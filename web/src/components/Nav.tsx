"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Market" },
  { href: "/sectors", label: "Sectors" },
  { href: "/order-book", label: "Order Book" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-text-primary">
          DSE Market Explorer
        </Link>
        <nav className="flex gap-6 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
