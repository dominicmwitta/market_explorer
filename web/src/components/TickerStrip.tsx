"use client";

import { useRef } from "react";
import { formatPct, formatTZS } from "@/lib/format";

export type TickerStripItem = { ticker: string; price: number; changePct: number };

/**
 * Full-width, horizontally scrollable strip of compact market pills — the
 * dense "Top Securities" band financial sites place right below the nav,
 * distinct from any single chart/story block below it.
 */
export default function TickerStrip({
  items,
  label,
}: {
  items: TickerStripItem[];
  label?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#14141f] py-2.5 pl-4 pr-2">
      {label && (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => scrollBy(-240)}
        aria-label="Scroll left"
        className="shrink-0 rounded-full px-1.5 py-0.5 text-white/50 hover:bg-white/10 hover:text-white"
      >
        ‹
      </button>
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const up = item.changePct >= 0;
          const color = up ? "#3ddc84" : "#ff6b6b";
          return (
            <div
              key={item.ticker}
              className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs"
            >
              <span className="font-semibold text-white">{item.ticker}</span>
              <span className="tabular-nums text-white/70">{formatTZS(item.price)}</span>
              <span className="flex items-center gap-0.5 tabular-nums font-medium" style={{ color }}>
                <span aria-hidden="true">{up ? "▲" : "▼"}</span>
                {formatPct(item.changePct)}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(240)}
        aria-label="Scroll right"
        className="shrink-0 rounded-full px-1.5 py-0.5 text-white/50 hover:bg-white/10 hover:text-white"
      >
        ›
      </button>
    </div>
  );
}
