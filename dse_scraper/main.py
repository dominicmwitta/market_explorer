"""Entry point and orchestration for DSE scraper."""

import argparse
import os

from .config import REPORTS_DIR
from .scraper import get_homepage, find_daily_report_urls
from .parser import extract_equity_data, parse_equity_row, extract_report_date
from .data import deduplicate_rows, create_dataframe, save_to_csv


def ensure_reports_dir():
    """Create reports directory if it doesn't exist."""
    if not os.path.exists(REPORTS_DIR):
        os.makedirs(REPORTS_DIR)


def process_report(url, output_file='dse_equity_daily.csv'):
    """Full pipeline for processing one report.

    Args:
        url: URL of the daily report page
        output_file: Path to output CSV file

    Returns:
        pandas DataFrame with equity data, or None if no data found
    """
    print(f"Fetching: {url}")

    report_date = extract_report_date(url)
    print(f"Report date: {report_date}")

    raw_rows = extract_equity_data(url)
    print(f"Found {len(raw_rows)} raw company rows")

    if not raw_rows:
        print("No data found")
        return None

    dedup_rows = deduplicate_rows(raw_rows)
    print(f"After deduplication: {len(dedup_rows)} companies")

    parsed_rows = []
    for row in dedup_rows:
        parsed = parse_equity_row(row)
        if parsed['numbers']:
            parsed_rows.append(parsed)

    df = create_dataframe(parsed_rows, report_date)
    save_to_csv(df, output_file)
    print(df.to_string())
    return df


def list_report_urls():
    """List available daily report URLs from DSE homepage.

    Returns:
        List of report URLs
    """
    soup = get_homepage()
    if not soup:
        print("Failed to fetch DSE homepage")
        return []

    urls = find_daily_report_urls(soup)
    if urls:
        print(f"Found {len(urls)} daily report URLs:")
        for i, url in enumerate(urls, 1):
            print(f"  {i}. {url}")
    else:
        print("No daily report URLs found")
    return urls


def main():
    """CLI entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Scrape equity data from DSE (Dar es Salaam Stock Exchange)'
    )
    parser.add_argument(
        '--url',
        help='Specific report URL to process'
    )
    parser.add_argument(
        '--output', '-o',
        default='dse_equity_daily.csv',
        help='Output CSV file path (default: dse_equity_daily.csv)'
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        dest='list_urls',
        help='List available report URLs and exit'
    )

    args = parser.parse_args()

    ensure_reports_dir()

    if args.list_urls:
        list_report_urls()
        return

    if args.url:
        process_report(args.url, args.output)
    else:
        soup = get_homepage()
        if not soup:
            print("Failed to fetch DSE homepage")
            return

        urls = find_daily_report_urls(soup)
        if urls:
            print(f"Found {len(urls)} daily report URLs")
            # Process the most recent report (index 0)
            process_report(urls[0], args.output)
        else:
            print("No daily report URLs found")


if __name__ == "__main__":
    main()
