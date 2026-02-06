"""HTML parsing and data extraction for DSE scraper."""

import re
import datetime

from .config import COMPANY_NAMES
from .scraper import fetch_page


def extract_equity_data(url):
    """Extract equity table from PDF-converted HTML.

    The HTML uses CSS positioning and spans to fragment numbers as anti-scraping.
    Example: "1<span>1,1<span>10" visually renders as "11,110"

    Solution: Use get_text() which combines fragments correctly, then split on whitespace.

    Args:
        url: URL of the daily report page

    Returns:
        List of dicts with 'company', 'raw', and 'values' keys
    """
    soup = fetch_page(url)
    if not soup:
        return []

    # Find all divs with class containing 't' (text rows)
    text_divs = soup.find_all('div', class_=lambda x: x and 't' in x.split() if x else False)

    all_rows = []
    for div in text_divs:
        # Use get_text() to properly combine fragmented text
        full_text = div.get_text()

        # Split on whitespace to get tokens
        tokens = full_text.split()

        if not tokens:
            continue

        # First token should be company name
        first_token = tokens[0]

        for company in COMPANY_NAMES:
            if first_token == company:
                # Get remaining tokens as potential values
                value_tokens = tokens[1:]

                # Filter to only numeric values (integers with commas or decimals)
                numeric_values = []
                for v in value_tokens:
                    v = v.strip()
                    # Match: digits with optional commas and optional decimal part
                    if v and re.match(r'^[\d,]+(\.\d+)?$', v):
                        numeric_values.append(v)

                if numeric_values:
                    raw_text = full_text.strip()
                    all_rows.append({
                        'company': company,
                        'raw': raw_text,
                        'values': numeric_values
                    })
                break

    return all_rows


def parse_equity_row(row_data):
    """Parse row data into numeric fields.

    Uses space-separated values when available (from HTML extraction).
    Falls back to regex parsing for concatenated strings.

    Expected column order from DSE website:
    Company, Open, Close, High, Low, Turnover, Deals, Volume, MarketCap, OutBids, OutOffers

    Output order expected by data.py:
    Open, Close, High, Low, Turnover, Deals, OutBids, OutOffers, Volume, MarketCap

    Args:
        row_data: Dict with 'company', 'raw', and optionally 'values' keys

    Returns:
        Dict with 'company', 'numbers', and 'raw' keys
    """
    company = row_data['company']
    raw = row_data['raw']

    # If we have pre-split values, use the simple parsing path
    if 'values' in row_data and row_data['values']:
        return parse_from_values(row_data)

    # Fallback: parse concatenated string (legacy path)
    return parse_concatenated(row_data)


def parse_from_values(row_data):
    """Parse pre-split values from HTML extraction.

    DOM order (how values appear in HTML):
        0: Opening, 1: Closing, 2: High, 3: Low, 4: Turnover, 5: Deals,
        6: Volume, 7: MarketCap, 8: OutBids, 9: OutOffers

    Output order (matching COLUMN_NAMES in config.py):
        0: Opening, 1: Closing, 2: High, 3: Low, 4: Turnover, 5: Deals,
        6: OutBids, 7: OutOffers, 8: Volume, 9: MarketCap
    """
    company = row_data['company']
    raw = row_data['raw']
    values = row_data['values']

    def parse_value(val_str):
        """Convert string value to number, handling commas and decimals."""
        clean = val_str.replace(',', '')
        if '.' in clean:
            return float(clean)
        return int(clean)

    # Parse all string values to numbers
    parsed = []
    for v in values:
        try:
            parsed.append(parse_value(v))
        except ValueError:
            continue

    # Reorder from DOM order to output order
    if len(parsed) >= 10:
        numbers = [
            parsed[0],  # Opening_Price
            parsed[1],  # Closing_Price
            parsed[2],  # High
            parsed[3],  # Low
            parsed[4],  # Turnover
            parsed[5],  # Deals
            parsed[8],  # Outstanding_Bids (DOM index 8)
            parsed[9],  # Outstanding_Offers (DOM index 9)
            parsed[6],  # Volume (DOM index 6)
            parsed[7],  # Market_Cap (DOM index 7)
        ]
    else:
        # Partial data - use as-is
        numbers = parsed

    return {'company': company, 'numbers': numbers, 'raw': raw}


def parse_concatenated(row_data):
    """Parse concatenated string without spaces (legacy fallback).

    This handles older HTML where values are concatenated together.
    """
    company = row_data['company']
    raw = row_data['raw']
    data_str = raw[len(company):]

    numbers = []

    # Check for non-traded stock pattern (5+ consecutive zeros)
    no_trade_match = re.search(r'0{5,}', data_str)

    if no_trade_match:
        # Non-traded stock: parse opening/closing then add zeros
        zero_start = no_trade_match.start()
        before_zeros = data_str[:zero_start]

        # Extract two prices from digits before zeros
        digits = re.sub(r'[^0-9]', '', before_zeros)
        if digits:
            # Try repeated pattern (same open/close for no-trade)
            for i in range(2, len(digits) // 2 + 1):
                first = digits[:i]
                second = digits[i:2*i]
                if first == second and first[0] != '0':
                    numbers.extend([int(first), int(second)])
                    break
            else:
                # Try simple split
                if len(digits) >= 4:
                    mid = len(digits) // 2
                    numbers.extend([int(digits[:mid]), int(digits[mid:])])

        # Add zeros for High, Low, Turnover, etc.
        numbers.extend([0] * len(no_trade_match.group()))

        # Parse after zeros for remaining fields
        after_zeros = data_str[no_trade_match.end():]
        for m in re.finditer(r'(\d+\.\d+)|([1-9]\d*)', after_zeros):
            if m.group(1):
                numbers.append(float(m.group(1)))
            else:
                numbers.append(int(m.group(2)))
    else:
        # Traded stock: extract comma-formatted numbers
        comma_pattern = r'[1-9]\d{0,2}(?:,\d{3})+'
        comma_matches = list(re.finditer(comma_pattern, data_str))

        if comma_matches:
            # Get positions of comma numbers
            for match in comma_matches:
                numbers.append(int(match.group().replace(',', '')))

        # Also look for plain integers and decimals not covered by comma pattern
        remaining = data_str
        for match in reversed(comma_matches):
            remaining = remaining[:match.start()] + ' ' + remaining[match.end():]

        for m in re.finditer(r'(\d+\.\d+)|([1-9]\d+)', remaining):
            if m.group(1):
                numbers.append(float(m.group(1)))
            elif m.group(2):
                val = int(m.group(2))
                if val not in numbers:  # Avoid duplicates
                    numbers.append(val)

    return {'company': company, 'numbers': numbers, 'raw': raw}


def extract_report_date(url):
    """Extract the report date from the page.

    Args:
        url: URL of the daily report page

    Returns:
        Date string in format 'DD-Month-YYYY'
    """
    soup = fetch_page(url)
    if not soup:
        return datetime.datetime.now().strftime('%d-%B-%Y')

    text = soup.get_text()
    date_match = re.search(r'DATE:\s*(\d{1,2}[-/]\w+[-/]\d{4})', text)
    if date_match:
        return date_match.group(1)

    # Alternative: look for month names
    months = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December']
    for month in months:
        pattern = rf'(\d{{1,2}})[^\d]*{month}[^\d]*(\d{{4}})'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{month}-{match.group(2)}"

    return datetime.datetime.now().strftime('%d-%B-%Y')
