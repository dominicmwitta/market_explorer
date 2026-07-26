import Link from "next/link";
import { getMarketMetrics } from "@/lib/db";
import { formatCompactTZS, formatTZS } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const metrics = await getMarketMetrics();

  const gainers = metrics.filter((m) => m.totalReturnPct > 0).length;
  const losers = metrics.filter((m) => m.totalReturnPct < 0).length;
  const unchanged = metrics.length - gainers - losers;
  const totalTurnover = metrics.reduce((sum, m) => sum + m.totalTurnover, 0);

  const topGainers = [...metrics].sort((a, b) => b.totalReturnPct - a.totalReturnPct).slice(0, 10);
  const topLosers = [...metrics].sort((a, b) => a.totalReturnPct - b.totalReturnPct).slice(0, 10);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Market Summary</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Across {metrics.length} active DSE-listed stocks, full available history.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Total Stocks" value={String(metrics.length)} />
          <StatTile label="Gainers" value={String(gainers)} sub={`${unchanged} unchanged`} />
          <StatTile label="Losers" value={String(losers)} />
          <StatTile label="Total Turnover" value={formatCompactTZS(totalTurnover)} />
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <MoversTable title="Top Gainers" rows={topGainers} />
        <MoversTable title="Top Losers" rows={topLosers} />
      </section>
    </div>
  );
}

function MoversTable({
  title,
  rows,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getMarketMetrics>>;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Sector</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gridline">
            {rows.map((r) => (
              <tr key={r.company} className="hover:bg-text-muted/5">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/stocks/${encodeURIComponent(r.company)}`} className="hover:underline">
                    {r.company}
                  </Link>
                </td>
                <td className="px-4 py-2 text-text-secondary">{r.sector}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatTZS(r.currentPrice)}</td>
                <td className="px-4 py-2 text-right">
                  <ReturnValue value={r.totalReturnPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
