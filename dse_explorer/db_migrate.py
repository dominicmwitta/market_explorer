"""One-time backfill: create schema and load dse_equity_daily.csv into Postgres.

Usage: dse-db-migrate [--csv path/to/file.csv]
"""

import argparse
from pathlib import Path

import pandas as pd

from dse_explorer.db import create_schema, get_engine, upsert_companies, upsert_prices
from dse_explorer.pipeline import _normalize_companies


def main():
    parser = argparse.ArgumentParser(description="Backfill dse_equity_daily.csv into Postgres")
    parser.add_argument("--csv", default="dse_equity_daily.csv", help="Path to source CSV")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    engine = get_engine()

    create_schema(engine)
    print("Schema ensured.")

    df = pd.read_csv(csv_path)
    df = _normalize_companies(df)

    tickers = set(df["Company"].unique())
    upsert_companies(engine, tickers, sync_known=True)
    print(f"Seeded {len(tickers)} companies.")

    n = upsert_prices(engine, df, source="backfill")
    print(f"Upserted {n} price rows.")


if __name__ == "__main__":
    main()
