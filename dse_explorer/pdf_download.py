# pip install playwright
# playwright install   # run once in terminal

import base64
import datetime
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

# Config
OUTPUT_DIR = Path("dse_reports")
OUTPUT_DIR.mkdir(exist_ok=True)

HOMEPAGE = "https://dse.co.tz/"
TODAY = datetime.date.today().strftime("%Y-%m-%d")
PDF_FILENAME = OUTPUT_DIR / f"DSE_Daily_Report_{TODAY}.pdf"
PDF_TEMP = OUTPUT_DIR / f"DSE_Daily_Report_{TODAY}.tmp.pdf"
DEBUG_SCREENSHOT = OUTPUT_DIR / f"debug_{TODAY}.png"


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

        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
        """)

        page = context.new_page()

        try:
            print("Step 1: Loading DSE homepage...")
            page.goto(HOMEPAGE, wait_until="load", timeout=30000)
            page.wait_for_timeout(2000)

            print("Step 2: Locating latest Market Report 'View' link...")
            view_links = page.get_by_role("link", name="View", exact=True).all()

            if not view_links:
                print("Error: No 'View' links found.")
                page.screenshot(path=str(DEBUG_SCREENSHOT))
                return False

            href = view_links[0].get_attribute("href")
            if not href:
                print("Error: 'View' link has no href.")
                return False

            report_url = urljoin(page.url, href)
            report_id = report_url.rstrip("/").rsplit("/", 1)[-1]
            print(f"  Found report: {report_url}")

            # The daily report is now rendered as an embedded PDF viewer
            # (Next.js app). Visiting the report page first establishes
            # whatever session/referer state the API route checks, then we
            # pull the original PDF straight from its API endpoint instead
            # of re-rendering the page to PDF (which is lossy and was timing
            # out on networkidle due to the SPA's background requests).
            print("Step 3: Opening report page...")
            page.goto(report_url, wait_until="load", timeout=30000)
            page.wait_for_timeout(2000)

            print("Step 4: Fetching source PDF via API...")
            api_url = urljoin(report_url, f"/api/daily-report/{report_id}")
            result = page.evaluate(
                """async (url) => {
                    const res = await fetch(url);
                    if (!res.ok) {
                        return {ok: false, status: res.status};
                    }
                    const buf = await res.arrayBuffer();
                    const bytes = new Uint8Array(buf);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return {ok: true, data: btoa(binary)};
                }""",
                api_url,
            )

            if not result.get("ok"):
                print(f"Error: PDF API returned status {result.get('status')}")
                page.screenshot(path=str(DEBUG_SCREENSHOT))
                return False

            pdf_bytes = base64.b64decode(result["data"])

            if len(pdf_bytes) < 5000:
                print(f"  WARNING: PDF is only {len(pdf_bytes)} bytes — may be empty.")
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
