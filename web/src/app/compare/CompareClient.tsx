"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricePoint } from "@/lib/db";
import { computeCompanyStats, type CompanyStats } from "@/lib/metrics";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import CandlestickChart from "@/components/charts/CandlestickChart";

type Ticker = { ticker: string; sector: string };

const COMPARISON_METRICS: {
  key: keyof CompanyStats;
  label: string;
  suffix: string;
  isReturn?: boolean;
}[] = [
  { key: "totalReturnPct", label: "Return %", suffix: "%", isReturn: true },
  { key: "volatilityPct", label: "Volatility %", suffix: "%" },
  { key: "sharpeRatio", label: "Sharpe Ratio", suffix: "" },
  { key: "liquidityPct", label: "Liquidity %", suffix: "%" },
];

const selectClasses =
  "rounded-lg border border-border bg-surface p-2 text-sm text-text-primary";

export default function CompareClient({ tickers }: { tickers: Ticker[] }) {
  const [stock1, setStock1] = useState(tickers[0]?.ticker ?? "");
  const [stock2, setStock2] = useState(tickers[1]?.ticker ?? tickers[0]?.ticker ?? "");
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [range, setRange] = useState<DateRange>({ start: "", end: "" });
  const [rangeResetKey, setRangeResetKey] = useState("");

  const selectionKey = [...new Set([stock1, stock2])].sort().join(",");

  useEffect(() => {
    if (!stock1 || !stock2) return;
    const key = selectionKey;
    let cancelled = false;

    fetch(`/api/compare?tickers=${key.split(",").map(encodeURIComponent).join(",")}`)
      .then((res) => res.json())
      .then((data: Record<string, PricePoint[]>) => {
        if (!cancelled) {
          setHistory(data);
          setLoadedKey(key);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stock1, stock2, selectionKey]);

  const loading = loadedKey !== selectionKey;

  const allDates = useMemo(
    () => [stock1, stock2].flatMap((t) => (history[t] ?? []).map((h) => h.date)),
    [history, stock1, stock2]
  );
  const minDate = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : "";
  const maxDate = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : "";

  // Reset to the full available window whenever a new pair's data finishes loading
  // (initial load or a ticker swap), so the range default is always "full history".
  // Adjusting state directly during render (rather than in an effect) avoids an
  // extra commit/cascading-render cycle — React re-renders immediately with the
  // updated state before the browser paints.
  if (loadedKey && loadedKey !== rangeResetKey) {
    setRangeResetKey(loadedKey);
    setRange({ start: minDate, end: maxDate });
  }

  const m1 = useMemo(() => {
    const filtered = (history[stock1] ?? []).filter((h) => inDateRange(h.date, range));
    if (filtered.length === 0) return undefined;
    return computeCompanyStats(
      filtered.map((h) => h.closingPrice),
      filtered.map((h) => h.turnover)
    );
  }, [history, stock1, range]);

  const m2 = useMemo(() => {
    const filtered = (history[stock2] ?? []).filter((h) => inDateRange(h.date, range));
    if (filtered.length === 0) return undefined;
    return computeCompanyStats(
      filtered.map((h) => h.closingPrice),
      filtered.map((h) => h.turnover)
    );
  }, [history, stock2, range]);

  const candlesFor = (ticker: string) =>
    (history[ticker] ?? [])
      .filter((h) => inDateRange(h.date, range))
      .map((h) => ({
        date: h.date,
        open: h.openingPrice,
        high: h.high,
        low: h.low,
        close: h.closingPrice,
      }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Stock 1
          <select
            value={stock1}
            onChange={(e) => setStock1(e.target.value)}
            className={selectClasses}
          >
            {tickers.map((t) => (
              <option key={t.ticker} value={t.ticker}>
                {t.ticker}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Stock 2
          <select
            value={stock2}
            onChange={(e) => setStock2(e.target.value)}
            className={selectClasses}
          >
            {tickers.map((t) => (
              <option key={t.ticker} value={t.ticker}>
                {t.ticker}
              </option>
            ))}
          </select>
        </label>
      </div>

      {minDate && maxDate && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
        </div>
      )}

      {m1 && m2 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {COMPARISON_METRICS.map(({ key, label, suffix, isReturn }) => (
            <div key={label} className="flex flex-col gap-3">
              <StatTile
                label={`${stock1} — ${label}`}
                value={
                  isReturn ? (
                    <ReturnValue value={m1[key] as number} />
                  ) : (
                    `${(m1[key] as number).toFixed(2)}${suffix}`
                  )
                }
              />
              <StatTile
                label={`${stock2} — ${label}`}
                value={
                  isReturn ? (
                    <ReturnValue value={m2[key] as number} />
                  ) : (
                    `${(m2[key] as number).toFixed(2)}${suffix}`
                  )
                }
              />
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{stock1 || "Stock 1"} Price</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          {loading && history[stock1] === undefined ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : (
            <CandlestickChart data={candlesFor(stock1)} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{stock2 || "Stock 2"} Price</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          {loading && history[stock2] === undefined ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : (
            <CandlestickChart data={candlesFor(stock2)} />
          )}
        </div>
      </section>
    </div>
  );
}
