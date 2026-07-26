import { getMarketMetrics, getPriceHistoryForTickers } from "@/lib/db";
import LiquidityIndexClient from "./LiquidityIndexClient";

export const dynamic = "force-dynamic";

const MAX_N = 20;

export default async function LiquidityIndexPage() {
  const metrics = await getMarketMetrics();

  // Fetch enough constituents to cover the full slider range (2-20) up
  // front, then let the client slice/recompute per N without a round trip.
  const topByTurnover = [...metrics]
    .sort((a, b) => b.totalTurnover - a.totalTurnover)
    .slice(0, MAX_N);

  const priceHistory = await getPriceHistoryForTickers(topByTurnover.map((m) => m.company));
  // Turnover is kept alongside price so the client can re-rank "top N most
  // liquid" by turnover WITHIN a user-selected period, not just the
  // full-history ranking baked into topByTurnover above.
  const closingHistory: Record<string, { date: string; closingPrice: number; turnover: number }[]> =
    {};
  for (const m of topByTurnover) {
    closingHistory[m.company] = (priceHistory[m.company] ?? []).map((p) => ({
      date: p.date,
      closingPrice: p.closingPrice,
      turnover: p.turnover,
    }));
  }

  const allDates = Object.values(closingHistory).flatMap((points) => points.map((p) => p.date));
  const minDate = allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : "";
  const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DSE Top-N Liquidity Index</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A turnover-weighted price index tracking the top N most liquid stocks (highest total
          turnover in the selected period) — the same liquidity ranking used elsewhere in this app.
        </p>
      </div>

      <LiquidityIndexClient
        topMetrics={topByTurnover}
        priceHistory={closingHistory}
        maxN={MAX_N}
        minDate={minDate}
        maxDate={maxDate}
      />
    </div>
  );
}
