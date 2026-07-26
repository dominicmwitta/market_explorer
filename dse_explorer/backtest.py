"""Simple momentum backtesting engine for DSE stocks."""

import argparse

import pandas as pd
import numpy as np

from dse_explorer.db import get_engine, read_daily_prices


class MomentumBacktest:
    """Buy top-N stocks by previous day's return, equal weight, daily rebalance."""

    def __init__(self, top_n: int = 5):
        self.top_n = top_n
        self.df = None
        self.portfolio_values: list[dict] = []
        self.daily_holdings: list[dict] = []

    def _load(self) -> pd.DataFrame:
        df = read_daily_prices(get_engine())
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values(["Date", "Company"]).reset_index(drop=True)
        self.df = df
        return df

    def run(self) -> dict:
        """Execute the backtest and return summary statistics."""
        if self.df is None:
            self._load()

        # Pivot closing prices
        prices = self.df.pivot_table(
            index="Date", columns="Company", values="Closing_Price"
        )
        prices = prices.sort_index()

        # Daily returns
        returns = prices.pct_change()

        dates = returns.index[1:]  # skip first NaN row
        portfolio_value = 100.0
        values = [{"Date": prices.index[0], "Value": portfolio_value}]
        daily_returns = []

        holdings_log = []

        for i, date in enumerate(dates):
            if i == 0:
                # No previous return to rank on the first tradeable day
                values.append({"Date": date, "Value": portfolio_value})
                continue

            prev_date = dates[i - 1]
            prev_returns = returns.loc[prev_date].dropna()

            if len(prev_returns) < self.top_n:
                top_stocks = prev_returns.nlargest(len(prev_returns)).index
            else:
                top_stocks = prev_returns.nlargest(self.top_n).index

            # Equal weight return for today
            today_returns = returns.loc[date, top_stocks].dropna()
            if len(today_returns) == 0:
                daily_ret = 0.0
            else:
                daily_ret = today_returns.mean()

            daily_returns.append(daily_ret)
            portfolio_value *= (1 + daily_ret)
            values.append({"Date": date, "Value": portfolio_value})

            # Record which stocks are held and their individual returns
            stock_details = []
            for stock in top_stocks:
                ret = returns.loc[date, stock]
                prev_ret = prev_returns[stock]
                stock_details.append({
                    "Stock": stock,
                    "Prev_Return_Pct": round(prev_ret * 100, 2),
                    "Day_Return_Pct": round(ret * 100, 2) if pd.notna(ret) else None,
                })
            holdings_log.append({
                "Date": date,
                "Stocks": [s["Stock"] for s in stock_details],
                "Details": stock_details,
                "Portfolio_Return_Pct": round(daily_ret * 100, 2),
            })

        self.portfolio_values = values
        self.daily_holdings = holdings_log
        daily_returns = np.array(daily_returns)

        # Summary stats
        total_return = (portfolio_value / 100 - 1) * 100
        win_rate = (daily_returns > 0).sum() / len(daily_returns) * 100 if len(daily_returns) > 0 else 0

        # Max drawdown
        cummax = np.maximum.accumulate([v["Value"] for v in values])
        drawdowns = (np.array([v["Value"] for v in values]) - cummax) / cummax * 100
        max_drawdown = drawdowns.min()

        best_day = daily_returns.max() * 100 if len(daily_returns) > 0 else 0
        worst_day = daily_returns.min() * 100 if len(daily_returns) > 0 else 0

        return {
            "total_return_pct": round(total_return, 2),
            "win_rate_pct": round(win_rate, 2),
            "max_drawdown_pct": round(max_drawdown, 2),
            "best_day_pct": round(best_day, 2),
            "worst_day_pct": round(worst_day, 2),
            "trading_days": len(daily_returns),
            "top_n": self.top_n,
        }


def main():
    parser = argparse.ArgumentParser(description="DSE Momentum Backtesting")
    parser.add_argument("--top-n", type=int, default=5, help="Number of top stocks to hold")

    args = parser.parse_args()

    bt = MomentumBacktest(top_n=args.top_n)
    try:
        results = bt.run()
    except Exception as e:
        print(f"Error: {e}")
        return 1

    print("=" * 50)
    print("DSE MOMENTUM BACKTEST RESULTS")
    print("=" * 50)
    print(f"Strategy: Buy top {results['top_n']} stocks by previous day return")
    print(f"Trading Days: {results['trading_days']}")
    print(f"Total Return: {results['total_return_pct']:+.2f}%")
    print(f"Win Rate: {results['win_rate_pct']:.1f}%")
    print(f"Max Drawdown: {results['max_drawdown_pct']:.2f}%")
    print(f"Best Day: {results['best_day_pct']:+.2f}%")
    print(f"Worst Day: {results['worst_day_pct']:+.2f}%")

    if bt.daily_holdings:
        latest = bt.daily_holdings[-1]
        print()
        print("=" * 50)
        print(f"LATEST HOLDINGS ({latest['Date'].strftime('%Y-%m-%d')})")
        print("=" * 50)
        print(f"{'Stock':<15} {'Prev Day %':>12} {'Day Return %':>14}")
        print("-" * 43)
        for detail in latest["Details"]:
            day_ret = f"{detail['Day_Return_Pct']:+.2f}%" if detail["Day_Return_Pct"] is not None else "N/A"
            print(f"{detail['Stock']:<15} {detail['Prev_Return_Pct']:>+11.2f}% {day_ret:>14}")
        print("-" * 43)
        print(f"{'Portfolio':.<15} {'':>12} {latest['Portfolio_Return_Pct']:>+13.2f}%")
    return 0


if __name__ == "__main__":
    exit(main())
