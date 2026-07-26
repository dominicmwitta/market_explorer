"use client";

import { useMemo, useState } from "react";
import StockFilterBar from "@/components/StockFilterBar";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import TopTurnoverChart from "@/components/charts/TopTurnoverChart";
import TurnoverTreemapChart from "@/components/charts/TurnoverTreemapChart";
import DailyTurnoverAreaChart from "@/components/charts/DailyTurnoverAreaChart";
import { computeMetricsForRange } from "@/lib/metrics";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import type { PricePoint } from "@/lib/db";

type TickerMeta = { ticker: string; sector: string; fullName: string };

export default function VolumeClient({
  tickers,
  history,
}: {
  tickers: TickerMeta[];
  history: Record<string, PricePoint[]>;
}) {
  const allDates = Object.values(history).flatMap((points) => points.map((p) => p.date));
  const minDate = allDates.length > 0 ? allDates.reduce((a, b) => (b < a ? b : a)) : "";
  const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => (b > a ? b : a)) : "";

  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tickers.map((t) => t.ticker))
  );

  const metrics = useMemo(
    () => computeMetricsForRange(tickers, history, range),
    [tickers, history, range]
  );

  const options = useMemo(
    () => tickers.map((t) => ({ ticker: t.ticker, sector: t.sector })),
    [tickers]
  );
  const fullNameByTicker = useMemo(
    () => Object.fromEntries(tickers.map((t) => [t.ticker, t.fullName])),
    [tickers]
  );

  const filtered = useMemo(
    () => metrics.filter((m) => selected.has(m.company)),
    [metrics, selected]
  );

  const top15 = useMemo(
    () => [...filtered].sort((a, b) => b.totalTurnover - a.totalTurnover).slice(0, 15),
    [filtered]
  );
  const treemapData = useMemo(
    () =>
      filtered
        .filter((m) => m.totalTurnover > 0)
        .map((m) => ({
          name: m.company,
          fullName: m.fullName,
          size: m.totalTurnover,
          returnPct: m.totalReturnPct,
        })),
    [filtered]
  );

  const dailyTurnover = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const ticker of selected) {
      for (const point of history[ticker] ?? []) {
        if (!inDateRange(point.date, range)) continue;
        byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.turnover);
      }
    }
    return [...byDate.entries()]
      .map(([date, totalTurnover]) => ({ date, totalTurnover }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, history, range]);

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4">
        <StockFilterBar
          options={options}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(tickers.map((t) => t.ticker)))}
          onClearAll={() => setSelected(new Set())}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-secondary">Select at least one stock to see volume analysis.</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Trading Volume by Stock</h2>
            <TopTurnoverChart data={top15} fullNameByTicker={fullNameByTicker} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Market Share by Turnover</h2>
            <TurnoverTreemapChart data={treemapData} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Daily Turnover Trend</h2>
            <DailyTurnoverAreaChart data={dailyTurnover} />
          </div>
        </>
      )}
    </div>
  );
}
