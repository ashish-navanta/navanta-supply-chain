"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A titled card. The app already has two container idioms — TableShell for
 * lists and DetailCard for read-only facts — and neither fits a chart or a
 * short ranked list, so this is the third and last one: one border, one
 * heading, one optional link out.
 */
export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** A link to the page that details what the card summarises. */
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-xl"
      style={{
        background: "var(--surface-base)",
        border: "1px solid var(--ds-border-default)",
        boxShadow: "var(--shadow-card-subtle)",
      }}
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <span className="flex min-w-0 flex-col">
          <span className="type-body-semibold" style={{ color: "var(--ds-text-primary)" }}>
            {title}
          </span>
          {subtitle && (
            <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
              {subtitle}
            </span>
          )}
        </span>
        {action && (
          <Link
            href={action.href}
            className="ds-label shrink-0 underline decoration-1 underline-offset-2 hover:no-underline"
            style={{ color: "var(--color-iris-700)", fontWeight: 500 }}
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-5 pb-5">{children}</div>
    </div>
  );
}
