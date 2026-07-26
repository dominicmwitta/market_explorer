/**
 * Technical indicators — ported exactly from dse_explorer/indicators.py.
 * All functions take a closing-price series (oldest to newest) and return a
 * parallel-length array; `null` marks positions where pandas would have
 * produced NaN (not enough history yet), so charts can render them as gaps.
 */

function rollingMean(values: (number | null)[], period: number): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) {
        valid = false;
        break;
      }
      sum += v;
    }
    result[i] = valid ? sum / period : null;
  }
  return result;
}

/** Simple Moving Average. */
export function sma(closingPrices: number[], period = 20): (number | null)[] {
  return rollingMean(closingPrices, period);
}

/** Exponential Moving Average (span=period, adjust=False — recursive form). */
export function ema(closingPrices: number[], period = 20): number[] {
  const alpha = 2 / (period + 1);
  const result: number[] = new Array(closingPrices.length);
  closingPrices.forEach((price, i) => {
    result[i] = i === 0 ? price : alpha * price + (1 - alpha) * result[i - 1];
  });
  return result;
}

/** Relative Strength Index (0-100). */
export function rsi(closingPrices: number[], period = 14): (number | null)[] {
  const n = closingPrices.length;
  const delta: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) delta[i] = closingPrices[i] - closingPrices[i - 1];

  const gain = delta.map((d) => (d === null ? null : Math.max(d, 0)));
  const loss = delta.map((d) => (d === null ? null : Math.max(-d, 0)));

  const avgGain = rollingMean(gain, period);
  const avgLoss = rollingMean(loss, period);

  return avgGain.map((ag, i) => {
    const al = avgLoss[i];
    if (ag === null || al === null || al === 0) return null; // avg_loss==0 -> RS undefined (matches .replace(0, NaN))
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  });
}

export type MacdResult = { macd: number[]; signal: number[]; histogram: number[] };

/** MACD indicator with Signal and Histogram (12/26/9 EMA spans). */
export function macd(closingPrices: number[]): MacdResult {
  const ema12 = ema(closingPrices, 12);
  const ema26 = ema(closingPrices, 26);
  const macdLine = closingPrices.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export type BollingerBands = {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
};

/** Bollinger Bands (period-window SMA ± stdMultiplier * sample std dev). */
export function bollingerBands(
  closingPrices: number[],
  period = 20,
  stdMultiplier = 2
): BollingerBands {
  const middle = sma(closingPrices, period);
  const n = closingPrices.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const mean = middle[i];
    if (mean === null) continue;
    const window = closingPrices.slice(i - period + 1, i + 1);
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / (period - 1);
    const std = Math.sqrt(variance);
    upper[i] = mean + stdMultiplier * std;
    lower[i] = mean - stdMultiplier * std;
  }

  return { upper, middle, lower };
}
