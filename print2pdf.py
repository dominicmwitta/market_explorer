# pip install playwright
# playwright install   # run once in terminal

import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Config
OUTPUT_DIR = Path("dse_reports")
OUTPUT_DIR.mkdir(exist_ok=True)

HOMEPAGE = "https://www.dse.co.tz/"
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
            page.goto(HOMEPAGE, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(4000)

            print("Step 2: Locating latest Market Report 'View' link...")
            view_links = page.get_by_role("link", name="View", exact=True).all()

            if not view_links:
                print("Error: No 'View' links found.")
                page.screenshot(path=str(DEBUG_SCREENSHOT))
                return False

            latest_view_link = view_links[0]
            href = latest_view_link.get_attribute("href")
            print(f"  Found link: {href}")

            print("Step 3: Navigating to report...")

            report_page = page
            try:
                with context.expect_page(timeout=5000) as new_page_info:
                    latest_view_link.click()
                report_page = new_page_info.value
                report_page.wait_for_load_state("networkidle", timeout=30000)
                print("  Report opened in new tab.")
            except (PlaywrightTimeoutError, Exception):
                page.wait_for_load_state("networkidle", timeout=30000)
                print("  Report loaded on same page.")

            report_page.wait_for_timeout(5000)

            # Save screenshot for verification
            report_page.screenshot(path=str(DEBUG_SCREENSHOT), full_page=True)
            print(f"  Screenshot saved: {DEBUG_SCREENSHOT}")

            print("Step 4: Removing anti-print protections...")
            report_page.evaluate("""() => {
                // Remove <style media="print"> tags that hide content
                document.querySelectorAll('style[media="print"]').forEach(s => s.remove());

                // Remove inline @media print rules from remaining stylesheets
                for (const sheet of document.styleSheets) {
                    try {
                        const rules = sheet.cssRules || sheet.rules;
                        for (let i = rules.length - 1; i >= 0; i--) {
                            const rule = rules[i];
                            if (rule.type === CSSRule.MEDIA_RULE &&
                                rule.conditionText === 'print') {
                                sheet.deleteRule(i);
                            }
                        }
                    } catch(e) { /* cross-origin stylesheet, skip */ }
                }

                // Also remove the Ctrl+P blocking script effect
                document.body.style.display = '';
                document.body.style.visibility = 'visible';

                // Make sure all page content boxes are visible for print
                document.querySelectorAll('.pc').forEach(el => {
                    el.style.display = 'block';
                });
            }""")

            # Override with a permissive print style
            report_page.add_style_tag(content="""
                @media print {
                    * { visibility: visible !important; }
                    body { display: block !important; }
                    .pf, .pc, .pi, #page-container { display: block !important; }
                }
            """)

            print("Step 5: Generating PDF...")
            report_page.pdf(
                path=str(PDF_TEMP),
                format="A4",
                landscape=True,
                print_background=True,
                margin={"top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm"},
                scale=0.88,
            )

            size = PDF_TEMP.stat().st_size
            if size < 5000:
                print(f"  WARNING: PDF is only {size} bytes — may be empty.")
                PDF_TEMP.unlink(missing_ok=True)
                return False

            # Atomic replace: temp -> final (overwrites even if locked)
            PDF_TEMP.replace(PDF_FILENAME)
            print(f"Success! PDF saved -> {PDF_FILENAME} ({size:,} bytes)")
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


if __name__ == "__main__":
    success = fetch_latest_dse_report()
    if not success:
        print("Failed to fetch today's report. Check screenshot and try again later.")
