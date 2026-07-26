/**
 * Turnover-weighted liquidity index: tracks the top-N most liquid stocks
 * (highest total turnover, same ranking convention as the "Month-End Prices —
 * Top 10 Most Liquid Stocks" feature on /price-trends and
 * getBidOfferRatioForTopLiquid() in db.ts). Weights are fixed at each
 * constituent's share of total turnover across the full period (not
 * rebalanced daily) — a deliberate simplification, surfaced in the UI.
 * Pure function (no I/O) so the page just fetches data via db.ts and hands
 * it here.
 */

import type { CompanyMetrics } from "@/lib/db";

export type IndexConstituent = {
  ticker: string;
  fullName: string;
  sector: string;
  weightPct: number;
  periodReturnPct: number;
  contributionPct: number;
};

export type IndexPoint = { date: string; value: number };

export type LiquidityIndexResult = {
  points: IndexPoint[];
  constituents: IndexConstituent[];
};

function emptyResult(): LiquidityIndexResult {
  return { points: [], constituents: [] };
}

export function buildLiquidityIndex(
  topMetrics: CompanyMetrics[],
  priceHistory: Record<string, { date: string; closingPrice: number }[]>
): LiquidityIndexResult {
  if (topMetrics.length === 0) return emptyResult();

  const totalTurnover = topMetrics.reduce((sum, m) => sum + m.totalTurnover, 0);
  if (totalTurnover <= 0) return emptyResult();

  const weightByTicker = new Map<string, number>();
  for (const m of topMetrics) {
    weightByTicker.set(m.company, m.totalTurnover / totalTurnover);
  }

  const tickers = topMetrics.map((m) => m.company);

  // Union of dates across all constituents, sorted — some thinly-traded
  // tickers don't post a price every day the market is open.
  const allDatesSet = new Set<string>();
  const priceByTickerDate = new Map<string, Map<string, number>>();
  for (const ticker of tickers) {
    const dateMap = new Map<string, number>();
    for (const point of priceHistory[ticker] ?? []) {
      dateMap.set(point.date, point.closingPrice);
      allDatesSet.add(point.date);
    }
    priceByTickerDate.set(ticker, dateMap);
  }
  const dates = [...allDatesSet].sort();
  if (dates.length === 0) return emptyResult();

  // Forward-fill each constituent's price across gaps (carry last known close
  // forward), matching lib/backtest.ts's filledPriceByCompany — the installed
  // pandas still defaults pct_change(fill_method="pad"), and this keeps the
  // TS index construction consistent with that same gap-handling convention
  // rather than inventing a different one.
  const filledByTicker = new Map<string, (number | undefined)[]>();
  for (const ticker of tickers) {
    const dateMap = priceByTickerDate.get(ticker)!;
    const filled: (number | undefined)[] = new Array(dates.length);
    let last: number | undefined;
    for (let i = 0; i < dates.length; i++) {
      const raw = dateMap.get(dates[i]);
      if (raw !== undefined) last = raw;
      filled[i] = last;
    }
    filledByTicker.set(ticker, filled);
  }

  // t0 = first date in the aligned series. Each constituent's own price is
  // indexed to its own t0 close, weighted, and summed — so the index starts
  // at exactly 100 (every price-relative is 1 at t0, weights sum to 1).
  // If a constituent has no price yet at t0 (shouldn't happen for active DSE
  // tickers, which all share a common history start, but guarded defensively
  // for a future thinly-listed IPO), it's excluded from the sum at that date
  // and its weight is renormalized across the remaining constituents so the
  // index doesn't silently understate itself.
  const startPriceByTicker = new Map<string, number>();
  for (const ticker of tickers) {
    const startPrice = filledByTicker.get(ticker)![0];
    if (startPrice !== undefined && startPrice > 0) {
      startPriceByTicker.set(ticker, startPrice);
    }
  }

  const points: IndexPoint[] = dates.map((date, i) => {
    let weightedSum = 0;
    let weightPresent = 0;
    for (const ticker of tickers) {
      const startPrice = startPriceByTicker.get(ticker);
      if (startPrice === undefined) continue;
      const price = filledByTicker.get(ticker)![i];
      if (price === undefined) continue;
      const weight = weightByTicker.get(ticker)!;
      weightedSum += weight * (price / startPrice);
      weightPresent += weight;
    }
    const value = weightPresent > 0 ? 100 * (weightedSum / weightPresent) : 100;
    return { date, value };
  });

  const lastIdx = dates.length - 1;
  const constituents: IndexConstituent[] = topMetrics.map((m) => {
    const ticker = m.company;
    const startPrice = startPriceByTicker.get(ticker);
    const endPrice = filledByTicker.get(ticker)![lastIdx];
    const weight = weightByTicker.get(ticker)!;
    const periodReturnPct =
      startPrice !== undefined && endPrice !== undefined
        ? (endPrice / startPrice - 1) * 100
        : 0;
    const contributionPct = weight * periodReturnPct;
    return {
      ticker,
      fullName: m.fullName,
      sector: m.sector,
      weightPct: weight * 100,
      periodReturnPct,
      contributionPct,
    };
  });
  constituents.sort((a, b) => b.weightPct - a.weightPct);

  return { points, constituents };
}
