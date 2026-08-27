"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Buildings,
  ChartBar,
  ChatCircleDots,
  Copy,
  Factory,
  Handshake,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { useChatPanel } from "@/context/ChatPanelContext";
import { contactFor, QUEUES } from "@/data/action-center";
import {
  KIND_LABEL,
  PLAYS,
  SUPPLIER_STATUS_LABEL,
  STAGE_LABEL,
  money,
  type Supplier,
} from "@/data/buying";
import {
  supplierDraftFor,
  supplierTaskFor,
  type SupplierDraftIntent,
} from "@/data/supplier-drafts";
import { BUYING_ROUTES } from "@/data/nav";

/**
 * A supplier, read the way the buyer reads a purchase order: the agent's line
 * on the relationship and the five figures that decide it, then the record
 * itself in tabs — the scorecard, who answers the phone, and what is currently
 * open against them.
 *
 * There is no action band. A supplier is not a decision; the decisions that
 * touch one live on a play or a PO, and both are linked from here rather than
 * duplicated.
 */
export function SupplierModal({
  supplier,
  agent,
  nav,
  onClose,
}: {
  supplier: Supplier;
  agent: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
}) {
  type Panel = "scorecard" | "contact" | "exposure" | "draft";
  const draft = supplierDraftFor(supplier);
  const draftReady = draft.kind === "ready";
  const [panel, setPanel] = useState<Panel>(draftReady ? "draft" : "scorecard");
  const [sent, setSent] = useState(false);
  const { startTask } = useChatPanel();

  const sendWithMercer = () => {
    const task = supplierTaskFor(supplier, agent);
    if (task) startTask(task);
    setSent(true);
  };

  const contact = contactFor(supplier.name, supplier.own);
  /* What this supplier is caught up in right now, on both sides of the desk —
     the plays that name them, and the exception rows sitting on their POs. */
  const plays = PLAYS.filter((p) => p.supplierIds.includes(supplier.id));
  const rows = QUEUES.buyer.rows.filter((r) => r.party === supplier.name);

  const trendWord =
    supplier.leadTimeTrend === "slipping"
      ? "moving out"
      : supplier.leadTimeTrend === "improving"
      ? "coming in"
      : "holding";

  return (
    <Modal
      title={`${supplier.name} — supplier record`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          {supplier.own ? (
            <Factory size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          ) : (
            <Handshake size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          )}
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {supplier.name}
          </span>
          <Pill variant={supplier.own ? "neutral" : "info"} size="sm">
            {supplier.own ? "Target plant" : `${supplier.site}, ${supplier.country}`}
          </Pill>
          <Pill
            variant={
              supplier.status === "preferred"
                ? "info"
                : supplier.status === "exit-planned"
                ? "warning"
                : "neutral"
            }
            size="sm"
          >
            {SUPPLIER_STATUS_LABEL[supplier.status]}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={
            `${supplier.note} Quoted lead time is ${supplier.quotedLeadDays} days and ${trendWord}, ` +
            `against ${supplier.otifPct}% on time in full and ${supplier.rejectRate} rejects per thousand units. ` +
            `${plays.length > 0 ? `${plays.length} ${plays.length === 1 ? "play names" : "plays name"} this supplier` : "No play currently names this supplier"}` +
            `${rows.length > 0 ? ` and ${rows.length} ${rows.length === 1 ? "line is" : "lines are"} open against them in your action center.` : "."}`
          }
          facts={[
            { label: "Annual spend", value: money(supplier.annualSpend) },
            { label: "Category share", value: `${supplier.categoryShare}%` },
            { label: "Quoted lead time", value: `${supplier.quotedLeadDays} days` },
            { label: "On time in full", value: `${supplier.otifPct}%` },
            {
              label: "Payment terms",
              value:
                supplier.paymentTermsDays === null
                  ? supplier.own
                    ? "Internal transfer"
                    : "Not on file"
                  : `Net ${supplier.paymentTermsDays}`,
            },
          ]}
        />

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            /* The one new tab. Leading, because it is the actionable piece —
               what Mercer has drafted and is waiting to send. Only present
               when there is a draft; the three record tabs are untouched. */
            ...(draftReady
              ? [{ id: "draft", label: `${agent} draft`, icon: Sparkle }]
              : []),
            { id: "scorecard", label: "Scorecard", icon: ChartBar },
            { id: "contact", label: "The account", icon: Buildings },
            {
              id: "exposure",
              label: "Open against them",
              icon: Briefcase,
              badge: plays.length + rows.length,
            },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "draft" && draft.kind === "ready" ? (
          <DetailCard>
            <DetailSection
              title={`${agent} has drafted the ${draft.label.toLowerCase()}`}
              columns={1}
            >
              <div className="flex flex-col" style={{ gap: 14 }}>
                <div className="flex items-center justify-between" style={{ gap: 12 }}>
                  <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                    {draft.subtitle}
                  </span>
                  {/* The DS pill has four variants and none of them is `success`; a sent
                      draft reads as neutral-done rather than a status to act on. */}
                  <Pill variant={sent ? "neutral" : "info"} size="sm">
                    {sent ? "Sent" : "Ready to approve"}
                  </Pill>
                </div>

                <SupplierArtifactPreview
                  intent={draft.intent}
                  supplier={supplier}
                  agent={agent}
                />

                <div className="flex items-center justify-between" style={{ gap: 12 }}>
                  <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                    Approve here or run it live in the {agent} panel.
                  </span>
                  <Button
                    size="sm"
                    variant="christy"
                    iconLeft={<ChatCircleDots size={14} weight="duotone" />}
                    onClick={sendWithMercer}
                    disabled={sent}
                  >
                    {sent ? "Sent" : `Send with ${agent}`}
                  </Button>
                </div>
              </div>
            </DetailSection>
          </DetailCard>
        ) : panel === "scorecard" ? (
          <DetailCard>
            <DetailSection title={`Composite ${supplier.score} of 100`} columns={1}>
              <ul className="flex flex-col">
                {supplier.scoreLines.map((line, i) => (
                  <li
                    key={line.key}
                    className="flex items-center gap-4 py-3"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                        {line.label}
                      </span>
                      <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                        {line.note}
                      </span>
                    </span>
                    <span
                      className="ds-label shrink-0"
                      style={{ width: 64, color: "var(--ds-text-secondary)" }}
                    >
                      {`${Math.round(line.weight * 100)}% weight`}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 overflow-hidden"
                      style={{ height: 6, width: 120, borderRadius: 999, background: "var(--ds-border-subtle)" }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${line.score}%`,
                          background:
                            line.score >= 75
                              ? "var(--text-success-vivid)"
                              : line.score >= 60
                              ? "var(--color-iris-500, #6d5bd0)"
                              : "var(--text-danger)",
                        }}
                      />
                    </span>
                    <span
                      className="ds-body-medium shrink-0 text-right"
                      style={{ width: 32, color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {line.score}
                    </span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection title="Performance on the record">
              <DetailItem
                label="On time in full"
                value={`${supplier.otifPct}%`}
                source="Order management · receipt vs promise, 12 months"
              />
              <DetailItem
                label="Reject rate"
                value={`${supplier.rejectRate} per 1,000 units`}
                source="Legacy WMS · receiving inspection"
              />
              <DetailItem
                label="Lead time trend"
                value={`${supplier.quotedLeadDays} days, ${trendWord}`}
                source="Supplier feed · four-quarter quote history"
              />
              <DetailItem
                label="Record reliability"
                value={
                  supplier.reliability === "high"
                    ? "Complete"
                    : supplier.reliability === "medium"
                    ? "Partial — some fields stale"
                    : "Incomplete — onboarded through the legacy path"
                }
                source="Supplier master · field completeness"
              />
            </DetailSection>
          </DetailCard>
        ) : panel === "contact" ? (
          <DetailCard>
            <DetailSection title="The account">
              <DetailItem
                label="Relationship"
                value={supplier.own ? "Target-operated plant" : "External supplier"}
                source="Supplier master"
              />
              <DetailItem label="Site" value={`${supplier.site}, ${supplier.country}`} source="Supplier master" />
              <DetailItem label="What they make" value={supplier.categories.join(" · ")} source="Capability matrix" />
              <DetailItem
                label="Status"
                value={SUPPLIER_STATUS_LABEL[supplier.status]}
                source="Set on the buying desk"
              />
              <DetailItem label="Annual spend" value={money(supplier.annualSpend)} source="Order management · spend cube" />
              <DetailItem
                label="Category share"
                value={`${supplier.categoryShare}% of ${supplier.categories[0]}`}
                source="Order management · spend cube"
              />
              <DetailItem
                label="Payment terms"
                value={
                  supplier.paymentTermsDays === null
                    ? supplier.own
                      ? "Internal transfer — no commercial term"
                      : "Not on file"
                    : `Net ${supplier.paymentTermsDays}`
                }
                source={supplier.paymentTermsDays === null && !supplier.own ? "Data gap · blocks the terms play" : "Ariba · contract terms"}
              />
              <DetailItem
                label="Contract expiry"
                value={supplier.contractExpiry ?? "No contract on file"}
                source="Ariba · contract register"
              />
            </DetailSection>

            <DetailSection title="Who answers">
              <DetailItem label="Contact" value={contact.name} source="Supplier master" />
              <DetailItem label="Role" value={contact.role} source="Supplier master" />
              <DetailItem
                label="Phone"
                value={contact.phone}
                source="Supplier master"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Copy phone number"
                    onClick={() => void navigator.clipboard?.writeText(contact.phone)}
                  >
                    <Copy size={13} />
                  </Button>
                }
              />
              <DetailItem label="Email" value={contact.email} source="Supplier master" />
              <DetailItem label="Working hours" value={contact.hours} source="Supplier master" />
              <DetailItem
                label="Responsiveness"
                value={contact.respondsIn}
                source="Databricks · response history"
              />
            </DetailSection>
          </DetailCard>
        ) : (
          <DetailCard>
            <DetailSection title="Plays that name this supplier" columns={1}>
              {plays.length === 0 ? (
                <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                  {`No play currently names ${supplier.name}.`}
                </span>
              ) : (
                <ul className="flex flex-col">
                  {plays.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`${BUYING_ROUTES.opportunities}?play=${p.id}`}
                          className="ds-body-medium truncate hover:underline"
                          style={{ color: "var(--color-iris-700)" }}
                        >
                          {p.title}
                        </Link>
                        <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                          {`${p.id} · ${KIND_LABEL[p.kind]} · ${money(p.recommended)}`}
                        </span>
                      </span>
                      <Pill variant="neutral" size="sm">
                        {STAGE_LABEL[p.stage]}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>

            <DetailSection title="Open in the action center" columns={1}>
              {rows.length === 0 ? (
                <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                  Nothing open. Every order against this supplier is running to promise.
                </span>
              ) : (
                <ul className="flex flex-col">
                  {rows.map((r, i) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                    >
                      {r.state === "decide" && (
                        <Warning
                          size={15}
                          weight="duotone"
                          className="shrink-0"
                          style={{ color: "var(--text-warning)" }}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={BUYING_ROUTES.actionCenter}
                          className="ds-body-medium truncate hover:underline"
                          style={{ color: "var(--color-iris-700)" }}
                        >
                          {`${r.ref} — ${r.refSub}`}
                        </Link>
                        <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                          {r.insight}
                        </span>
                      </span>
                      <Pill variant={r.state === "settled" ? "info" : "neutral"} size="sm">
                        {r.state === "decide"
                          ? "Needs a decision"
                          : r.state === "waiting"
                          ? "Waiting"
                          : "Settled"}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </DetailCard>
        )}
      </div>
    </Modal>
  );
}

/* The drafted artifact preview — the one AI addition to the record modal.
   Per-intent copy so the chase, the terms letter and the benchmark each read
   as the thing they are, not a generic "Mercer did something" card. */
const artifactLine: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--ds-text-primary)",
  margin: 0,
};

function SupplierArtifactPreview({
  intent,
  supplier,
  agent,
}: {
  intent: SupplierDraftIntent;
  supplier: Supplier;
  agent: string;
}) {
  const wrap = (kicker: string, body: React.ReactNode) => (
    <div
      className="flex flex-col rounded-[8px] p-3"
      style={{
        background: "var(--surface-sunken, #F7F7F7)",
        border: "1px solid var(--ds-border-subtle)",
        gap: 8,
      }}
    >
      <span
        className="ds-label"
        style={{
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "var(--ds-text-secondary)",
        }}
      >
        {kicker}
      </span>
      {body}
    </div>
  );

  const first = supplier.name.split(" ")[0];

  if (intent === "chase") {
    return wrap(
      `Draft · from ${agent} to ${supplier.name}`,
      <>
        <p style={artifactLine}>Subject · PO cover · request for confirmed ETA</p>
        <p style={artifactLine}>
          Hi {first} team — the last four quarters have quoted{" "}
          {supplier.quotedLeadDays} days on our line, up from where we planned.
          We need a confirmed ETA against open POs, and the reason the line
          moved so we can plan around it.
        </p>
        <p style={artifactLine}>Attached: open PO refs, expected receipts, and the cover we hold.</p>
      </>,
    );
  }
  if (intent === "terms") {
    return wrap(
      "Draft · Net 60 terms letter · signed by finance",
      <>
        <p style={artifactLine}>
          Per master supply agreement §4, we propose extending payment terms to
          Net 60 across active POs with {supplier.name}, effective Q4.
        </p>
        <p style={artifactLine}>
          Countersignature returns via the commercial contact of record;
          category confirms within 5 business days.
        </p>
      </>,
    );
  }
  if (intent === "consolidate" || intent === "shortlist") {
    return wrap(
      "Draft · benchmark shortlist · ranked",
      <>
        <p style={artifactLine}>
          {supplier.name} sits at {supplier.categoryShare}% of{" "}
          {supplier.categories[0]}. Landed-cost model against the comparable
          names on file; scorecard composite {supplier.score}.
        </p>
        <p style={artifactLine}>
          Approve to lift the ranking into a play under Act. Nothing moves on
          the record until the play is committed.
        </p>
      </>,
    );
  }
  if (intent === "exit") {
    return wrap(
      "Draft · exit timeline · three quarters",
      <>
        <p style={artifactLine}>
          Wind-down plan against current cover on {supplier.name}. Last
          committed PO date, transfer window to the successor vendor, and the
          handover of tooling and spec sheets.
        </p>
        <p style={artifactLine}>
          Approve to publish to procurement and finance. No commercial
          conversation happens until then.
        </p>
      </>,
    );
  }
  return wrap(
    "Draft · scorecard refresh",
    <p style={artifactLine}>
      Composite {supplier.score} across five weighted lines re-run against the
      last four quarters. Refreshing writes the current numbers; nothing else
      moves.
    </p>,
  );
}
