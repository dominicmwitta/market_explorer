"""Manage a personal stock watchlist stored as JSON."""

import json
import argparse
from pathlib import Path

WATCHLIST_FILE = Path("watchlist.json")


def load_watchlist() -> list[str]:
    """Load the watchlist from disk."""
    if WATCHLIST_FILE.exists():
        return json.loads(WATCHLIST_FILE.read_text(encoding="utf-8"))
    return []


def save_watchlist(stocks: list[str]) -> None:
    """Persist the watchlist to disk."""
    WATCHLIST_FILE.write_text(json.dumps(sorted(set(stocks)), indent=2), encoding="utf-8")


def add_stock(name: str) -> list[str]:
    """Add a stock to the watchlist."""
    stocks = load_watchlist()
    name = name.upper()
    if name not in stocks:
        stocks.append(name)
        save_watchlist(stocks)
        print(f"Added {name} to watchlist")
    else:
        print(f"{name} is already in the watchlist")
    return stocks


def remove_stock(name: str) -> list[str]:
    """Remove a stock from the watchlist."""
    stocks = load_watchlist()
    name = name.upper()
    if name in stocks:
        stocks.remove(name)
        save_watchlist(stocks)
        print(f"Removed {name} from watchlist")
    else:
        print(f"{name} is not in the watchlist")
    return stocks


def list_stocks() -> list[str]:
    """Print and return the current watchlist."""
    stocks = load_watchlist()
    if stocks:
        print("Watchlist:")
        for s in sorted(stocks):
            print(f"  - {s}")
    else:
        print("Watchlist is empty")
    return stocks


def main():
    parser = argparse.ArgumentParser(description="DSE Stock Watchlist Manager")
    parser.add_argument("--add", metavar="TICKER", help="Add a stock to the watchlist")
    parser.add_argument("--remove", metavar="TICKER", help="Remove a stock from the watchlist")
    parser.add_argument("--list", action="store_true", help="List all stocks in the watchlist")

    args = parser.parse_args()

    if args.add:
        add_stock(args.add)
    elif args.remove:
        remove_stock(args.remove)
    elif args.list:
        list_stocks()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
