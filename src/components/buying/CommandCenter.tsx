"use client";

import Link from "next/link";
import {
  BarChart,
  KpiBreakdownCard,
  KpiGrid,
  KpiProgressCard,
  Pill,
} from "@navanta-ai/design-system";
import { ArrowUpRight, TrendDown, TrendUp, WarningCircle } from "@phosphor-icons/react";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { QUEUES } from "@/data/action-center";
import {
  BOOK,
  KIND_LABEL,
  PLAYS,
  SUPPLIERS,
  acceptedPlays,
  band,
  feedPlays,
  ledgerPlays,
  money,
  realizedToDate,
  spendByCategory,
  termsGaps,
} from "@/data/buying";
import { BUYING_ROUTES } from "@/data/nav";
import { AgentBrief } from "@/components/buying/AgentBrief";
import { Panel } from "@/components/buying/Panel";

/**
 * The buying desk's landing page.
 *
 * The action center answers "what needs me in the next hour". This answers the
 * question underneath it — is the book in good shape — with the four figures
 * the seat is actually measured on, then the two views that explain them: where
 * the spend is concentrated, and what the sweep found against it.
 *
 * Every figure here is derived from the same fixtures the other pages render.
 * Nothing on this page is a number typed twice.
 */
export function CommandCenter() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];

  const feed = feedPlays();
  const accepted = acceptedPlays();
  const ledger = ledgerPlays();
  const drifting = PLAYS.filter((p) => p.drift?.flagged);

  const feedLow = feed.reduce((s, p) => s + p.savingsLow, 0);
  const feedHigh = feed.reduce((s, p) => s + p.savingsHigh, 0);
  const committed = ledger.reduce((s, p) => s + p.recommended, 0);
  const realized = ledger.reduce((s, p) => s + realizedToDate(p), 0);

  const queue = QUEUES[persona];
  const needsDecision = queue.rows.filter((r) => r.state === "decide").length;
  const waiting = queue.rows.filter((r) => r.state === "waiting").length;

  /* The two supplier lists worth surfacing without opening the book: who is
     slipping, and where the record is incomplete. */
  const slipping = SUPPLIERS.filter((s) => s.leadTimeTrend === "slipping").sort(
    (a, b) => b.annualSpend - a.annualSpend,
  );
  const gaps = termsGaps();

  const categories = spendByCategory().slice(0, 6);
  const topShare = Math.round(
    (categories.slice(0, 2).reduce((s, c) => s + c.value, 0) / BOOK.spend) * 100,
  );

  const paragraph =
    `You hold ${money(BOOK.spend)} across ${BOOK.suppliers} supplier relationships, ` +
    `${BOOK.importShare}% of it on the import book · ${BOOK.openPos} purchase orders are open ` +
    `for ${money(BOOK.openPoValue)}, and ${needsDecision} of them need a decision from you today with ` +
    `${waiting} waiting on a counterparty. Last night's sweep ran the category against the ` +
    `${BOOK.benchmarkLow}–${BOOK.benchmarkHigh}% benchmark and surfaced ${feed.length} plays worth ` +
    `${band(feedLow, feedHigh)}; ${accepted.length} more is already running and ${money(committed)} is ` +
    `committed with ${money(realized)} realized so far. Start with the stoneware consolidation and the ` +
    `Section 301 lane shift — both rest on paper that already exists.`;

  return (
    <div className="flex flex-col gap-6">
      <AgentBrief
        agent={profile.agent}
        title={`${profile.agent} — the book this morning`}
        paragraph={paragraph}
        chips={[
          { label: `Work ${needsDecision} decisions`, href: BUYING_ROUTES.actionCenter },
          { label: `Review ${feed.length} opportunities`, href: BUYING_ROUTES.opportunities },
          { label: `${slipping.length} suppliers slipping`, href: BUYING_ROUTES.suppliers },
          {
            label: drifting.length
              ? `${drifting.length} play drifting off ramp`
              : "Realization on ramp",
            href: BUYING_ROUTES.value,
          },
        ]}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Category spend"
          value={money(BOOK.spend)}
          subtitle={`${BOOK.suppliers} suppliers · ${BOOK.importShare}% import`}
          info="Annualised spend across the home, kitchen and grocery book Marcus owns."
        />
        {/* No trend badge: it would read "3 to decide" directly above a
            breakdown line that already says "3 need a decision". */}
        <KpiBreakdownCard
          title="Open purchase orders"
          value={money(BOOK.openPoValue)}
          subtitle={`${BOOK.openPos} orders · ${needsDecision} need a decision`}
          info="Value currently on order across the book, before anything in the action center is decided."
        />
        <KpiBreakdownCard
          title="Identified opportunity"
          value={band(feedLow, feedHigh)}
          subtitle={`${feed.length} surfaced · ${accepted.length} running`}
          info="The savings band across plays that are surfaced or in qualification, before anything is committed."
        />
        <KpiProgressCard
          title="Realized against committed"
          value={money(realized)}
          subtitle={`${money(committed)} committed across ${ledger.length} plays`}
          progress={Math.round((realized / committed) * 100)}
          tone={drifting.length ? "warning" : "success"}
        />
      </KpiGrid>

      {/* items-start so the chart card sizes to its own content instead of
          stretching to match the taller feed list beside it — that stretch was
          leaving a half-card of empty space under the bars. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel
          title="Where the spend sits"
          subtitle={`Top two categories hold ${topShare}% of the book`}
          action={{ label: "Open the supplier book", href: BUYING_ROUTES.suppliers }}
        >
          <BarChart
            data={categories}
            height={260}
            /* Headroom above the tallest bar so its value label clears the top
               gridline instead of sitting on it. */
            maxValue={Math.max(...categories.map((c) => c.value)) * 1.15}
            showValueLabels
            showGrid
            color="var(--color-iris-500, #6d5bd0)"
            formatValue={(v) => money(v)}
          />
        </Panel>

        <Panel
          title="What the sweep found"
          subtitle={`${feed.length} surfaced · ranked by the figure ${profile.agent} recommends committing`}
          action={{ label: "Open the feed", href: BUYING_ROUTES.opportunities }}
        >
          <ul className="flex flex-col">
            {[...feed]
              .sort((a, b) => b.recommended - a.recommended)
              .map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`${BUYING_ROUTES.opportunities}?play=${p.id}`}
                      className="ds-body-medium truncate hover:underline"
                      style={{ color: "var(--ds-text-primary)" }}
                      title={p.title}
                    >
                      {p.title}
                    </Link>
                    <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                      {KIND_LABEL[p.kind]} · {p.category} · confidence {p.confidencePct}%
                    </span>
                  </span>
                  <span
                    className="ds-body-medium shrink-0"
                    style={{ color: "var(--color-iris-700)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {money(p.recommended)}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Suppliers moving the wrong way"
          subtitle="Quoted lead time slipping over the last four quarters"
          action={{ label: "Score the book", href: BUYING_ROUTES.suppliers }}
        >
          <ul className="flex flex-col">
            {slipping.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
              >
                <TrendDown size={16} style={{ color: "var(--text-danger)" }} className="shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="ds-body-medium truncate"
                    style={{ color: "var(--ds-text-primary)" }}
                  >
                    {s.name}
                  </span>
                  <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                    {s.quotedLeadDays} days quoted · {s.otifPct}% OTIF · {money(s.annualSpend)}
                  </span>
                </span>
                <Pill variant={s.score >= 75 ? "neutral" : "warning"} size="sm">
                  {`Score ${s.score}`}
                </Pill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Gaps in the record"
          subtitle="What has to be closed before a play can be run on it"
          action={{ label: "Open the supplier book", href: BUYING_ROUTES.suppliers }}
        >
          <div className="flex flex-col gap-3">
            {gaps.map((s) => (
              <div key={s.id} className="flex items-start gap-2.5">
                <WarningCircle
                  size={16}
                  weight="duotone"
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--text-warning)" }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {`${s.name} — no payment term on file`}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {`${money(s.annualSpend)} a year onboarded through the legacy path · blocks the Net 60 play`}
                  </span>
                </span>
              </div>
            ))}

            <div className="flex items-start gap-2.5">
              <TrendUp
                size={16}
                weight="duotone"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--text-success)" }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                  {`${SUPPLIERS.filter((s) => s.reliability === "high").length} of ${SUPPLIERS.length} supplier records are complete`}
                </span>
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  Terms, lead time and capability confirmed within the last two quarters
                </span>
              </span>
            </div>

            <Link
              href={BUYING_ROUTES.opportunities}
              className="ds-label mt-1 inline-flex items-center gap-1 self-start"
              style={{ color: "var(--color-iris-700)", fontWeight: 500 }}
            >
              Run the Net 60 terms play
              <ArrowUpRight size={12} weight="bold" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
