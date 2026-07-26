"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; closingPrice: number };

export default function PriceChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
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
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => new Intl.NumberFormat("en-US").format(v)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [
            typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—",
            "Close (TZS)",
          ]}
        />
        <Line
          type="monotone"
          dataKey="closingPrice"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
