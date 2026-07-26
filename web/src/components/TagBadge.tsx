const STYLES = {
  gold: "bg-series-4/15 text-series-4",
  liquid: "bg-series-1/15 text-series-1",
} as const;

/** Small icon+label pill for calling out a standout row (e.g. "Top", "Liquid") — badge-grading visual language, distinct from PressureBadge's status colors. */
export default function TagBadge({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: keyof typeof STYLES;
}) {
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STYLES[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
