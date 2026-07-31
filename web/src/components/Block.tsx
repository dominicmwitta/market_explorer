import type { ReactNode } from "react";

/**
 * A self-contained "module" card — small uppercase eyebrow, a headline, and
 * an optional description, all inside one bordered block. Modeled on the
 * dense, bordered-module layout financial data sites use (distinct blocks
 * stacked/gridded on the page) rather than loose headings floating directly
 * on the page background.
 */
export default function Block({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const hasHeader = eyebrow || title || action;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      {hasHeader && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="mt-0.5 text-lg font-semibold text-text-primary">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
