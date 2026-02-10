"""Extract Equity Daily Prices from DSE Market Report PDF to CSV."""

import re
import sys
import datetime
from pathlib import Path

import pdfplumber
import pandas as pd

# Directories
PDF_DIR = Path("dse_reports")
OUTPUT_DIR = Path("reports")
OUTPUT_DIR.mkdir(exist_ok=True)

EQUITY_COLUMNS = [
    "Date", "Company", "Opening_Price", "Closing_Price", "High", "Low",
    "Turnover", "Deals", "Outstanding_Bids", "Outstanding_Offers",
    "Volume", "Market_Cap",
]

_TICKER_RE = re.compile(r'^[A-Z][A-Z0-9-]+$')


def find_latest_pdf():
    """Find the most recent DSE_Daily_Report PDF."""
    pdfs = sorted(PDF_DIR.glob("DSE_Daily_Report_*.pdf"), reverse=True)
    if not pdfs:
        print(f"No PDF reports found in {PDF_DIR}/")
        return None
    return pdfs[0]


def extract_report_date(pdf):
    """Pull the report date from the PDF text."""
    for page in pdf.pages:
        text = page.extract_text() or ""
        m = re.search(r"DATE:\s*(\d{1,2})-(\w+)-(\d{4})", text)
        if m:
            day, month, year = m.group(1), m.group(2), m.group(3)
            return datetime.datetime.strptime(
                f"{day}-{month}-{year}", "%d-%B-%Y"
            ).strftime("%Y-%m-%d")
        m = re.search(
            r"(\d{1,2})\s*(?:st|nd|rd|th)?\s+"
            r"(January|February|March|April|May|June|July|"
            r"August|September|October|November|December)\s+"
            r"(\d{4})",
            text,
        )
        if m:
            day, month, year = m.group(1), m.group(2), m.group(3)
            return datetime.datetime.strptime(
                f"{day}-{month}-{year}", "%d-%B-%Y"
            ).strftime("%Y-%m-%d")
    return datetime.date.today().strftime("%Y-%m-%d")


def find_section_pages(pdf, section_title):
    """Find page indices that contain a given section title."""
    pages = []
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        if section_title in text:
            pages.append(i)
    return pages


def clean_number(val):
    """Convert '6,663,929,540' or '132.16' to a number."""
    val = val.strip().replace(",", "")
    if not val or val == "-":
        return 0
    if "." in val:
        return float(val)
    return int(val)


def parse_data_line(line):
    """Parse a single line like 'AFRIPRISE 840 905 950 860 229,184,220 ...'
    Returns (company, [10 numbers]) or None."""
    line = line.strip()
    if not line:
        return None

    # Match company ticker at start of line
    # Absorb trailing uppercase-only words into the ticker name
    # (e.g. "ITRUST ETF 1200 ..." -> company="ITRUST ETF")
    parts = line.split()
    if len(parts) < 2:
        return None
    if not _TICKER_RE.match(parts[0]):
        return None
    name_parts = [parts[0]]
    idx = 1
    while idx < len(parts) and re.match(r'^[A-Z]+$', parts[idx]):
        name_parts.append(parts[idx])
        idx += 1
    company = ' '.join(name_parts)
    rest = ' '.join(parts[idx:])

    if not rest:
        return None

    # Extract all numbers (integers with commas, or decimals)
    nums = re.findall(r"[\d,]+\.?\d*", rest)
    cleaned = []
    for n in nums:
        cleaned.append(clean_number(n))

    if len(cleaned) < 10:
        return None

    return company, cleaned[:10]


def extract_prices_from_text(pdf, page_indices):
    """Extract price data by parsing text lines from given pages."""
    records = []
    seen = set()

    for idx in page_indices:
        page = pdf.pages[idx]
        text = page.extract_text() or ""

        for line in text.split("\n"):
            result = parse_data_line(line)
            if result and result[0] not in seen:
                company, nums = result
                seen.add(company)
                records.append((company, nums))

    return records


def extract_equity_prices(pdf_path=None):
    """Main extraction: PDF -> equity + ETF daily prices CSV."""
    if pdf_path is None:
        pdf_path = find_latest_pdf()
    else:
        pdf_path = Path(pdf_path)

    if not pdf_path or not pdf_path.exists():
        print("PDF not found.")
        return None

    print(f"Reading: {pdf_path}")

    with pdfplumber.open(pdf_path) as pdf:
        report_date = extract_report_date(pdf)
        print(f"Report date: {report_date}")

        # --- EQUITY DAILY PRICES ---
        equity_pages = find_section_pages(pdf, "EQUITY DAILY PRICES")
        if not equity_pages:
            print("Could not find 'EQUITY DAILY PRICES' section.")
            return None

        # Table spans header page + next page with data
        equity_page_set = set()
        for p in equity_pages:
            equity_page_set.add(p)
            if p + 1 < len(pdf.pages):
                equity_page_set.add(p + 1)
        equity_page_list = sorted(equity_page_set)
        print(f"Equity pages: {[p+1 for p in equity_page_list]}")

        equity_data = extract_prices_from_text(pdf, equity_page_list)
        print(f"  Found {len(equity_data)} equity rows")

        # --- ETF DAILY PRICES ---
        etf_pages = find_section_pages(pdf, "ETF DAILY PRICES")
        etf_data = []
        if etf_pages:
            etf_page_set = set()
            for p in etf_pages:
                etf_page_set.add(p)
                if p + 1 < len(pdf.pages):
                    etf_page_set.add(p + 1)
            etf_page_list = sorted(etf_page_set)
            print(f"ETF pages: {[p+1 for p in etf_page_list]}")

            etf_data = extract_prices_from_text(pdf, etf_page_list)
            print(f"  Found {len(etf_data)} ETF rows")

        # Build DataFrame
        all_data = equity_data + etf_data
        if not all_data:
            print("No data rows extracted.")
            return None

        rows = []
        for company, nums in all_data:
            # PDF column order:
            # 0:Opening 1:Closing 2:High 3:Low 4:Turnover
            # 5:Deals 6:OutstandingBids 7:OutstandingOffers 8:Volume 9:MarketCap
            rows.append({
                "Date": report_date,
                "Company": company,
                "Opening_Price": nums[0],
                "Closing_Price": nums[1],
                "High": nums[2],
                "Low": nums[3],
                "Turnover": nums[4],
                "Deals": nums[5],
                "Outstanding_Bids": nums[6],
                "Outstanding_Offers": nums[7],
                "Volume": nums[8],
                "Market_Cap": nums[9],
            })

        df = pd.DataFrame(rows, columns=EQUITY_COLUMNS)
        df = df.sort_values("Company").reset_index(drop=True)

        print(f"\nExtracted {len(df)} companies for {report_date}")
        print(df.to_string(index=False))
        return df


def main():
    pdf_file = sys.argv[1] if len(sys.argv) > 1 else None
    extract_equity_prices(pdf_file)


if __name__ == "__main__":
    main()
