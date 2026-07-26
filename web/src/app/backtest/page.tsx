import { getDailyTotalTurnover } from "@/lib/db";
import BacktestClient from "./BacktestClient";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  // getDailyTotalTurnover() is already grouped/sorted by date across every
  // active ticker, so its first/last rows give the full history's date
  // bounds cheaply — no need for a dedicated bounds query or a second full
  // getAllClosingPrices() fetch just to size the period picker.
  const turnoverByDate = await getDailyTotalTurnover();
  const minDate = turnoverByDate[0]?.date ?? "";
  const maxDate = turnoverByDate[turnoverByDate.length - 1]?.date ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Momentum Backtesting</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Buy the top-N stocks by previous day&apos;s return, equal weight, daily rebalance —
          against the selected price history window.
        </p>
      </div>

      <BacktestClient minDate={minDate} maxDate={maxDate} />
    </div>
  );
}
