import { getMarketMetrics } from "@/lib/db";
import { formatCompactTZS } from "@/lib/format";
import ReturnValue from "@/components/ReturnValue";
import SectorReturnChart from "@/components/charts/SectorReturnChart";

export const dynamic = "force-dynamic";

export default async function SectorsPage() {
  const metrics = await getMarketMetrics();

  const bySector = new Map<string, { returns: number[]; turnover: number; count: number }>();
  for (const m of metrics) {
    const entry = bySector.get(m.sector) ?? { returns: [], turnover: 0, count: 0 };
    entry.returns.push(m.totalReturnPct);
    entry.turnover += m.totalTurnover;
    entry.count += 1;
    bySector.set(m.sector, entry);
  }

  const sectors = [...bySector.entries()]
    .map(([sector, { returns, turnover, count }]) => ({
      sector,
      avgReturnPct: returns.reduce((a, b) => a + b, 0) / returns.length,
      numStocks: count,
      totalTurnover: turnover,
    }))
    .sort((a, b) => b.avgReturnPct - a.avgReturnPct);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sector Performance</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Average return, stock count, and turnover by sector across the full price history.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <SectorReturnChart data={sectors} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Sector</th>
              <th className="px-4 py-2 text-right font-medium">Stocks</th>
              <th className="px-4 py-2 text-right font-medium">Avg Return</th>
              <th className="px-4 py-2 text-right font-medium">Total Turnover</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gridline">
            {sectors.map((s) => (
              <tr key={s.sector} className="hover:bg-text-muted/5">
                <td className="px-4 py-2 font-medium">{s.sector}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.numStocks}</td>
                <td className="px-4 py-2 text-right">
                  <ReturnValue value={s.avgReturnPct} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCompactTZS(s.totalTurnover)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
