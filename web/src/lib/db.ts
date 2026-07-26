import { neon } from "@neondatabase/serverless";
import { computeCompanyStats } from "@/lib/metrics";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to web/.env.local");
}

const sql = neon(process.env.DATABASE_URL);

export type CompanyMetrics = {
  company: string;
  fullName: string;
  sector: string;
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

export type PricePoint = {
  date: string;
  openingPrice: number;
  closingPrice: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  outstandingBids: number;
  outstandingOffers: number;
};

export type OrderBookRow = {
  company: string;
  sector: string;
  date: string;
  outstandingBids: number;
  outstandingOffers: number;
  bidOfferRatio: number | null; // null represents an infinite ratio (bids > 0, offers = 0)
  pressure: string;
};

function classifyPressure(bids: number, offers: number): { ratio: number | null; pressure: string } {
  if (offers === 0) {
    return bids > 0
      ? { ratio: null, pressure: "Strong Buy Pressure (No Offers)" }
      : { ratio: 0, pressure: "Neutral" };
  }
  const ratio = bids / offers;
  if (ratio > 1.5) return { ratio, pressure: "Strong Buy Pressure" };
  if (ratio < 0.67) return { ratio, pressure: "Sell Pressure" };
  return { ratio, pressure: "Neutral" };
}

/**
 * Per-company summary metrics (return, volatility, Sharpe, turnover, liquidity)
 * across the full active price history — mirrors analyzer.py's calculate_metrics().
 * Volatility/Sharpe/latest-return are derived in JS from the same daily-return
 * helpers used elsewhere (dailyReturnsPct/sampleStdDev) so the math matches
 * pandas' pct_change()/.std() exactly, rather than reimplementing it in SQL.
 */
export async function getMarketMetrics(): Promise<CompanyMetrics[]> {
  const rows = await sql`
    SELECT
      dp.company,
      c.sector,
      COALESCE(c.full_name, dp.company) AS full_name,
      dp.date::text AS date,
      dp.closing_price::float8 AS closing_price,
      dp.turnover::float8 AS turnover
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    ORDER BY dp.company, dp.date ASC
  `;

  const byCompany = new Map<
    string,
    { sector: string; fullName: string; closingPrices: number[]; turnovers: number[] }
  >();
  for (const r of rows) {
    const company = r.company as string;
    const entry = byCompany.get(company) ?? {
      sector: r.sector as string,
      fullName: r.full_name as string,
      closingPrices: [],
      turnovers: [],
    };
    entry.closingPrices.push(Number(r.closing_price));
    entry.turnovers.push(Number(r.turnover));
    byCompany.set(company, entry);
  }

  const metrics: CompanyMetrics[] = [];
  for (const [company, { sector, fullName, closingPrices, turnovers }] of byCompany) {
    if (closingPrices.length === 0) continue;
    metrics.push({
      company,
      fullName,
      sector,
      ...computeCompanyStats(closingPrices, turnovers),
    });
  }

  return metrics.sort((a, b) => a.company.localeCompare(b.company));
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
 * Market breadth indicators computed from an already-fetched metrics array —
 * mirrors analyzer.py's market_breadth() (latest-day gainers/losers, A/D ratio,
 * % of stocks trading above their own period-average price). Takes the
 * metrics array rather than re-querying so callers can reuse a single
 * getMarketMetrics() call.
 */
export function marketBreadth(metrics: CompanyMetrics[]): MarketBreadth {
  let gainers = 0;
  let losers = 0;
  let aboveAvg = 0;

  for (const m of metrics) {
    if (m.latestReturnPct > 0) gainers += 1;
    else if (m.latestReturnPct < 0) losers += 1;
    if (m.currentPrice > m.avgClosingPrice) aboveAvg += 1;
  }

  const total = metrics.length;
  const unchanged = total - gainers - losers;
  const advanceDeclineRatio = losers > 0 ? gainers / losers : null;
  const pctPositiveReturn = total > 0 ? (gainers / total) * 100 : 0;
  const pctAboveAvgPrice = total > 0 ? (aboveAvg / total) * 100 : 0;

  return { gainers, losers, unchanged, advanceDeclineRatio, pctPositiveReturn, pctAboveAvgPrice };
}

/**
 * Full price + order-book history for one ticker, ordered oldest to newest.
 * Dates are cast to text in SQL to avoid the JS Date object shifting the
 * calendar day when serialized (date-only Postgres values have no timezone).
 */
export async function getPriceHistory(ticker: string): Promise<PricePoint[]> {
  const rows = await sql`
    SELECT
      dp.date::text AS date,
      dp.opening_price::float8 AS opening_price,
      dp.closing_price::float8 AS closing_price,
      dp.high::float8 AS high,
      dp.low::float8 AS low,
      dp.volume::float8 AS volume,
      dp.turnover::float8 AS turnover,
      dp.outstanding_bids::float8 AS outstanding_bids,
      dp.outstanding_offers::float8 AS outstanding_offers
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active AND dp.company = ${ticker}
    ORDER BY dp.date ASC
  `;

  return rows.map((r) => ({
    date: r.date as string,
    openingPrice: Number(r.opening_price),
    closingPrice: Number(r.closing_price),
    high: Number(r.high),
    low: Number(r.low),
    volume: Number(r.volume),
    turnover: Number(r.turnover),
    outstandingBids: Number(r.outstanding_bids),
    outstandingOffers: Number(r.outstanding_offers),
  }));
}

/**
 * Full price + order-book history for a set of tickers in one round trip,
 * grouped by ticker and ordered oldest to newest — used by client-interactive
 * pages (e.g. /price-trends multi-select) that can't call db.ts directly.
 */
export async function getPriceHistoryForTickers(
  tickers: string[]
): Promise<Record<string, PricePoint[]>> {
  if (tickers.length === 0) return {};

  const rows = await sql`
    SELECT
      dp.company,
      dp.date::text AS date,
      dp.opening_price::float8 AS opening_price,
      dp.closing_price::float8 AS closing_price,
      dp.high::float8 AS high,
      dp.low::float8 AS low,
      dp.volume::float8 AS volume,
      dp.turnover::float8 AS turnover,
      dp.outstanding_bids::float8 AS outstanding_bids,
      dp.outstanding_offers::float8 AS outstanding_offers
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active AND dp.company = ANY(${tickers})
    ORDER BY dp.company, dp.date ASC
  `;

  const result: Record<string, PricePoint[]> = {};
  for (const r of rows) {
    const company = r.company as string;
    const point: PricePoint = {
      date: r.date as string,
      openingPrice: Number(r.opening_price),
      closingPrice: Number(r.closing_price),
      high: Number(r.high),
      low: Number(r.low),
      volume: Number(r.volume),
      turnover: Number(r.turnover),
      outstandingBids: Number(r.outstanding_bids),
      outstandingOffers: Number(r.outstanding_offers),
    };
    (result[company] ??= []).push(point);
  }
  return result;
}

/** Latest-day bid/offer snapshot across all active stocks, with pressure classification. */
export async function getLatestOrderBook(): Promise<OrderBookRow[]> {
  const rows = await sql`
    WITH latest_date AS (
      SELECT MAX(date) AS date FROM daily_prices
    )
    SELECT
      dp.company,
      c.sector,
      dp.date::text AS date,
      dp.outstanding_bids::float8 AS outstanding_bids,
      dp.outstanding_offers::float8 AS outstanding_offers
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    JOIN latest_date ld ON dp.date = ld.date
    WHERE c.active
    ORDER BY dp.company
  `;

  return rows.map((r) => {
    const bids = Number(r.outstanding_bids);
    const offers = Number(r.outstanding_offers);
    const { ratio, pressure } = classifyPressure(bids, offers);
    return {
      company: r.company as string,
      sector: r.sector as string,
      date: r.date as string,
      outstandingBids: bids,
      outstandingOffers: offers,
      bidOfferRatio: ratio,
      pressure,
    };
  });
}

export type ClosingPricePoint = { date: string; closingPrice: number };

/**
 * Full closing-price history for every active ticker, keyed by ticker,
 * oldest to newest — feeds the momentum backtester's date x company pivot
 * (see lib/backtest.ts). A dedicated lean query rather than reusing
 * getPriceHistoryForTickers so the backtest doesn't pull unused columns
 * across ~3000+ rows.
 */
export async function getAllClosingPrices(): Promise<Record<string, ClosingPricePoint[]>> {
  const rows = await sql`
    SELECT dp.company, dp.date::text AS date, dp.closing_price::float8 AS closing_price
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    ORDER BY dp.company, dp.date ASC
  `;

  const result: Record<string, ClosingPricePoint[]> = {};
  for (const r of rows) {
    const company = r.company as string;
    (result[company] ??= []).push({
      date: r.date as string,
      closingPrice: Number(r.closing_price),
    });
  }
  return result;
}

/** All active tickers with their sector and full name, for nav/lookup. */
export async function getTickers(): Promise<{ ticker: string; sector: string; fullName: string }[]> {
  const rows = await sql`
    SELECT ticker, sector, COALESCE(full_name, ticker) AS full_name
    FROM companies WHERE active ORDER BY ticker
  `;
  return rows.map((r) => ({
    ticker: r.ticker as string,
    sector: r.sector as string,
    fullName: r.full_name as string,
  }));
}

export type DailyTurnoverPoint = { date: string; totalTurnover: number };

/** Sum of turnover across all active stocks per calendar date, full history. */
export async function getDailyTotalTurnover(): Promise<DailyTurnoverPoint[]> {
  const rows = await sql`
    SELECT dp.date::text AS date, SUM(dp.turnover)::float8 AS total_turnover
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    GROUP BY dp.date
    ORDER BY dp.date ASC
  `;
  return rows.map((r) => ({ date: r.date as string, totalTurnover: Number(r.total_turnover) }));
}

export type CompanyDailyTurnoverPoint = { date: string; turnover: number };

/**
 * Daily turnover per active company, oldest to newest — lets client-side
 * stock filters re-aggregate the "Daily Turnover Trend" chart to a subset of
 * stocks, unlike getDailyTotalTurnover()'s pre-summed market-wide total.
 */
export async function getDailyTurnoverByCompany(): Promise<
  Record<string, CompanyDailyTurnoverPoint[]>
> {
  const rows = await sql`
    SELECT dp.company, dp.date::text AS date, dp.turnover::float8 AS turnover
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    ORDER BY dp.company, dp.date ASC
  `;

  const result: Record<string, CompanyDailyTurnoverPoint[]> = {};
  for (const r of rows) {
    const company = r.company as string;
    (result[company] ??= []).push({ date: r.date as string, turnover: Number(r.turnover) });
  }
  return result;
}

export type VolumeSpike = {
  company: string;
  latestVolume: number;
  avgVolume: number;
  spikeRatio: number;
};

/**
 * Stocks whose latest-day volume is >= threshold times their historical
 * average volume — mirrors analyzer.py's detect_volume_spikes().
 */
export async function getVolumeSpikes(threshold = 2.0): Promise<VolumeSpike[]> {
  const rows = await sql`
    WITH latest_date AS (
      SELECT MAX(date) AS date FROM daily_prices
    ),
    avgs AS (
      SELECT dp.company, AVG(dp.volume)::float8 AS avg_volume
      FROM daily_prices dp
      JOIN companies c ON c.ticker = dp.company
      WHERE c.active
      GROUP BY dp.company
    ),
    latest AS (
      SELECT dp.company, dp.volume::float8 AS latest_volume
      FROM daily_prices dp
      JOIN companies c ON c.ticker = dp.company
      JOIN latest_date ld ON dp.date = ld.date
      WHERE c.active
    )
    SELECT l.company, l.latest_volume, a.avg_volume
    FROM latest l
    JOIN avgs a ON a.company = l.company
  `;

  return rows
    .map((r) => {
      const latestVolume = Number(r.latest_volume);
      const avgVolume = Number(r.avg_volume);
      const spikeRatio = avgVolume > 0 ? latestVolume / avgVolume : 0;
      return { company: r.company as string, latestVolume, avgVolume, spikeRatio };
    })
    .filter((r) => r.spikeRatio >= threshold)
    .sort((a, b) => b.spikeRatio - a.spikeRatio);
}

export type PressureTrendPoint = {
  date: string;
  strongBuy: number;
  neutral: number;
  sellPressure: number;
};

/**
 * Market-wide buy/sell pressure over time: for each trading day, how many
 * active stocks fall into each pressure bucket (same thresholds as
 * classifyPressure/getLatestOrderBook — the two "Strong Buy" variants are
 * combined into one bucket here since the trend chart only needs sentiment,
 * not the no-offers distinction).
 */
export async function getPressureTrend(): Promise<PressureTrendPoint[]> {
  const rows = await sql`
    SELECT
      dp.date::text AS date,
      dp.outstanding_bids::float8 AS outstanding_bids,
      dp.outstanding_offers::float8 AS outstanding_offers
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    ORDER BY dp.date ASC
  `;

  const byDate = new Map<string, { strongBuy: number; neutral: number; sellPressure: number }>();
  for (const r of rows) {
    const date = r.date as string;
    const bids = Number(r.outstanding_bids);
    const offers = Number(r.outstanding_offers);
    const { pressure } = classifyPressure(bids, offers);

    const entry = byDate.get(date) ?? { strongBuy: 0, neutral: 0, sellPressure: 0 };
    if (pressure.startsWith("Strong Buy Pressure")) entry.strongBuy += 1;
    else if (pressure === "Sell Pressure") entry.sellPressure += 1;
    else entry.neutral += 1;
    byDate.set(date, entry);
  }

  return [...byDate.entries()]
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type LiquidBidOfferSeries = {
  ticker: string;
  points: { date: string; ratio: number | null }[];
};

/**
 * Bid/offer ratio over time for the top-N most liquid stocks (liquidity =
 * highest Total_Turnover, same ranking used for the "Month-End Prices — Top
 * 10 Most Liquid Stocks" feature). Null ratio = outstanding offers are zero
 * with bids present (an "infinite" ratio) — charts should render this as a
 * gap (connectNulls=false), matching the single-stock ratio chart.
 */
export async function getBidOfferRatioForTopLiquid(limit = 10): Promise<LiquidBidOfferSeries[]> {
  const metrics = await getMarketMetrics();
  const topTickers = [...metrics]
    .sort((a, b) => b.totalTurnover - a.totalTurnover)
    .slice(0, limit)
    .map((m) => m.company);

  const history = await getPriceHistoryForTickers(topTickers);

  return topTickers.map((ticker) => ({
    ticker,
    points: (history[ticker] ?? []).map((h) => ({
      date: h.date,
      ratio:
        h.outstandingOffers > 0
          ? h.outstandingBids / h.outstandingOffers
          : h.outstandingBids > 0
            ? null
            : 0,
    })),
  }));
}

export type CompanyPressurePoint = { company: string; date: string; pressure: string };

/**
 * Per-company daily pressure classification (same classifyPressure() rules as
 * getPressureTrend(), just not pre-aggregated by date) — lets callers bucket
 * an arbitrary filtered subset of companies into daily counts themselves,
 * which the market-wide getPressureTrend() aggregate can't support.
 */
export async function getPressureByCompany(): Promise<CompanyPressurePoint[]> {
  const rows = await sql`
    SELECT
      dp.company,
      dp.date::text AS date,
      dp.outstanding_bids::float8 AS outstanding_bids,
      dp.outstanding_offers::float8 AS outstanding_offers
    FROM daily_prices dp
    JOIN companies c ON c.ticker = dp.company
    WHERE c.active
    ORDER BY dp.date ASC
  `;

  return rows.map((r) => {
    const bids = Number(r.outstanding_bids);
    const offers = Number(r.outstanding_offers);
    const { pressure } = classifyPressure(bids, offers);
    return { company: r.company as string, date: r.date as string, pressure };
  });
}
