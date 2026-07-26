import { getLatestOrderBook, getTickers, getVolumeSpikes } from "@/lib/db";
import OrderBookClient from "./OrderBookClient";

export const dynamic = "force-dynamic";

export default async function OrderBookPage() {
  const [rows, spikes, tickers] = await Promise.all([
    getLatestOrderBook(),
    getVolumeSpikes(),
    getTickers(),
  ]);
  const asOf = rows[0]?.date;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order Book Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Outstanding bid/offer pressure as of the latest trading day{asOf ? ` (${asOf})` : ""}.
        </p>
      </div>

      <OrderBookClient rows={rows} spikes={spikes} tickers={tickers} />
    </div>
  );
}
