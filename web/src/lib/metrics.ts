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
