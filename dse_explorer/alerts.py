"""Price alert system with JSON persistence."""

import json
import argparse
from pathlib import Path

import pandas as pd

ALERTS_FILE = Path("alerts.json")


def load_alerts() -> list[dict]:
    """Load alerts from disk."""
    if ALERTS_FILE.exists():
        return json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
    return []


def save_alerts(alerts: list[dict]) -> None:
    """Persist alerts to disk."""
    ALERTS_FILE.write_text(json.dumps(alerts, indent=2), encoding="utf-8")


def add_alert(company: str, condition: str, price: float) -> list[dict]:
    """Add a new price alert."""
    if condition not in ("above", "below"):
        print("Condition must be 'above' or 'below'")
        return load_alerts()

    alerts = load_alerts()
    alert = {
        "company": company.upper(),
        "condition": condition,
        "price": price,
        "active": True,
    }
    alerts.append(alert)
    save_alerts(alerts)
    print(f"Alert added: {alert['company']} {condition} {price}")
    return alerts


def remove_alert(index: int) -> list[dict]:
    """Remove an alert by its index."""
    alerts = load_alerts()
    if 0 <= index < len(alerts):
        removed = alerts.pop(index)
        save_alerts(alerts)
        print(f"Removed alert: {removed['company']} {removed['condition']} {removed['price']}")
    else:
        print(f"Invalid alert index: {index}")
    return alerts


def check_alerts(df: pd.DataFrame) -> list[dict]:
    """Check which alerts are triggered by the latest data.

    Parameters
    ----------
    df : pd.DataFrame
        Stock data with at least ``Company`` and ``Closing_Price`` columns.

    Returns
    -------
    list[dict]
        List of triggered alert dicts (with an added ``current_price`` key).
    """
    alerts = load_alerts()
    if not alerts:
        return []

    # Get the latest closing price per company
    latest = df.sort_values("Date").groupby("Company").last().reset_index()

    triggered = []
    for alert in alerts:
        if not alert.get("active", True):
            continue
        company = alert["company"]
        row = latest[latest["Company"] == company]
        if row.empty:
            continue
        current_price = float(row["Closing_Price"].iloc[0])
        if alert["condition"] == "above" and current_price >= alert["price"]:
            triggered.append({**alert, "current_price": current_price})
        elif alert["condition"] == "below" and current_price <= alert["price"]:
            triggered.append({**alert, "current_price": current_price})

    return triggered


def list_alerts() -> list[dict]:
    """Print and return all alerts."""
    alerts = load_alerts()
    if alerts:
        print("Price Alerts:")
        for i, a in enumerate(alerts):
            status = "active" if a.get("active", True) else "inactive"
            print(f"  [{i}] {a['company']} {a['condition']} {a['price']} ({status})")
    else:
        print("No alerts configured")
    return alerts


def main():
    parser = argparse.ArgumentParser(description="DSE Price Alert Manager")
    parser.add_argument("--add", nargs=3, metavar=("TICKER", "CONDITION", "PRICE"),
                        help="Add alert: --add CRDB above 2500")
    parser.add_argument("--remove", type=int, metavar="INDEX",
                        help="Remove alert by index")
    parser.add_argument("--list", action="store_true", help="List all alerts")
    parser.add_argument("--check", action="store_true",
                        help="Check alerts against latest data")

    args = parser.parse_args()

    if args.add:
        ticker, condition, price = args.add
        add_alert(ticker, condition, float(price))
    elif args.remove is not None:
        remove_alert(args.remove)
    elif args.check:
        from dse_explorer.db import get_engine, read_daily_prices
        df = read_daily_prices(get_engine())
        df["Date"] = pd.to_datetime(df["Date"])
        triggered = check_alerts(df)
        if triggered:
            print("Triggered alerts:")
            for t in triggered:
                print(f"  {t['company']} is {t['condition']} {t['price']} "
                      f"(current: {t['current_price']:.2f})")
        else:
            print("No alerts triggered")
    elif args.list:
        list_alerts()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
