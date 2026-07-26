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
  const closingHistory: Record<string, { date: string; closingPrice: number }[]> = {};
  for (const m of topByTurnover) {
    closingHistory[m.company] = (priceHistory[m.company] ?? []).map((p) => ({
      date: p.date,
      closingPrice: p.closingPrice,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DSE Top-N Liquidity Index</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A turnover-weighted price index tracking the top N most liquid stocks (highest total
          turnover across the full price history) — the same liquidity ranking used elsewhere in
          this app.
        </p>
      </div>

      <LiquidityIndexClient topMetrics={topByTurnover} priceHistory={closingHistory} maxN={MAX_N} />
    </div>
  );
}
