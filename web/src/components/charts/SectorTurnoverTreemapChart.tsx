"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatCompactTZS } from "@/lib/format";

export type SectorTreemapDatum = {
  name: string;
  children: { name: string; size: number; returnPct: number }[];
};

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  returnPct?: number;
  depth?: number;
}

function SectorTreemapCell({ x = 0, y = 0, width = 0, height = 0, name, returnPct, depth = 0 }: CellProps) {
  if (depth === 0) return null;

  if (depth === 1) {
    const showLabel = width > 60 && height > 18;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke="var(--border)" strokeWidth={1} />
        {showLabel && (
          <text x={x + 4} y={y + 14} fontSize={11} fontWeight={600} fill="var(--text-secondary)">
            {name}
          </text>
        )}
      </g>
    );
  }

  const fill = (returnPct ?? 0) >= 0 ? "var(--status-good)" : "var(--status-critical)";
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

type TreemapTooltipDatum = {
  name: string;
  value: number;
  returnPct?: number;
  children?: unknown[];
};

function SectorTreemapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TreemapTooltipDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isLeaf = !d.children || d.children.length === 0;
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
      <div>Turnover: {formatCompactTZS(d.value)}</div>
      {isLeaf && typeof d.returnPct === "number" && <div>Return: {d.returnPct.toFixed(2)}%</div>}
    </div>
  );
}

export default function SectorTurnoverTreemapChart({ data }: { data: SectorTreemapDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={480}>
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        nodeInset={16}
        nodeGap={2}
        content={<SectorTreemapCell />}
        isAnimationActive={false}
      >
        <Tooltip content={<SectorTreemapTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
