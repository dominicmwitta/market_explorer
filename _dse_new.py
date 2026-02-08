import requests
from bs4 import BeautifulSoup
import pandas as pd
import datetime
import os
import re

# Get data from the website
base_url = "https://dse.co.tz/"
response = requests.get(base_url)

if response.status_code !=200:
    print(f"Failed to fetch website with response code: {response.status_code}")
    exit()

# Parse html content
soup = BeautifulSoup(response.text, 'lxml')
divs = soup.find_all('div', class_ = 'ms-2')

# Create report path if doesnt exist
if not os.path.exists('reports'):
    os.makedirs('reports')
urls = []

for i, div in enumerate(divs,1):
    a_tag = div.find('a')
    if re.search('daily', a_tag['href']):
        urls.append(a_tag['href'])


def extract_equity_data(url):
    """Extract equity table from PDF-converted HTML."""
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    company_names = ['AFRIPRISE', 'CRDB', 'DCB', 'DSE', 'EABL', 'JATU', 'JHL', 'KA', 'KCB',
                     'MBP', 'MCB', 'MKCB', 'MUCOBA', 'NICO', 'NMB', 'PAL', 'SWIS', 'TBL',
                     'TCC', 'TCCL', 'TOL', 'TPCC', 'TTP', 'USL', 'VODA', 'YETU']

    # Find all divs with class containing 't ' (text divs)
    text_divs = soup.find_all('div', class_=lambda x: x and 't' in str(x))

    all_rows = []
    for div in text_divs:
        text = div.get_text(strip=True)
        # Check if text starts with a company name followed by numbers
        for company in company_names:
            if text.startswith(company) and len(text) > len(company):
                # Check if followed by numbers (price data)
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
    """Extract the report date from the page."""
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Look for date pattern in text: "DATE: DD-Month-YYYY" or similar
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


def create_equity_csv(url, output_file='dse_equity_daily.csv'):
    """Main function to extract and save equity data."""
    print(f"Fetching: {url}")

    # Get report date
    report_date = extract_report_date(url)
    print(f"Report date: {report_date}")

    raw_rows = extract_equity_data(url)
    print(f"Found {len(raw_rows)} raw company rows")

    if not raw_rows:
        print("No data found")
        return None

    # Deduplicate by keeping the longest raw data for each company
    # (PDF conversion may create multiple overlapping elements)
    company_best = {}
    for row in raw_rows:
        company = row['company']
        if company not in company_best or len(row['raw']) > len(company_best[company]['raw']):
            company_best[company] = row

    dedup_rows = list(company_best.values())
    print(f"After deduplication: {len(dedup_rows)} companies")

    # Parse each row
    parsed_rows = []
    for row in dedup_rows:
        parsed = parse_equity_row(row)
        if parsed['numbers']:
            parsed_rows.append(parsed)

    # Create DataFrame with first 5 numeric columns
    # Based on screenshot: Opening, Closing, High, Low, Turnover
    columns = ['Date', 'Company', 'Opening_Price', 'Closing_Price', 'High', 'Low', 'Turnover']

    data_for_df = []
    for row in parsed_rows:
        nums = row['numbers']
        if len(nums) >= 5:
            opening = nums[0]
            closing = nums[1]
            high = nums[2]
            low = nums[3]
            turnover = nums[4]

            # Basic sanity check - prices should be < 100,000 typically
            # and opening/closing should be within reasonable range of each other
            if opening < 100000 and closing < 100000:
                # Additional validation: high >= max(opening, closing) when non-zero
                # Skip rows with clearly incorrect parsing
                if high == 0 or high >= max(opening, closing) * 0.5:
                    data_for_df.append({
                        'Date': report_date,
                        'Company': row['company'],
                        'Opening_Price': opening,
                        'Closing_Price': closing,
                        'High': high,
                        'Low': low,
                        'Turnover': turnover
                    })

    df = pd.DataFrame(data_for_df, columns=columns)

    # Sort by company name for consistent output
    df = df.sort_values('Company').reset_index(drop=True)

    df.to_csv(output_file, index=False)
    print(f"\nSaved {len(df)} rows to {output_file}")
    print(df.to_string())
    return df


# Run extraction
if urls:
    print(f"Found {len(urls)} daily report URLs")
    df = create_equity_csv(urls[2])
else:
    print("No daily report URLs found")