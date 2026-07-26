"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { company: string; latestReturnPct: number };

interface ValueLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}

function ValueLabel({ x = 0, y = 0, width = 0, height = 0, value }: ValueLabelProps) {
  if (typeof value !== "number") return null;
  const positive = value >= 0;
  const cx = x + width / 2;
  const cy = positive ? y - 6 : y + height + 14;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={11}
      fill={positive ? "var(--status-good)" : "var(--status-critical)"}
    >
      {`${positive ? "+" : ""}${value.toFixed(2)}%`}
    </text>
  );
}

export default function MomentumChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
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
            "Latest return",
          ]}
        />
        <Bar dataKey="latestReturnPct" radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d) => (
            <Cell
              key={d.company}
              fill={d.latestReturnPct >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            />
          ))}
          <LabelList dataKey="latestReturnPct" content={<ValueLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
