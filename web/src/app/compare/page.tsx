import { getTickers } from "@/lib/db";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const tickers = await getTickers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare Two Stocks</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Side-by-side return, risk, and price comparison for any two DSE-listed stocks.
        </p>
      </div>

      <CompareClient tickers={tickers} />
    </div>
  );
}
