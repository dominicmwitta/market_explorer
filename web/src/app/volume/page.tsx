import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import VolumeClient from "./VolumeClient";

export const dynamic = "force-dynamic";

export default async function VolumePage() {
  const tickers = await getTickers();
  const history = await getPriceHistoryForTickers(tickers.map((t) => t.ticker));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Volume Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Trading turnover by stock, market share, and the daily turnover trend over the selected
          period.
        </p>
      </div>

      <VolumeClient tickers={tickers} history={history} />
    </div>
  );
}
