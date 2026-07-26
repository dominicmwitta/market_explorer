import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import PriceTrendsClient from "./PriceTrendsClient";

export const dynamic = "force-dynamic";

export default async function PriceTrendsPage() {
  const tickers = await getTickers();
  const allTickers = tickers.map((t) => t.ticker).sort();
  const defaultSelected = allTickers.slice(0, 5);
  const history = await getPriceHistoryForTickers(allTickers);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Price Trends</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Compare closing prices across stocks, normalized to a common base, and review month-end
          prices for the most liquid names.
        </p>
      </div>

      <PriceTrendsClient allTickers={allTickers} defaultSelected={defaultSelected} history={history} />
    </div>
  );
}
