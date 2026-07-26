import BacktestClient from "./BacktestClient";

export default function BacktestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Momentum Backtesting</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Buy the top-N stocks by previous day&apos;s return, equal weight, daily rebalance —
          against the full active price history.
        </p>
      </div>

      <BacktestClient />
    </div>
  );
}
