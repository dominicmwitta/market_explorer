"""DSE daily pipeline: download the daily report PDF -> extract -> save to Postgres."""

import difflib

from dse_explorer.config import SECTOR_MAP
from dse_explorer.logger import get_logger
from dse_explorer.pdf_extract import extract_equity_prices

# Canonical names: map old/alternate ticker names to current DSE names (real
# renames, e.g. when an ETF's ticker changed on the website but the PDF
# report still lags behind). One-off scraping *glitches* (truncation, stray
# whitespace, typos) are instead caught generically by _find_glitch_match.
_TICKER_ALIASES = {
    "IEACLC-ETF": "ITRUST ETF",
    "VERTEX-ETF": "VERTEX ETF",
}

_KNOWN_TICKERS = {ticker for tickers in SECTOR_MAP.values() for ticker in tickers}


def _find_glitch_match(ticker: str) -> str | None:
    """Try to recognize a mangled ticker as a known one.

    Handles the common scraping/PDF-extraction glitches seen in practice:
    stray whitespace, and truncation of a multi-word ticker (e.g. the
    "VERTEX ETF" -> "VERTEX ET" incident). Only returns a correction when
    exactly one known ticker is a plausible match, so a genuinely new
    listing is never silently mapped onto an unrelated existing one.
    """
    cleaned = " ".join(ticker.split()).upper()
    if cleaned in _KNOWN_TICKERS:
        return cleaned

    prefix_matches = [
        known for known in _KNOWN_TICKERS
        if known.startswith(cleaned) or cleaned.startswith(known)
    ]
    if len(prefix_matches) == 1:
        return prefix_matches[0]

    close_matches = difflib.get_close_matches(cleaned, _KNOWN_TICKERS, n=2, cutoff=0.85)
    if len(close_matches) == 1:
        return close_matches[0]

    return None


def _normalize_companies(df):
    """Replace legacy/mis-scraped ticker names with current DSE names."""
    if df is None:
        return None
    df = df.copy()
    df["Company"] = df["Company"].replace(_TICKER_ALIASES)

    unknown = set(df["Company"].unique()) - _KNOWN_TICKERS
    corrections = {}
    unresolved = []
    for ticker in unknown:
        match = _find_glitch_match(ticker)
        if match:
            corrections[ticker] = match
            log.warning(f"Auto-corrected likely scraping glitch: '{ticker}' -> '{match}'")
        else:
            unresolved.append(ticker)

    if corrections:
        df["Company"] = df["Company"].replace(corrections)

    if unresolved:
        log.warning(
            f"Unrecognized ticker(s) not in config.SECTOR_MAP: {sorted(unresolved)} — "
            "verify this is a real new listing (not a scraping glitch) and add it "
            "to SECTOR_MAP, otherwise it will be stored with sector='Unknown'"
        )

    return df


log = get_logger()


# ------------------------------------------------------------------
# Step 1: PDF Extraction
# ------------------------------------------------------------------
def try_pdf():
    """Download and extract today's PDF report."""
    log.info("--- Step 1: PDF Extraction ---")
    try:
        from dse_explorer.pdf_download import fetch_latest_dse_report

        success = fetch_latest_dse_report()
        if not success:
            log.warning("PDF: download failed")
            return None

        df = extract_equity_prices()  # uses latest PDF in dse_reports/
        if df is None or df.empty:
            log.warning("PDF: extraction returned empty data")
            return None

        log.info(f"PDF: extracted {len(df)} rows")
        return df

    except Exception as e:
        log.exception(f"PDF pipeline failed: {e}")
        return None


# ------------------------------------------------------------------
# Step 2: Update Master Database
# ------------------------------------------------------------------
def update_master_db(new_df, source: str):
    """Upsert today's rows into Postgres and return the full active history."""
    log.info("--- Step 2: Updating Master Database ---")

    from dse_explorer.db import (
        create_schema, get_engine, read_daily_prices, upsert_companies, upsert_prices,
    )

    engine = get_engine()
    create_schema(engine)

    new_df = _normalize_companies(new_df)
    upsert_companies(engine, set(new_df["Company"].unique()))
    n = upsert_prices(engine, new_df, source=source)
    log.info(f"Upserted {n} rows (source={source})")

    combined = read_daily_prices(engine)
    log.info(f"{len(combined)} total active rows in database")
    return combined


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    log.info("=" * 60)
    log.info("DSE Daily Pipeline Started")
    log.info("=" * 60)

    errors = []
    source = "PDF"

    result = try_pdf()
    if result is None:
        errors.append("PDF download/extraction failed")
        log.error("No data to save")
        # Notify failure and exit
        try:
            from dse_explorer.notifier import notify_pipeline_result
            notify_pipeline_result(False, {
                "source": source,
                "rows_scraped": 0,
                "total_rows": 0,
                "errors": errors,
            })
        except Exception as e:
            log.debug(f"Email notification skipped: {e}")
        # Non-zero exit so the scheduled run shows as failed and logs are uploaded
        raise SystemExit(1)

    rows_scraped = len(result)
    final = update_master_db(result, source=source)
    print(final.to_string())

    # Check price alerts
    triggered = []
    try:
        from dse_explorer.alerts import check_alerts
        triggered = check_alerts(final)
        for alert in triggered:
            log.warning(
                f"ALERT: {alert['company']} is {alert['condition']} "
                f"{alert['price']} (current: {alert['current_price']:.2f})"
            )
    except Exception as e:
        log.debug(f"Alert check skipped: {e}")

    # Email triggered alerts
    if triggered:
        try:
            from dse_explorer.notifier import notify_alerts
            notify_alerts(triggered)
        except Exception as e:
            log.debug(f"Alert email skipped: {e}")

    log.info("DSE Daily Pipeline Completed")

    # Send pipeline summary email
    try:
        from dse_explorer.notifier import notify_pipeline_result
        notify_pipeline_result(True, {
            "source": source,
            "rows_scraped": rows_scraped,
            "total_rows": len(final),
            "alerts_triggered": len(triggered),
            "errors": errors,
        })
    except Exception as e:
        log.debug(f"Email notification skipped: {e}")


if __name__ == "__main__":
    main()
