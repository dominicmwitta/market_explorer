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
