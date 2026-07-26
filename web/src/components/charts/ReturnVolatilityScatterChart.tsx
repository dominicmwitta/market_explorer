"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
type Datum = {
  company: string;
  fullName?: string;
  volatilityPct: number;
  totalReturnPct: number;
  totalTurnover: number;
};

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Datum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Datum;
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <div className="font-medium">{d.company}</div>
      {d.fullName && d.fullName !== d.company && (
        <div className="text-text-muted">{d.fullName}</div>
      )}
      <div>Return: {d.totalReturnPct.toFixed(2)}%</div>
      <div>Volatility: {d.volatilityPct.toFixed(2)}%</div>
    </div>
  );
}

export default function ReturnVolatilityScatterChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--gridline)" />
        <XAxis
          type="number"
          dataKey="volatilityPct"
          name="Volatility"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="number"
          dataKey="totalReturnPct"
          name="Return"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ZAxis dataKey="totalTurnover" range={[50, 500]} />
        <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <Tooltip
          content={<ScatterTooltip />}
          cursor={{ strokeDasharray: "3 3", stroke: "var(--baseline)" }}
        />
        <Scatter data={data} fillOpacity={0.75}>
          {data.map((d) => (
            <Cell
              key={d.company}
              fill={d.totalReturnPct >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
