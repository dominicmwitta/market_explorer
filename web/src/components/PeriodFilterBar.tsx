"use client";

import type { DateRange } from "@/lib/timeseries";

const PRESETS: { label: string; days: number | null }[] = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

/** `maxDate` minus `days` calendar days, clamped so it never goes earlier than `minDate`. */
function presetStart(maxDate: string, days: number | null, minDate: string): string {
  if (days === null) return minDate;
  const d = new Date(`${maxDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  const iso = d.toISOString().slice(0, 10);
  return iso < minDate ? minDate : iso;
}

/**
 * Shared period picker: preset buttons (30D/90D/6M/1Y/All) plus a custom
 * start/end date range. `minDate`/`maxDate` are the full available history
 * bounds (from the page's already-fetched data) — presets and the date
 * inputs are both clamped to that range.
 */
export default function PeriodFilterBar({
  minDate,
  maxDate,
  value,
  onChange,
}: {
  minDate: string;
  maxDate: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const activePresetLabel = PRESETS.find(
    (p) => value.start === presetStart(maxDate, p.days, minDate) && value.end === maxDate
  )?.label;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-text-secondary">Period</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = activePresetLabel === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ start: presetStart(maxDate, p.days, minDate), end: maxDate })}
              style={active ? { background: "var(--brand-gradient)" } : undefined}
              className={
                active
                  ? "rounded-full border border-transparent px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="date"
          value={value.start}
          min={minDate}
          max={value.end}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="rounded-md border border-border bg-surface px-2 py-1 text-text-primary"
        />
        <span>to</span>
        <input
          type="date"
          value={value.end}
          min={value.start}
          max={maxDate}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="rounded-md border border-border bg-surface px-2 py-1 text-text-primary"
        />
      </div>
    </div>
  );
}
