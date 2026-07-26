import { notFound } from "next/navigation";
import { getPriceHistory, getTickers } from "@/lib/db";
import { sma, rsi, macd, bollingerBands } from "@/lib/indicators";
import TechnicalClient from "./TechnicalClient";
import type { TechCandle } from "./PriceWithBollinger";

export const dynamic = "force-dynamic";

export default async function TechnicalPage(props: PageProps<"/technical/[ticker]">) {
  const { ticker: rawTicker } = await props.params;
  const ticker = decodeURIComponent(rawTicker);

  const [history, tickers] = await Promise.all([getPriceHistory(ticker), getTickers()]);
  if (!tickers.some((t) => t.ticker === ticker)) {
    notFound();
  }

  if (history.length < 2) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{ticker}</h1>
        <p className="text-sm text-text-secondary">Not enough data for technical analysis.</p>
      </div>
    );
  }

  // Rolling-window indicators (SMA-50 needs 49 prior days, etc.) must be computed
  // over the FULL history here, before any period filtering — TechnicalClient only
  // slices this already-computed combined series for display.
  const closingPrices = history.map((h) => h.closingPrice);
  const sma20 = sma(closingPrices, 20);
  const sma50 = sma(closingPrices, 50);
  const bb = bollingerBands(closingPrices);
  const rsiValues = rsi(closingPrices);
  const macdData = macd(closingPrices);

  const priceData: TechCandle[] = history.map((h, i) => {
    const upper = bb.upper[i];
    const lower = bb.lower[i];
    return {
      date: h.date,
      open: h.openingPrice,
      high: h.high,
      low: h.low,
      close: h.closingPrice,
      sma20: sma20[i],
      sma50: sma50[i],
      bbRange: upper !== null && lower !== null ? [lower, upper] : null,
    };
  });

  const rsiData = history.map((h, i) => ({ date: h.date, rsi: rsiValues[i] }));
  const macdSeries = history.map((h, i) => ({
    date: h.date,
    macd: macdData.macd[i],
    signal: macdData.signal[i],
    histogram: macdData.histogram[i],
  }));

  return (
    <TechnicalClient ticker={ticker} priceData={priceData} rsiData={rsiData} macdSeries={macdSeries} />
  );
}
