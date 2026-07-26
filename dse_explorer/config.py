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


# Full legal/trading names, verified against each company's official profile
# at dse.co.tz/listed/company/profile. Tickers not listed here (e.g. the
# ETFs, which sit under a different section of the site) fall back to
# displaying the ticker itself rather than a guessed name.
COMPANY_FULL_NAMES = {
    "AFRIPRISE": "Afriprise Investment PLC",
    "CRDB": "CRDB Bank PLC",
    "DCB": "DCB Commercial Bank PLC",
    "DSE": "Dar es Salaam Stock Exchange PLC",
    "EABL": "East African Breweries Limited",
    "JATU": "JATU PLC",
    "JHL": "Jubilee Holdings Limited",
    "KA": "Kenya Airways Limited",
    "KCB": "KCB Group PLC",
    "MBP": "Maendeleo Bank PLC",
    "MCB": "Mwalimu Commercial Bank PLC",
    "MKCB": "Mkombozi Commercial Bank PLC",
    "MUCOBA": "Mufindi Community Bank Limited",
    "NICO": "National Investment Company Limited",
    "NMB": "NMB Bank PLC",
    "NMG": "Nation Media Group PLC",
    "PAL": "Precision Air Services PLC",
    "SWALA": "Swala Oil & Gas (Tanzania) PLC",
    "SWIS": "Swissport Tanzania PLC",
    "TBL": "Tanzania Breweries PLC",
    "TCC": "Tanzania Cigarette Company Limited",
    "TCCL": "Tanga Cement PLC",
    "TOL": "TOL Gases Limited",
    "TPCC": "Tanzania Portland Cement PLC",
    "TTP": "TOL Gases Limited",
    "USL": "Uchumi Supermarkets Limited",
    "VODA": "Vodacom Tanzania PLC",
    "YETU": "Yetu Microfinance Bank PLC",
}


def get_full_name(company: str) -> str:
    """Return the full company name for a ticker, falling back to the ticker itself."""
    return COMPANY_FULL_NAMES.get(company, company)
