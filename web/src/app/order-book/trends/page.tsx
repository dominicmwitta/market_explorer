import { getBidOfferRatioForTopLiquid, getPressureByCompany, getTickers } from "@/lib/db";
import OrderBookTrendsClient from "./OrderBookTrendsClient";

export const dynamic = "force-dynamic";

export default async function OrderBookTrendsPage() {
  const [pressureByCompany, liquidRatios, tickers] = await Promise.all([
    getPressureByCompany(),
    getBidOfferRatioForTopLiquid(),
    getTickers(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order Book Trends</h1>
        <p className="mt-1 text-sm text-text-secondary">
          How market sentiment and bid/offer pressure have shifted over time, across the full price
          history.
        </p>
      </div>

      <OrderBookTrendsClient
        pressureByCompany={pressureByCompany}
        liquidRatios={liquidRatios}
        tickers={tickers}
      />
    </div>
  );
}
