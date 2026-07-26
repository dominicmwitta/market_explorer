"use client";

import { useMemo, useState } from "react";
import StockFilterBar from "@/components/StockFilterBar";
import ReturnHistogramChart from "@/components/charts/ReturnHistogramChart";
import ReturnVolatilityScatterChart from "@/components/charts/ReturnVolatilityScatterChart";
import MomentumChart from "@/components/charts/MomentumChart";
import type { CompanyMetrics } from "@/lib/db";

const BIN_COUNT = 20;

export default function ReturnsClient({ metrics }: { metrics: CompanyMetrics[] }) {
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
          onSelectAll={() => setSelected(new Set(metrics.map((m) => m.company)))}
          onClearAll={() => setSelected(new Set())}
        />
      </div>

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
              <h2 className="mb-3 text-lg font-semibold">Return vs Volatility</h2>
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
