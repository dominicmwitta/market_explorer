import { formatDateLabel } from "@/lib/format";

/** Small freshness indicator: the latest trading date backing the numbers on this page. */
export default function DataAsOf({ date }: { date: string }) {
  if (!date) return null;
  return (
    <p className="text-xs text-text-muted">Data as of {formatDateLabel(date)}.</p>
  );
}
