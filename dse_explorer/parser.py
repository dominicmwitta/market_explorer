"""HTML parsing and data extraction for DSE scraper."""

import re
import datetime
from bs4 import NavigableString, Tag

from .scraper import fetch_page

_TICKER_RE = re.compile(r'^[A-Z][A-Z0-9-]+$')


def parse_css_positions(soup):
    """Extract CSS position values from stylesheets.

    Parses margin-left and left properties to determine x-positions.

    Returns:
        Dict mapping class names to x-offset values
    """
    css_positions = {}

    for style in soup.find_all('style'):
        text = style.get_text()

        # Parse margin-left values (used for span offsets)
        for match in re.finditer(r'\.(_[a-z0-9]+)\s*\{\s*margin-left:\s*(-?[\d.]+)px', text, re.IGNORECASE):
            css_positions[match.group(1)] = float(match.group(2))

        # Parse left values (used for div base positions)
        for match in re.finditer(r'\.(x[a-z0-9]+)\s*\{\s*left:\s*(-?[\d.]+)px', text, re.IGNORECASE):
            css_positions[match.group(1)] = float(match.group(2))

    return css_positions


def extract_by_css_position(div, css_positions):
    """Extract text fragments sorted by CSS x-position.

    Fallback method when DOM order is randomized.

    Args:
        div: BeautifulSoup div element
        css_positions: Dict of CSS class -> x-offset

    Returns:
        List of text tokens sorted by visual x-position
    """
    # Get div's base x position
    div_classes = div.get('class', [])
    base_x = 0
    for cls in div_classes:
        if cls.startswith('x') and cls in css_positions:
            base_x = css_positions[cls]
            break

    # Extract fragments with their positions
    fragments = []
    current_offset = 0

    for child in div.children:
        if isinstance(child, NavigableString):
            text = str(child).strip()
            if text:
                x_pos = base_x + current_offset
                fragments.append((x_pos, text))
        elif isinstance(child, Tag) and child.name == 'span':
            # Get span's margin-left offset for next text
            for cls in child.get('class', []):
                if cls.startswith('_') and cls in css_positions:
                    current_offset = css_positions[cls]
                    break

    # Sort by x position
    fragments.sort(key=lambda x: x[0])

    # Merge adjacent fragments and extract tokens
    merged_text = ' '.join(text for _, text in fragments)
    return merged_text.split()


def validate_values(values, company):
    """Check if extracted values look valid.

    Returns True if values seem reasonable, False if suspicious.
    """
    if len(values) < 6:
        return False

    # Try to parse first few as prices
    try:
        prices = []
        for v in values[:4]:
            clean = v.replace(',', '')
            prices.append(float(clean))

        # Prices should be reasonable (1 to 100,000 TZS typically)
        for p in prices:
            if p < 0 or (p > 0 and p < 1) or p > 500000:
                return False

        # Opening and closing should be somewhat close (within 50%)
        if prices[0] > 0 and prices[1] > 0:
            ratio = max(prices[0], prices[1]) / min(prices[0], prices[1])
            if ratio > 2:  # More than 100% difference is suspicious
                return False

    except (ValueError, ZeroDivisionError):
        return False

    return True


def extract_equity_data(url):
    """Extract equity table from PDF-converted HTML.

    Uses two strategies to handle anti-scraping CSS techniques:
    1. Primary: get_text() which combines fragments in DOM order
    2. Fallback: Parse CSS positions and sort fragments by x-coordinate

    Args:
        url: URL of the daily report page

    Returns:
        List of dicts with 'company', 'raw', and 'values' keys
    """
    soup = fetch_page(url)
    if not soup:
        return []

    # Pre-parse CSS positions for fallback method
    css_positions = parse_css_positions(soup)

    # Find all divs with class containing 't' (text rows)
    text_divs = soup.find_all('div', class_=lambda x: x and 't' in x.split() if x else False)

    all_rows = []
    for div in text_divs:
        # Primary method: Use get_text() to combine fragmented text
        full_text = div.get_text()
        tokens = full_text.split()

        if not tokens:
            continue

        first_token = tokens[0]

        if _TICKER_RE.match(first_token):
            # Absorb trailing uppercase-only words into the company name
            # (e.g. "ITRUST" + "ETF" -> "ITRUST ETF")
            name_parts = [first_token]
            idx = 1
            while idx < len(tokens) and re.match(r'^[A-Z]+$', tokens[idx]):
                name_parts.append(tokens[idx])
                idx += 1
            company = ' '.join(name_parts)
            value_tokens = tokens[idx:]

            # Filter to only numeric values
            numeric_values = []
            for v in value_tokens:
                v = v.strip()
                if v and re.match(r'^[\d,]+(\.\d+)?$', v):
                    numeric_values.append(v)

            # Validate results - if suspicious, try CSS position fallback
            if not validate_values(numeric_values, company) and css_positions:
                # Fallback: extract by CSS x-position
                css_tokens = extract_by_css_position(div, css_positions)

                if css_tokens and css_tokens[0] == company:
                    css_value_tokens = css_tokens[1:]
                    css_numeric = []
                    for v in css_value_tokens:
                        v = v.strip()
                        if v and re.match(r'^[\d,]+(\.\d+)?$', v):
                            css_numeric.append(v)

                    # Use CSS method if it gives better results
                    if validate_values(css_numeric, company):
                        numeric_values = css_numeric
                        full_text = ' '.join(css_tokens)

            if numeric_values:
                raw_text = full_text.strip()
                all_rows.append({
                    'company': company,
                    'raw': raw_text,
                    'values': numeric_values
                })

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
        Date string in ISO format 'YYYY-MM-DD'
    """
    soup = fetch_page(url)
    if not soup:
        return datetime.datetime.now().strftime('%Y-%m-%d')

    text = soup.get_text()
    date_match = re.search(r'DATE:\s*(\d{1,2})[-/](\w+)[-/](\d{4})', text)
    if date_match:
        day, month, year = date_match.group(1), date_match.group(2), date_match.group(3)
        return datetime.datetime.strptime(f"{day}-{month}-{year}", '%d-%B-%Y').strftime('%Y-%m-%d')

    # Alternative: look for month names
    months = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December']
    for month in months:
        pattern = rf'(\d{{1,2}})[^\d]*{month}[^\d]*(\d{{4}})'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            day, year = match.group(1), match.group(2)
            return datetime.datetime.strptime(f"{day}-{month}-{year}", '%d-%B-%Y').strftime('%Y-%m-%d')

    return datetime.datetime.now().strftime('%Y-%m-%d')
