import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import PerformanceClient from "./PerformanceClient";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const tickers = await getTickers();
  const history = await getPriceHistoryForTickers(tickers.map((t) => t.ticker));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance Rankings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Total return and risk-adjusted performance across the selected period.
        </p>
      </div>

      <PerformanceClient tickers={tickers} history={history} />
    </div>
  );
}
