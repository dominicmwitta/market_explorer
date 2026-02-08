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
