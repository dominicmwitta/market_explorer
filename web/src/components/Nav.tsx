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
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-text-primary">
          DSE Market Explorer
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
                    ? "font-medium text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
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
