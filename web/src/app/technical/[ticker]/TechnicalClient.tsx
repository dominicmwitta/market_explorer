"use client";

import { useMemo, useState } from "react";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import RsiChart from "@/components/charts/RsiChart";
import MacdChart from "@/components/charts/MacdChart";
import PriceWithBollinger, { type TechCandle } from "./PriceWithBollinger";

type RsiPoint = { date: string; rsi: number | null };
type MacdPoint = { date: string; macd: number; signal: number; histogram: number };

export default function TechnicalClient({
  ticker,
  priceData,
  rsiData,
  macdSeries,
}: {
  ticker: string;
  priceData: TechCandle[];
  rsiData: RsiPoint[];
  macdSeries: MacdPoint[];
}) {
  const minDate = priceData[0]?.date ?? "";
  const maxDate = priceData[priceData.length - 1]?.date ?? "";
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  // Indicators were already computed over the full history in the server component
  // (leading windows intact) — filtering here only trims what's displayed.
  const filteredPrice = useMemo(
    () => priceData.filter((d) => inDateRange(d.date, range)),
    [priceData, range]
  );
  const filteredRsi = useMemo(
    () => rsiData.filter((d) => inDateRange(d.date, range)),
    [rsiData, range]
  );
  const filteredMacd = useMemo(
    () => macdSeries.filter((d) => inDateRange(d.date, range)),
    [macdSeries, range]
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{ticker}</h1>

      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      {filteredPrice.length === 0 ? (
        <p className="text-sm text-text-secondary">No trading data in the selected period.</p>
      ) : (
        <>
          <PriceWithBollinger ticker={ticker} data={filteredPrice} />

          <section>
            <h2 className="mb-3 text-lg font-semibold">RSI</h2>
            <p className="mb-3 text-sm text-text-secondary">
              Dashed lines mark the conventional overbought (70) and oversold (30) thresholds.
            </p>
            <div className="rounded-lg border border-border bg-surface p-4">
              <RsiChart data={filteredRsi} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">MACD</h2>
            <div className="rounded-lg border border-border bg-surface p-4">
              <MacdChart data={filteredMacd} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
