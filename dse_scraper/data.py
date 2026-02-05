"""DataFrame operations and CSV output for DSE scraper."""

import pandas as pd

from .config import COLUMN_NAMES


def deduplicate_rows(raw_rows):
    """Keep best row per company (longest raw data).

    PDF conversion may create multiple overlapping elements.

    Args:
        raw_rows: List of dicts with 'company' and 'raw' keys

    Returns:
        List of deduplicated row dicts
    """
    company_best = {}
    for row in raw_rows:
        company = row['company']
        if company not in company_best or len(row['raw']) > len(company_best[company]['raw']):
            company_best[company] = row

    return list(company_best.values())


def create_dataframe(parsed_rows, report_date):
    """Build DataFrame with validation.

    Args:
        parsed_rows: List of parsed row dicts with 'company' and 'numbers' keys
        report_date: Date string for the report

    Returns:
        pandas DataFrame with equity data
    """
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
            if opening < 100000 and closing < 100000:
                # Additional validation: high >= max(opening, closing) when non-zero
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

    df = pd.DataFrame(data_for_df, columns=COLUMN_NAMES)
    df = df.sort_values('Company').reset_index(drop=True)
    return df


def save_to_csv(df, output_file):
    """Write DataFrame to CSV file.

    Args:
        df: pandas DataFrame to save
        output_file: Path to output CSV file
    """
    df.to_csv(output_file, index=False)
    print(f"\nSaved {len(df)} rows to {output_file}")
