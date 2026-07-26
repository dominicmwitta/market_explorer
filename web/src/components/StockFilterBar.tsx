"use client";

export type StockFilterOption = { ticker: string; sector?: string };

/**
 * Reusable ticker multi-select — toggleable pills, with optional select-all/
 * clear affordances and an optional selection cap (needed by charts drawing
 * from the fixed 8-slot categorical palette; omit it for charts that color
 * by return polarity instead, which have no such limit).
 */
export default function StockFilterBar({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  maxSelected,
  label = "Filter stocks",
}: {
  options: StockFilterOption[];
  selected: Set<string>;
  onToggle: (ticker: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  maxSelected?: number;
  label?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-text-secondary">
          {label} {maxSelected ? `(up to ${maxSelected})` : `(${selected.size} of ${options.length})`}
        </div>
        {(onSelectAll || onClearAll) && (
          <div className="flex gap-3 text-xs">
            {onSelectAll && (
              <button type="button" onClick={onSelectAll} className="text-series-1 hover:underline">
                Select all
              </button>
            )}
            {onClearAll && (
              <button type="button" onClick={onClearAll} className="text-text-muted hover:underline">
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ ticker }) => {
          const active = selected.has(ticker);
          const disabled = !active && maxSelected !== undefined && selected.size >= maxSelected;
          return (
            <button
              key={ticker}
              type="button"
              onClick={() => onToggle(ticker)}
              disabled={disabled}
              aria-pressed={active}
              style={active ? { background: "var(--brand-gradient)" } : undefined}
              className={
                active
                  ? "rounded-full border border-transparent px-3 py-1 text-xs font-medium text-white"
                  : disabled
                    ? "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted opacity-50"
                    : "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              }
            >
              {ticker}
            </button>
          );
        })}
      </div>
    </div>
  );
}
