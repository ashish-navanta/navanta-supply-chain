"use client";

import { ORDER_STAGE_ORDER, STAGE_LABEL, type OrderStage } from "@/data/service";

/**
 * How far along, as four dots.
 *
 * Ported from the Customer Ops order list: filled green behind the current
 * stage, coloured at it, hairline ahead of it. The colour at the current dot is
 * the whole point — blue when it is fine, red when it is not — so one glance
 * answers both "how far along" and "should I worry" without reading a word.
 *
 * Shared between the order book, the queue and the line items on a record page.
 * The order table had its own copy keyed on a whole `ServiceOrder`, which meant a
 * line item — which has a stage but is not an order — could not use it.
 */
export function StageDots({
  stage,
  atRisk = false,
  label,
}: {
  stage: OrderStage;
  /** Tints the current dot red rather than blue. */
  atRisk?: boolean;
  /** Shown beside the dots. Omit for dots alone. */
  label?: string;
}) {
  const at = ORDER_STAGE_ORDER.indexOf(stage);
  const delivered = stage === "delivered";

  return (
    <span
      className="flex min-w-0 flex-col"
      style={{ gap: 4 }}
      aria-label={`${STAGE_LABEL[stage]}${atRisk ? " — at risk" : ""}`}
    >
      <span className="flex items-center" style={{ gap: 3 }}>
        {ORDER_STAGE_ORDER.map((st, i) => {
          const bg =
            delivered || i < at
              ? "var(--ds-icon-success)"
              : i === at
                ? atRisk
                  ? "var(--ds-icon-error)"
                  : "var(--ds-icon-info)"
                : "var(--ds-border-subtle)";
          return (
            <span
              key={st}
              aria-hidden="true"
              className="rounded-full"
              style={{ width: 8, height: 8, background: bg }}
            />
          );
        })}
      </span>
      {label && (
        <span
          className="truncate"
          style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
