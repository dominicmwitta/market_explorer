import { inDateRange, type DateRange } from "@/lib/timeseries";

/** Day-over-day % change, matching analyzer.py's Daily_Return calculation. */
export function dailyReturnsPct(closingPrices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closingPrices.length; i++) {
    const prev = closingPrices[i - 1];
    if (prev !== 0) {
      returns.push(((closingPrices[i] - prev) / prev) * 100);
    }
  }
  return returns;
}

/** Sample standard deviation (ddof=1), matching pandas Series.std(). */
export function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export type CompanyStats = {
  currentPrice: number;
  startPrice: number;
  totalReturnPct: number;
  totalTurnover: number;
  volatilityPct: number;
  sharpeRatio: number;
  latestReturnPct: number;
  liquidityPct: number;
  avgClosingPrice: number;
};

/**
 * Computes the same per-company statistics as db.ts's getMarketMetrics(),
 * but as a pure function over an arbitrary (already date-filtered) slice of
 * a company's price history — the shared basis for both the full-history
 * server computation and any client-side period-filtered recomputation.
 * closingPrices/turnovers must be ordered oldest-to-newest and the same length.
 */
export function computeCompanyStats(closingPrices: number[], turnovers: number[]): CompanyStats {
  const startPrice = closingPrices[0] ?? 0;
  const currentPrice = closingPrices[closingPrices.length - 1] ?? 0;
  const totalReturnPct = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

  const dailyReturns = dailyReturnsPct(closingPrices);
  const volatilityPct = sampleStdDev(dailyReturns);
  const avgDailyReturnPct =
    dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const sharpeRatio = volatilityPct > 0 ? avgDailyReturnPct / volatilityPct : 0;
  const latestReturnPct = dailyReturns.length > 0 ? dailyReturns[dailyReturns.length - 1] : 0;

  const totalTurnover = turnovers.reduce((a, b) => a + b, 0);
  const tradingDays = turnovers.filter((t) => t > 0).length;
  const liquidityPct = closingPrices.length > 0 ? (tradingDays / closingPrices.length) * 100 : 0;
  const avgClosingPrice =
    closingPrices.length > 0 ? closingPrices.reduce((a, b) => a + b, 0) / closingPrices.length : 0;

  return {
    currentPrice,
    startPrice,
    totalReturnPct,
    totalTurnover,
    volatilityPct,
    sharpeRatio,
    latestReturnPct,
    liquidityPct,
    avgClosingPrice,
  };
}

export type MarketBreadth = {
  gainers: number;
  losers: number;
  unchanged: number;
  advanceDeclineRatio: number | null; // null represents an infinite ratio (losers = 0)
  pctPositiveReturn: number;
  pctAboveAvgPrice: number;
};

/**
 * Same logic as db.ts's marketBreadth(), duplicated here as a pure function
 * so client components (e.g. HomeClient's period-filtered recomputation) can
 * call it without importing db.ts — which would drag its module-level
 * neon(process.env.DATABASE_URL) call into the client bundle and throw, since
 * that env var isn't exposed to the browser.
 */
export function computeMarketBreadth(
  companies: { latestReturnPct: number; currentPrice: number; avgClosingPrice: number }[]
): MarketBreadth {
  let gainers = 0;
  let losers = 0;
  let aboveAvg = 0;

  for (const c of companies) {
    if (c.latestReturnPct > 0) gainers += 1;
    else if (c.latestReturnPct < 0) losers += 1;
    if (c.currentPrice > c.avgClosingPrice) aboveAvg += 1;
  }

  const total = companies.length;
  const unchanged = total - gainers - losers;
  const advanceDeclineRatio = losers > 0 ? gainers / losers : null;
  const pctPositiveReturn = total > 0 ? (gainers / total) * 100 : 0;
  const pctAboveAvgPrice = total > 0 ? (aboveAvg / total) * 100 : 0;

  return { gainers, losers, unchanged, advanceDeclineRatio, pctPositiveReturn, pctAboveAvgPrice };
}

export type PeriodHistoryPoint = { date: string; closingPrice: number; turnover: number };

export type CompanyMetricsForRange = CompanyStats & {
  company: string;
  fullName: string;
  sector: string;
};

/**
 * Client-side equivalent of db.ts's getMarketMetrics(), but recomputed over an
 * arbitrary date range from raw per-company history instead of the full
 * history — the shared basis for period filtering on /performance, /returns,
 * and /volume, which all fetch the same raw getPriceHistoryForTickers() data
 * and re-derive CompanyMetrics-shaped rows client-side per selected range.
 * Companies with no rows in range are omitted, matching getMarketMetrics().
 */
export function computeMetricsForRange(
  tickers: { ticker: string; sector: string; fullName: string }[],
  historyByTicker: Record<string, PeriodHistoryPoint[]>,
  range: DateRange
): CompanyMetricsForRange[] {
  const metrics: CompanyMetricsForRange[] = [];
  for (const { ticker, sector, fullName } of tickers) {
    const points = (historyByTicker[ticker] ?? []).filter((p) => inDateRange(p.date, range));
    if (points.length === 0) continue;
    const closingPrices = points.map((p) => p.closingPrice);
    const turnovers = points.map((p) => p.turnover);
    metrics.push({
      company: ticker,
      fullName,
      sector,
      ...computeCompanyStats(closingPrices, turnovers),
    });
  }
  return metrics.sort((a, b) => a.company.localeCompare(b.company));
}
