"""DSE Scraper - Modular package for scraping Dar es Salaam Stock Exchange data."""

from .config import BASE_URL, COMPANY_NAMES, COLUMN_NAMES, REPORTS_DIR
from .scraper import fetch_page, find_daily_report_urls, get_homepage
from .parser import extract_equity_data, parse_equity_row, extract_report_date
from .data import deduplicate_rows, create_dataframe, save_to_csv
from .main import process_report, list_report_urls, main
from .logger import get_logger

__all__ = [
    # Config
    'BASE_URL',
    'COMPANY_NAMES',
    'COLUMN_NAMES',
    'REPORTS_DIR',
    # Scraper
    'fetch_page',
    'find_daily_report_urls',
    'get_homepage',
    # Parser
    'extract_equity_data',
    'parse_equity_row',
    'extract_report_date',
    # Data
    'deduplicate_rows',
    'create_dataframe',
    'save_to_csv',
    # Main
    'process_report',
    'list_report_urls',
    'main',
    # Logger
    'get_logger',
]
