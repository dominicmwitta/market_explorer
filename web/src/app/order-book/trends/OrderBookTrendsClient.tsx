"use client";

import { useMemo, useState } from "react";
import { inDateRange, pivotByDate, type DateRange, type SeriesPoint } from "@/lib/timeseries";
import PressureTrendChart from "@/components/charts/PressureTrendChart";
import MultiLineChart from "@/components/charts/MultiLineChart";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import StockFilterBar from "@/components/StockFilterBar";
import type { CompanyPressurePoint, LiquidBidOfferSeries } from "@/lib/db";
import DataAsOf from "@/components/DataAsOf";

export default function OrderBookTrendsClient({
  pressureByCompany,
  liquidRatios,
  tickers,
}: {
  pressureByCompany: CompanyPressurePoint[];
  liquidRatios: LiquidBidOfferSeries[];
  tickers: { ticker: string; sector: string; fullName: string }[];
}) {
  const allTickers = useMemo(() => tickers.map((t) => t.ticker), [tickers]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allTickers));

  const { minDate, maxDate } = useMemo(() => {
    let min = "";
    let max = "";
    for (const p of pressureByCompany) {
      if (!min || p.date < min) min = p.date;
      if (!max || p.date > max) max = p.date;
    }
    return { minDate: min, maxDate: max };
  }, [pressureByCompany]);
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  // Mirrors getPressureTrend()'s server-side aggregation, but over a client-filtered
  // subset of companies — the pre-aggregated market-wide trend can't be un-summed.
  const pressureTrend = useMemo(() => {
    const byDate = new Map<string, { strongBuy: number; neutral: number; sellPressure: number }>();
    for (const p of pressureByCompany) {
      if (!selected.has(p.company) || !inDateRange(p.date, range)) continue;
      const entry = byDate.get(p.date) ?? { strongBuy: 0, neutral: 0, sellPressure: 0 };
      if (p.pressure.startsWith("Strong Buy Pressure")) entry.strongBuy += 1;
      else if (p.pressure === "Sell Pressure") entry.sellPressure += 1;
      else entry.neutral += 1;
      byDate.set(p.date, entry);
    }
    return [...byDate.entries()]
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [pressureByCompany, selected, range]);

  const filteredLiquid = useMemo(
    () => liquidRatios.filter((r) => selected.has(r.ticker)),
    [liquidRatios, selected]
  );
  const liquidTickers = useMemo(() => filteredLiquid.map((r) => r.ticker), [filteredLiquid]);
  const ratioChartData = useMemo(() => {
    const seriesByTicker: Record<string, SeriesPoint<number | null>[]> = {};
    for (const r of filteredLiquid) {
      seriesByTicker[r.ticker] = r.points
        .filter((p) => inDateRange(p.date, range))
        .map((p) => ({ date: p.date, value: p.ratio }));
    }
    return pivotByDate(seriesByTicker, liquidTickers);
  }, [filteredLiquid, liquidTickers, range]);

  return (
    <>
      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      <DataAsOf date={maxDate} />

      <StockFilterBar
        options={tickers}
        selected={selected}
        onToggle={toggle}
        onSelectAll={() => setSelected(new Set(allTickers))}
        onClearAll={() => setSelected(new Set())}
      />

      <section>
        <h2 className="mb-1 text-lg font-semibold">Market-Wide Pressure Trend</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Daily count of selected stocks in each pressure bucket.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <PressureTrendChart data={pressureTrend} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Bid/Offer Ratio Trend — Top 10 Most Liquid Stocks</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Above the dashed line (1.0) means outstanding bids exceed offers — buy-side pressure;
          below means the opposite. Liquidity ranked by total turnover, limited to selected
          stocks. Gaps indicate no outstanding offers that day (an infinite ratio).
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          {liquidTickers.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No selected stocks are in the top-10 liquidity list.
            </p>
          ) : (
            <MultiLineChart
              data={ratioChartData}
              series={liquidTickers.map((t) => ({ key: t, label: t }))}
              referenceLine={1}
              connectNulls={false}
              valueFormat="ratio"
            />
          )}
        </div>
      </section>
    </>
  );
}
