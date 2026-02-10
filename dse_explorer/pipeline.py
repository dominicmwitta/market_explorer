"""Composed DSE data pipeline: scraper -> PDF fallback -> compare -> merge."""

import os
import pandas as pd

from dse_explorer.logger import get_logger
from dse_explorer.equity_scraper import scrape_equity_table
from dse_explorer.pdf_extract import extract_equity_prices

OUTPUT_FILE = "dse_equity_daily.csv"
COMPARE_COLUMNS = [
    "Opening_Price", "Closing_Price", "High", "Low",
    "Turnover", "Deals", "Outstanding_Bids", "Outstanding_Offers",
    "Volume", "Market_Cap",
]

log = get_logger()


# ------------------------------------------------------------------
# Step 0: Equity Table (fastest — plain HTML table on homepage)
# ------------------------------------------------------------------
def try_equity_table():
    """Scrape today's data from the #equity table on the DSE homepage."""
    log.info("--- Step 0: Equity Table ---")
    try:
        df = scrape_equity_table()
        if df is None or df.empty:
            log.warning("Equity table: no data extracted")
            return None
        log.info(f"Equity table: extracted {len(df)} rows")
        return df
    except Exception as e:
        log.exception(f"Equity table failed: {e}")
        return None


# ------------------------------------------------------------------
# Step 1: Web Scraper
# ------------------------------------------------------------------
SCRAPER_TIMEOUT = 120  # seconds before giving up on the scraper


def _run_scraper():
    """Inner scraper logic (runs inside thread for timeout control)."""
    from dse_explorer import get_homepage, find_daily_report_urls
    from dse_explorer.scraper import close_browser
    from dse_explorer.scrape import scrape_report

    try:
        soup = get_homepage()
        if not soup:
            log.warning("Scraper: failed to fetch DSE homepage")
            return None

        urls = find_daily_report_urls(soup)
        if not urls:
            log.warning("Scraper: no daily report URLs found")
            return None

        log.info(f"Scraper: found {len(urls)} report(s), using latest")
        df = scrape_report(urls[0])
        if df is None or df.empty:
            log.warning("Scraper: returned empty data")
            return None

        log.info(f"Scraper: extracted {len(df)} rows")
        return df

    except Exception as e:
        log.exception(f"Scraper failed: {e}")
        return None

    finally:
        close_browser()


def try_scraper():
    """Attempt to scrape today's data from the DSE website."""
    log.info("--- Step 1: Web Scraper ---")
    return _run_scraper()


# ------------------------------------------------------------------
# Step 2: PDF Extraction
# ------------------------------------------------------------------
def try_pdf():
    """Download and extract today's PDF report."""
    log.info("--- Step 2: PDF Extraction ---")
    try:
        from dse_explorer.pdf_download import fetch_latest_dse_report

        success = fetch_latest_dse_report()
        if not success:
            log.warning("PDF: download failed")
            return None

        df = extract_equity_prices()  # uses latest PDF in dse_reports/
        if df is None or df.empty:
            log.warning("PDF: extraction returned empty data")
            return None

        log.info(f"PDF: extracted {len(df)} rows")
        return df

    except Exception as e:
        log.exception(f"PDF pipeline failed: {e}")
        return None


# ------------------------------------------------------------------
# Step 3: Compare & Merge
# ------------------------------------------------------------------
def compare_sources(scraper_df, pdf_df):
    """Compare row-by-row and log mismatches. Returns merged DataFrame."""
    log.info("--- Step 3: Comparing Sources ---")

    scraper_companies = set(scraper_df["Company"])
    pdf_companies = set(pdf_df["Company"])

    common = scraper_companies & pdf_companies
    only_scraper = scraper_companies - pdf_companies
    only_pdf = pdf_companies - scraper_companies

    if only_scraper:
        log.info(f"Companies only in scraper: {sorted(only_scraper)}")
    if only_pdf:
        log.info(f"Companies only in PDF: {sorted(only_pdf)}")

    mismatches = 0
    for company in sorted(common):
        s_row = scraper_df[scraper_df["Company"] == company].iloc[0]
        p_row = pdf_df[pdf_df["Company"] == company].iloc[0]

        for col in COMPARE_COLUMNS:
            s_val = s_row[col]
            p_val = p_row[col]
            if s_val != p_val:
                log.warning(
                    f"  {company} {col}: scraper={s_val} vs pdf={p_val} MISMATCH"
                )
                mismatches += 1

    if mismatches == 0:
        log.info(f"All {len(common)} common companies match perfectly")
    else:
        log.warning(f"{mismatches} value mismatches across {len(common)} companies")

    # Prefer PDF; supplement with scraper-only companies
    if only_scraper:
        extra = scraper_df[scraper_df["Company"].isin(only_scraper)]
        merged = pd.concat([pdf_df, extra], ignore_index=True)
    else:
        merged = pdf_df.copy()

    return merged


