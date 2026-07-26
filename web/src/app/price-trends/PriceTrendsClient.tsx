"use client";

import { useEffect, useMemo, useState } from "react";
import MultiLineChart from "@/components/charts/MultiLineChart";
import { normalizeToBase100, pivotByDate, type SeriesPoint } from "@/lib/timeseries";

const MAX_SELECTED = 8; // fixed categorical palette has 8 slots — see MultiLineChart

type ApiPricePoint = { date: string; closingPrice: number };
type ApiResponse = Record<string, ApiPricePoint[]>;

export default function PriceTrendsClient({
  allTickers,
  defaultSelected,
}: {
  allTickers: string[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [history, setHistory] = useState<ApiResponse>({});
  const [loadedKey, setLoadedKey] = useState("");

  const selectionKey = selected.join(",");

  useEffect(() => {
    if (selected.length === 0) return;
    let cancelled = false;
    fetch(`/api/price-trends?tickers=${encodeURIComponent(selectionKey)}`)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (!cancelled) {
          setHistory(data);
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
      result[ticker] = (history[ticker] ?? []).map((h) => ({ date: h.date, value: h.closingPrice }));
    }
    return result;
  }, [history, selected]);

  const priceChartData = useMemo(
    () => pivotByDate(seriesByTicker, selected),
    [seriesByTicker, selected]
  );
  const normalizedChartData = useMemo(
    () => pivotByDate(normalizeToBase100(seriesByTicker, selected), selected),
    [seriesByTicker, selected]
  );
  const seriesSpecs = useMemo(() => selected.map((t) => ({ key: t, label: t })), [selected]);

  return (
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
                className={
                  active
                    ? "rounded-full border border-transparent bg-text-primary px-3 py-1 text-xs font-medium text-surface"
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
  );
}
