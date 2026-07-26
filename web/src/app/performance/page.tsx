import { getMarketMetrics } from "@/lib/db";
import ReturnRankingChart from "@/components/charts/ReturnRankingChart";
import SharpeRatioChart from "@/components/charts/SharpeRatioChart";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const metrics = await getMarketMetrics();

  const top10 = [...metrics].sort((a, b) => b.totalReturnPct - a.totalReturnPct).slice(0, 10);
  const bottom10 = [...metrics].sort((a, b) => a.totalReturnPct - b.totalReturnPct).slice(0, 10);
  const tradeable = metrics
    .filter((m) => m.volatilityPct > 0)
    .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
    .slice(0, 15);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance Rankings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Total return and risk-adjusted performance across the full price history.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">Top Performers</h2>
          <ReturnRankingChart data={top10} barColor="var(--status-good)" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">Worst Performers</h2>
          <ReturnRankingChart data={bottom10} barColor="var(--status-critical)" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Risk-Adjusted Performance (Sharpe Ratio)</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Top 15 stocks by Sharpe ratio among those with non-zero volatility, colored by total return.
        </p>
        <SharpeRatioChart data={tradeable} />
      </div>
    </div>
  );
}