def pick_best(equity_df, scraper_df, pdf_df):
    """Choose or merge data from whichever sources succeeded.

    Priority: equity table > PDF > scraper (for compare/merge logic,
    the equity table is treated like the scraper result when both it
    and PDF are available).
    """
    # If equity table succeeded, use it as the primary web source
    web_df = equity_df if equity_df is not None else scraper_df

    both = web_df is not None and pdf_df is not None
    web_only = web_df is not None and pdf_df is None
    pdf_only = pdf_df is not None and web_df is None

    if both:
        return compare_sources(web_df, pdf_df)
    elif pdf_only:
        log.info("Using PDF data (web sources unavailable)")
        return pdf_df
    elif web_only:
        log.info("Using web data (PDF unavailable)")
        return web_df
    else:
        log.error("All sources failed — no data to save")
        return None


# ------------------------------------------------------------------
# Step 4: Update Master CSV
# ------------------------------------------------------------------
def update_master_csv(new_df):
    """Append new data to master CSV, deduplicating by Date+Company."""
    log.info("--- Step 4: Updating Master CSV ---")

    if os.path.exists(OUTPUT_FILE):
        existing = pd.read_csv(OUTPUT_FILE)
        log.info(f"Loaded {len(existing)} existing rows from {OUTPUT_FILE}")
        combined = pd.concat([existing, new_df], ignore_index=True)
    else:
        combined = new_df.copy()

    before = len(combined)
    combined = combined.drop_duplicates(subset=["Date", "Company"], keep="last")
    combined = combined.sort_values(["Date", "Company"]).reset_index(drop=True)
    after = len(combined)

    if before != after:
        log.info(f"Deduplication: {before} -> {after} rows")

    combined.to_csv(OUTPUT_FILE, index=False)
    log.info(f"Saved {after} rows to {OUTPUT_FILE}")
    return combined


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    log.info("=" * 60)
    log.info("DSE Daily Pipeline Started")
    log.info("=" * 60)

    errors = []
    source = "none"

    # Step 0 — fastest path: plain HTML table
    equity_df = try_equity_table()

    # Step 1 — full-page scraper (only if equity table missed)
    scraper_df = None
    if equity_df is None:
        scraper_df = try_scraper()

    # Close Playwright from prior steps so pdf_download can start its own
    from dse_explorer.scraper import close_browser
    close_browser()

    # Step 2 — PDF fallback
    pdf_df = try_pdf()

    # Determine which source label to report
    web_df = equity_df if equity_df is not None else scraper_df
    if web_df is not None and pdf_df is not None:
        source = ("equity-table" if equity_df is not None else "scraper") + "+PDF"
    elif web_df is not None:
        source = "equity-table" if equity_df is not None else "scraper"
    elif pdf_df is not None:
        source = "PDF"
    else:
        errors.append("All sources (equity table, scraper, PDF) failed")

    result = pick_best(equity_df, scraper_df, pdf_df)
    if result is None:
        # Notify failure and exit
        try:
            from dse_explorer.notifier import notify_pipeline_result
            notify_pipeline_result(False, {
                "source": source,
                "rows_scraped": 0,
                "total_rows": 0,
                "errors": errors,
            })
        except Exception as e:
            log.debug(f"Email notification skipped: {e}")
        return

    rows_scraped = len(result)
    final = update_master_csv(result)
    print(final.to_string())

    # Check price alerts
    triggered = []
    try:
        from dse_explorer.alerts import check_alerts
        triggered = check_alerts(final)
        for alert in triggered:
            log.warning(
                f"ALERT: {alert['company']} is {alert['condition']} "
                f"{alert['price']} (current: {alert['current_price']:.2f})"
            )
    except Exception as e:
        log.debug(f"Alert check skipped: {e}")

    # Email triggered alerts
    if triggered:
        try:
            from dse_explorer.notifier import notify_alerts
            notify_alerts(triggered)
        except Exception as e:
            log.debug(f"Alert email skipped: {e}")

    log.info("DSE Daily Pipeline Completed")

    # Send pipeline summary email
    try:
        from dse_explorer.notifier import notify_pipeline_result
        notify_pipeline_result(True, {
            "source": source,
            "rows_scraped": rows_scraped,
            "total_rows": len(final),
            "alerts_triggered": len(triggered),
            "errors": errors,
        })
    except Exception as e:
        log.debug(f"Email notification skipped: {e}")


if __name__ == "__main__":
    main()
