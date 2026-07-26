const ACCENTS = {
  1: "var(--series-1)",
  2: "var(--series-2)",
  3: "var(--series-3)",
  4: "var(--series-4)",
  5: "var(--series-5)",
  6: "var(--series-6)",
  7: "var(--series-7)",
  8: "var(--series-8)",
  good: "var(--status-good)",
  critical: "var(--status-critical)",
} as const;

export default function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-surface p-4"
      style={accent ? { borderTop: `3px solid ${ACCENTS[accent]}` } : undefined}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-sm text-text-secondary">{sub}</div>}
    </div>
  );
}
