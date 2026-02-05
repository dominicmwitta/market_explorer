"""HTML parsing and data extraction for DSE scraper."""

import re
import datetime

from .config import COMPANY_NAMES
from .scraper import fetch_page


def extract_equity_data(url):
    """Extract equity table from PDF-converted HTML.

    Args:
        url: URL of the daily report page

    Returns:
        List of dicts with 'company' and 'raw' keys
    """
    soup = fetch_page(url)
    if not soup:
        return []

    text_divs = soup.find_all('div', class_=lambda x: x and 't' in str(x))

    all_rows = []
    for div in text_divs:
        text = div.get_text(strip=True)
        for company in COMPANY_NAMES:
            if text.startswith(company) and len(text) > len(company):
                after_company = text[len(company):]
                if after_company and after_company[0].isdigit():
                    all_rows.append({'company': company, 'raw': text})
                    break

    return all_rows


def parse_equity_row(row_data):
    """Parse concatenated row data into fields.

    The row format is: COMPANY[numbers concatenated]
    e.g., 'AFRIPRISE805830845800152,812,895490183,873121.2166,97765,377'

    Handles both traded stocks (normal parsing) and non-traded stocks
    (special handling for consecutive zeros representing High=0, Low=0, etc.)

    Args:
        row_data: Dict with 'company' and 'raw' keys

    Returns:
        Dict with 'company', 'numbers', and 'raw' keys
    """
    company = row_data['company']
    raw = row_data['raw']
    data_str = raw[len(company):]

    numbers = []

    # Step 1: Extract ALL comma-formatted numbers first and mark their positions
    comma_matches = list(re.finditer(r'([1-9]\d{0,2}(?:,\d{3})+)', data_str))

    # Create a masked string where comma numbers are replaced with spaces
    masked = data_str
    for match in reversed(comma_matches):
        masked = masked[:match.start()] + ' ' * len(match.group()) + masked[match.end():]

    # Step 2: Check for no-trade pattern (5+ consecutive zeros = High,Low,Turnover all 0)
    no_trade_match = re.search(r'0{5,}', masked)

    if no_trade_match:
        zero_start = no_trade_match.start()
        zero_end = no_trade_match.end()
        zeros_str = no_trade_match.group()

        after_zeros_original = data_str[zero_end:]

        # Extract comma prices that are BEFORE the zeros
        for match in comma_matches:
            if match.end() <= zero_start:
                numbers.append(int(match.group().replace(',', '')))

        # Get remaining digits before zeros (non-comma formatted)
        before_masked = masked[:zero_start]
        digits = re.sub(r'[^0-9]', '', before_masked)

        if digits:
            length = len(digits)
            found = False

            # Check for repeated pattern (same opening/closing for no-trade)
            for i in range(2, length // 2 + 1):
                first = digits[:i]
                second = digits[i:2*i]
                if first == second and first[0] != '0':
                    numbers.extend([int(first), int(second)])
                    digits = digits[2*i:]
                    found = True
                    break

            # Try borrowing zeros from the zero sequence for prices like "100"
            if not found:
                all_candidates = []
                for extra_zeros in range(4):
                    test_digits = digits + '0' * extra_zeros
                    test_len = len(test_digits)

                    for split in range(2, test_len - 1):
                        p1 = test_digits[:split]
                        p2 = test_digits[split:]
                        if (p1[0] != '0' or p1 == '0') and (p2[0] != '0' or p2 == '0'):
                            v1, v2 = int(p1), int(p2)
                            # Reasonable stock prices: 20-50000 TZS
                            if 20 <= v1 <= 50000 and 20 <= v2 <= 50000:
                                score = min(v1, v2)  # Prefer higher minimum price
                                all_candidates.append((v1, v2, extra_zeros, score))

                if all_candidates:
                    best = max(all_candidates, key=lambda x: x[3])
                    numbers.extend([best[0], best[1]])
                    zeros_str = zeros_str[best[2]:]
                    digits = ''
                    found = True

            if digits and not found:
                for d in re.findall(r'[1-9]\d*', digits):
                    numbers.append(int(d))

        # Add zeros (High=0, Low=0, Turnover=0, etc.)
        numbers.extend([0] * len(zeros_str))

        # Parse after zeros (other metrics)
        for m in re.finditer(r'(\d+\.\d+)|([1-9]\d*)', after_zeros_original):
            if m.group(1):
                numbers.append(float(m.group(1)))
            else:
                numbers.append(int(m.group(2)))
    else:
        # Normal traded stock - use standard parsing
        all_nums = re.findall(r'\d{1,3}(?:,\d{3})*(?:\.\d+)?', data_str)
        for num_str in all_nums:
            clean = num_str.replace(',', '')
            if '.' in clean:
                numbers.append(float(clean))
            else:
                numbers.append(int(clean))

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
