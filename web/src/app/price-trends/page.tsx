import { getMarketMetrics, getPriceHistoryForTickers, getTickers } from "@/lib/db";
import { formatTZS } from "@/lib/format";
import { formatMonthLabel, monthEndValues, pivotByDate, type SeriesPoint } from "@/lib/timeseries";
import MultiLineChart from "@/components/charts/MultiLineChart";
import PriceTrendsClient from "./PriceTrendsClient";

export const dynamic = "force-dynamic";

export default async function PriceTrendsPage() {
  const [tickers, metrics] = await Promise.all([getTickers(), getMarketMetrics()]);
  const allTickers = tickers.map((t) => t.ticker).sort();
  const defaultSelected = allTickers.slice(0, 5);

  const liquidTop10 = [...metrics]
    .sort((a, b) => b.totalTurnover - a.totalTurnover)
    .slice(0, 10)
    .map((m) => m.company);

  const liquidHistory = await getPriceHistoryForTickers(liquidTop10);

  const monthEndByTicker: Record<string, SeriesPoint<number>[]> = {};
  for (const ticker of liquidTop10) {
    const points = (liquidHistory[ticker] ?? []).map((h) => ({ date: h.date, value: h.closingPrice }));
    monthEndByTicker[ticker] = monthEndValues(points);
  }
  const allMonths = [...new Set(liquidTop10.flatMap((t) => monthEndByTicker[t].map((p) => p.date)))].sort();
  const monthChartData = pivotByDate(monthEndByTicker, liquidTop10, "month");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Price Trends</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Compare closing prices across stocks, normalized to a common base, and review month-end
          prices for the most liquid names.
        </p>
      </div>

      <PriceTrendsClient allTickers={allTickers} defaultSelected={defaultSelected} />

      <section>
        <h2 className="mb-1 text-lg font-semibold">Month-End Prices — Top 10 Most Liquid Stocks</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Liquidity ranked by total turnover across the full price history.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <MultiLineChart
            data={monthChartData}
            series={liquidTop10.map((t) => ({ key: t, label: t }))}
            xKey="month"
            xFormat="month"
            valueFormat="currency"
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2 font-medium">Company</th>
                {allMonths.map((month) => (
                  <th key={month} className="px-4 py-2 text-right font-medium">
                    {formatMonthLabel(month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gridline">
              {liquidTop10.map((ticker) => {
                const values = new Map(monthEndByTicker[ticker].map((p) => [p.date, p.value]));
                return (
                  <tr key={ticker} className="hover:bg-text-muted/5">
                    <td className="px-4 py-2 font-medium">{ticker}</td>
                    {allMonths.map((month) => (
                      <td key={month} className="px-4 py-2 text-right tabular-nums">
                        {values.has(month) ? formatTZS(values.get(month)!) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
