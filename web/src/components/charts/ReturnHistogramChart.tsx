"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Bin = { binCenter: number; rangeLabel: string; count: number };

function HistogramTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: Bin }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
      }}
    >
      <div>{d.rangeLabel}</div>
      <div className="font-medium">{d.count} stocks</div>
    </div>
  );
}

export default function ReturnHistogramChart({ data }: { data: Bin[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="binCenter"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: "var(--gridline)" }} content={<HistogramTooltip />} />
        <ReferenceLine x={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <Bar dataKey="count" fill="var(--series-1)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
