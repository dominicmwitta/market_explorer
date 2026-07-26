"""Configuration constants for DSE scraper."""

BASE_URL = "https://dse.co.tz/"

COMPANY_NAMES = [
    'AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'JATU', 'JHL', 'KA', 'KCB',
    'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'NMG', 'PAL', 'SWALA',
    'SWIS', 'TBL', 'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VODA', 'YETU',
    'IEACLC-ETF', 'VERTEX-ETF'
]

COLUMN_NAMES = [
    'Date', 'Company', 'Opening_Price', 'Closing_Price', 'High', 'Low',
    'Turnover', 'Deals', 'Outstanding_Bids', 'Outstanding_Offers', 'Volume', 'Market_Cap'
]

REPORTS_DIR = 'reports'

# Tickers excluded from analysis/reporting (e.g. suspended or non-trading
# stocks that would otherwise distort metrics with flat, zero-volume rows).
EXCLUDED_TICKERS = ['JATU']

SECTOR_MAP = {
    "Banking": ["CRDB", "DCB", "KCB", "MCB", "MKCB", "MUCOBA", "NMB", "YETU"],
    "Manufacturing": ["TBL", "TCC", "TCCL", "TPCC"],
    "Agriculture": ["KA", "MBP"],
    "Telecommunications": ["VODA"],
    "Insurance": ["NICO"],
    "Investment": ["DSE", "SWALA", "SWIS", "NMG", "JHL"],
    "Services": ["AFRIPRISE", "JATU", "PAL", "TOL", "TTP", "USL", "EABL"],
    "ETFs": ["IEACLC-ETF", "VERTEX-ETF"],
}


def get_sector(company: str) -> str:
    """Return the sector name for a given company ticker."""
    for sector, companies in SECTOR_MAP.items():
        if company in companies:
            return sector
    return "Unknown"
