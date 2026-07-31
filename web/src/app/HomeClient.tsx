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
import DateRangeSlider from "@/components/DateRangeSlider";
import TagBadge from "@/components/TagBadge";
import TickerTile, { type TickerTileData } from "@/components/TickerTile";
import TickerStrip, { type TickerStripItem } from "@/components/TickerStrip";
import Block from "@/components/Block";
import type { PricePoint } from "@/lib/db";

const STRIP_TICKER_COUNT = 10;
const WATCH_TILE_COUNT = 3;

/** Latest close and 1-day change from an ascending, oldest-to-newest price history. */
function computeTickerSnapshot(points: PricePoint[]): { price: number; changePct: number } {
  const price = points[points.length - 1].closingPrice;
  const prevPrice = points.length > 1 ? points[points.length - 2].closingPrice : price;
  const changePct = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
  return { price, changePct };
}

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

  // Independent of the selected `range` above — a stable "most liquid, right
  // now" watchlist rather than something that goes quiet when the period is
  // narrowed to a single day. Ranked by full-history turnover.
  const rankedByLiquidity = useMemo(() => {
    return tickers
      .map((t) => {
        const points = historyByTicker[t.ticker] ?? [];
        const totalTurnover = points.reduce((sum, p) => sum + p.turnover, 0);
        return { ticker: t.ticker, points, totalTurnover };
      })
      .filter((t) => t.points.length > 0)
      .sort((a, b) => b.totalTurnover - a.totalTurnover);
  }, [tickers, historyByTicker]);

  const tickerStripItems: TickerStripItem[] = useMemo(
    () =>
      rankedByLiquidity.slice(0, STRIP_TICKER_COUNT).map(({ ticker, points }) => ({
        ticker,
        ...computeTickerSnapshot(points),
      })),
    [rankedByLiquidity]
  );

  // All-time gain from first to latest available close — independent of the
  // selected `range` above, same as the liquidity ranking, so the watchlist
  // doesn't go quiet when the period is narrowed to a single day.
  const rankedByAllTimeReturn = useMemo(() => {
    return tickers
      .map((t) => {
        const points = historyByTicker[t.ticker] ?? [];
        if (points.length === 0) return null;
        const first = points[0].closingPrice;
        const last = points[points.length - 1].closingPrice;
        const allTimeReturnPct = first > 0 ? ((last - first) / first) * 100 : 0;
        return { ticker: t.ticker, points, allTimeReturnPct };
      })
      .filter((t): t is { ticker: string; points: PricePoint[]; allTimeReturnPct: number } => t !== null)
      .sort((a, b) => b.allTimeReturnPct - a.allTimeReturnPct);
  }, [tickers, historyByTicker]);

  const watchTiles: TickerTileData[] = useMemo(
    () =>
      rankedByAllTimeReturn.slice(0, WATCH_TILE_COUNT).map(({ ticker, points, allTimeReturnPct }) => ({
        ticker,
        price: points[points.length - 1].closingPrice,
        changePct: allTimeReturnPct,
        sparkline: points.map((p) => ({ date: p.date, value: p.closingPrice })),
      })),
    [rankedByAllTimeReturn]
  );

  return (
    <div className="space-y-6">
      <TickerStrip items={tickerStripItems} label="Most Liquid" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Market Summary</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Across {metrics.length} active DSE-listed stocks. Showing change from{" "}
              <strong className="font-medium text-text-primary">{formatDateLabel(range.start)}</strong>{" "}
              to <strong className="font-medium text-text-primary">{formatDateLabel(range.end)}</strong>.
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
        </div>

        {watchTiles.length > 0 && (
          <Block eyebrow="Watchlist" title="All-Time Top Gainers">
            <div className="grid grid-cols-3 gap-3 sm:w-[380px]">
              {watchTiles.map((t) => (
                <TickerTile key={t.ticker} {...t} />
              ))}
            </div>
          </Block>
        )}
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-text-secondary">No trading data in the selected period.</p>
      ) : (
        <div className="space-y-6">
          <Block eyebrow="Overview" title="Market Snapshot">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          </Block>

          <Block
            eyebrow="Breadth"
            title="Market Breadth (Period End)"
            description="How the last trading day in the selected period compares to the rest of it — advance/decline sentiment and price-vs-average positioning."
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Advancing" value={String(breadth.gainers)} accent="good" />
              <StatTile label="Declining" value={String(breadth.losers)} accent="critical" />
              <StatTile
                label="A/D Ratio"
                value={breadth.advanceDeclineRatio === null ? "∞" : breadth.advanceDeclineRatio.toFixed(2)}
                accent={4}
              />
              <StatTile label="Above Avg Price" value={`${breadth.pctAboveAvgPrice.toFixed(1)}%`} accent={3} />
            </div>
          </Block>

          <Block
            eyebrow="Movers"
            title="Top Movers"
            description={`${formatDateLabel(range.start)} → ${formatDateLabel(range.end)}`}
          >
            <div className="space-y-6">
              {tradingDates.length > 1 && (
                <div className="border-b border-border pb-6">
                  <div className="mb-2 text-sm font-medium text-text-secondary">
                    Drag to change the period for the tables below
                  </div>
                  <DateRangeSlider dates={tradingDates} value={range} onChange={setRange} />
                </div>
              )}

              <div className="grid gap-8 lg:grid-cols-2">
                <MoversTable title="Top Gainers" rows={topGainers} mostLiquid={mostLiquid} />
                <MoversTable title="Top Losers" rows={topLosers} mostLiquid={mostLiquid} />
              </div>
            </div>
          </Block>
        </div>
      )}
    </div>
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
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
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
