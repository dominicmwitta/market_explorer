"use client";

import { useMemo, useState } from "react";
import { formatCompactTZS } from "@/lib/format";
import ReturnValue from "@/components/ReturnValue";
import SectorReturnChart from "@/components/charts/SectorReturnChart";
import SectorTurnoverTreemapChart, {
  type SectorTreemapDatum,
} from "@/components/charts/SectorTurnoverTreemapChart";
import StockFilterBar from "@/components/StockFilterBar";
import type { CompanyMetrics } from "@/lib/db";

export default function SectorsClient({ metrics }: { metrics: CompanyMetrics[] }) {
  const allTickers = useMemo(() => metrics.map((m) => m.company), [metrics]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allTickers));

  const filterOptions = useMemo(
    () => metrics.map((m) => ({ ticker: m.company, sector: m.sector })),
    [metrics]
  );

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  const filtered = useMemo(() => metrics.filter((m) => selected.has(m.company)), [metrics, selected]);

  const sectors = useMemo(() => {
    const bySector = new Map<string, { returns: number[]; turnover: number; count: number }>();
    for (const m of filtered) {
      const entry = bySector.get(m.sector) ?? { returns: [], turnover: 0, count: 0 };
      entry.returns.push(m.totalReturnPct);
      entry.turnover += m.totalTurnover;
      entry.count += 1;
      bySector.set(m.sector, entry);
    }
    return [...bySector.entries()]
      .map(([sector, { returns, turnover, count }]) => ({
        sector,
        avgReturnPct: returns.reduce((a, b) => a + b, 0) / returns.length,
        numStocks: count,
        totalTurnover: turnover,
      }))
      .sort((a, b) => b.avgReturnPct - a.avgReturnPct);
  }, [filtered]);

  const treemapData = useMemo<SectorTreemapDatum[]>(() => {
    const bySectorCompanies = new Map<string, SectorTreemapDatum["children"]>();
    for (const m of filtered) {
      if (m.totalTurnover <= 0) continue;
      const children = bySectorCompanies.get(m.sector) ?? [];
      children.push({ name: m.company, size: m.totalTurnover, returnPct: m.totalReturnPct });
      bySectorCompanies.set(m.sector, children);
    }
    return [...bySectorCompanies.entries()].map(([sector, children]) => ({ name: sector, children }));
  }, [filtered]);

  return (
    <>
      <StockFilterBar
        options={filterOptions}
        selected={selected}
        onToggle={toggle}
        onSelectAll={() => setSelected(new Set(allTickers))}
        onClearAll={() => setSelected(new Set())}
      />

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
            {sectors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-secondary">
                  No stocks selected.
                </td>
              </tr>
            ) : (
              sectors.map((s) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Market Share by Turnover</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <SectorTurnoverTreemapChart data={treemapData} />
        </div>
      </div>
    </>
  );
}
