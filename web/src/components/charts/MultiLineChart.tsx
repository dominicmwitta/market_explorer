"use client";

import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatTZS } from "@/lib/format";
import { formatMonthLabel } from "@/lib/timeseries";

// Fixed-order categorical series colors — never cycled or reassigned by rank.
const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

// String flags, not function props — this component is also rendered directly from Server
// Components (e.g. price-trends/page.tsx), and functions can't cross the server/client boundary.
export type ValueFormat = "number" | "currency" | "ratio" | "index";
export type XFormat = "date" | "month";

const VALUE_FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  number: formatNumber,
  currency: formatTZS,
  ratio: (v) => v.toFixed(2),
  index: (v) => v.toFixed(1),
};

const X_FORMATTERS: Record<XFormat, (v: string) => string> = {
  date: (v) => v,
  month: formatMonthLabel,
};

export type LineSeriesSpec = { key: string; label: string };

/**
 * Generic multi-line time series chart: one Line per series, colors assigned
 * in fixed palette order. Beyond 8 series (only the top-10-liquidity month-end
 * chart needs this) colors 1-2 repeat with a dashed stroke so lines stay
 * distinguishable — the accompanying data table is the accessible fallback.
 */
export default function MultiLineChart({
  data,
  series,
  xKey = "date",
  height = 360,
  xFormat = "date",
  valueFormat = "number",
  referenceLine,
  connectNulls = true,
}: {
  data: Record<string, unknown>[];
  series: LineSeriesSpec[];
  xKey?: string;
  height?: number;
  xFormat?: XFormat;
  valueFormat?: ValueFormat;
  referenceLine?: number;
  connectNulls?: boolean;
}) {
  const formatValue = VALUE_FORMATTERS[valueFormat];
  const formatX = X_FORMATTERS[xFormat];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey={xKey}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          minTickGap={40}
          tickFormatter={formatX}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => new Intl.NumberFormat("en-US").format(v)}
        />
        {referenceLine !== undefined && (
          <ReferenceLine y={referenceLine} stroke="var(--baseline)" strokeDasharray="4 4" />
        )}
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(label) => (typeof label === "string" ? formatX(label) : label)}
          formatter={(value, name) => [typeof value === "number" ? formatValue(value) : "—", name ?? ""]}
        />
        {/* itemSorter overrides Recharts' default alphabetical legend sort so order matches the
            fixed series/color order (and, for the month-end chart, the liquidity-ranked table). */}
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} itemSorter={() => 0} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeDasharray={i >= SERIES_COLORS.length ? "6 3" : undefined}
            strokeWidth={2}
            dot={false}
            connectNulls={connectNulls}
            activeDot={{ r: 3, stroke: "var(--surface-1)", strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
