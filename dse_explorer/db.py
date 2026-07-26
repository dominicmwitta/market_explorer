"""Shared database access for DSE Explorer (Postgres/Neon).

Holds the connection, schema management, and the read/write helpers used by
every part of the app (pipeline writer, dashboard, analyzer, backtester) so
there is exactly one place that knows the daily_prices/companies schema.
"""

import os
from functools import lru_cache
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from psycopg2.extras import execute_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from dse_explorer.config import SECTOR_MAP, EXCLUDED_TICKERS, get_sector, get_full_name

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"

# Historical CSV column names <-> daily_prices column names.
CSV_TO_DB_COLUMNS = {
    "Date": "date",
    "Company": "company",
    "Opening_Price": "opening_price",
    "Closing_Price": "closing_price",
    "High": "high",
    "Low": "low",
    "Turnover": "turnover",
    "Deals": "deals",
    "Outstanding_Bids": "outstanding_bids",
    "Outstanding_Offers": "outstanding_offers",
    "Volume": "volume",
    "Market_Cap": "market_cap",
}
DAILY_PRICES_COLUMNS = list(CSV_TO_DB_COLUMNS.values()) + ["source"]

# Reverse mapping, used to alias DB columns back to the names the rest of the
# codebase (analyzer.py, dashboard.py, backtest.py) already expects.
_SELECT_COLUMNS = ", ".join(
    f'dp.{db_col}::float8 AS "{csv_col}"' if db_col not in ("date", "company", "deals")
    else f'dp.{db_col} AS "{csv_col}"'
    for csv_col, db_col in CSV_TO_DB_COLUMNS.items()
)


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Return a shared SQLAlchemy engine for the DATABASE_URL connection.

    Cached so every caller in the process reuses the same connection pool.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to a .env file in the project "
            "root (DATABASE_URL=postgresql://...) or export it in the environment."
        )
    return create_engine(url, pool_pre_ping=True)


def create_schema(engine: Engine) -> None:
    """Execute schema.sql statement by statement (idempotent)."""
    statements = [s.strip() for s in SCHEMA_FILE.read_text().split(";") if s.strip()]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def upsert_companies(engine: Engine, tickers: set[str], sync_known: bool = False) -> None:
    """Ensure every ticker has a companies row.

    With sync_known=True (used by the one-time backfill), tickers found in
    SECTOR_MAP have their sector/active flag re-synced from config on every
    call. Otherwise (the daily pipeline path) existing rows are left alone —
    only brand-new tickers get inserted — so a manual `active` toggle in the
    database isn't silently overwritten by the next scrape.
    """
    known = {t for tickers_ in SECTOR_MAP.values() for t in tickers_}
    rows = [(t, get_sector(t), t not in EXCLUDED_TICKERS, get_full_name(t)) for t in tickers]

    conflict_clause = (
        "DO UPDATE SET sector = EXCLUDED.sector, active = EXCLUDED.active, full_name = EXCLUDED.full_name"
        if sync_known else "DO NOTHING"
    )

    with engine.begin() as conn:
        raw = conn.connection
        with raw.cursor() as cur:
            if sync_known:
                execute_values(
                    cur,
                    f"""
                    INSERT INTO companies (ticker, sector, active, full_name)
                    VALUES %s
                    ON CONFLICT (ticker) {conflict_clause}
                    """,
                    rows,
                )
            else:
                # Only insert tickers that aren't already known/seeded.
                new_rows = [r for r in rows if r[0] not in known]
                if new_rows:
                    execute_values(
                        cur,
                        f"""
                        INSERT INTO companies (ticker, sector, active, full_name)
                        VALUES %s
                        ON CONFLICT (ticker) {conflict_clause}
                        """,
                        new_rows,
                    )


def upsert_prices(engine: Engine, df: pd.DataFrame, source: str | None = None) -> int:
    """Upsert rows into daily_prices. df must use the original CSV column names."""
    df = df.rename(columns=CSV_TO_DB_COLUMNS)
    df["deals"] = df["deals"].astype("Int64")
    df["source"] = source
    df = df[DAILY_PRICES_COLUMNS]
    df = df.where(pd.notna(df), None)
    # psycopg2 has no adapter for numpy scalar types (e.g. numpy.int64 from the
    # nullable Int64 "deals" column), so coerce everything to plain Python types.
    df["deals"] = df["deals"].map(lambda v: int(v) if v is not None else None)

    rows = list(df.itertuples(index=False, name=None))
    if not rows:
        return 0
    columns = ", ".join(DAILY_PRICES_COLUMNS)

    with engine.begin() as conn:
        raw = conn.connection
        with raw.cursor() as cur:
            execute_values(
                cur,
                f"""
                INSERT INTO daily_prices ({columns})
                VALUES %s
                ON CONFLICT (company, date) DO UPDATE SET
                    opening_price = EXCLUDED.opening_price,
                    closing_price = EXCLUDED.closing_price,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    turnover = EXCLUDED.turnover,
                    deals = EXCLUDED.deals,
                    outstanding_bids = EXCLUDED.outstanding_bids,
                    outstanding_offers = EXCLUDED.outstanding_offers,
                    volume = EXCLUDED.volume,
                    market_cap = EXCLUDED.market_cap,
                    source = EXCLUDED.source
                """,
                rows,
                page_size=500,
            )
    return len(rows)


def read_daily_prices(engine: Engine, active_only: bool = True) -> pd.DataFrame:
    """Load daily_prices (joined to companies) with the original CSV column names."""
    where_clause = "WHERE c.active" if active_only else ""
    query = f"""
        SELECT {_SELECT_COLUMNS}
        FROM daily_prices dp
        JOIN companies c ON c.ticker = dp.company
        {where_clause}
        ORDER BY dp.company, dp.date
    """
    return pd.read_sql(text(query), engine)
