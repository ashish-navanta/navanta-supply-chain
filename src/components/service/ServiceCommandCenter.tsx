"use client";

import Link from "next/link";
import {
  BarChart,
  KpiBreakdownCard,
  KpiGrid,
  KpiProgressCard,
  Pill,
} from "@navanta-ai/design-system";
import { Truck, WarningCircle } from "@phosphor-icons/react";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { QUEUES } from "@/data/action-center";
import {
  AT_RISK,
  CLAIM_KIND_LABEL,
  DEALERS,
  HEALTH_LABEL,
  ORDERS,
  SERVICE_BOOK,
  atRiskOrders,
  bestEta,
  claimsNeedingAction,
  dealerBook,
  formatUsd,
  hasEtaConflict,
  inFlight,
  openClaims,
  promisesKept,
  repeatLots,
} from "@/data/service";
import { SERVICE_ROUTES, orderRoute } from "@/data/nav";
import { AgentBrief } from "@/components/buying/AgentBrief";
import { Panel } from "@/components/buying/Panel";

/**
 * The service desk's landing page.
 *
 * The action center answers "what needs me in the next hour". This answers the
 * question underneath it — are my accounts being served — with the four figures
 * the seat is measured on, then the three things that explain them: what is
 * exposed, what is claimed, and which accounts are carrying the pain.
 *
 * Every figure is derived from the same fixtures the other pages render.
 */
