import { getBidOfferRatioForTopLiquid, getPressureTrend } from "@/lib/db";
import { pivotByDate, type SeriesPoint } from "@/lib/timeseries";
import PressureTrendChart from "@/components/charts/PressureTrendChart";
import MultiLineChart from "@/components/charts/MultiLineChart";

export const dynamic = "force-dynamic";

export default async function OrderBookTrendsPage() {
  const [pressureTrend, liquidRatios] = await Promise.all([
    getPressureTrend(),
    getBidOfferRatioForTopLiquid(),
  ]);

  const tickers = liquidRatios.map((r) => r.ticker);
  const ratioSeriesByTicker: Record<string, SeriesPoint<number | null>[]> = {};
  for (const r of liquidRatios) {
    ratioSeriesByTicker[r.ticker] = r.points.map((p) => ({ date: p.date, value: p.ratio }));
  }
  const ratioChartData = pivotByDate(ratioSeriesByTicker, tickers);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order Book Trends</h1>
        <p className="mt-1 text-sm text-text-secondary">
          How market sentiment and bid/offer pressure have shifted over time, across the full price
          history.
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Market-Wide Pressure Trend</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Daily count of active stocks in each pressure bucket.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <PressureTrendChart data={pressureTrend} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Bid/Offer Ratio Trend — Top 10 Most Liquid Stocks</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Liquidity ranked by total turnover. Gaps indicate no outstanding offers that day (an
          infinite ratio).
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <MultiLineChart
            data={ratioChartData}
            series={tickers.map((t) => ({ key: t, label: t }))}
            referenceLine={1}
            connectNulls={false}
            valueFormat="ratio"
          />
        </div>
      </section>
    </div>
  );
}
