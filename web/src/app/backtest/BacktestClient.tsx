"use client";

import { useState, useTransition } from "react";
import { runBacktestAction } from "./actions";
import type { BacktestResult } from "@/lib/backtest";
import { formatPct } from "@/lib/format";
import StatTile from "@/components/StatTile";
import ReturnValue from "@/components/ReturnValue";
import PortfolioValueChart from "@/components/charts/PortfolioValueChart";

export default function BacktestClient() {
  const [topN, setTopN] = useState(5);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRun = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await runBacktestAction(topN);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Backtest failed");
      }
    });
  };

  const latestHoldings =
    result && result.dailyHoldings.length > 0
      ? result.dailyHoldings[result.dailyHoldings.length - 1]
      : null;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4">
        <label htmlFor="top-n" className="text-sm font-medium text-text-primary">
          Number of top stocks to hold: <span className="tabular-nums">{topN}</span>
        </label>
        <input
          id="top-n"
          type="range"
          min={1}
          max={15}
          step={1}
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="mt-3 w-full max-w-md"
        />
        <div className="mt-4">
          <button
            type="button"
            onClick={handleRun}
            disabled={isPending}
            style={{ background: "var(--brand-gradient)" }}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
          >
            {isPending ? "Running backtest…" : "Run Backtest"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-status-critical">
          Backtest failed: {error}
        </div>
      )}

      {result && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Total Return" value={<ReturnValue value={result.totalReturnPct} />} />
            <StatTile label="Win Rate" value={`${result.winRatePct.toFixed(1)}%`} />
            <StatTile label="Max Drawdown" value={formatPct(result.maxDrawdownPct, 2)} />
            <StatTile label="Trading Days" value={String(result.tradingDays)} />
            <StatTile label="Best Day" value={<ReturnValue value={result.bestDayPct} />} />
            <StatTile label="Worst Day" value={<ReturnValue value={result.worstDayPct} />} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Stocks to Hold {latestHoldings ? `(${latestHoldings.date})` : ""}
            </h2>
            {latestHoldings && latestHoldings.details.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-4 py-2 font-medium">Stock</th>
                      <th className="px-4 py-2 text-right font-medium">Weight</th>
                      <th className="px-4 py-2 text-right font-medium">Prev Day Return</th>
                      <th className="px-4 py-2 text-right font-medium">Day Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gridline">
                    {latestHoldings.details.map((d) => (
                      <tr key={d.stock} className="hover:bg-text-muted/5">
                        <td className="px-4 py-2 font-medium">{d.stock}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {(100 / latestHoldings.details.length).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 text-right">
                          <ReturnValue value={d.prevReturnPct} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {d.dayReturnPct !== null ? (
                            <ReturnValue value={d.dayReturnPct} />
                          ) : (
                            <span className="text-text-muted">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No holdings to show.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Daily Holdings History</h2>
            {result.dailyHoldings.length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Stocks Held</th>
                      <th className="px-4 py-2 text-right font-medium">Portfolio Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gridline">
                    {result.dailyHoldings.map((h) => (
                      <tr key={h.date} className="hover:bg-text-muted/5">
                        <td className="px-4 py-2 whitespace-nowrap">{h.date}</td>
                        <td className="px-4 py-2 text-text-secondary">{h.stocks.join(", ")}</td>
                        <td className="px-4 py-2 text-right">
                          <ReturnValue value={h.portfolioReturnPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No trading days to show.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Portfolio Value (Top {result.topN} Momentum Strategy)
            </h2>
            <div className="rounded-lg border border-border bg-surface p-4">
              <PortfolioValueChart data={result.portfolioValues} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
