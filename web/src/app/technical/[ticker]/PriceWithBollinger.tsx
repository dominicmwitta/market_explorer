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
      <p className="mb-3 text-sm text-text-secondary">
        Green candles mean the price closed higher than it opened that day; red means it closed
        lower. SMA 20 and SMA 50 smooth the closing price over the last 20 and 50 trading days to
        show the underlying trend — price holding above both lines suggests an uptrend, below
        both suggests a downtrend. SMA 20 crossing above SMA 50 (a &quot;golden cross&quot;) is
        often read as bullish; crossing below (a &quot;death cross&quot;) is often read as
        bearish. Bollinger Bands widen and narrow with recent volatility: price pushing against
        the upper band can mean it&apos;s stretched above its recent range (risk of a pullback),
        while pushing against the lower band can mean it&apos;s stretched below its recent range
        (potential for a bounce). None of these guarantee what happens next — they describe recent
        behavior, not predict future direction.
      </p>
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
