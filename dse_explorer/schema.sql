-- DSE Explorer schema (Postgres / Neon)

CREATE TABLE IF NOT EXISTS companies (
    ticker      text PRIMARY KEY,
    sector      text NOT NULL DEFAULT 'Unknown',
    active      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS daily_prices (
    company             text NOT NULL REFERENCES companies(ticker),
    date                date NOT NULL,
    opening_price       numeric,
    closing_price       numeric,
    high                numeric,
    low                 numeric,
    turnover            numeric,
    deals               integer,
    outstanding_bids    numeric,
    outstanding_offers  numeric,
    volume              numeric,
    market_cap          numeric,
    source              text,
    inserted_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices (date);
