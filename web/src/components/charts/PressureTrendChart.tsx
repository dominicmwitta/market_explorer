"use client";

import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

type Point = { date: string; strongBuy: number; neutral: number; sellPressure: number };

/** Market-wide buy/sell pressure over time — stacked area, status colors reserved for polarity. */
export default function PressureTrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => [
            typeof value === "number" ? formatNumber(value) : "—",
            name ?? "",
          ]}
        />
        {/* itemSorter overrides Recharts' default alphabetical legend sort — keep good/neutral/bad order. */}
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} itemSorter={() => 0} />
        <Area
          type="monotone"
          dataKey="strongBuy"
          name="Strong Buy Pressure"
          stackId="pressure"
          stroke="var(--status-good)"
          fill="var(--status-good)"
          fillOpacity={0.35}
        />
        <Area
          type="monotone"
          dataKey="neutral"
          name="Neutral"
          stackId="pressure"
          stroke="var(--text-muted)"
          fill="var(--text-muted)"
          fillOpacity={0.25}
        />
        <Area
          type="monotone"
          dataKey="sellPressure"
          name="Sell Pressure"
          stackId="pressure"
          stroke="var(--status-critical)"
          fill="var(--status-critical)"
          fillOpacity={0.35}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
