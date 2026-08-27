"use client";

import { AiStar, Pill } from "@navanta-ai/design-system";
import { bestLoadEta, etaSpread, type Load, type LoadEta } from "@/data/logistics";

/**
 * The three-systems-disagree block, at asset scope.
 *
 * Daniela's version of this reconciles arrival dates across Fusion, the WMS and
 * the carrier — all of them describing the same shipment. Terrence's problem is
 * different and worse: DC appointment book answers at shipment level, Carrier milestone at the
 * trailer, Forwarder feed at the tractor. Three systems can all be correct and
 * still give three answers, because they are not describing the same object.
 *
 * So the scope is the thing this shows that the order-level version does not.
 * Without it a reader sees a contradiction; with it they see an explanation, and
 * can say why the tractor feed is the one to repeat on the phone.
 */

const SCOPE_LABEL: Record<LoadEta["scope"], string> = {
  tractor: "Tractor",
  trailer: "Trailer",
  shipment: "Shipment",
  dock: "Dock",
  order: "Order",
};

/** How close the source sits to the truck. A tractor feed is the vehicle itself;
 *  a shipment estimate is two abstractions away from it. */
const SCOPE_NOTE: Record<LoadEta["scope"], string> = {
  tractor: "reads the vehicle itself",
  trailer: "lags the tractor by design",
  shipment: "built from the tender, not the truck",
  dock: "the receiving queue, not the arrival",
  order: "the ask, not a commitment",
};

export function LoadEtaReconciler({ load, agent }: { load: Load; agent: string }) {
  const best = bestLoadEta(load);
  const spread = etaSpread(load);

  return (
    <div
      className="flex flex-col gap-3 overflow-hidden rounded-xl p-4"
      style={{ background: "var(--color-iris-50)" }}
    >
      <span className="flex items-start gap-2">
        <AiStar size={16} variant="small" className="mt-0.5 shrink-0" />
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
          {spread > 1
            ? `${agent} reconciled ${load.etas.length} systems — they disagree by ${spread} times because they are watching ${spread === load.etas.length ? "different things" : "the load at different scopes"}`
            : `${agent} checked ${load.etas.length} ${load.etas.length === 1 ? "system" : "systems"} — they agree`}
        </span>
      </span>

      <ul className="flex flex-col gap-2">
        {[...load.etas]
          .sort((a, b) => b.confidence - a.confidence)
          .map((e) => {
            const trusted = e.system === best.system && e.scope === best.scope;
            return (
              <li
                key={`${e.system}-${e.scope}`}
                className="flex flex-col gap-1 rounded-lg p-2.5"
                style={{
                  background: "var(--surface-base)",
                  border: `1px solid ${trusted ? "var(--color-iris-200)" : "var(--ds-border-subtle)"}`,
                }}
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {`${e.system} — ${e.eta}`}
                  </span>
                  <Pill variant={trusted ? "info" : "neutral"} size="sm">
                    {`${SCOPE_LABEL[e.scope]} · ${e.confidence}%`}
                  </Pill>
                  {/* The DS has no success variant on Pill — info is the
                      positive one here, and it is the same signal the trusted
                      source already carries. */}
                  {trusted && (
                    <Pill variant="info" size="sm">
                      Repeat this one
                    </Pill>
                  )}
                </span>
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  {e.note}
                </span>
                <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                  {`${SCOPE_LABEL[e.scope]}-scope source — ${SCOPE_NOTE[e.scope]}`}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
