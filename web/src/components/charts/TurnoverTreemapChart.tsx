"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatCompactTZS } from "@/lib/format";

type LeafDatum = { name: string; fullName?: string; size: number; returnPct: number };

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  returnPct?: number;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, returnPct = 0 }: CellProps) {
  const fill = returnPct >= 0 ? "var(--status-good)" : "var(--status-critical)";
  const showLabel = width > 42 && height > 24;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.85}
        stroke="var(--surface-1)"
        strokeWidth={2}
      />
      {showLabel && (
        <text x={x + 6} y={y + 16} fontSize={11} fill="#fff">
          {name}
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: LeafDatum & { value: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as LeafDatum & { value: number };
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
      <div className="font-medium">{d.name}</div>
      {d.fullName && d.fullName !== d.name && <div className="text-text-muted">{d.fullName}</div>}
      <div>Turnover: {formatCompactTZS(d.value)}</div>
      <div>Return: {d.returnPct.toFixed(2)}%</div>
    </div>
  );
}

export default function TurnoverTreemapChart({ data }: { data: LeafDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        content={<TreemapCell />}
        isAnimationActive={false}
      >
        <Tooltip content={<TreemapTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
