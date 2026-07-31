"use client";

import { useMemo, useState } from "react";
import StockFilterBar from "@/components/StockFilterBar";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import ReturnHistogramChart from "@/components/charts/ReturnHistogramChart";
import ReturnVolatilityScatterChart from "@/components/charts/ReturnVolatilityScatterChart";
import MomentumChart from "@/components/charts/MomentumChart";
import { computeMetricsForRange } from "@/lib/metrics";
import type { DateRange } from "@/lib/timeseries";
import type { PricePoint } from "@/lib/db";
import DataAsOf from "@/components/DataAsOf";

const BIN_COUNT = 20;

type TickerMeta = { ticker: string; sector: string; fullName: string };

export default function ReturnsClient({
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

  const bins = useMemo(() => {
    const returns = filtered.map((m) => m.totalReturnPct);
    if (returns.length === 0) return [];
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const binWidth = (max - min) / BIN_COUNT || 1;

    const result = Array.from({ length: BIN_COUNT }, (_, i) => {
      const start = min + i * binWidth;
      const end = start + binWidth;
      return {
        binCenter: (start + end) / 2,
        rangeLabel: `${start.toFixed(1)}% to ${end.toFixed(1)}%`,
        count: 0,
      };
    });
    for (const r of returns) {
      const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((r - min) / binWidth)));
      result[idx].count += 1;
    }
    return result;
  }, [filtered]);

  const scatterData = useMemo(
    () =>
      filtered
        .filter((m) => m.volatilityPct > 0)
        .map((m) => ({
          company: m.company,
          fullName: m.fullName,
          volatilityPct: m.volatilityPct,
          totalReturnPct: m.totalReturnPct,
          totalTurnover: m.totalTurnover,
        })),
    [filtered]
  );
  const momentum = useMemo(
    () => [...filtered].sort((a, b) => b.latestReturnPct - a.latestReturnPct).slice(0, 15),
    [filtered]
  );

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

      <DataAsOf date={maxDate} />

      {filtered.length === 0 ? (
        <p className="text-sm text-text-secondary">Select at least one stock to see returns analysis.</p>
      ) : (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-lg font-semibold">Return Distribution</h2>
              <ReturnHistogramChart data={bins} />
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-1 text-lg font-semibold">Return vs Volatility</h2>
              <p className="mb-3 text-xs text-text-secondary">
                Volatility (x-axis) is how much the price swung day to day — bumpier, not
                automatically worse. The upper-left is generally the most attractive spot: solid
                return for relatively low volatility. Dot size reflects trading activity
                (turnover).
              </p>
              <ReturnVolatilityScatterChart data={scatterData} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Latest Day Momentum</h2>
            <MomentumChart data={momentum} fullNameByTicker={fullNameByTicker} />
          </div>
        </>
      )}
    </div>
  );
}
