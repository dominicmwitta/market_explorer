"""Historical data backfill: scrape ALL available report URLs."""

import argparse
import os
from pathlib import Path

import pandas as pd

from dse_explorer import get_homepage, find_daily_report_urls
from dse_explorer.scraper import close_browser
from dse_explorer.scrape import scrape_report
from dse_explorer.pipeline import _normalize_companies
from dse_explorer.logger import get_logger

log = get_logger()

PDF_DIR = Path("dse_reports")
PDF_DIR.mkdir(exist_ok=True)

# Anti-print JS injected into each report page before PDF generation
_UNBLOCK_JS = """() => {
    document.querySelectorAll('style[media="print"]').forEach(s => s.remove());
    for (const sheet of document.styleSheets) {
        try {
            const rules = sheet.cssRules || sheet.rules;
            for (let i = rules.length - 1; i >= 0; i--) {
                const rule = rules[i];
                if (rule.type === CSSRule.MEDIA_RULE && rule.conditionText === 'print') {
                    sheet.deleteRule(i);
                }
            }
        } catch(e) {}
    }
    document.body.style.display = '';
    document.body.style.visibility = 'visible';
    document.querySelectorAll('.pc').forEach(el => { el.style.display = 'block'; });
}"""

_PRINT_CSS = """
@media print {
    * { visibility: visible !important; }
    body { display: block !important; }
    .pf, .pc, .pi, #page-container { display: block !important; }
}
"""


def _pdf_from_url(url: str, dest: Path) -> bool:
    """Open a report URL with Playwright and save it as a PDF.

    Returns True on success, False on failure.
    """
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    tmp = dest.with_suffix(".tmp.pdf")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    viewport={"width": 1440, "height": 900},
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/132.0.0.0 Safari/537.36"
                    ),
                    locale="en-US",
                    timezone_id="Africa/Dar_es_Salaam",
                    ignore_https_errors=True,
                )
                context.add_init_script(
                    "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
                )
                page = context.new_page()
                log.info(f"  Opening: {url[:80]}")
                page.goto(url, wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(4000)
                page.evaluate(_UNBLOCK_JS)
                page.add_style_tag(content=_PRINT_CSS)
                page.pdf(
                    path=str(tmp),
                    format="A4",
                    landscape=True,
                    print_background=True,
                    margin={"top": "10mm", "bottom": "10mm",
                            "left": "10mm", "right": "10mm"},
                    scale=0.88,
                )
            finally:
                browser.close()

        size = tmp.stat().st_size
        if size < 5000:
            log.warning(f"  PDF too small ({size} bytes) — skipping")
            tmp.unlink(missing_ok=True)
            return False

        tmp.replace(dest)
        log.info(f"  Saved PDF ({size:,} bytes) -> {dest.name}")
        return True

    except Exception as e:
        log.error(f"  PDF generation failed: {e}")
        tmp.unlink(missing_ok=True)
        return False


def pdf_backfill(output_file: str = "dse_equity_daily.csv") -> pd.DataFrame | None:
    """For every available historical report URL: download PDF, extract, merge."""
    from dse_explorer.pdf_extract import extract_equity_prices

    log.info("Starting PDF backfill")

    try:
        soup = get_homepage()
        if not soup:
            log.error("Failed to fetch DSE homepage")
            return None

        urls = find_daily_report_urls(soup)
        if not urls:
            log.error("No daily report URLs found on homepage")
            return None

        log.info(f"Found {len(urls)} report URL(s) on homepage")

        # Close the module-level Playwright browser opened by get_homepage()
        # before starting fresh per-URL Playwright instances in _pdf_from_url.
        close_browser()

        # Load existing data so we can skip already-covered dates
        if os.path.exists(output_file):
            existing = pd.read_csv(output_file)
            existing = _normalize_companies(existing)
            existing_dates = set(existing["Date"].unique())
            log.info(f"Loaded {len(existing)} existing rows covering {len(existing_dates)} date(s)")
        else:
            existing = pd.DataFrame()
            existing_dates = set()

        all_dfs = [existing] if not existing.empty else []

        for i, url in enumerate(urls, 1):
            log.info(f"[{i}/{len(urls)}] Processing URL: {url[:80]}")

            # Derive a temporary filename; date will be determined from PDF content
            tmp_name = PDF_DIR / f"_backfill_tmp_{i}.pdf"

            if not _pdf_from_url(url, tmp_name):
                log.warning(f"  Skipping URL {i} — PDF download failed")
                continue

            df = extract_equity_prices(str(tmp_name))
            if df is None or df.empty:
                log.warning(f"  No data extracted from PDF {i}")
                tmp_name.unlink(missing_ok=True)
                continue

            report_date = df["Date"].iloc[0]
            # Rename temp file to the proper dated filename
            dated_name = PDF_DIR / f"DSE_Daily_Report_{report_date}.pdf"
            try:
                tmp_name.replace(dated_name)
            except Exception:
                tmp_name.unlink(missing_ok=True)

            if report_date in existing_dates:
                log.info(f"  Date {report_date} already in CSV — skipping merge")
                continue

            df = _normalize_companies(df)
            log.info(f"  Extracted {len(df)} rows for {report_date}")
            all_dfs.append(df)
            existing_dates.add(report_date)

        if not all_dfs:
            log.warning("No new data extracted during PDF backfill")
            return None

        merged = pd.concat(all_dfs, ignore_index=True)
        merged = merged.drop_duplicates(subset=["Date", "Company"], keep="last")
        merged = merged.sort_values(["Date", "Company"]).reset_index(drop=True)
        merged.to_csv(output_file, index=False)

        log.info(f"PDF backfill complete: {len(merged)} rows saved to {output_file}")
        return merged

    except Exception as e:
        log.exception(f"PDF backfill failed: {e}")
        return None


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
    parser.add_argument("--pdf", action="store_true",
                        help="Use PDF pipeline instead of HTML scraper")

    args = parser.parse_args()

    if args.pdf:
        result = pdf_backfill(args.output)
    else:
        result = backfill(args.output)

    if result is not None:
        print(f"Backfill complete: {len(result)} total rows")
    else:
        print("Backfill failed. Check logs for details.")
        return 1
    return 0


if __name__ == "__main__":
    exit(main())
