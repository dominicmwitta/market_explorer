"use client";

import { useMemo } from "react";
import type { DateRange } from "@/lib/timeseries";
import { formatDateLabel } from "@/lib/format";

/**
 * Dual-handle slider over the actual list of trading dates rather than raw
 * calendar days, so every position the user can drag to lands on a date that
 * has real data instead of a weekend/holiday gap.
 */
export default function DateRangeSlider({
  dates,
  value,
  onChange,
}: {
  dates: string[]; // ascending, unique, at least 2 entries
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const lastIndex = dates.length - 1;

  const startIndex = useMemo(() => {
    const i = dates.indexOf(value.start);
    return i === -1 ? 0 : i;
  }, [dates, value.start]);
  const endIndex = useMemo(() => {
    const i = dates.indexOf(value.end);
    return i === -1 ? lastIndex : i;
  }, [dates, value.end, lastIndex]);

  if (lastIndex < 1) return null;

  const startPct = (startIndex / lastIndex) * 100;
  const endPct = (endIndex / lastIndex) * 100;

  return (
    <div className="w-full max-w-md">
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gridline" />
        <div
          className="absolute h-1.5 rounded-full"
          style={{ left: `${startPct}%`, right: `${100 - endPct}%`, background: "var(--brand-gradient)" }}
        />
        <input
          type="range"
          min={0}
          max={lastIndex}
          value={startIndex}
          onChange={(e) => {
            const i = Math.min(Number(e.target.value), endIndex);
            onChange({ start: dates[i], end: value.end });
          }}
          className="range-slider-thumb range-slider-thumb--start pointer-events-none absolute inset-x-0 h-5 w-full"
          aria-label="Range start date"
        />
        <input
          type="range"
          min={0}
          max={lastIndex}
          value={endIndex}
          onChange={(e) => {
            const i = Math.max(Number(e.target.value), startIndex);
            onChange({ start: value.start, end: dates[i] });
          }}
          className="range-slider-thumb range-slider-thumb--end pointer-events-none absolute inset-x-0 h-5 w-full"
          aria-label="Range end date"
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-text-secondary">
        <span>{formatDateLabel(value.start)}</span>
        <span>{formatDateLabel(value.end)}</span>
      </div>
    </div>
  );
}
