"use client";

import { useState } from "react";
import { Area, Line } from "recharts";
import CandlestickChart, { type CandleDatum } from "@/components/charts/CandlestickChart";

export type TechCandle = CandleDatum & {
  sma20: number | null;
  sma50: number | null;
  bbRange: [number, number] | null;
};

export default function PriceWithBollinger({
  ticker,
  data,
}: {
  ticker: string;
  data: TechCandle[];
}) {
  const [showBollinger, setShowBollinger] = useState(false);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{ticker} Price — SMA 20 / SMA 50</h2>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showBollinger}
            onChange={(e) => setShowBollinger(e.target.checked)}
          />
          Show Bollinger Bands
        </label>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <CandlestickChart data={data} height={360}>
          {showBollinger && (
            <Area
              dataKey="bbRange"
              stroke="none"
              fill="var(--series-1)"
              fillOpacity={0.1}
              isAnimationActive={false}
              connectNulls={false}
              name="Bollinger Bands"
            />
          )}
          <Line
            type="monotone"
            dataKey="sma20"
            stroke="var(--series-2)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            name="SMA 20"
          />
          <Line
            type="monotone"
            dataKey="sma50"
            stroke="var(--series-1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            name="SMA 50"
          />
        </CandlestickChart>
      </div>
    </section>
  );
}
