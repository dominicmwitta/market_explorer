"""HTTP requests and URL discovery for DSE scraper."""

import re
import requests
from bs4 import BeautifulSoup

from .config import BASE_URL

# Try to import Playwright for JavaScript rendering
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# Module-level browser instance for reuse
_browser = None
_playwright = None


def get_browser():
    """Get or create a reusable browser instance."""
    global _browser, _playwright

    if not PLAYWRIGHT_AVAILABLE:
        return None

    if _browser is None:
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)

    return _browser


def close_browser():
    """Close the browser instance when done."""
    global _browser, _playwright

    if _browser:
        _browser.close()
        _browser = None
    if _playwright:
        _playwright.stop()
        _playwright = None


def fetch_page_playwright(url):
    """Fetch a page using Playwright (handles JavaScript rendering).

    Args:
        url: URL to fetch

    Returns:
        BeautifulSoup object or None if request failed
    """
    try:
        browser = get_browser()
        if not browser:
            return None

        page = browser.new_page()
        page.goto(url, wait_until='networkidle', timeout=30000)

        # Wait for content to render
        page.wait_for_timeout(1000)

        # Get the fully rendered HTML
        content = page.content()
        page.close()

        return BeautifulSoup(content, 'html.parser')

    except Exception as e:
        print(f"Playwright error fetching {url}: {e}")
        return None


def fetch_page_requests(url):
    """Fetch a page using requests (simple HTTP, no JavaScript).

    Args:
        url: URL to fetch

    Returns:
        BeautifulSoup object or None if request failed
    """
    try:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            print(f"Failed to fetch {url} with status code: {response.status_code}")
            return None
        return BeautifulSoup(response.content, 'html.parser')
    except Exception as e:
        print(f"Requests error fetching {url}: {e}")
        return None


def fetch_page(url, use_playwright=None):
    """Fetch a page and return BeautifulSoup object.

    Uses Playwright by default if available (handles JavaScript rendering).
    Falls back to requests if Playwright fails or is unavailable.

    Args:
        url: URL to fetch
        use_playwright: Force Playwright (True), requests (False), or auto (None)

    Returns:
        BeautifulSoup object or None if request failed
    """
    # Determine which method to use
    if use_playwright is True:
        return fetch_page_playwright(url)
    elif use_playwright is False:
        return fetch_page_requests(url)

    # Auto mode: try Playwright first, fall back to requests
    if PLAYWRIGHT_AVAILABLE:
        result = fetch_page_playwright(url)
        if result:
            return result
        print("Playwright failed, falling back to requests...")

    return fetch_page_requests(url)


def find_daily_report_urls(soup):
    """Extract daily report URLs from homepage soup.

    Args:
        soup: BeautifulSoup object of DSE homepage

    Returns:
        List of daily report URLs
    """
    divs = soup.find_all('div', class_='ms-2')
    urls = []

    for div in divs:
        a_tag = div.find('a')
        if a_tag and a_tag.get('href') and re.search('daily', a_tag['href']):
            urls.append(a_tag['href'])

    return urls


def get_homepage():
    """Fetch and parse DSE homepage.

    Returns:
        BeautifulSoup object or None if request failed
    """
    return fetch_page(BASE_URL)
