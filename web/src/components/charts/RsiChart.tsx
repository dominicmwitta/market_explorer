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

type Point = { date: string; rsi: number | null };

export default function RsiChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={70} stroke="var(--status-critical)" strokeDasharray="4 4" />
        <ReferenceLine y={30} stroke="var(--status-good)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [typeof value === "number" ? value.toFixed(2) : "—", "RSI"]}
        />
        <Line
          type="monotone"
          dataKey="rsi"
          stroke="var(--series-7)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
