/**
 * Momentum backtest: buy top-N stocks by previous day's return, equal weight,
 * daily rebalance. Ports dse_explorer/backtest.py's MomentumBacktest exactly —
 * see that file for the reference algorithm. Pure function (no I/O) so the
 * server action just fetches data via db.ts and hands it here.
 */

export type ClosingPricePoint = { date: string; closingPrice: number };

export type BacktestStockDetail = {
  stock: string;
  prevReturnPct: number;
  dayReturnPct: number | null;
};

export type BacktestHoldingsEntry = {
  date: string;
  stocks: string[];
  details: BacktestStockDetail[];
  portfolioReturnPct: number;
};

export type BacktestPortfolioPoint = { date: string; value: number };

export type BacktestResult = {
  totalReturnPct: number;
  winRatePct: number;
  maxDrawdownPct: number;
  bestDayPct: number;
  worstDayPct: number;
  tradingDays: number;
  topN: number;
  portfolioValues: BacktestPortfolioPoint[];
  dailyHoldings: BacktestHoldingsEntry[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyResult(topN: number): BacktestResult {
  return {
    totalReturnPct: 0,
    winRatePct: 0,
    maxDrawdownPct: 0,
    bestDayPct: 0,
    worstDayPct: 0,
    tradingDays: 0,
    topN,
    portfolioValues: [],
    dailyHoldings: [],
  };
}

export function runMomentumBacktest(
  closingPricesByCompany: Record<string, ClosingPricePoint[]>,
  topN: number
): BacktestResult {
  const companies = Object.keys(closingPricesByCompany).sort();
  if (companies.length === 0) return emptyResult(topN);

  // Pivot closing prices: date -> company -> price (mirrors pd.pivot_table).
  const priceByCompanyDate = new Map<string, Map<string, number>>();
  const allDatesSet = new Set<string>();
  for (const company of companies) {
    const dateMap = new Map<string, number>();
    for (const point of closingPricesByCompany[company]) {
      dateMap.set(point.date, point.closingPrice);
      allDatesSet.add(point.date);
    }
    priceByCompanyDate.set(company, dateMap);
  }

  const dates = [...allDatesSet].sort();
  if (dates.length === 0) return emptyResult(topN);

  // The installed pandas (2.3.3, per dse_explorer/backtest.py) still defaults
  // DataFrame.pct_change(fill_method="pad") — it forward-fills each column's
  // gaps (dates a ticker didn't trade) before diffing, rather than leaving
  // them NaN. Thinly-traded tickers (e.g. ETFs) rank differently if this is
  // skipped, so replicate the forward-fill exactly to match backtest.py.
  const filledPriceByCompany = new Map<string, (number | undefined)[]>();
  for (const company of companies) {
    const dateMap = priceByCompanyDate.get(company)!;
    const filled: (number | undefined)[] = new Array(dates.length);
    let last: number | undefined;
    for (let i = 0; i < dates.length; i++) {
      const raw = dateMap.get(dates[i]);
      if (raw !== undefined) last = raw;
      filled[i] = last;
    }
    filledPriceByCompany.set(company, filled);
  }

  // Day-over-day % returns per company, position-based (mirrors pct_change()).
  // returnsByDateIndex[0] stays empty — the first row has no prior row.
  const returnsByDateIndex: Map<string, number>[] = dates.map(() => new Map());
  for (const company of companies) {
    const filled = filledPriceByCompany.get(company)!;
    for (let i = 1; i < dates.length; i++) {
      const prevPrice = filled[i - 1];
      const price = filled[i];
      if (prevPrice !== undefined && price !== undefined && prevPrice !== 0) {
        returnsByDateIndex[i].set(company, (price - prevPrice) / prevPrice);
      }
    }
  }

  const tradeableDates = dates.slice(1); // returns.index[1:] — skip first NaN row
  let portfolioValue = 100;
  const portfolioValues: BacktestPortfolioPoint[] = [{ date: dates[0], value: portfolioValue }];
  const dailyReturns: number[] = [];
  const dailyHoldings: BacktestHoldingsEntry[] = [];

  for (let i = 0; i < tradeableDates.length; i++) {
    const date = tradeableDates[i];
    const dateIdx = i + 1; // position of `date` within `dates`/`returnsByDateIndex`

    if (i === 0) {
      // No previous return to rank on the first tradeable day
      portfolioValues.push({ date, value: portfolioValue });
      continue;
    }

    const prevDateIdx = dateIdx - 1;
    const prevReturnsMap = returnsByDateIndex[prevDateIdx];
    const prevReturnsSorted = [...prevReturnsMap.entries()].sort((a, b) => b[1] - a[1]);

    const n = Math.min(topN, prevReturnsSorted.length);
    const topStocks = prevReturnsSorted.slice(0, n).map(([company]) => company);

    const todayReturnsMap = returnsByDateIndex[dateIdx];
    const todayValidReturns = topStocks
      .map((s) => todayReturnsMap.get(s))
      .filter((v): v is number => v !== undefined);

    const dailyRet =
      todayValidReturns.length === 0
        ? 0
        : todayValidReturns.reduce((a, b) => a + b, 0) / todayValidReturns.length;

    dailyReturns.push(dailyRet);
    portfolioValue *= 1 + dailyRet;
    portfolioValues.push({ date, value: portfolioValue });

    const details: BacktestStockDetail[] = topStocks.map((stock) => {
      const ret = todayReturnsMap.get(stock);
      const prevRet = prevReturnsMap.get(stock)!;
      return {
        stock,
        prevReturnPct: round2(prevRet * 100),
        dayReturnPct: ret !== undefined ? round2(ret * 100) : null,
      };
    });

    dailyHoldings.push({
      date,
      stocks: topStocks,
      details,
      portfolioReturnPct: round2(dailyRet * 100),
    });
  }

  const totalReturnPct = round2((portfolioValue / 100 - 1) * 100);
  const winRatePct =
    dailyReturns.length > 0
      ? round2((dailyReturns.filter((r) => r > 0).length / dailyReturns.length) * 100)
      : 0;

  let runningMax = -Infinity;
  let maxDrawdown = 0;
  for (const { value } of portfolioValues) {
    runningMax = Math.max(runningMax, value);
    const drawdown = ((value - runningMax) / runningMax) * 100;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  const bestDayPct = dailyReturns.length > 0 ? round2(Math.max(...dailyReturns) * 100) : 0;
  const worstDayPct = dailyReturns.length > 0 ? round2(Math.min(...dailyReturns) * 100) : 0;

  return {
    totalReturnPct,
    winRatePct,
    maxDrawdownPct: round2(maxDrawdown),
    bestDayPct,
    worstDayPct,
    tradingDays: dailyReturns.length,
    topN,
    portfolioValues,
    dailyHoldings,
  };
}
