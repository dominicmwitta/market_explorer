import { formatPct } from "@/lib/format";

/** Colors a return/delta value by polarity (status tokens, never a categorical series color). */
export default function ReturnValue({ value, digits = 2 }: { value: number; digits?: number }) {
  const color =
    value > 0 ? "text-status-good" : value < 0 ? "text-status-critical" : "text-text-secondary";
  return <span className={`font-medium tabular-nums ${color}`}>{formatPct(value, digits)}</span>;
}
