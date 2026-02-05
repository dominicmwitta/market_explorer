"""Simple script to scrape DSE equity data using the dse_scraper package."""

from dse_scraper import get_homepage, find_daily_report_urls, process_report


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

    print(f"Found {len(urls)} daily reports")

    # Process the most recent report
    df = process_report(urls[0])

    if df is not None:
        print(f"\nSuccessfully scraped {len(df)} companies")


if __name__ == "__main__":
    main()
