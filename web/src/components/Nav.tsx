"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Market" },
  { href: "/performance", label: "Performance" },
  { href: "/returns", label: "Returns" },
  { href: "/volume", label: "Volume" },
  { href: "/sectors", label: "Sectors" },
  { href: "/compare", label: "Compare" },
  { href: "/technical", label: "Technical" },
  { href: "/price-trends", label: "Price Trends" },
  { href: "/order-book", label: "Order Book" },
  { href: "/order-book/trends", label: "OB Trends" },
  { href: "/backtest", label: "Backtest" },
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
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
