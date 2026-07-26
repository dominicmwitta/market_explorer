import { notFound } from "next/navigation";
import { getPriceHistory, getTickers } from "@/lib/db";
import { dailyReturnsPct, sampleStdDev } from "@/lib/metrics";
import { formatCompactTZS, formatTZS } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PriceChart from "@/components/charts/PriceChart";
import BidOfferRatioChart from "@/components/charts/BidOfferRatioChart";

export const dynamic = "force-dynamic";

export default async function StockDetailPage(props: PageProps<"/stocks/[ticker]">) {
  const { ticker: rawTicker } = await props.params;
  const ticker = decodeURIComponent(rawTicker);

  const [history, tickers] = await Promise.all([getPriceHistory(ticker), getTickers()]);
  if (history.length === 0) {
    notFound();
  }

  const sector = tickers.find((t) => t.ticker === ticker)?.sector ?? "Unknown";
  const closingPrices = history.map((h) => h.closingPrice);
  const currentPrice = closingPrices[closingPrices.length - 1];
  const startPrice = closingPrices[0];
  const totalReturnPct = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const volatility = sampleStdDev(dailyReturnsPct(closingPrices));
  const totalTurnover = history.reduce((sum, h) => sum + h.turnover, 0);

  const priceSeries = history.map((h) => ({ date: h.date, closingPrice: h.closingPrice }));
  const ratioSeries = history.map((h) => {
    const { outstandingBids: bids, outstandingOffers: offers } = h;
    const ratio = offers > 0 ? bids / offers : bids > 0 ? null : 0;
    return { date: h.date, ratio };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticker}</h1>
        <p className="mt-1 text-sm text-text-secondary">{sector}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Current Price" value={formatTZS(currentPrice)} accent={1} />
        <StatTile label="Total Return" value={<ReturnValue value={totalReturnPct} />} accent={totalReturnPct >= 0 ? "good" : "critical"} />
        <StatTile label="Volatility" value={`${volatility.toFixed(2)}%`} accent={4} />
        <StatTile label="Total Turnover" value={formatCompactTZS(totalTurnover)} accent={7} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Price History</h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <PriceChart data={priceSeries} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bid/Offer Ratio Trend</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Above the dashed line (1.0) means outstanding bids exceed offers — buy-side pressure.
          Gaps indicate no outstanding offers that day.
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <BidOfferRatioChart data={ratioSeries} />
        </div>
      </section>
    </div>
  );
}
