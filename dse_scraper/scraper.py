"""HTTP requests and URL discovery for DSE scraper."""

import re
import requests
from bs4 import BeautifulSoup

from .config import BASE_URL


def fetch_page(url):
    """Fetch a page and return BeautifulSoup object.

    Args:
        url: URL to fetch

    Returns:
        BeautifulSoup object or None if request failed
    """
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to fetch {url} with status code: {response.status_code}")
        return None
    return BeautifulSoup(response.content, 'html.parser')


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
