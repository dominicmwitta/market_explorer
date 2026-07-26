"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; ratio: number | null };

export default function BidOfferRatioChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={1} stroke="var(--baseline)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [
            typeof value === "number" ? value.toFixed(2) : "—",
            "Bid/Offer ratio",
          ]}
        />
        <Line
          type="monotone"
          dataKey="ratio"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
