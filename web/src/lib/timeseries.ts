/**
 * Pure helpers for reshaping per-ticker time series into the wide,
 * one-row-per-date format Recharts multi-line charts expect. Shared by
 * server components (month-end aggregation) and client components
 * (interactive ticker comparison) — no React/DOM dependency.
 */

export type SeriesPoint<V = number> = { date: string; value: V };

export type DateRange = { start: string; end: string }; // inclusive, "YYYY-MM-DD"

/** Inclusive date-string comparison — works directly since ISO dates sort lexicographically. */
export function inDateRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** One row per date, one column per ticker — the shape Recharts needs for multi-line charts. */
export function pivotByDate<V extends number | string | null>(
  seriesByTicker: Record<string, SeriesPoint<V>[]>,
  tickers: string[],
  xKey = "date"
): Record<string, V | string>[] {
  const byKey = new Map<string, Record<string, V>>();
  for (const ticker of tickers) {
    for (const p of seriesByTicker[ticker] ?? []) {
      const row = byKey.get(p.date) ?? ({} as Record<string, V>);
      row[ticker] = p.value;
      byKey.set(p.date, row);
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({ [xKey]: key, ...values }));
}

/** Indexes each ticker's series to its own first value * 100, for base-100 comparison charts. */
export function normalizeToBase100(
  seriesByTicker: Record<string, SeriesPoint<number>[]>,
  tickers: string[]
): Record<string, SeriesPoint<number>[]> {
  const result: Record<string, SeriesPoint<number>[]> = {};
  for (const ticker of tickers) {
    const points = seriesByTicker[ticker] ?? [];
    const base = points[0]?.value;
    result[ticker] = !base ? [] : points.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
  }
  return result;
}

/** Last trading day's value per calendar month (keyed "YYYY-MM"); assumes points sorted ascending by date. */
export function monthEndValues(points: SeriesPoint<number>[]): SeriesPoint<number>[] {
  const byMonth = new Map<string, SeriesPoint<number>>();
  for (const p of points) {
    const month = p.date.slice(0, 7);
    const existing = byMonth.get(month);
    if (!existing || p.date > existing.date) byMonth.set(month, { date: month, value: p.value });
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** "2026-02" -> "Feb 2026". */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
