# pip install playwright
# playwright install   # run once in terminal

"""Download the latest DSE Daily Market Report PDF.

The DSE site (redesigned Nov 2026) links each report as
"Daily Market Report <date>" -> /en/resources/research/investment-insights/<id>.
That page loads the real PDF from /api/daily-report/<id>, which only answers
requests made from the page itself (direct requests get 403), so we open the
page in a browser and save the PDF response it receives.
"""

import datetime
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

# Config
OUTPUT_DIR = Path("dse_reports")
OUTPUT_DIR.mkdir(exist_ok=True)

HOMEPAGE = "https://dse.co.tz/en"
REPORTS_PAGE = "https://dse.co.tz/en/resources/research/investment-insights"
TODAY = datetime.date.today().strftime("%Y-%m-%d")
PDF_FILENAME = OUTPUT_DIR / f"DSE_Daily_Report_{TODAY}.pdf"
PDF_TEMP = OUTPUT_DIR / f"DSE_Daily_Report_{TODAY}.tmp.pdf"
DEBUG_SCREENSHOT = OUTPUT_DIR / f"debug_{TODAY}.png"

_REPORT_LINK_RE = re.compile(r"Daily Market Report\s+(.+)", re.I)


def _parse_link_date(text):
    """Parse the date in a link like 'Daily Market Report 10 Nov 2026'."""
    m = _REPORT_LINK_RE.search(text)
    if not m:
        return None
    date_text = " ".join(m.group(1).split())
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.datetime.strptime(date_text, fmt).date()
        except ValueError:
            continue
    return None


def _find_latest_report_url(page):
    """Return (date, absolute URL) of the newest daily report linked on the page."""
    links = page.eval_on_selector_all(
        "a[href*='/investment-insights/']",
        "els => els.map(a => [a.innerText, a.href])",
    )
    dated = []
    for text, href in links:
        d = _parse_link_date(text)
        if d:
            dated.append((d, href))
    return max(dated) if dated else None


def fetch_latest_dse_report():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
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
        page = context.new_page()

        try:
            latest = None
            for url in (HOMEPAGE, REPORTS_PAGE):
                print(f"Step 1: Looking for Daily Market Report links on {url}")
                # The homepage keeps background requests open, so "networkidle"
                # never fires; wait for the report links to render instead.
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_selector(
                        "a[href*='/investment-insights/']", timeout=30000
                    )
                except Exception as e:
                    print(f"  Could not load links from {url}: {e}")
                    continue
                latest = _find_latest_report_url(page)
                if latest:
                    break

            if not latest:
                print("Error: No 'Daily Market Report' links found.")
                page.screenshot(path=str(DEBUG_SCREENSHOT), full_page=True)
                return False

            report_date, report_url = latest
            print(f"  Latest report: {report_date} -> {report_url}")

            print("Step 2: Opening report page and capturing the PDF...")
            with page.expect_response(
                lambda r: "/api/daily-report/" in r.url
                and r.status == 200
                and "application/pdf" in r.headers.get("content-type", ""),
                timeout=60000,
            ) as resp_info:
                page.goto(report_url, wait_until="domcontentloaded", timeout=60000)
            pdf_bytes = resp_info.value.body()

            if len(pdf_bytes) < 5000 or not pdf_bytes.startswith(b"%PDF"):
                print(f"  WARNING: response is not a valid PDF ({len(pdf_bytes)} bytes).")
                return False

            PDF_TEMP.write_bytes(pdf_bytes)
            # Atomic replace: temp -> final (overwrites even if locked)
            PDF_TEMP.replace(PDF_FILENAME)
            print(f"Success! PDF saved -> {PDF_FILENAME} ({len(pdf_bytes):,} bytes)")
            return True

        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path=str(DEBUG_SCREENSHOT), full_page=True)
                print(f"Debug screenshot: {DEBUG_SCREENSHOT}")
            except Exception:
                pass
            return False

        finally:
            browser.close()


def main():
    success = fetch_latest_dse_report()
    if not success:
        print("Failed to fetch today's report. Check screenshot and try again later.")


if __name__ == "__main__":
    main()
