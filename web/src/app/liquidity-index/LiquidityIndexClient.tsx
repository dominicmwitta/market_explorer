"use client";

import { useMemo, useState } from "react";
import type { CompanyMetrics } from "@/lib/db";
import { buildLiquidityIndex } from "@/lib/liquidityIndex";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import LiquidityIndexChart from "@/components/charts/LiquidityIndexChart";

type ClosingPoint = { date: string; closingPrice: number; turnover: number };

export default function LiquidityIndexClient({
  topMetrics,
  priceHistory,
  maxN,
  minDate,
  maxDate,
}: {
  topMetrics: CompanyMetrics[];
  priceHistory: Record<string, ClosingPoint[]>;
  maxN: number;
  minDate: string;
  maxDate: string;
}) {
  const [topN, setTopN] = useState(Math.min(10, maxN));
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  const filteredHistory = useMemo(() => {
    const out: Record<string, { date: string; closingPrice: number }[]> = {};
    for (const ticker of Object.keys(priceHistory)) {
      out[ticker] = priceHistory[ticker]
        .filter((p) => inDateRange(p.date, range))
        .map((p) => ({ date: p.date, closingPrice: p.closingPrice }));
    }
    return out;
  }, [priceHistory, range]);

  // Re-rank "most liquid" by turnover summed WITHIN the selected period,
  // rather than trusting the full-history ranking baked into topMetrics.
  // Simplification: only re-ranks within the top-20-by-full-period-turnover
  // pool already fetched server-side (see page.tsx's MAX_N) — a stock outside
  // that top 20 overall but highly liquid only in a short window would be
  // missed. Documented in the methodology caption below.
  const periodRankedMetrics = useMemo(() => {
    return [...topMetrics]
      .map((m) => {
        const periodTurnover = (priceHistory[m.company] ?? [])
          .filter((p) => inDateRange(p.date, range))
          .reduce((sum, p) => sum + p.turnover, 0);
        return { ...m, totalTurnover: periodTurnover };
      })
      .sort((a, b) => b.totalTurnover - a.totalTurnover);
  }, [topMetrics, priceHistory, range]);

  const result = useMemo(
    () => buildLiquidityIndex(periodRankedMetrics.slice(0, topN), filteredHistory),
    [periodRankedMetrics, filteredHistory, topN]
  );

  const indexReturnPct =
    result.points.length > 0 ? result.points[result.points.length - 1].value - 100 : 0;
  const topHolding = result.constituents[0];

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        Turnover-weighted, not market-cap-weighted: each constituent&apos;s weight is its share of
        total turnover among the chosen names, recomputed for the selected period. Weights are
        fixed at the period total (no daily rebalancing), and gaps from thinly-traded days are
        forward-filled from each stock&apos;s last known close — a simplification for analysis, not a
        published index. &quot;Most liquid&quot; is re-ranked by turnover within the selected period, but
        only among the top 20 stocks by full-history turnover fetched for this page — a stock
        outside that top 20 overall that was highly liquid only during a short selected window
        would not appear here.
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />

        <div>
          <label htmlFor="top-n" className="text-sm font-medium text-text-primary">
            Number of constituents: <span className="tabular-nums">{topN}</span>
          </label>
          <input
            id="top-n"
            type="range"
            min={2}
            max={maxN}
            step={1}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="mt-3 w-full max-w-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Index Return" value={<ReturnValue value={indexReturnPct} />} />
        <StatTile label="Constituents" value={String(result.constituents.length)} />
        <StatTile
          label="Top Holding"
          value={topHolding ? topHolding.ticker : "—"}
          sub={topHolding ? `${topHolding.weightPct.toFixed(1)}% weight` : undefined}
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Index Value (Base = 100)</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <LiquidityIndexChart data={result.points} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Constituent Breakdown</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 text-right font-medium">Weight</th>
                <th className="px-4 py-2 text-right font-medium">Period Return</th>
                <th className="px-4 py-2 text-right font-medium">Contribution (pp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gridline">
              {result.constituents.map((c) => (
                <tr key={c.ticker} className="hover:bg-text-muted/5">
                  <td className="px-4 py-2">
                    <span className="font-medium">{c.ticker}</span>
                    <span className="ml-2 text-text-muted">{c.fullName}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.weightPct.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right">
                    <ReturnValue value={c.periodReturnPct} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ReturnValue value={c.contributionPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
