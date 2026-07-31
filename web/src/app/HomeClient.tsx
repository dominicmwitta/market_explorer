"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  computeMarketBreadth,
  computeMetricsForRange,
  type CompanyMetricsForRange,
} from "@/lib/metrics";
import { uniqueSortedDates, type DateRange } from "@/lib/timeseries";
import { formatCompactTZS, formatDateLabel, formatTZS } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import TagBadge from "@/components/TagBadge";
import type { PricePoint } from "@/lib/db";

type TickerInfo = { ticker: string; sector: string; fullName: string };

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
  const tradingDates = useMemo(() => uniqueSortedDates(allDates), [allDates]);
  // Default to the latest one-day change (previous trading day -> latest), not the full history.
  const defaultStart =
    tradingDates.length >= 2 ? tradingDates[tradingDates.length - 2] : minDate;
  const [range, setRange] = useState<DateRange>({ start: defaultStart, end: maxDate });

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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Summary</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Across {metrics.length} active DSE-listed stocks. Showing change from{" "}
          <strong className="font-medium text-text-primary">{formatDateLabel(range.start)}</strong> to{" "}
          <strong className="font-medium text-text-primary">{formatDateLabel(range.end)}</strong>.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar
          minDate={minDate}
          maxDate={maxDate}
          value={range}
          onChange={setRange}
          tradingDates={tradingDates}
        />
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

          <section className="grid gap-8 lg:grid-cols-2">
            <MoversTable title="Top Gainers" rows={topGainers} mostLiquid={mostLiquid} range={range} />
            <MoversTable title="Top Losers" rows={topLosers} mostLiquid={mostLiquid} range={range} />
          </section>
        </>
      )}
    </div>
  );
}

function MoversTable({
  title,
  rows,
  mostLiquid,
  range,
}: {
  title: string;
  rows: CompanyMetricsForRange[];
  mostLiquid: Set<string>;
  range: DateRange;
}) {
  return (
    <div className="min-w-0">
      <h2 className="mb-0.5 text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-text-secondary">
        {formatDateLabel(range.start)} → {formatDateLabel(range.end)}
      </p>
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
