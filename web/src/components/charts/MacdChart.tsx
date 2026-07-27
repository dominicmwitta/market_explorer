"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; macd: number; signal: number; histogram: number };

export default function MacdChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(2) : "—",
            name,
          ]}
        />
        <Bar dataKey="histogram" isAnimationActive={false} name="Histogram (momentum)">
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.histogram >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="macd"
          stroke="var(--series-1)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
          name="MACD line"
        />
        <Line
          type="monotone"
          dataKey="signal"
          stroke="var(--series-2)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
          name="Signal line"
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
