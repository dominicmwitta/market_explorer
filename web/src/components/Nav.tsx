"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; advanced?: boolean };
type Group = { label: string; icon: string; href?: string; basePath?: string; items?: Item[] };

// Grouped into a handful of dropdown categories (goal.com-style mega-menu
// pattern) instead of a flat list of links, so the bar stays a single
// compact row instead of wrapping onto two.
function buildGroups(sectors: string[]): Group[] {
  return [
    { label: "Market", icon: "🏠", href: "/" },
    {
      label: "Sectors",
      icon: "🏢",
      basePath: "/sectors",
      items: sectors.map((sector) => ({
        href: `/sectors?sector=${encodeURIComponent(sector)}`,
        label: sector,
        icon: "🏷️",
      })),
    },
    {
      label: "Analysis",
      icon: "📊",
      items: [
        { href: "/performance", label: "Performance", icon: "🏆" },
        { href: "/returns", label: "Returns", icon: "💹" },
        { href: "/volume", label: "Volume", icon: "📶" },
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
        { href: "/backtest", label: "Backtest", icon: "🔁", advanced: true },
        { href: "/liquidity-index", label: "Liquidity Index", icon: "💧", advanced: true },
      ],
    },
  ];
}

// Sector links carry a query string (e.g. /sectors?sector=Banking) which
// usePathname() never includes, so per-item active-highlighting only applies
// to plain-path items; the "Sectors" group pill itself still lights up via
// basePath whenever the user is anywhere on /sectors.
function isItemActive(href: string, pathname: string): boolean {
  if (href.includes("?")) return false;
  if (href === "/technical") return pathname.startsWith("/technical");
  return pathname === href;
}

function isGroupActive(group: Group, pathname: string): boolean {
  if (group.href) return group.href === "/" ? pathname === "/" : pathname === group.href;
  if (group.basePath && pathname === group.basePath) return true;
  return (group.items ?? []).some((it) => isItemActive(it.href, pathname));
}

const activePill = "rounded-full bg-white px-3 py-1.5 font-medium text-[#2a1a5e]";
const inactivePill =
  "rounded-full px-3 py-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white";

export default function Nav({ sectors }: { sectors: string[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = buildGroups(sectors);

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--brand-gradient)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          📈 DSE Market Explorer
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {groups.map((group) => {
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
                  <span className="inline-block text-[10px] transition-transform duration-150 group-hover:rotate-180">
                    ▾
                  </span>
                </button>
                <div className="invisible absolute left-0 top-full z-50 origin-top-left scale-95 pt-2.5 opacity-0 transition duration-150 ease-out group-hover:visible group-hover:scale-100 group-hover:opacity-100">
                  <div
                    aria-hidden="true"
                    className="absolute left-5 top-1.5 h-3 w-3 rotate-45 border-l border-t border-border bg-surface"
                  />
                  <div className="relative max-h-[70vh] min-w-[200px] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                    {group.items!.map((it) => {
                      const itActive = isItemActive(it.href, pathname);
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className={
                            itActive
                              ? "flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2 text-sm font-medium text-text-primary"
                              : "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-page hover:text-text-primary"
                          }
                        >
                          <span>
                            <span aria-hidden="true">{it.icon}</span> {it.label}
                          </span>
                          {it.advanced && (
                            <span className="rounded-full bg-text-muted/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-muted">
                              Advanced
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
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
        <div className="max-h-[calc(100vh-56px)] overflow-y-auto border-t border-white/20 bg-surface px-4 py-2 md:hidden">
          {groups.map((group) => (
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
                          ? "flex items-center justify-between gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-text-primary"
                          : "flex items-center justify-between gap-2 rounded-md px-4 py-1.5 text-sm text-text-secondary"
                      }
                    >
                      <span>
                        <span aria-hidden="true">{it.icon}</span> {it.label}
                      </span>
                      {it.advanced && (
                        <span className="rounded-full bg-text-muted/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-muted">
                          Advanced
                        </span>
                      )}
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
