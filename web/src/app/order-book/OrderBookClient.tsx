"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatNumber, formatRatio } from "@/lib/format";
import PressureBadge from "@/components/PressureBadge";
import StockFilterBar from "@/components/StockFilterBar";
import type { OrderBookRow, VolumeSpike } from "@/lib/db";

export default function OrderBookClient({
  rows,
  spikes,
  tickers,
}: {
  rows: OrderBookRow[];
  spikes: VolumeSpike[];
  tickers: { ticker: string; sector: string; fullName: string }[];
}) {
  const allTickers = useMemo(() => tickers.map((t) => t.ticker), [tickers]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allTickers));
  const fullNameByTicker = useMemo(
    () => new Map(tickers.map((t) => [t.ticker, t.fullName])),
    [tickers]
  );

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  const sorted = useMemo(() => {
    return rows
      .filter((r) => selected.has(r.company))
      .sort((a, b) => {
        const ra = a.bidOfferRatio ?? Infinity;
        const rb = b.bidOfferRatio ?? Infinity;
        return rb - ra;
      });
  }, [rows, selected]);

  const filteredSpikes = useMemo(
    () => spikes.filter((s) => selected.has(s.company)),
    [spikes, selected]
  );

  return (
    <>
      <StockFilterBar
        options={tickers}
        selected={selected}
        onToggle={toggle}
        onSelectAll={() => setSelected(new Set(allTickers))}
        onClearAll={() => setSelected(new Set())}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Sector</th>
              <th className="px-4 py-2 text-right font-medium">Bids</th>
              <th className="px-4 py-2 text-right font-medium">Offers</th>
              <th className="px-4 py-2 text-right font-medium">Ratio</th>
              <th className="px-4 py-2 font-medium">Pressure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gridline">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No stocks selected.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.company} className="hover:bg-text-muted/5">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={`/stocks/${encodeURIComponent(r.company)}`}
                      className="hover:underline"
                      title={fullNameByTicker.get(r.company)}
                    >
                      {r.company}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{r.sector}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(r.outstandingBids)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(r.outstandingOffers)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRatio(r.bidOfferRatio)}</td>
                  <td className="px-4 py-2">
                    <PressureBadge pressure={r.pressure} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Volume Spike Alerts</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Stocks trading at least 2x their historical average volume on the latest trading day.
        </p>
        {filteredSpikes.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            No volume spikes detected among the selected stocks on the latest trading day.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 text-right font-medium">Latest Volume</th>
                  <th className="px-4 py-2 text-right font-medium">Avg Volume</th>
                  <th className="px-4 py-2 text-right font-medium">Spike Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gridline">
                {filteredSpikes.map((s) => (
                  <tr key={s.company} className="hover:bg-text-muted/5">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/stocks/${encodeURIComponent(s.company)}`}
                        className="hover:underline"
                        title={fullNameByTicker.get(s.company)}
                      >
                        {s.company}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(s.latestVolume)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(s.avgVolume)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.spikeRatio.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
