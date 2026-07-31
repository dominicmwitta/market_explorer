"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { formatPct, formatTZS } from "@/lib/format";

export type TickerTileData = {
  ticker: string;
  price: number;
  changePct: number;
  sparkline: { date: string; value: number }[];
};

/** Compact "watch" tile: ticker, latest price, 1-day change, and a mini trend — no axes/tooltip. */
export default function TickerTile({ ticker, price, changePct, sparkline }: TickerTileData) {
  const up = changePct >= 0;
  const color = up ? "var(--status-good)" : "var(--status-critical)";
  const gradientId = `ticker-spark-${ticker}`;

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs font-semibold text-text-primary">{ticker}</div>
      <div className="mt-0.5 text-sm tabular-nums text-text-secondary">{formatTZS(price)}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-medium tabular-nums" style={{ color }}>
        <span aria-hidden="true">{up ? "▲" : "▼"}</span>
        {formatPct(changePct)}
      </div>
      <div className="mt-2 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
