"use client";

import { AiStar, Pill } from "@navanta-ai/design-system";
import { bestEta, type ServiceOrder } from "@/data/service";

/**
 * The three-systems-disagree block.
 *
 * Terrence's line in the deck is that DC appointment book says delivered, SAP WM says
 * delivered, and ten units are crushed under the wrap. Daniela's version of
 * the same problem is arrival dates: Fusion holds the original promise, the WMS
 * knows the allocation, the carrier's portal is a day stale, and the account can
 * see the worst of the three. So this shows every source with its confidence
 * rather than picking one silently, and names the one worth repeating on a call.
 */
export function EtaReconciler({ order, agent }: { order: ServiceOrder; agent: string }) {
  const best = bestEta(order);
  const dates = [...new Set(order.etas.map((e) => e.date))];

  return (
    <div
      className="flex flex-col gap-3 overflow-hidden rounded-xl p-4"
      style={{ background: "var(--color-iris-50)" }}
    >
      <span className="flex items-center gap-2">
        <AiStar size={16} variant="small" />
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
          {`${agent} reconciled ${order.etas.length} systems — they disagree by ${dates.length} dates`}
        </span>
      </span>

      <ul className="flex flex-col gap-2">
        {[...order.etas]
          .sort((a, b) => b.confidence - a.confidence)
          .map((e) => {
            const trusted = e.source === best.source;
            return (
              <li
                key={e.source}
                className="flex items-center gap-3 rounded-lg p-2.5"
                style={{
                  background: "var(--surface-base)",
                  border: `1px solid ${trusted ? "var(--color-iris-200)" : "var(--ds-border-subtle)"}`,
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {`${e.source} — ${e.date}`}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {e.note}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 overflow-hidden"
                  style={{ height: 6, width: 88, borderRadius: 999, background: "var(--ds-border-subtle)" }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${e.confidence}%`,
                      background: trusted
                        ? "var(--text-success-vivid)"
                        : "var(--color-iris-500, #6d5bd0)",
                    }}
                  />
                </span>
                <span
                  className="ds-label shrink-0 text-right"
                  style={{ width: 32, color: "var(--ds-text-secondary)", fontVariantNumeric: "tabular-nums" }}
                >
                  {`${e.confidence}%`}
                </span>
                {trusted && (
                  <Pill variant="info" size="sm">
                    Trust this
                  </Pill>
                )}
              </li>
            );
          })}
      </ul>

      <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
        {`Tell ${order.account} ${best.date}. ${best.source} is the only source that has been updated since the shipment moved` +
          `${order.etas.some((e) => e.source === "SAP ECC" && e.date !== best.date) ? ", and Fusion — the date on the account's portal — is the one that is wrong." : "."}`}
      </p>
    </div>
  );
}
