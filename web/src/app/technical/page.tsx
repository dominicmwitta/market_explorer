import Link from "next/link";
import { getTickers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TechnicalIndexPage() {
  const tickers = await getTickers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Technical Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Select a stock to view SMA/Bollinger overlays, RSI, and MACD.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tickers.map((t) => (
          <Link
            key={t.ticker}
            href={`/technical/${encodeURIComponent(t.ticker)}`}
            className="rounded-lg border border-border bg-surface p-4 hover:border-baseline"
          >
            <div className="font-medium text-text-primary">{t.ticker}</div>
            <div className="text-sm text-text-secondary">{t.sector}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
