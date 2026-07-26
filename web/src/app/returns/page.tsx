import { getMarketMetrics } from "@/lib/db";
import ReturnHistogramChart from "@/components/charts/ReturnHistogramChart";
import ReturnVolatilityScatterChart from "@/components/charts/ReturnVolatilityScatterChart";
import MomentumChart from "@/components/charts/MomentumChart";

export const dynamic = "force-dynamic";

const BIN_COUNT = 20;

export default async function ReturnsPage() {
  const metrics = await getMarketMetrics();

  const returns = metrics.map((m) => m.totalReturnPct);
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / BIN_COUNT || 1;

  const bins = Array.from({ length: BIN_COUNT }, (_, i) => {
    const start = min + i * binWidth;
    const end = start + binWidth;
    return {
      binCenter: (start + end) / 2,
      rangeLabel: `${start.toFixed(1)}% to ${end.toFixed(1)}%`,
      count: 0,
    };
  });
  for (const r of returns) {
    const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((r - min) / binWidth)));
    bins[idx].count += 1;
  }

  const scatterData = metrics.filter((m) => m.volatilityPct > 0);
  const momentum = [...metrics].sort((a, b) => b.latestReturnPct - a.latestReturnPct).slice(0, 15);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Returns Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Distribution of total returns, the risk/return trade-off, and the latest trading day&apos;s
          momentum.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">Return Distribution</h2>
          <ReturnHistogramChart data={bins} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-semibold">Return vs Volatility</h2>
          <ReturnVolatilityScatterChart data={scatterData} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Latest Day Momentum</h2>
        <MomentumChart data={momentum} />
      </div>
    </div>
  );
}
