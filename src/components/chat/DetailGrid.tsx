"use client";

import type { ReactNode } from "react";

/**
 * The detail panels' layout: one bordered card, divided into titled sections,
 * each a grid of stacked label-over-value pairs.
 *
 * Stacked and left-aligned rather than label-left / value-right: in a
 * two-column grid of ruled rows, a right-aligned value sits directly beside the
 * next column's left-aligned label, so "PO-4463   Promise date" read as one
 * four-part row instead of two pairs. Stacking removes the collision and lets a
 * long value (an email, a product family) use the whole column.
 */

export function DetailItem({
  label,
  value,
  source,
  action,
  onSelect,
}: {
  label: string;
  value: string;
  /**
   * Where the value came from — the system of record, the supplier's own mail,
   * or the agent's reading. The engine owns no data of its own, so every figure
   * on screen is borrowed; saying whose it is turns the panel from an assertion
   * into something checkable.
   */
  source?: string;
  /** Optional trailing control — a copy button, a link. */
  action?: ReactNode;
  /** When set, the value becomes a link to wherever that fact is detailed —
   *  the supplier's own tab, the line-item table. Facts that have somewhere to
   *  go should say so rather than being a dead end. */
  onSelect?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            title={value}
            className="ds-body-medium truncate text-left underline decoration-1 underline-offset-2 hover:no-underline"
            style={{ color: "var(--color-iris-700)" }}
          >
            {value}
          </button>
        ) : (
          <span
            className="ds-body-medium truncate"
            style={{ color: "var(--ds-text-primary)" }}
            title={value}
          >
            {value}
          </span>
        )}
        {action}
      </span>
      {source && (
        <span className="ds-label truncate" style={{ color: "var(--text-muted)" }} title={source}>
          {source}
        </span>
      )}
    </div>
  );
}

export function DetailSection({
  title,
  columns = 4,
  icon,
  children,
}: {
  title: string;
  columns?: number;
  /** Rendered before the heading — the AiStar on agent-written sections. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <span className="flex items-center gap-1.5">
        {icon}
        <span className="type-overline" style={{ color: "var(--ds-text-secondary)" }}>
          {title}
        </span>
      </span>
      <div
        className="grid gap-x-6 gap-y-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The card the sections sit in, ruled between sections.
 *
 * Read-only by construction: these panels mirror the systems of record, so
 * there are no inputs and no edit affordances anywhere inside them. The only
 * editable figure in either modal is the lead-time override, which lives on the
 * action band where the decision is. `aria-readonly` states that to assistive
 * tech rather than leaving it implied by the absence of controls.
 */
export function DetailCard({ children }: { children: ReactNode }) {
  return (
    <div
      aria-readonly="true"
      className="detail-card flex flex-col rounded-xl"
      style={{ border: "1px solid var(--ds-border-default)" }}
    >
      {children}
    </div>
  );
}
