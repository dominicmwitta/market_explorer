# DSE Explorer

Scraper and analytics toolkit for the **Dar es Salaam Stock Exchange (DSE)**.
Collects daily equity and ETF price data from the DSE website, extracts data from PDF market reports, and provides analysis tools and an interactive dashboard.

## What it does

- **Web scraping** - Fetches daily equity price reports from [dse.co.tz](https://dse.co.tz/) using Playwright (JavaScript rendering) with a requests fallback.
- **PDF download** - Automates browser-based download of the official DSE daily market report PDF, bypassing anti-print protections.
- **PDF extraction** - Parses downloaded PDF reports with pdfplumber to extract equity and ETF daily prices into CSV.
- **Daily pipeline** - Runs the full workflow (scrape + PDF download + extract + compare + merge) in one command, deduplicating against existing data.
- **Stock analysis** - Calculates performance metrics (returns, volatility, Sharpe ratio, momentum, liquidity) and generates a text report.
- **Interactive dashboard** - Streamlit web app with charts for price trends, performance rankings, returns analysis, volume breakdowns, and stock comparison.

### Companies tracked

AFRIPRISE, CRDB, DCB, DSE, EABL, JATU, JHL, KA, KCB, MBP, MCB, MKCB, MUCOBA, NICO, NMB, NMG, PAL, SWALA, SWIS, TBL, TCC, TCCL, TOL, TPCC, TTP, USL, VODA, YETU, IEACLC-ETF, VERTEX-ETF

## Requirements

- Python >= 3.10
- Chromium browser for Playwright (installed separately, see below)

## Installation

```bash
# Clone the repository
git clone https://github.com/dominicmwitta/market_explorer.git
cd market_explorer

# Install the package (editable mode recommended for development)
pip install -e .

# Install the Playwright Chromium browser (required for scraping and PDF download)
playwright install chromium
```

For a non-editable install:

```bash
pip install .
```

### Install directly from GitHub

```bash
pip install git+https://github.com/dominicmwitta/market_explorer.git

# Then install the Playwright browser
playwright install chromium
```

## Uninstallation

```bash
pip uninstall dse-explorer
```

## Usage

After installation, six CLI commands are available:

### dse-scrape

Scrape equity data from the DSE website.

```bash
# List available daily report URLs
dse-scrape --list

# Scrape the latest report
dse-scrape

# Scrape a specific report URL
dse-scrape --url <report-url>

# Specify output file
dse-scrape --output my_data.csv
```

### dse-pipeline

Run the full daily pipeline: web scrape, PDF download, PDF extraction, source comparison, and merge into a master CSV.

```bash
dse-pipeline
```

### dse-pdf-download

Download today's DSE daily market report as a PDF.

```bash
dse-pdf-download
```

PDFs are saved to `dse_reports/`.

### dse-pdf-extract

Extract equity and ETF prices from a downloaded PDF report.

```bash
# Extract from the latest PDF in dse_reports/
dse-pdf-extract

# Extract from a specific PDF file
dse-pdf-extract path/to/report.pdf
```

CSVs are saved to `reports/`.

### dse-analyze

Generate a stock performance analysis report.

```bash
# Print report to console
dse-analyze

# Save report to a file
dse-analyze --output report.txt

# Use a different data file
dse-analyze --data my_data.csv

# Export metrics to CSV
dse-analyze --export-csv metrics.csv
```

### dse-dashboard

Launch the interactive Streamlit dashboard.

```bash
dse-dashboard
```

Opens in your browser at `http://localhost:8501`.

## Project structure

```
market_explorer/
  pyproject.toml          # Package metadata, dependencies, CLI entry points
  dse_explorer/
    __init__.py           # Package exports
    config.py             # Constants (base URL, company names, column names)
    scraper.py            # HTTP fetching (Playwright + requests)
    parser.py             # HTML parsing and anti-scraping CSS handling
    data.py               # DataFrame operations and CSV output
    main.py               # Single-report scraper CLI
    scrape.py             # Batch scraper (all reports)
    pipeline.py           # Daily pipeline orchestrator
    pdf_download.py       # Browser-based PDF downloader
    pdf_extract.py        # PDF-to-CSV extractor
    analyzer.py           # Stock performance analysis
    dashboard.py          # Streamlit interactive dashboard
    logger.py             # Logging configuration
```

## Output files

| File | Description |
|---|---|
| `dse_equity_daily.csv` | Master CSV with all scraped daily equity data |
| `dse_reports/*.pdf` | Downloaded DSE daily market report PDFs |
| `reports/dse_equity_*.csv` | Per-date CSVs extracted from PDF reports |
| `logs/dse_explorer_*.log` | Daily log files |

## License

This project is for educational and personal use.