export function ServiceCommandCenter() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];

  const queue = QUEUES[persona];
  const needsDecision = queue.rows.filter((r) => r.state === "decide").length;

  const flying = inFlight();
  const atRisk = atRiskOrders();
  const crewExposed = atRisk.filter((o) => o.crewBooked);
  const conflicts = flying.filter(hasEtaConflict);
  const open = openClaims();
  const needing = claimsNeedingAction();
  const kept = promisesKept();
  const lots = repeatLots();

  /* Exposure by account, biggest first — the chart answers "who is carrying it",
     which no row in a table shows. */
  const byDealer = DEALERS.map((d) => ({ label: d.name.split(" ")[0], value: dealerBook(d.name).openValue }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const paragraph =
    `${flying.length} orders are still coming for ${formatUsd(SERVICE_BOOK.openValue)} across ${DEALERS.length} accounts · ` +
    `${atRisk.length} are at risk and ${crewExposed.length} of those have a crew already booked, which is the list to work first. ` +
    `${conflicts.length} shipments have systems disagreeing on the arrival date — ${conflicts.map((o) => o.id).join(" and ")} — ` +
    `and the date the account can see is the wrong one. On the claims side ${open.length} are open for ${formatUsd(SERVICE_BOOK.openClaimValue)}, ` +
    `${needing.length} adjudicated and waiting on your signature. ` +
    (lots.length > 0
      ? `${lots[0].claims.length} claims trace to batch ${lots[0].batch} rather than to any one account.`
      : `No batch is repeating.`);

  return (
    <div className="flex flex-col gap-6">
      <AgentBrief
        agent={profile.agent}
        title={`${profile.agent} — your book this morning`}
        paragraph={paragraph}
        chips={[
          { label: `Work ${needsDecision} decisions`, href: SERVICE_ROUTES.actionCenter },
          { label: `${atRisk.length} orders at risk`, href: SERVICE_ROUTES.orders },
          { label: `${needing.length} credits to sign`, href: SERVICE_ROUTES.claims },
          {
            label: conflicts.length ? `${conflicts.length} ETA conflicts` : "Every ETA agrees",
            href: SERVICE_ROUTES.orders,
          },
        ]}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Open order value"
          value={formatUsd(SERVICE_BOOK.openValue)}
          subtitle={`${flying.length} orders across ${DEALERS.length} accounts`}
          info="Value on orders that have not yet been delivered."
        />
        <KpiBreakdownCard
          title="Orders at risk"
          value={String(atRisk.length)}
          subtitle={
            crewExposed.length > 0
              ? `${crewExposed.length} with a crew already booked`
              : "No crews exposed"
          }
          info="Delayed, backordered, or running close enough to the floor-set date that a day would break it."
        />
        <KpiBreakdownCard
          title="Claims needing you"
          value={String(needing.length)}
          subtitle={`${formatUsd(needing.reduce((s, c) => s + (c.adjudicated ?? c.requested), 0))} adjudicated and ready`}
        />
        <KpiProgressCard
          title="Promises kept"
          value={`${kept.pct}%`}
          subtitle={`${kept.kept} of ${kept.total} delivered on the original date`}
          progress={kept.pct}
          tone={kept.pct >= 80 ? "success" : "warning"}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Who is carrying the exposure"
          subtitle="Open order value by account"
          action={{ label: "Open the account book", href: SERVICE_ROUTES.accounts }}
        >
          <BarChart
            data={byDealer}
            height={220}
            showValueLabels
            showGrid
            color="var(--color-iris-500, #6d5bd0)"
            formatValue={(v) => formatUsd(v)}
          />
        </Panel>

        <Panel
          title="Work these first"
          subtitle={`${atRisk.length} at risk · ranked by what a slip actually breaks`}
          action={{ label: "Open the order book", href: SERVICE_ROUTES.orders }}
        >
          <ul className="flex flex-col">
            {[...atRisk]
              .sort(
                (a, b) =>
                  Number(b.crewBooked) - Number(a.crewBooked) || b.value - a.value,
              )
              .map((o, i) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={orderRoute(o.id)}
                      className="ds-body-medium truncate hover:underline"
                      style={{ color: "var(--ds-text-primary)" }}
                      title={`${o.id} — ${o.style}`}
                    >
                      {`${o.id} · ${o.account}`}
                    </Link>
                    <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                      {`${HEALTH_LABEL[o.health]} · promised ${o.promisedOn} → ${o.currentEta}` +
                        (o.crewBooked && o.installOn ? ` · crew booked ${o.installOn}` : "")}
                    </span>
                  </span>
                  <span
                    className="ds-body-medium shrink-0"
                    style={{ color: "var(--color-iris-700)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatUsd(o.value)}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Where the systems disagree"
          subtitle="The date on the account's portal is not always the right one"
          action={{ label: "Open the order book", href: SERVICE_ROUTES.orders }}
        >
          {conflicts.length === 0 ? (
            <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
              Every source agrees on every shipment in flight.
            </span>
          ) : (
            <div className="flex flex-col gap-3">
              {conflicts.map((o) => (
                <Link key={o.id} href={orderRoute(o.id)} className="flex items-start gap-2.5">
                  <Truck
                    size={16}
                    weight="duotone"
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--text-warning)" }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                      {`${o.id} · ${o.account} — trust ${bestEta(o).date}`}
                    </span>
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      {o.etas.map((e) => `${e.source} ${e.date}`).join(" · ")}
                    </span>
                  </span>
                  <Pill variant="warning" size="sm" className="ml-auto shrink-0">
                    {`${o.etas.length} sources`}
                  </Pill>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={`${profile.agent} sees a pattern, not incidents`}
          subtitle="Claims clustering on one batch are a supplier conversation"
          action={{ label: "Open the claim book", href: SERVICE_ROUTES.claims }}
        >
          {lots.length === 0 ? (
            <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
              No batch has more than one claim against it.
            </span>
          ) : (
            <div className="flex flex-col gap-3">
              {lots.map((l) => (
                <div key={l.batch} className="flex items-start gap-2.5">
                  <WarningCircle
                    size={16}
                    weight="duotone"
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--text-warning)" }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                      {`Batch ${l.batch} — ${l.claims.length} claims, ${formatUsd(
                        l.claims.reduce((s, c) => s + (c.adjudicated ?? c.requested), 0),
                      )}`}
                    </span>
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      {`${[...new Set(l.claims.map((c) => c.account))].length} accounts · ${[
                        ...new Set(l.claims.map((c) => CLAIM_KIND_LABEL[c.kind])),
                      ]
                        .join(", ")
                        .toLowerCase()}`}
                    </span>
                  </span>
                </div>
              ))}
              <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                {`${ORDERS.filter((o) => AT_RISK.has(o.health)).length} at-risk orders and ${
                  open.length
                } open claims, and one lot behind more of it than any account.`}
              </span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
