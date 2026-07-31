"use client";

import { useMemo, useState } from "react";
import StockFilterBar from "@/components/StockFilterBar";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import ReturnRankingChart from "@/components/charts/ReturnRankingChart";
import SharpeRatioChart from "@/components/charts/SharpeRatioChart";
import { computeMetricsForRange } from "@/lib/metrics";
import type { DateRange } from "@/lib/timeseries";
import type { PricePoint } from "@/lib/db";
import DataAsOf from "@/components/DataAsOf";

type TickerMeta = { ticker: string; sector: string; fullName: string };

export default function PerformanceClient({
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

  const top10 = useMemo(
    () => [...filtered].sort((a, b) => b.totalReturnPct - a.totalReturnPct).slice(0, 10),
    [filtered]
  );
  const bottom10 = useMemo(
    () => [...filtered].sort((a, b) => a.totalReturnPct - b.totalReturnPct).slice(0, 10),
    [filtered]
  );
  const tradeable = useMemo(
    () =>
      filtered
        .filter((m) => m.volatilityPct > 0)
        .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
        .slice(0, 15),
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
        <p className="text-sm text-text-secondary">Select at least one stock to see performance rankings.</p>
      ) : (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-lg font-semibold">Top Performers</h2>
              <ReturnRankingChart
                data={top10}
                barColor="var(--status-good)"
                fullNameByTicker={fullNameByTicker}
              />
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-lg font-semibold">Worst Performers</h2>
              <ReturnRankingChart
                data={bottom10}
                barColor="var(--status-critical)"
                fullNameByTicker={fullNameByTicker}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Risk-Adjusted Performance (Sharpe Ratio)</h2>
            <p className="mb-3 text-sm text-text-secondary">
              Sharpe ratio measures return earned per unit of volatility (day-to-day price
              swings) taken on — a higher bar means a smoother ride to that return, not
              necessarily a bigger one. It&apos;s one useful measure of risk, not the whole
              picture. Showing the top 15 stocks by Sharpe ratio among those with non-zero
              volatility; bars are green where total return was positive and red where negative.
            </p>
            <SharpeRatioChart data={tradeable} fullNameByTicker={fullNameByTicker} />
          </div>
        </>
      )}
    </div>
  );
}
