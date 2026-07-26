"use client";

import { useMemo, useState } from "react";
import { formatCompactTZS } from "@/lib/format";
import { computeCompanyStats } from "@/lib/metrics";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import ReturnValue from "@/components/ReturnValue";
import SectorReturnChart from "@/components/charts/SectorReturnChart";
import SectorTurnoverTreemapChart, {
  type SectorTreemapDatum,
} from "@/components/charts/SectorTurnoverTreemapChart";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import StockFilterBar from "@/components/StockFilterBar";
import type { PricePoint } from "@/lib/db";

type TickerInfo = { ticker: string; sector: string; fullName: string };

export default function SectorsClient({
  tickers,
  history,
}: {
  tickers: TickerInfo[];
  history: Record<string, PricePoint[]>;
}) {
  const allTickers = useMemo(() => tickers.map((t) => t.ticker), [tickers]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allTickers));

  const { minDate, maxDate } = useMemo(() => {
    let min = "";
    let max = "";
    for (const ticker of allTickers) {
      const points = history[ticker] ?? [];
      if (points.length === 0) continue;
      if (!min || points[0].date < min) min = points[0].date;
      const last = points[points.length - 1].date;
      if (!max || last > max) max = last;
    }
    return { minDate: min, maxDate: max };
  }, [allTickers, history]);
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  const filterOptions = useMemo(
    () => tickers.map((t) => ({ ticker: t.ticker, sector: t.sector })),
    [tickers]
  );

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  // Per-company stats recomputed over the date-filtered slice, mirroring
  // getMarketMetrics()'s full-history computation (same computeCompanyStats).
  const metrics = useMemo(() => {
    return tickers
      .map((t) => {
        const points = (history[t.ticker] ?? []).filter((h) => inDateRange(h.date, range));
        if (points.length === 0) return null;
        const closingPrices = points.map((p) => p.closingPrice);
        const turnovers = points.map((p) => p.turnover);
        return { company: t.ticker, sector: t.sector, ...computeCompanyStats(closingPrices, turnovers) };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [tickers, history, range]);

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
      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

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
                  No stocks with trading data in the selected period.
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
