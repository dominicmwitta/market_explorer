"""Configuration constants for DSE scraper."""

BASE_URL = "https://dse.co.tz/"

COMPANY_NAMES = [
    'AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'JATU', 'JHL', 'KA', 'KCB',
    'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'NMG', 'PAL', 'SWALA',
    'SWIS', 'TBL', 'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VODA', 'YETU',
    'ITRUST ETF', 'VERTEX ETF'
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
    # Verified against each company's official profile at dse.co.tz/listed/company/profile
    "Banking": ["CRDB", "DCB", "KCB", "MBP", "MCB", "MKCB", "MUCOBA", "NMB", "YETU"],
    "Aviation": ["KA", "PAL", "SWIS"],  # Kenya Airways, Precision Air, Swissport Tanzania
    "Manufacturing": ["TBL", "TCC", "TCCL", "TPCC", "TOL", "TTP", "EABL"],
    "Telecommunications": ["VODA"],
    "Investment": ["DSE", "JHL", "NICO", "AFRIPRISE"],
    "Energy": ["SWALA"],  # Swala Gas and Oil (oil & gas exploration)
    "Media": ["NMG"],  # Nation Media Group
    "Retail": ["USL"],  # Uchumi Supermarkets
    "Agriculture": ["JATU"],
    "ETFs": ["ITRUST ETF", "VERTEX ETF"],
}


def get_sector(company: str) -> str:
    """Return the sector name for a given company ticker."""
    for sector, companies in SECTOR_MAP.items():
        if company in companies:
            return sector
    return "Unknown"
