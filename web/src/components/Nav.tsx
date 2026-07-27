"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };
type Group = { label: string; icon: string; href?: string; items?: Item[] };

// Grouped into a handful of dropdown categories (goal.com-style mega-menu
// pattern) instead of a flat list of 12 links, so the bar stays a single
// compact row instead of wrapping onto two.
const GROUPS: Group[] = [
  { label: "Market", icon: "🏠", href: "/" },
  {
    label: "Analysis",
    icon: "📊",
    items: [
      { href: "/performance", label: "Performance", icon: "🏆" },
      { href: "/returns", label: "Returns", icon: "💹" },
      { href: "/volume", label: "Volume", icon: "📶" },
      { href: "/sectors", label: "Sectors", icon: "🏢" },
    ],
  },
  {
    label: "Stocks",
    icon: "📈",
    items: [
      { href: "/compare", label: "Compare", icon: "⚖️" },
      { href: "/technical", label: "Technical", icon: "📉" },
      { href: "/price-trends", label: "Price Trends", icon: "📈" },
    ],
  },
  {
    label: "Order Book",
    icon: "📖",
    items: [
      { href: "/order-book", label: "Snapshot", icon: "📖" },
      { href: "/order-book/trends", label: "Trends", icon: "🔀" },
    ],
  },
  {
    label: "Tools",
    icon: "🧰",
    items: [
      { href: "/backtest", label: "Backtest", icon: "🔁" },
      { href: "/liquidity-index", label: "Liquidity Index", icon: "💧" },
    ],
  },
];

function isItemActive(href: string, pathname: string): boolean {
  return href === "/technical" ? pathname.startsWith("/technical") : pathname === href;
}

function isGroupActive(group: Group, pathname: string): boolean {
  if (group.href) return group.href === "/" ? pathname === "/" : pathname === group.href;
  return (group.items ?? []).some((it) => isItemActive(it.href, pathname));
}

const activePill = "rounded-full bg-white px-3 py-1.5 font-medium text-[#2a1a5e]";
const inactivePill =
  "rounded-full px-3 py-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white";

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--brand-gradient)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          📈 DSE Market Explorer
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {GROUPS.map((group) => {
            const active = isGroupActive(group, pathname);
            if (group.href) {
              return (
                <Link key={group.label} href={group.href} className={active ? activePill : inactivePill}>
                  <span aria-hidden="true">{group.icon}</span> {group.label}
                </Link>
              );
            }
            return (
              <div key={group.label} className="group relative">
                <button type="button" className={active ? activePill : inactivePill}>
                  <span aria-hidden="true">{group.icon}</span> {group.label}{" "}
                  <span className="text-[10px]">▾</span>
                </button>
                <div className="invisible absolute left-0 top-full z-50 mt-1 min-w-[190px] rounded-lg border border-border bg-surface p-1.5 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                  {group.items!.map((it) => {
                    const itActive = isItemActive(it.href, pathname);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={
                          itActive
                            ? "block rounded-md bg-page px-3 py-2 text-sm font-medium text-text-primary"
                            : "block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-page hover:text-text-primary"
                        }
                      >
                        <span aria-hidden="true">{it.icon}</span> {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          className="text-xl text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/20 bg-surface px-4 py-2 md:hidden">
          {GROUPS.map((group) => (
            <div key={group.label} className="border-b border-gridline py-2 last:border-0">
              {group.href ? (
                <Link
                  href={group.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    isGroupActive(group, pathname)
                      ? "block rounded-md px-2 py-1.5 font-medium text-text-primary"
                      : "block rounded-md px-2 py-1.5 text-text-secondary"
                  }
                >
                  <span aria-hidden="true">{group.icon}</span> {group.label}
                </Link>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <span aria-hidden="true">{group.icon}</span> {group.label}
                  </div>
                  {group.items!.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setMobileOpen(false)}
                      className={
                        isItemActive(it.href, pathname)
                          ? "block rounded-md px-4 py-1.5 text-sm font-medium text-text-primary"
                          : "block rounded-md px-4 py-1.5 text-sm text-text-secondary"
                      }
                    >
                      <span aria-hidden="true">{it.icon}</span> {it.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
