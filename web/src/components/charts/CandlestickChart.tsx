"use client";

import {
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export type CandleDatum = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandleShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleDatum;
};

/**
 * Custom Bar shape rendering an OHLC candle. The Bar's dataKey is the
 * [low, high] range, so recharts already maps x/y/width/height to that
 * vertical span — we interpolate the open/close body within it.
 */
function Candle(props: CandleShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;

  const { open, high, low, close } = payload;
  const range = high - low;
  const priceToY = (price: number) =>
    range > 0 ? y + ((high - price) / range) * height : y + height / 2;

  const bodyTop = priceToY(Math.max(open, close));
  const bodyBottom = priceToY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
  const isUp = close >= open;
  const color = isUp ? "var(--status-good)" : "var(--status-critical)";
  const wickX = x + width / 2;

  return (
    <g>
      <line x1={wickX} x2={wickX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={color} />
    </g>
  );
}

type ChartDatum = CandleDatum & { range: [number, number] };

export default function CandlestickChart({
  data,
  height = 320,
  children,
}: {
  data: CandleDatum[];
  height?: number;
  children?: React.ReactNode;
}) {
  const chartData: ChartDatum[] = data.map((d) => {
    const high = d.high > 0 ? d.high : Math.max(d.open, d.close);
    const low = d.low > 0 ? d.low : Math.min(d.open, d.close);
    return { ...d, high, low, range: [low, high] };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => new Intl.NumberFormat("en-US").format(v)}
        />
        <Tooltip
          content={(props) => {
            const point = props.payload?.[0]?.payload as ChartDatum | undefined;
            if (!point) return null;
            return (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                }}
              >
                <div className="mb-1 font-medium text-text-primary">{point.date}</div>
                <div className="text-text-secondary">Open {point.open.toFixed(2)}</div>
                <div className="text-text-secondary">High {point.high.toFixed(2)}</div>
                <div className="text-text-secondary">Low {point.low.toFixed(2)}</div>
                <div className="text-text-secondary">Close {point.close.toFixed(2)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="range" shape={Candle} isAnimationActive={false} />
        {children}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
