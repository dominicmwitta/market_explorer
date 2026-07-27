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

// Gain/loss tiles get a full tinted background (not just a border accent) so
// they read as a signal at a glance; categorical tiles (1-8) keep the
// existing thin top-border treatment since they aren't "good/bad".
const TINT_CLASSES = {
  good: "border-status-good/30 bg-status-good/10",
  critical: "border-status-critical/30 bg-status-critical/10",
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
  const isTint = accent === "good" || accent === "critical";

  return (
    <div
      className={`rounded-lg border p-3 ${isTint ? TINT_CLASSES[accent] : "border-border bg-surface"}`}
      style={accent && !isTint ? { borderTop: `3px solid ${ACCENTS[accent]}` } : undefined}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}
