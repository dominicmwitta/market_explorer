"""
DSE Stock Performance Analyzer
Identifies best performing stocks based on multiple metrics.
"""

import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import argparse


class StockAnalyzer:
    """Analyzes DSE stock data to identify best performers."""

    def __init__(self, csv_path: str = "dse_equity_daily.csv"):
        self.csv_path = Path(csv_path)
        self.df = None
        self.analysis_date = datetime.now().strftime("%Y-%m-%d %H:%M")

    def load_data(self) -> pd.DataFrame:
        """Load and preprocess the stock data."""
        if not self.csv_path.exists():
            raise FileNotFoundError(f"Data file not found: {self.csv_path}")

        self.df = pd.read_csv(self.csv_path)

        # Parse dates
        self.df['Date'] = pd.to_datetime(self.df['Date'], format='%d-%B-%Y')
        self.df = self.df.sort_values(['Company', 'Date'])

        # Convert numeric columns
        numeric_cols = ['Opening_Price', 'Closing_Price', 'High', 'Low', 'Turnover']
        for col in numeric_cols:
            self.df[col] = pd.to_numeric(self.df[col], errors='coerce')

        return self.df

    def calculate_metrics(self) -> pd.DataFrame:
        """Calculate performance metrics for each stock."""
        if self.df is None:
            self.load_data()

        metrics = []

        for company in self.df['Company'].unique():
            stock_data = self.df[self.df['Company'] == company].copy()
            stock_data = stock_data.sort_values('Date')

            if len(stock_data) < 1:
                continue

            # Basic price info
            first_close = stock_data['Closing_Price'].iloc[0]
            last_close = stock_data['Closing_Price'].iloc[-1]
            first_open = stock_data['Opening_Price'].iloc[0]

            # Daily returns
            stock_data['Daily_Return'] = stock_data['Closing_Price'].pct_change() * 100

            # Intraday returns (close vs open)
            stock_data['Intraday_Return'] = (
                (stock_data['Closing_Price'] - stock_data['Opening_Price'])
                / stock_data['Opening_Price'] * 100
            )

            # Calculate metrics
            total_return = ((last_close - first_close) / first_close * 100) if first_close > 0 else 0
            avg_daily_return = stock_data['Daily_Return'].mean()
            volatility = stock_data['Daily_Return'].std()

            # Trading activity
            total_turnover = stock_data['Turnover'].sum()
            avg_turnover = stock_data['Turnover'].mean()
            trading_days = (stock_data['Turnover'] > 0).sum()
            total_days = len(stock_data)

            # Price range
            period_high = stock_data[stock_data['High'] > 0]['High'].max()
            period_low = stock_data[stock_data['Low'] > 0]['Low'].min()
            price_range = ((period_high - period_low) / period_low * 100) if period_low > 0 else 0

            # Momentum (latest daily return)
            latest_return = stock_data['Daily_Return'].iloc[-1] if len(stock_data) > 1 else 0

            # Sharpe-like ratio (return/volatility)
            sharpe = avg_daily_return / volatility if volatility > 0 else 0

            # Consecutive gains
            if len(stock_data) > 1:
                gains = (stock_data['Daily_Return'] > 0).astype(int)
                max_consecutive_gains = gains.groupby((gains != gains.shift()).cumsum()).sum().max()
            else:
                max_consecutive_gains = 0

            metrics.append({
                'Company': company,
                'Current_Price': last_close,
                'Period_Start_Price': first_close,
                'Total_Return_Pct': round(total_return, 2),
                'Avg_Daily_Return_Pct': round(avg_daily_return, 2) if not np.isnan(avg_daily_return) else 0,
                'Volatility_Pct': round(volatility, 2) if not np.isnan(volatility) else 0,
                'Sharpe_Ratio': round(sharpe, 3) if not np.isnan(sharpe) else 0,
                'Total_Turnover': total_turnover,
                'Avg_Turnover': round(avg_turnover, 0),
                'Trading_Days': trading_days,
                'Total_Days': total_days,
                'Liquidity_Ratio': round(trading_days / total_days * 100, 1) if total_days > 0 else 0,
                'Period_High': period_high if not np.isnan(period_high) else last_close,
                'Period_Low': period_low if not np.isnan(period_low) else last_close,
                'Price_Range_Pct': round(price_range, 2) if not np.isnan(price_range) else 0,
                'Latest_Return_Pct': round(latest_return, 2) if not np.isnan(latest_return) else 0,
                'Max_Consecutive_Gains': int(max_consecutive_gains)
            })

        return pd.DataFrame(metrics)

    def get_top_performers(self, metrics_df: pd.DataFrame, by: str = 'Total_Return_Pct',
                          top_n: int = 10, ascending: bool = False) -> pd.DataFrame:
        """Get top performing stocks by specified metric."""
        return metrics_df.nlargest(top_n, by) if not ascending else metrics_df.nsmallest(top_n, by)

    def generate_report(self, output_path: str = None) -> str:
        """Generate comprehensive analytical report."""
        metrics = self.calculate_metrics()

        # Date range
        date_min = self.df['Date'].min().strftime('%d-%b-%Y')
        date_max = self.df['Date'].max().strftime('%d-%b-%Y')
        total_days = self.df['Date'].nunique()

        report = []
        report.append("=" * 80)
        report.append("DSE STOCK PERFORMANCE ANALYSIS REPORT")
        report.append("=" * 80)
        report.append(f"\nGenerated: {self.analysis_date}")
        report.append(f"Data Period: {date_min} to {date_max} ({total_days} trading days)")
        report.append(f"Total Stocks Analyzed: {len(metrics)}")

        # Market Overview
        report.append("\n" + "-" * 80)
        report.append("MARKET OVERVIEW")
        report.append("-" * 80)

        gainers = (metrics['Total_Return_Pct'] > 0).sum()
        losers = (metrics['Total_Return_Pct'] < 0).sum()
        unchanged = (metrics['Total_Return_Pct'] == 0).sum()
        avg_market_return = metrics['Total_Return_Pct'].mean()
        total_market_turnover = metrics['Total_Turnover'].sum()

        report.append(f"\nMarket Sentiment:")
        report.append(f"  Gainers: {gainers} stocks")
        report.append(f"  Losers: {losers} stocks")
        report.append(f"  Unchanged: {unchanged} stocks")
        report.append(f"  Average Market Return: {avg_market_return:.2f}%")
        report.append(f"  Total Market Turnover: TZS {total_market_turnover:,.0f}")

        # Top Performers by Total Return
        report.append("\n" + "-" * 80)
        report.append("TOP 10 BEST PERFORMERS (By Total Return)")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Return %':<12}{'Price':<12}{'Volatility':<12}{'Turnover':<15}")
        report.append("-" * 68)

        top_returns = self.get_top_performers(metrics, 'Total_Return_Pct', 10)
        for i, (_, row) in enumerate(top_returns.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Total_Return_Pct']:>8.2f}%   "
                f"{row['Current_Price']:>10,.0f}  {row['Volatility_Pct']:>8.2f}%   "
                f"{row['Total_Turnover']:>12,.0f}"
            )

        # Worst Performers
        report.append("\n" + "-" * 80)
        report.append("TOP 10 WORST PERFORMERS (By Total Return)")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Return %':<12}{'Price':<12}{'Volatility':<12}{'Turnover':<15}")
        report.append("-" * 68)

        worst_returns = self.get_top_performers(metrics, 'Total_Return_Pct', 10, ascending=True)
        for i, (_, row) in enumerate(worst_returns.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Total_Return_Pct']:>8.2f}%   "
                f"{row['Current_Price']:>10,.0f}  {row['Volatility_Pct']:>8.2f}%   "
                f"{row['Total_Turnover']:>12,.0f}"
            )

        # Most Actively Traded
        report.append("\n" + "-" * 80)
        report.append("TOP 10 MOST ACTIVELY TRADED (By Turnover)")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Turnover':<20}{'Return %':<12}{'Liquidity':<12}")
        report.append("-" * 61)

        top_turnover = self.get_top_performers(metrics, 'Total_Turnover', 10)
        for i, (_, row) in enumerate(top_turnover.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Total_Turnover']:>16,.0f}   "
                f"{row['Total_Return_Pct']:>8.2f}%   {row['Liquidity_Ratio']:>8.1f}%"
            )

        # Best Risk-Adjusted Returns (Sharpe Ratio)
        report.append("\n" + "-" * 80)
        report.append("TOP 10 RISK-ADJUSTED PERFORMERS (By Sharpe Ratio)")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Sharpe':<10}{'Return %':<12}{'Volatility':<12}{'Price':<12}")
        report.append("-" * 63)

        # Filter out stocks with zero volatility for Sharpe ranking
        tradeable = metrics[metrics['Volatility_Pct'] > 0]
        top_sharpe = self.get_top_performers(tradeable, 'Sharpe_Ratio', 10)
        for i, (_, row) in enumerate(top_sharpe.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Sharpe_Ratio']:>7.3f}   "
                f"{row['Total_Return_Pct']:>8.2f}%   {row['Volatility_Pct']:>8.2f}%   "
                f"{row['Current_Price']:>10,.0f}"
            )

        # Most Volatile
        report.append("\n" + "-" * 80)
        report.append("TOP 10 MOST VOLATILE STOCKS")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Volatility':<12}{'Return %':<12}{'Price Range':<15}")
        report.append("-" * 56)

        top_volatile = self.get_top_performers(metrics, 'Volatility_Pct', 10)
        for i, (_, row) in enumerate(top_volatile.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Volatility_Pct']:>8.2f}%   "
                f"{row['Total_Return_Pct']:>8.2f}%   {row['Price_Range_Pct']:>10.2f}%"
            )

        # Latest Day Momentum
        report.append("\n" + "-" * 80)
        report.append("LATEST DAY MOMENTUM (Today's Best Gainers)")
        report.append("-" * 80)
        report.append(f"\n{'Rank':<5}{'Company':<12}{'Today %':<12}{'Price':<12}{'Total Return':<15}")
        report.append("-" * 56)

        top_momentum = self.get_top_performers(metrics, 'Latest_Return_Pct', 10)
        for i, (_, row) in enumerate(top_momentum.iterrows(), 1):
            report.append(
                f"{i:<5}{row['Company']:<12}{row['Latest_Return_Pct']:>8.2f}%   "
                f"{row['Current_Price']:>10,.0f}  {row['Total_Return_Pct']:>10.2f}%"
            )

        # Price Categories
        report.append("\n" + "-" * 80)
        report.append("STOCK PRICE CATEGORIES")
        report.append("-" * 80)

        premium = metrics[metrics['Current_Price'] >= 5000]
        mid_cap = metrics[(metrics['Current_Price'] >= 1000) & (metrics['Current_Price'] < 5000)]
        small_cap = metrics[metrics['Current_Price'] < 1000]

        report.append(f"\nPremium Stocks (>= TZS 5,000): {len(premium)}")
        if len(premium) > 0:
            best_premium = premium.nlargest(3, 'Total_Return_Pct')
            for _, row in best_premium.iterrows():
                report.append(f"  - {row['Company']}: TZS {row['Current_Price']:,.0f} ({row['Total_Return_Pct']:+.2f}%)")

        report.append(f"\nMid-Cap Stocks (TZS 1,000 - 5,000): {len(mid_cap)}")
        if len(mid_cap) > 0:
            best_mid = mid_cap.nlargest(3, 'Total_Return_Pct')
            for _, row in best_mid.iterrows():
                report.append(f"  - {row['Company']}: TZS {row['Current_Price']:,.0f} ({row['Total_Return_Pct']:+.2f}%)")

        report.append(f"\nSmall-Cap Stocks (< TZS 1,000): {len(small_cap)}")
        if len(small_cap) > 0:
            best_small = small_cap.nlargest(3, 'Total_Return_Pct')
            for _, row in best_small.iterrows():
                report.append(f"  - {row['Company']}: TZS {row['Current_Price']:,.0f} ({row['Total_Return_Pct']:+.2f}%)")

        # Recommendations Summary
        report.append("\n" + "-" * 80)
        report.append("INVESTMENT INSIGHTS")
        report.append("-" * 80)

        # Strong performers: positive return + high liquidity + reasonable volatility
        strong = metrics[
            (metrics['Total_Return_Pct'] > 0) &
            (metrics['Liquidity_Ratio'] >= 100) &
            (metrics['Volatility_Pct'] > 0)
        ].nlargest(5, 'Sharpe_Ratio')

        if len(strong) > 0:
            report.append("\nStrong Performers (Good returns with high liquidity):")
            for _, row in strong.iterrows():
                report.append(
                    f"  * {row['Company']}: Return {row['Total_Return_Pct']:+.2f}%, "
                    f"Sharpe {row['Sharpe_Ratio']:.3f}, "
                    f"Turnover TZS {row['Total_Turnover']:,.0f}"
                )

        # High momentum plays
        hot = metrics[metrics['Latest_Return_Pct'] > 2].nlargest(3, 'Latest_Return_Pct')
        if len(hot) > 0:
            report.append("\nHigh Momentum (Latest day gains > 2%):")
            for _, row in hot.iterrows():
                report.append(f"  * {row['Company']}: +{row['Latest_Return_Pct']:.2f}% today")

        # Value plays (negative return but still trading)
        value = metrics[
            (metrics['Total_Return_Pct'] < -5) &
            (metrics['Liquidity_Ratio'] >= 100)
        ].nsmallest(3, 'Total_Return_Pct')
        if len(value) > 0:
            report.append("\nPotential Value Plays (Oversold but liquid):")
            for _, row in value.iterrows():
                report.append(
                    f"  * {row['Company']}: {row['Total_Return_Pct']:.2f}% "
                    f"(Price: TZS {row['Current_Price']:,.0f})"
                )

        # Footer
        report.append("\n" + "=" * 80)
        report.append("DISCLAIMER: This report is for informational purposes only.")
        report.append("Past performance does not guarantee future results.")
        report.append("=" * 80)

        report_text = "\n".join(report)

        # Save report if path provided
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report_text)
            print(f"Report saved to: {output_file}")

        return report_text

    def export_metrics_csv(self, output_path: str = "stock_metrics.csv"):
        """Export calculated metrics to CSV for further analysis."""
        metrics = self.calculate_metrics()
        metrics = metrics.sort_values('Total_Return_Pct', ascending=False)
        metrics.to_csv(output_path, index=False)
        print(f"Metrics exported to: {output_path}")
        return metrics


def main():
    parser = argparse.ArgumentParser(description='DSE Stock Performance Analyzer')
    parser.add_argument('--data', '-d', default='dse_equity_daily.csv',
                       help='Path to the stock data CSV file')
    parser.add_argument('--output', '-o', default=None,
                       help='Path to save the report (optional)')
    parser.add_argument('--export-csv', '-e', default=None,
                       help='Export metrics to CSV file')
    parser.add_argument('--quiet', '-q', action='store_true',
                       help='Only save report, do not print to console')

    args = parser.parse_args()

    analyzer = StockAnalyzer(args.data)

    try:
        analyzer.load_data()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    # Generate and optionally save report
    report = analyzer.generate_report(args.output)

    if not args.quiet:
        print(report)

    # Export metrics CSV if requested
    if args.export_csv:
        analyzer.export_metrics_csv(args.export_csv)

    return 0


if __name__ == "__main__":
    exit(main())
