"use server";

import { getAllClosingPrices, type ClosingPricePoint } from "@/lib/db";
import { runMomentumBacktest, type BacktestResult } from "@/lib/backtest";
import { inDateRange, type DateRange } from "@/lib/timeseries";

export async function runBacktestAction(topN: number, range: DateRange): Promise<BacktestResult> {
  const clamped = Math.max(1, Math.min(15, Math.round(topN)));
  const closingPrices = await getAllClosingPrices();

  // Filter each company's series to the selected period BEFORE it reaches
  // runMomentumBacktest — the backtest computes its own day-over-day returns
  // from whatever points it's given, so trimming the input array here is
  // safe and doesn't corrupt the return calculation.
  const filtered: Record<string, ClosingPricePoint[]> = {};
  for (const company of Object.keys(closingPrices)) {
    filtered[company] = closingPrices[company].filter((p) => inDateRange(p.date, range));
  }

  return runMomentumBacktest(filtered, clamped);
}
