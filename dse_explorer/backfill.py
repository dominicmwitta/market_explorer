"""Historical data backfill: scrape ALL available report URLs."""

import argparse
import os

import pandas as pd

from dse_explorer import get_homepage, find_daily_report_urls
from dse_explorer.scraper import close_browser
from dse_explorer.scrape import scrape_report
from dse_explorer.logger import get_logger

log = get_logger()


def backfill(output_file: str = "dse_equity_daily.csv") -> pd.DataFrame | None:
    """Scrape every available daily report URL and merge into a master CSV."""
    log.info("Starting historical backfill")

    try:
        soup = get_homepage()
        if not soup:
            log.error("Failed to fetch DSE homepage")
            return None

        urls = find_daily_report_urls(soup)
        if not urls:
            log.error("No daily report URLs found")
            return None

        log.info(f"Found {len(urls)} report(s) to backfill")

        # Load existing data
        if os.path.exists(output_file):
            existing = pd.read_csv(output_file)
            log.info(f"Loaded {len(existing)} existing rows")
        else:
            existing = pd.DataFrame()

        all_dfs = [existing] if not existing.empty else []

        for i, url in enumerate(urls, 1):
            log.info(f"[{i}/{len(urls)}] Scraping report...")
            df = scrape_report(url)
            if df is not None and not df.empty:
                all_dfs.append(df)

        if not all_dfs:
            log.warning("No data scraped during backfill")
            return None

        merged = pd.concat(all_dfs, ignore_index=True)
        merged = merged.drop_duplicates(subset=["Date", "Company"], keep="last")
        merged = merged.sort_values(["Date", "Company"]).reset_index(drop=True)

        merged.to_csv(output_file, index=False)
        log.info(f"Backfill complete: {len(merged)} rows saved to {output_file}")
        return merged

    except Exception as e:
        log.exception(f"Backfill failed: {e}")
        return None

    finally:
        close_browser()


def main():
    parser = argparse.ArgumentParser(description="DSE Historical Data Backfill")
    parser.add_argument("--output", "-o", default="dse_equity_daily.csv",
                        help="Output CSV file")

    args = parser.parse_args()
    result = backfill(args.output)

    if result is not None:
        print(f"Backfill complete: {len(result)} total rows")
    else:
        print("Backfill failed. Check logs for details.")
        return 1
    return 0


if __name__ == "__main__":
    exit(main())
