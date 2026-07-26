"use client";

import { useMemo, useState } from "react";
import StockFilterBar from "@/components/StockFilterBar";
import ReturnRankingChart from "@/components/charts/ReturnRankingChart";
import SharpeRatioChart from "@/components/charts/SharpeRatioChart";
import type { CompanyMetrics } from "@/lib/db";

export default function PerformanceClient({ metrics }: { metrics: CompanyMetrics[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(metrics.map((m) => m.company))
  );

  const options = useMemo(
    () => metrics.map((m) => ({ ticker: m.company, sector: m.sector })),
    [metrics]
  );
  const fullNameByTicker = useMemo(
    () => Object.fromEntries(metrics.map((m) => [m.company, m.fullName])),
    [metrics]
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
          onSelectAll={() => setSelected(new Set(metrics.map((m) => m.company)))}
          onClearAll={() => setSelected(new Set())}
        />
      </div>

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
              Top 15 stocks by Sharpe ratio among those with non-zero volatility, colored by total
              return.
            </p>
            <SharpeRatioChart data={tradeable} fullNameByTicker={fullNameByTicker} />
          </div>
        </>
      )}
    </div>
  );
}
