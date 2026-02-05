"""Script to scrape all DSE equity data and merge into a single CSV."""

import os
import pandas as pd

from dse_scraper import (
    get_homepage,
    find_daily_report_urls,
    extract_equity_data,
    extract_report_date,
    parse_equity_row,
    deduplicate_rows,
    create_dataframe,
)

OUTPUT_FILE = 'dse_equity_daily.csv'


def scrape_report(url):
    """Scrape a single report and return DataFrame."""
    print(f"  Fetching: {url[:60]}...")

    report_date = extract_report_date(url)
    raw_rows = extract_equity_data(url)

    if not raw_rows:
        print(f"    No data found")
        return None

    dedup_rows = deduplicate_rows(raw_rows)
    parsed_rows = [parse_equity_row(r) for r in dedup_rows if parse_equity_row(r)['numbers']]
    df = create_dataframe(parsed_rows, report_date)

    print(f"    Found {len(df)} companies for {report_date}")
    return df


def main():
    print("Fetching DSE homepage...")
    soup = get_homepage()

    if not soup:
        print("Failed to fetch DSE homepage")
        return

    urls = find_daily_report_urls(soup)

    if not urls:
        print("No daily report URLs found")
        return

    print(f"Found {len(urls)} daily reports\n")

    # Load existing data if file exists
    if os.path.exists(OUTPUT_FILE):
        existing_df = pd.read_csv(OUTPUT_FILE)
        print(f"Loaded {len(existing_df)} existing rows from {OUTPUT_FILE}")
    else:
        existing_df = pd.DataFrame()

    # Scrape all reports
    all_dfs = [existing_df] if not existing_df.empty else []

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}]", end="")
        df = scrape_report(url)
        if df is not None and not df.empty:
            all_dfs.append(df)

    if not all_dfs:
        print("\nNo data scraped")
        return

    # Merge all DataFrames
    merged_df = pd.concat(all_dfs, ignore_index=True)
    print(f"\nTotal rows before deduplication: {len(merged_df)}")

    # Remove duplicates based on Date + Company
    merged_df = merged_df.drop_duplicates(subset=['Date', 'Company'], keep='last')
    merged_df = merged_df.sort_values(['Date', 'Company']).reset_index(drop=True)

    print(f"Total rows after deduplication: {len(merged_df)}")

    # Save to CSV
    merged_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")
    print(merged_df.to_string())


if __name__ == "__main__":
    main()
