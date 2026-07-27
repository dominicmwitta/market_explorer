"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  computeMarketBreadth,
  computeMetricsForRange,
  type CompanyMetricsForRange,
} from "@/lib/metrics";
import type { DateRange } from "@/lib/timeseries";
import { formatCompactTZS, formatTZS } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import TagBadge from "@/components/TagBadge";
import type { PricePoint } from "@/lib/db";

type TickerInfo = { ticker: string; sector: string; fullName: string };

const SECTOR_ICONS: Record<string, string> = {
  Aviation: "✈️",
  Banking: "🏦",
  Energy: "⚡",
  ETFs: "📦",
  Investment: "💼",
  Manufacturing: "🏭",
  Media: "📰",
  Retail: "🛒",
  Telecommunications: "📡",
  Agriculture: "🌾",
};

// Fixed order (alphabetical) so each sector always gets the same accent
// color regardless of stock counts shifting — identity, not ranking.
const SECTOR_ACCENTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default function HomeClient({
  tickers,
  historyByTicker,
}: {
  tickers: TickerInfo[];
  historyByTicker: Record<string, PricePoint[]>;
}) {
  const allDates = useMemo(
    () => Object.values(historyByTicker).flatMap((h) => h.map((p) => p.date)),
    [historyByTicker]
  );
  const minDate = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : "";
  const maxDate = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : "";
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  const metrics: CompanyMetricsForRange[] = useMemo(
    () => computeMetricsForRange(tickers, historyByTicker, range),
    [tickers, historyByTicker, range]
  );

  const breadth = useMemo(
    () =>
      computeMarketBreadth(
        metrics.map((m) => ({
          latestReturnPct: m.latestReturnPct,
          currentPrice: m.currentPrice,
          avgClosingPrice: m.avgClosingPrice,
        }))
      ),
    [metrics]
  );

  const gainers = metrics.filter((m) => m.totalReturnPct > 0).length;
  const losers = metrics.filter((m) => m.totalReturnPct < 0).length;
  const unchanged = metrics.length - gainers - losers;
  const totalTurnover = metrics.reduce((sum, m) => sum + m.totalTurnover, 0);

  const topGainers = [...metrics].sort((a, b) => b.totalReturnPct - a.totalReturnPct).slice(0, 10);
  const topLosers = [...metrics].sort((a, b) => a.totalReturnPct - b.totalReturnPct).slice(0, 10);
  const mostLiquid = new Set(
    [...metrics].sort((a, b) => b.totalTurnover - a.totalTurnover).slice(0, 10).map((m) => m.company)
  );

  const sectorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickers) counts.set(t.sector, (counts.get(t.sector) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tickers]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Summary</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Across {metrics.length} active DSE-listed stocks, {range.start} to {range.end}.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-text-secondary">No trading data in the selected period.</p>
      ) : (
        <>
          <section>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Total Stocks" value={String(metrics.length)} accent={1} />
              <StatTile
                label="Gainers"
                value={String(gainers)}
                sub={`${unchanged} unchanged`}
                accent="good"
              />
              <StatTile label="Losers" value={String(losers)} accent="critical" />
              <StatTile label="Total Turnover" value={formatCompactTZS(totalTurnover)} accent={7} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Market Breadth (Period End)</h2>
            <p className="mt-1 text-sm text-text-secondary">
              How the last trading day in the selected period compares to the rest of it —
              advance/decline sentiment and price-vs-average positioning.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Advancing" value={String(breadth.gainers)} accent="good" />
              <StatTile label="Declining" value={String(breadth.losers)} accent="critical" />
              <StatTile
                label="A/D Ratio"
                value={breadth.advanceDeclineRatio === null ? "∞" : breadth.advanceDeclineRatio.toFixed(2)}
                accent={4}
              />
              <StatTile label="Above Avg Price" value={`${breadth.pctAboveAvgPrice.toFixed(1)}%`} accent={3} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Browse by Sector</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {sectorCounts.map(([sector, count], i) => (
                <SectorTile
                  key={sector}
                  sector={sector}
                  count={count}
                  accent={SECTOR_ACCENTS[i % SECTOR_ACCENTS.length]}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <MoversTable title="Top Gainers" rows={topGainers} mostLiquid={mostLiquid} />
            <MoversTable title="Top Losers" rows={topLosers} mostLiquid={mostLiquid} />
          </section>
        </>
      )}
    </div>
  );
}

function SectorTile({
  sector,
  count,
  accent,
}: {
  sector: string;
  count: number;
  accent: number;
}) {
  return (
    <Link
      href={`/sectors?sector=${encodeURIComponent(sector)}`}
      className="rounded-lg border border-border bg-surface p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
      style={{ borderTop: `3px solid var(--series-${accent})` }}
    >
      <div className="text-2xl">{SECTOR_ICONS[sector] ?? "🏷️"}</div>
      <div className="mt-2 text-sm font-medium text-text-primary">{sector}</div>
      <div className="text-xs text-text-muted">
        {count} {count === 1 ? "stock" : "stocks"}
      </div>
    </Link>
  );
}

function MoversTable({
  title,
  rows,
  mostLiquid,
}: {
  title: string;
  rows: CompanyMetricsForRange[];
  mostLiquid: Set<string>;
}) {
  return (
    <div className="min-w-0">
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
            {rows.map((r, i) => (
              <tr key={r.company} className="hover:bg-text-muted/5">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/stocks/${encodeURIComponent(r.company)}`} className="hover:underline">
                    {r.company}
                  </Link>
                  {i === 0 && <TagBadge icon="🏆" label="Top" tone="gold" />}
                  {mostLiquid.has(r.company) && <TagBadge icon="💧" label="Liquid" tone="liquid" />}
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
