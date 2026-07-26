"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactTZS } from "@/lib/format";

type Datum = { company: string; totalTurnover: number; totalReturnPct: number };

export default function TopTurnoverChart({
  data,
  fullNameByTicker,
}: {
  data: Datum[];
  fullNameByTicker?: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={400}>
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
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
          }
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
            typeof value === "number" ? formatCompactTZS(value) : "—",
            "Turnover",
          ]}
        />
        <Bar dataKey="totalTurnover" radius={[4, 4, 0, 0]} maxBarSize={32}>
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
