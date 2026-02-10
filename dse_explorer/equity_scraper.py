"""Scrape the #equity HTML table from the DSE homepage."""

import argparse
import os
import re
from datetime import datetime

import pandas as pd

from .config import BASE_URL, COLUMN_NAMES
from .scraper import fetch_page
from .logger import get_logger

log = get_logger()

OUTPUT_FILE = "dse_equity_daily.csv"

# Maps the equity table header text to our COLUMN_NAMES schema.
# Headers not listed here are skipped (Prev Close, Change).
_HEADER_MAP = {
    "symbol": "Company",
    "open": "Opening_Price",
    "close": "Closing_Price",
    "high": "High",
    "low": "Low",
    "turn over": "Turnover",
    "deals": "Deals",
    "out standing bid": "Outstanding_Bids",
    "out standing offer": "Outstanding_Offers",
    "volume": "Volume",
    "mcap (tzs 'b)": "Market_Cap",
}


def _parse_number(text):
    """Convert a table cell string like '1,234.56' to a float."""
    text = text.strip().replace(",", "")
    if not text or text == "-":
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _extract_market_date(soup):
    """Extract the report date from the 'Market Summary' heading.

    The DSE homepage has a structure like:
        <h5>Market Summary :</h5>
        <h5>February 09, 2026</h5>

    Returns:
        Date string in 'YYYY-MM-DD' format, or *None* if not found.
    """
    for tag in soup.find_all(string=re.compile(r"Market Summary", re.I)):
        # The date is in the next sibling <h5> element
        date_tag = tag.parent.find_next_sibling()
        if date_tag:
            date_text = date_tag.get_text(strip=True)
            try:
                dt = datetime.strptime(date_text, "%B %d, %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


def _find_equity_table(soup):
    """Locate the equity <table> on the DSE homepage.

    Prefers ``#equity-watch`` (includes ETFs) over ``#equity`` (equities only).
    """
    # Prefer #equity-watch (equities + ETFs)
    for section_id in ("equity-watch", "equity"):
        section = soup.find(id=section_id)
        if section:
            table = section.find("table")
            if table:
                return table

    # Fallback: look for a table whose header row contains "Symbol"
    for table in soup.find_all("table"):
        header_row = table.find("tr")
        if header_row and header_row.get_text(strip=True).lower().startswith("symbol"):
            return table

    return None


def scrape_equity_table(soup=None):
    """Parse the #equity table from DSE homepage soup.

    Args:
        soup: BeautifulSoup of the homepage (fetched if *None*).

    Returns:
        pandas DataFrame with columns matching ``COLUMN_NAMES``,
        or *None* on failure.
    """
    if soup is None:
        log.info("Fetching DSE homepage for equity table…")
        soup = fetch_page(BASE_URL)
        if soup is None:
            log.error("Failed to fetch DSE homepage")
            return None

    table = _find_equity_table(soup)
    if table is None:
        log.warning("Equity table not found on homepage")
        return None

    rows = table.find_all("tr")
    if len(rows) < 2:
        log.warning("Equity table has no data rows")
        return None

    # --- Build column index map from header row ---
    header_cells = rows[0].find_all(["th", "td"])
    col_index = {}  # our_column_name -> position in row
    for i, cell in enumerate(header_cells):
        header_text = cell.get_text(strip=True).lower()
        mapped = _HEADER_MAP.get(header_text)
        if mapped:
            col_index[mapped] = i

    if "Company" not in col_index:
        log.warning("Could not find 'Symbol' column in equity table header")
        return None

    log.debug(f"Equity table column mapping: {col_index}")

    # --- Extract report date from Market Summary ---
    report_date = _extract_market_date(soup)
    if report_date is None:
        log.warning("Could not extract date from Market Summary")
        return None

    # --- Parse data rows ---
    _TICKER_RE = re.compile(r'^[A-Z][A-Z0-9]+([ -][A-Z][A-Z0-9]*)*$')
    records = []

    for tr in rows[1:]:
        cells = tr.find_all("td")
        if len(cells) < len(col_index):
            continue

        symbol = cells[col_index["Company"]].get_text(strip=True).upper()
        if not _TICKER_RE.match(symbol):
            continue

        record = {"Date": report_date, "Company": symbol}
        for col_name, idx in col_index.items():
            if col_name == "Company":
                continue
            record[col_name] = _parse_number(cells[idx].get_text(strip=True))

        records.append(record)

    if not records:
        log.warning("No recognised company rows in equity table")
        return None

    df = pd.DataFrame(records, columns=COLUMN_NAMES)
    # Fill any columns that weren't in the table with 0
    df = df.fillna(0)
    df = df.sort_values("Company").reset_index(drop=True)

    log.info(f"Equity table: extracted {len(df)} companies for {report_date}")
    return df


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Scrape the DSE homepage equity table"
    )
    parser.add_argument(
        "-o", "--output", help="Save output to a CSV file"
    )
    parser.add_argument(
        "--merge", action="store_true",
        help=f"Merge into master {OUTPUT_FILE}"
    )
    args = parser.parse_args()

    df = scrape_equity_table()
    if df is None or df.empty:
        log.error("No data extracted")
        return

    print(df.to_string(index=False))

    if args.output:
        df.to_csv(args.output, index=False)
        print(f"\nSaved {len(df)} rows to {args.output}")

    if args.merge:
        if os.path.exists(OUTPUT_FILE):
            existing = pd.read_csv(OUTPUT_FILE)
            combined = pd.concat([existing, df], ignore_index=True)
        else:
            combined = df.copy()

        combined = combined.drop_duplicates(
            subset=["Date", "Company"], keep="last"
        )
        combined = combined.sort_values(
            ["Date", "Company"]
        ).reset_index(drop=True)

        combined.to_csv(OUTPUT_FILE, index=False)
        print(f"Merged into {OUTPUT_FILE} ({len(combined)} total rows)")


if __name__ == "__main__":
    main()
