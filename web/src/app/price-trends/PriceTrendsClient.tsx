"use client";

import { useEffect, useMemo, useState } from "react";
import MultiLineChart from "@/components/charts/MultiLineChart";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import { formatTZS } from "@/lib/format";
import type { PricePoint } from "@/lib/db";
import {
  formatMonthLabel,
  inDateRange,
  monthEndValues,
  normalizeToBase100,
  pivotByDate,
  type DateRange,
  type SeriesPoint,
} from "@/lib/timeseries";

const MAX_SELECTED = 8; // fixed categorical palette has 8 slots — see MultiLineChart
const LIQUID_TOP_N = 10;

type ApiPricePoint = { date: string; closingPrice: number };
type ApiResponse = Record<string, ApiPricePoint[]>;

export default function PriceTrendsClient({
  allTickers,
  defaultSelected,
  history,
}: {
  allTickers: string[];
  defaultSelected: string[];
  history: Record<string, PricePoint[]>;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [compareHistory, setCompareHistory] = useState<ApiResponse>({});
  const [loadedKey, setLoadedKey] = useState("");

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

  const selectionKey = selected.join(",");

  useEffect(() => {
    if (selected.length === 0) return;
    let cancelled = false;
    fetch(`/api/price-trends?tickers=${encodeURIComponent(selectionKey)}`)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (!cancelled) {
          setCompareHistory(data);
          setLoadedKey(selectionKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected, selectionKey]);

  const loading = selected.length > 0 && loadedKey !== selectionKey;

  function toggle(ticker: string) {
    setSelected((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, ticker];
    });
  }

  const seriesByTicker = useMemo<Record<string, SeriesPoint<number>[]>>(() => {
    const result: Record<string, SeriesPoint<number>[]> = {};
    for (const ticker of selected) {
      result[ticker] = (compareHistory[ticker] ?? [])
        .filter((h) => inDateRange(h.date, range))
        .map((h) => ({ date: h.date, value: h.closingPrice }));
    }
    return result;
  }, [compareHistory, selected, range]);

  const priceChartData = useMemo(
    () => pivotByDate(seriesByTicker, selected),
    [seriesByTicker, selected]
  );
  const normalizedChartData = useMemo(
    () => pivotByDate(normalizeToBase100(seriesByTicker, selected), selected),
    [seriesByTicker, selected]
  );
  const seriesSpecs = useMemo(() => selected.map((t) => ({ key: t, label: t })), [selected]);

  // Liquidity ranking for the month-end table is recomputed from turnover
  // WITHIN the selected period, not full history — narrowing the period can
  // change which stocks are "most liquid" and users expect that to update.
  const liquidTop10 = useMemo(() => {
    const totals = allTickers.map((ticker) => {
      const points = (history[ticker] ?? []).filter((h) => inDateRange(h.date, range));
      const totalTurnover = points.reduce((sum, h) => sum + h.turnover, 0);
      return { ticker, totalTurnover };
    });
    return totals
      .sort((a, b) => b.totalTurnover - a.totalTurnover)
      .slice(0, LIQUID_TOP_N)
      .map((t) => t.ticker);
  }, [allTickers, history, range]);

  const monthEndByTicker = useMemo(() => {
    const result: Record<string, SeriesPoint<number>[]> = {};
    for (const ticker of liquidTop10) {
      const points = (history[ticker] ?? [])
        .filter((h) => inDateRange(h.date, range))
        .map((h) => ({ date: h.date, value: h.closingPrice }));
      result[ticker] = monthEndValues(points);
    }
    return result;
  }, [liquidTop10, history, range]);

  const allMonths = useMemo(
    () => [...new Set(liquidTop10.flatMap((t) => (monthEndByTicker[t] ?? []).map((p) => p.date)))].sort(),
    [liquidTop10, monthEndByTicker]
  );
  const monthChartData = useMemo(
    () => pivotByDate(monthEndByTicker, liquidTop10, "month"),
    [monthEndByTicker, liquidTop10]
  );

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-medium text-text-secondary">
            Select stocks to compare (up to {MAX_SELECTED})
          </div>
          <div className="flex flex-wrap gap-2">
            {allTickers.map((ticker) => {
              const active = selected.includes(ticker);
              const disabled = !active && selected.length >= MAX_SELECTED;
              return (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => toggle(ticker)}
                  disabled={disabled}
                  aria-pressed={active}
                  style={active ? { background: "var(--brand-gradient)" } : undefined}
                  className={
                    active
                      ? "rounded-full border border-transparent px-3 py-1 text-xs font-medium text-white"
                      : disabled
                        ? "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted opacity-50"
                        : "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                  }
                >
                  {ticker}
                </button>
              );
            })}
          </div>
        </div>

        {selected.length === 0 ? (
          <p className="text-sm text-text-secondary">Select at least one stock to see its price trend.</p>
        ) : loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Closing Price</h2>
              <div className="rounded-lg border border-border bg-surface p-4">
                <MultiLineChart data={priceChartData} series={seriesSpecs} valueFormat="number" />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold">Normalized Price Comparison (Base = 100)</h2>
              <div className="rounded-lg border border-border bg-surface p-4">
                <MultiLineChart
                  data={normalizedChartData}
                  series={seriesSpecs}
                  referenceLine={100}
                  valueFormat="index"
                />
              </div>
            </section>
          </>
        )}
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Month-End Prices — Top 10 Most Liquid Stocks</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Liquidity ranked by total turnover within the selected period.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          {liquidTop10.length === 0 ? (
            <p className="text-sm text-text-secondary">No trading data in the selected period.</p>
          ) : (
            <MultiLineChart
              data={monthChartData}
              series={liquidTop10.map((t) => ({ key: t, label: t }))}
              xKey="month"
              xFormat="month"
              valueFormat="currency"
            />
          )}
        </div>

        {liquidTop10.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2 font-medium">Company</th>
                  {allMonths.map((month) => (
                    <th key={month} className="px-4 py-2 text-right font-medium">
                      {formatMonthLabel(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gridline">
                {liquidTop10.map((ticker) => {
                  const values = new Map((monthEndByTicker[ticker] ?? []).map((p) => [p.date, p.value]));
                  return (
                    <tr key={ticker} className="hover:bg-text-muted/5">
                      <td className="px-4 py-2 font-medium">{ticker}</td>
                      {allMonths.map((month) => (
                        <td key={month} className="px-4 py-2 text-right tabular-nums">
                          {values.has(month) ? formatTZS(values.get(month)!) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
