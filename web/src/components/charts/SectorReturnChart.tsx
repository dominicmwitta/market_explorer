"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SectorDatum = { sector: string; avgReturnPct: number };

export default function SectorReturnChart({ data }: { data: SectorDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="sector"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          cursor={{ fill: "var(--gridline)" }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [
            typeof value === "number" ? `${value.toFixed(2)}%` : "—",
            "Avg return",
          ]}
        />
        <Bar dataKey="avgReturnPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell
              key={d.sector}
              fill={d.avgReturnPct >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
