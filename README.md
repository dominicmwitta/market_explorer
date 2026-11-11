# DSE Explorer

Data pipeline and analytics toolkit for the **Dar es Salaam Stock Exchange (DSE)**.
Collects daily equity and ETF price data from the official DSE daily market report PDFs and provides analysis tools and an interactive dashboard.

## What it does

- **PDF download** - Opens the latest daily market report on [dse.co.tz](https://dse.co.tz/) in a headless browser (Playwright) and saves the PDF.
- **PDF extraction** - Parses downloaded PDF reports with pdfplumber to extract equity and ETF daily prices into CSV.
- **Daily pipeline** - Runs the full workflow (PDF download + extract + upsert into Postgres + alerts) in one command.
- **Stock analysis** - Calculates performance metrics (returns, volatility, Sharpe ratio, momentum, liquidity) and generates a text report.
- **Technical indicators** - SMA, EMA, RSI, MACD, and Bollinger Bands computed per stock.
- **Order book analysis** - Bid/offer ratio and buy/sell pressure categorization.
- **Volume spike detection** - Flags stocks with volume exceeding 2x their average.
- **Market breadth** - Advance/decline ratio, percent of stocks with positive returns, percent above period average.
- **Correlation matrix** - Cross-stock daily return correlations.
- **Sector grouping** - Stocks grouped into Banking, Manufacturing, Agriculture, Telecommunications, Insurance, Investment, Services, and ETFs.
- **Backtesting** - Simple momentum strategy backtest with portfolio tracking.
- **Watchlist** - Personal stock watchlist stored as JSON with CLI management.
- **Price alerts** - Configurable above/below price alerts with automatic checking in the pipeline.
- **Excel export** - Multi-sheet Excel report (openpyxl).
- **Automated scheduling** - Windows Task Scheduler integration for daily pipeline runs.
- **Interactive dashboard** - Streamlit web app with 9 tabs: Performance, Price Trends, Returns Analysis, Volume Analysis, Stock Comparison, Technical Analysis, Market Intelligence, Sector Analysis, and Backtesting.

### Companies tracked

AFRIPRISE, CRDB, DCB, DSE, EABL, JATU, JHL, KA, KCB, MBP, MCB, MKCB, MUCOBA, NICO, NMB, NMG, PAL, SWALA, SWIS, TBL, TCC, TCCL, TOL, TPCC, TTP, USL, VODA, YETU, IEACLC-ETF, VERTEX-ETF, ZAN TIMIZA ETF

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

After installation, these CLI commands are available:

### dse-pipeline

Run the full daily pipeline: PDF download, PDF extraction, upsert into the database, and check price alerts.

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

### dse-watchlist

Manage your personal stock watchlist.

```bash
# Add a stock
dse-watchlist --add CRDB

# Remove a stock
dse-watchlist --remove CRDB

# List all stocks in the watchlist
dse-watchlist --list
```

Watchlist is stored in `watchlist.json` in the working directory.

### dse-alerts

Manage price alerts that trigger when a stock crosses a threshold.

```bash
# Add an alert
dse-alerts --add CRDB above 2500

# List all alerts
dse-alerts --list

# Check alerts against latest data
dse-alerts --check

# Remove an alert by index
dse-alerts --remove 0
```

Alerts are stored in `alerts.json`. They are also checked automatically at the end of `dse-pipeline`.

### dse-schedule

Set up automated daily pipeline runs using Windows Task Scheduler.

```bash
# Install a daily task at 18:00
dse-schedule --install

# Install at a custom time
dse-schedule --install --time 17:30

# Check current schedule status
dse-schedule --status

# Remove the scheduled task
dse-schedule --remove
```

### dse-backtest

Run a momentum backtesting strategy.

```bash
# Run with default settings (top 5 stocks)
dse-backtest

# Customize the number of stocks
dse-backtest --top-n 3

# Use a different data file
dse-backtest --data my_data.csv
```

### dse-create-shortcuts

Create a Windows desktop shortcut for quick access to the Dashboard.

```bash
dse-create-shortcuts
```

This places a **DSE Dashboard** shortcut on your Desktop that launches the Streamlit dashboard.

## Dashboard tabs

| Tab | Description |
|-----|-------------|
| Performance | Top/worst performers, risk-adjusted rankings |
| Price Trends | Price lines, normalized comparison |
| Returns Analysis | Return distribution, volatility scatter, momentum |
| Volume Analysis | Turnover rankings, treemap, daily trend |
| Stock Comparison | Side-by-side candlestick comparison |
| Technical Analysis | Candlestick with SMA/EMA, RSI, MACD, Bollinger Bands |
| Market Intelligence | Order book, volume spikes, breadth, correlation heatmap |
| Sector Analysis | Sector performance bar chart, treemap, comparison table |
| Backtesting | Momentum strategy with portfolio value chart |

The sidebar includes a watchlist filter toggle and company/price selectors. Triggered price alerts are shown at the top. Excel and CSV exports are available below the metrics table.

## Project structure

```
market_explorer/
  pyproject.toml          # Package metadata, dependencies, CLI entry points
  dse_explorer/
    __init__.py           # Package exports
    config.py             # Constants, sector map, company names
    data.py               # DataFrame operations and CSV output
    pipeline.py           # Daily pipeline orchestrator
    pdf_download.py       # Browser-based PDF downloader
    pdf_extract.py        # PDF-to-CSV extractor
    analyzer.py           # Stock performance analysis + Excel export
    indicators.py         # Technical indicators (SMA, EMA, RSI, MACD, Bollinger)
    watchlist.py          # Watchlist management (JSON + CLI)
    alerts.py             # Price alerts (JSON + CLI + checking)
    backtest.py           # Momentum backtesting engine
    scheduler.py          # Windows Task Scheduler integration
    dashboard.py          # Streamlit interactive dashboard (9 tabs)
    shortcuts.py          # Windows desktop shortcut creator
    logger.py             # Logging configuration
```

## Data files

| File | Description |
|------|-------------|
| `dse_equity_daily.csv` | Historical equity data (one-time source for `dse-db-migrate`) |
| `dse_reports/*.pdf` | Downloaded DSE daily market report PDFs |
| `reports/dse_equity_*.csv` | Per-date CSVs extracted from PDF reports |
| `logs/dse_explorer_*.log` | Daily log files |
| `watchlist.json` | Personal stock watchlist |
| `alerts.json` | Price alert configuration |
| `dse_report.xlsx` | Excel export (generated on demand) |

## License

This project is for educational and personal use.
