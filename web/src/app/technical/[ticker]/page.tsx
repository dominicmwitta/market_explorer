import { notFound } from "next/navigation";
import { getPriceHistory, getTickers } from "@/lib/db";
import { sma, rsi, macd, bollingerBands } from "@/lib/indicators";
import RsiChart from "@/components/charts/RsiChart";
import MacdChart from "@/components/charts/MacdChart";
import PriceWithBollinger, { type TechCandle } from "./PriceWithBollinger";

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
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{ticker}</h1>

      <PriceWithBollinger ticker={ticker} data={priceData} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">RSI</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Dashed lines mark the conventional overbought (70) and oversold (30) thresholds.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <RsiChart data={rsiData} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">MACD</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <MacdChart data={macdSeries} />
        </div>
      </section>
    </div>
  );
}
