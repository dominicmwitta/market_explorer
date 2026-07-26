"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SharpeDatum = { company: string; sharpeRatio: number; totalReturnPct: number };

export default function SharpeRatioChart({
  data,
  fullNameByTicker,
}: {
  data: SharpeDatum[];
  fullNameByTicker?: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="company"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <Tooltip
          cursor={{ fill: "var(--gridline)" }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(label) => (typeof label === "string" ? fullNameByTicker?.[label] ?? label : label)}
          formatter={(value) => [
            typeof value === "number" ? value.toFixed(3) : "—",
            "Sharpe ratio",
          ]}
        />
        <Bar dataKey="sharpeRatio" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {data.map((d) => (
            <Cell
              key={d.company}
              fill={d.totalReturnPct >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
