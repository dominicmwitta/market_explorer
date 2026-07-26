import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to web/.env.local");
}

const sql = neon(process.env.DATABASE_URL);

export type CompanyMetrics = {
  company: string;
  sector: string;
  currentPrice: number;
  startPrice: number;
  totalReturnPct: number;
  totalTurnover: number;
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
 * Per-company summary metrics (current/start price, return, turnover) across
 * the full active price history — mirrors analyzer.py's calculate_metrics().
 */
export async function getMarketMetrics(): Promise<CompanyMetrics[]> {
  const rows = await sql`
    WITH first_prices AS (
      SELECT DISTINCT ON (dp.company)
        dp.company, dp.closing_price::float8 AS start_price
      FROM daily_prices dp
      JOIN companies c ON c.ticker = dp.company
      WHERE c.active
      ORDER BY dp.company, dp.date ASC
    ),
    last_prices AS (
      SELECT DISTINCT ON (dp.company)
        dp.company, dp.closing_price::float8 AS current_price
      FROM daily_prices dp
      JOIN companies c ON c.ticker = dp.company
      WHERE c.active
      ORDER BY dp.company, dp.date DESC
    ),
    turnover AS (
      SELECT dp.company, SUM(dp.turnover)::float8 AS total_turnover
      FROM daily_prices dp
      JOIN companies c ON c.ticker = dp.company
      WHERE c.active
      GROUP BY dp.company
    )
    SELECT
      f.company,
      c.sector,
      l.current_price,
      f.start_price,
      CASE WHEN f.start_price > 0
        THEN (l.current_price - f.start_price) / f.start_price * 100
        ELSE 0
      END AS total_return_pct,
      t.total_turnover
    FROM first_prices f
    JOIN last_prices l ON l.company = f.company
    JOIN turnover t ON t.company = f.company
    JOIN companies c ON c.ticker = f.company
    ORDER BY f.company
  `;

  return rows.map((r) => ({
    company: r.company as string,
    sector: r.sector as string,
    currentPrice: Number(r.current_price),
    startPrice: Number(r.start_price),
    totalReturnPct: Number(r.total_return_pct),
    totalTurnover: Number(r.total_turnover),
  }));
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

/** All active tickers with their sector, for nav/lookup. */
export async function getTickers(): Promise<{ ticker: string; sector: string }[]> {
  const rows = await sql`
    SELECT ticker, sector FROM companies WHERE active ORDER BY ticker
  `;
  return rows.map((r) => ({ ticker: r.ticker as string, sector: r.sector as string }));
}
