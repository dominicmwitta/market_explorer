import Link from "next/link";
import { getLatestOrderBook } from "@/lib/db";
import { formatNumber, formatRatio } from "@/lib/format";
import PressureBadge from "@/components/PressureBadge";

export const dynamic = "force-dynamic";

export default async function OrderBookPage() {
  const rows = await getLatestOrderBook();
  const asOf = rows[0]?.date;

  const sorted = [...rows].sort((a, b) => {
    const ra = a.bidOfferRatio ?? Infinity;
    const rb = b.bidOfferRatio ?? Infinity;
    return rb - ra;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order Book Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Outstanding bid/offer pressure as of the latest trading day{asOf ? ` (${asOf})` : ""}.
        </p>
      </div>

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
            {sorted.map((r) => (
              <tr key={r.company} className="hover:bg-text-muted/5">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/stocks/${encodeURIComponent(r.company)}`} className="hover:underline">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
