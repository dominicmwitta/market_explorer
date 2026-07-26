"use client";

import { useMemo, useState } from "react";
import { computeCompanyStats } from "@/lib/metrics";
import { inDateRange, type DateRange } from "@/lib/timeseries";
import { formatCompactTZS, formatTZS } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import PriceChart from "@/components/charts/PriceChart";
import BidOfferRatioChart from "@/components/charts/BidOfferRatioChart";
import type { PricePoint } from "@/lib/db";

export default function StockDetailClient({
  ticker,
  sector,
  history,
}: {
  ticker: string;
  sector: string;
  history: PricePoint[];
}) {
  const minDate = history[0]?.date ?? "";
  const maxDate = history[history.length - 1]?.date ?? "";
  const [range, setRange] = useState<DateRange>({ start: minDate, end: maxDate });

  const filtered = useMemo(
    () => history.filter((h) => inDateRange(h.date, range)),
    [history, range]
  );

  const stats = useMemo(() => {
    const closingPrices = filtered.map((h) => h.closingPrice);
    const turnovers = filtered.map((h) => h.turnover);
    return computeCompanyStats(closingPrices, turnovers);
  }, [filtered]);

  const priceSeries = useMemo(
    () => filtered.map((h) => ({ date: h.date, closingPrice: h.closingPrice })),
    [filtered]
  );
  const ratioSeries = useMemo(
    () =>
      filtered.map((h) => {
        const { outstandingBids: bids, outstandingOffers: offers } = h;
        const ratio = offers > 0 ? bids / offers : bids > 0 ? null : 0;
        return { date: h.date, ratio };
      }),
    [filtered]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticker}</h1>
        <p className="mt-1 text-sm text-text-secondary">{sector}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <PeriodFilterBar minDate={minDate} maxDate={maxDate} value={range} onChange={setRange} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-secondary">No trading data in the selected period.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Current Price" value={formatTZS(stats.currentPrice)} accent={1} />
            <StatTile
              label="Total Return"
              value={<ReturnValue value={stats.totalReturnPct} />}
              accent={stats.totalReturnPct >= 0 ? "good" : "critical"}
            />
            <StatTile label="Volatility" value={`${stats.volatilityPct.toFixed(2)}%`} accent={4} />
            <StatTile label="Total Turnover" value={formatCompactTZS(stats.totalTurnover)} accent={7} />
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
        </>
      )}
    </div>
  );
}
