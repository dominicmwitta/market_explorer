"use server";

import { getAllClosingPrices } from "@/lib/db";
import { runMomentumBacktest, type BacktestResult } from "@/lib/backtest";

export async function runBacktestAction(topN: number): Promise<BacktestResult> {
  const clamped = Math.max(1, Math.min(15, Math.round(topN)));
  const closingPrices = await getAllClosingPrices();
  return runMomentumBacktest(closingPrices, clamped);
}
