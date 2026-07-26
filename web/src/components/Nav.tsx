"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Market", icon: "🏠" },
  { href: "/performance", label: "Performance", icon: "🏆" },
  { href: "/returns", label: "Returns", icon: "💹" },
  { href: "/volume", label: "Volume", icon: "📶" },
  { href: "/sectors", label: "Sectors", icon: "🏢" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/technical", label: "Technical", icon: "📉" },
  { href: "/price-trends", label: "Price Trends", icon: "📈" },
  { href: "/order-book", label: "Order Book", icon: "📖" },
  { href: "/order-book/trends", label: "OB Trends", icon: "🔀" },
  { href: "/backtest", label: "Backtest", icon: "🔁" },
  { href: "/liquidity-index", label: "Liquidity Index", icon: "💧" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header style={{ background: "var(--brand-gradient)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          📈 DSE Market Explorer
        </Link>
        <nav className="flex flex-wrap gap-x-1.5 gap-y-2 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : link.href === "/technical"
                  ? pathname.startsWith("/technical")
                  : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "rounded-full bg-white px-3 py-1 font-medium text-[#2a1a5e]"
                    : "rounded-full px-3 py-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                }
              >
                <span aria-hidden="true">{link.icon}</span> {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
