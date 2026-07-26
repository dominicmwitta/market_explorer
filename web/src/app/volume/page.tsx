import { getDailyTotalTurnover, getMarketMetrics } from "@/lib/db";
import TopTurnoverChart from "@/components/charts/TopTurnoverChart";
import TurnoverTreemapChart from "@/components/charts/TurnoverTreemapChart";
import DailyTurnoverAreaChart from "@/components/charts/DailyTurnoverAreaChart";

export const dynamic = "force-dynamic";

export default async function VolumePage() {
  const [metrics, dailyTurnover] = await Promise.all([getMarketMetrics(), getDailyTotalTurnover()]);

  const top15 = [...metrics].sort((a, b) => b.totalTurnover - a.totalTurnover).slice(0, 15);
  const treemapData = metrics
    .filter((m) => m.totalTurnover > 0)
    .map((m) => ({ name: m.company, size: m.totalTurnover, returnPct: m.totalReturnPct }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Volume Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Trading turnover by stock, market share, and the daily turnover trend across the full
          history.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Trading Volume by Stock</h2>
        <TopTurnoverChart data={top15} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Market Share by Turnover</h2>
        <TurnoverTreemapChart data={treemapData} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Daily Turnover Trend</h2>
        <DailyTurnoverAreaChart data={dailyTurnover} />
      </div>
    </div>
  );
}
