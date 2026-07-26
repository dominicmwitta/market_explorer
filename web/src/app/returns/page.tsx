import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import ReturnsClient from "./ReturnsClient";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const tickers = await getTickers();
  const history = await getPriceHistoryForTickers(tickers.map((t) => t.ticker));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Returns Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Distribution of total returns, the risk/return trade-off, and the latest trading day&apos;s
          momentum, over the selected period.
        </p>
      </div>

      <ReturnsClient tickers={tickers} history={history} />
    </div>
  );
}
