"use client";

import type { DateRange } from "@/lib/timeseries";
import DateRangeSlider from "@/components/DateRangeSlider";

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
 * Shared period picker: preset buttons (1D/30D/90D/6M/1Y/All), a draggable
 * date-range slider, and custom start/end date inputs. `minDate`/`maxDate`
 * are the full available history bounds (from the page's already-fetched
 * data) — presets, slider, and date inputs are all clamped to that range.
 *
 * `tradingDates` (ascending, unique) is optional: when supplied, it enables
 * the "1D" preset (the previous *trading* day, not just a calendar day back
 * — DSE doesn't trade weekends/holidays) and the slider, which only lets the
 * user land on dates that actually have data.
 */
export default function PeriodFilterBar({
  minDate,
  maxDate,
  value,
  onChange,
  tradingDates,
}: {
  minDate: string;
  maxDate: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  tradingDates?: string[];
}) {
  const prevTradingDate =
    tradingDates && tradingDates.length >= 2 ? tradingDates[tradingDates.length - 2] : undefined;

  // When the available history is shorter than a preset's window, that preset's
  // start clamps to minDate — the same value "All" resolves to. Check "All"
  // first so it wins in that case rather than whichever shorter preset happens
  // to appear first in the array. "1D" is checked before both since it's the
  // most specific match.
  const activePresetLabel =
    value.end === maxDate
      ? prevTradingDate !== undefined && value.start === prevTradingDate
        ? "1D"
        : value.start === minDate
          ? "All"
          : PRESETS.find(
              (p) => p.days !== null && value.start === presetStart(maxDate, p.days, minDate)
            )?.label
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-text-secondary">Period</span>
        <div className="flex flex-wrap gap-2">
          {prevTradingDate !== undefined && (
            <button
              type="button"
              onClick={() => onChange({ start: prevTradingDate, end: maxDate })}
              style={activePresetLabel === "1D" ? { background: "var(--brand-gradient)" } : undefined}
              className={
                activePresetLabel === "1D"
                  ? "rounded-full border border-transparent px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              }
            >
              1D
            </button>
          )}
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
      {tradingDates && tradingDates.length > 1 && (
        <DateRangeSlider dates={tradingDates} value={value} onChange={onChange} />
      )}
    </div>
  );
}
