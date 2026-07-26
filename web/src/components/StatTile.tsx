export default function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-sm text-text-secondary">{sub}</div>}
    </div>
  );
}
