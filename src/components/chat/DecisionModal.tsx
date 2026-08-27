"use client";

import { useMemo, useState } from "react";
import {
  Buildings,
  ChatsCircle,
  Check,
  ClockCounterClockwise,
  Package,
  PencilSimple,
  Receipt,
} from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { ChoiceSection } from "@/components/chat/ChoiceSection";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { EmailThread } from "@/components/chat/EmailThread";
import { LineItems } from "@/components/chat/LineItems";
import { LEAD_TIME_REASONS, OverridePanel } from "@/components/chat/OverridePanel";
import { leadTimeCommit, type CommitReport } from "@/components/chat/commit";
export type { CommitReport } from "@/components/chat/commit";
import { PoDetails } from "@/components/chat/PoDetails";
import { SupplierDetails } from "@/components/chat/SupplierDetails";
import {
  CAUSE_LABEL,
  SLIP_DAYS,
  causeOf,
  formatUsd,
  historyFor,
  linesFor,
  threadFor,
  type ActionRow,
} from "@/data/action-center";

/* ─── Date arithmetic on the row's "22 Aug" strings ─────────────────
 * Each move lands the material on a different date, and the date is
 * most of the decision — so the option cards carry it, like the Figma
 * spec's "Reroute via Denver (Mar 8)". Rows whose date field isn't a
 * real date ("3d ago") simply drop the suffix.
 * ─────────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function shiftDate(date: string, days: number): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})$/.exec(date.trim());
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return null;
  let day = parseInt(m[1], 10) + days;
  let month = mi;
  while (day < 1) {
    month = (month + 11) % 12;
    day += MONTH_DAYS[month];
  }
  while (day > MONTH_DAYS[month]) {
    day -= MONTH_DAYS[month];
    month = (month + 1) % 12;
  }
  return `${day} ${MONTHS[month]}`;
}

export interface Recommendation {
  /** The lead time the agent recommends, in days. */
  days: number;
  /** What it was before the supplier moved it. */
  wasDays: number;
  /** Why the agent landed there. */
  why: string;
}

/**
 * How sure the agent is of its figure. Deterministic, like the insight copy: a
 * supplier that has confirmed a number in writing is firmer than a plant
 * schedule the agent inferred, and a cost exception firmer still because the
 * quote is on the record.
 */
function confidenceFor(row: ActionRow): number {
  if (row.signal === "lead-time-jump") return 88;
  if (row.signal === "capacity") return 82;
  return 76;
}

function recommendationFor(row: ActionRow, leadOnRecord: number): Recommendation {
  return {
    days: leadOnRecord,
    wasDays: leadOnRecord - SLIP_DAYS,
    why:
      row.signal === "capacity"
        ? `The plant is capped for three months. ${leadOnRecord} days is what the current schedule can actually hold.`
        : `The supplier has confirmed +${SLIP_DAYS} days for the next three months. ${leadOnRecord} days is their quoted figure.`,
  };
}

export interface DecisionModalProps {
  row: ActionRow;
  /** The agent that costed the options. */
  agent: string;
  onClose: () => void;
  /** Prev/next through the queue, forwarded to the modal shell's header. */
  nav?: ModalProps["nav"];
  /** Called on commit. The host closes this modal and raises the notification —
   *  a confirmation panel inside a modal you are about to dismiss is a screen
   *  nobody reads. */
  onCommitted: (report: CommitReport) => void;
  /** Open straight into the override panel — the row's Override button skips
   *  the recommendation, since pressing it is already a rejection of it. */
  initialOverriding?: boolean;
}

export function DecisionModal({
  row,
  agent,
  nav,
  onClose,
  onCommitted,
  initialOverriding = false,
}: DecisionModalProps) {

  const lines = useMemo(() => linesFor(row), [row]);
  const thread = useMemo(() => threadFor(row, agent), [row, agent]);
  const history = useMemo(() => historyFor(row, agent), [row, agent]);
  const leadOnRecord = Math.max(...lines.map((l) => l.leadDays));
  const rec = recommendationFor(row, leadOnRecord);

  /* The lead time the buyer is committing. Starts on the agent's recommendation
     and is theirs to change — the input is the decision, not a radio button. */
  const [lead, setLead] = useState(String(rec.days));
  /* The override is a deliberate act, not an always-open field — the default
     path is confirming the agent's figure. */
  const [overriding, setOverriding] = useState(initialOverriding);
  const [reason, setReason] = useState<string | null>(null);
  const leadNum = Number.parseInt(lead, 10);
  const valid = Number.isFinite(leadNum) && leadNum > 0 && leadNum < 400;
  const delta = valid ? leadNum - rec.days : 0;
  // The date the order lands on if this lead time is committed.
  const landsOn = valid ? shiftDate(row.date, delta) : null;
  const overridden = valid && leadNum !== rec.days;
  /** The date the order is committed to today, before any change is accepted. */
  const committedDate = shiftDate(row.date, -SLIP_DAYS) ?? row.date;
  /* A settled row is a record to read, not a decision to take — every row now
     opens under one "Review" verb, so the modal decides what it can offer.

     So is a row whose exception isn't a lead time. This modal only knows how to
     commit days; offering its band on a rush-freight quote or a re-promise would
     put a lead-time decision on a screen about something else. Those rows read
     as a record until they have a decision surface of their own. */
  const leadTimeRow = row.signal === "lead-time-jump" || row.signal === "capacity";
  const settled = row.state === "settled" || !leadTimeRow;
  /** Which supporting panel is open below the summary. */
  type Panel = "po" | "supplier" | "thread" | "products" | "history";
  const [panel, setPanel] = useState<Panel>("po");

  /** Commit the figure on screen. The wording is shared with the row's Approve
   *  button, which commits the same decision without opening this modal. */
  const commit = () => onCommitted(leadTimeCommit(row, agent, leadNum, landsOn, reason));

  return (
    <Modal
      title={`${row.ref} — ${settled ? "review" : "decide"}`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          <Package size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {row.ref}
          </span>
          <Pill variant={row.partyOwn ? "neutral" : "info"} size="sm">
            {row.party}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          /* The paragraph states the situation; nothing is written to the
             record until the figure below is confirmed, which is what the
             outcome copy then reports. */
          text={
            !leadTimeRow && row.state !== "settled"
              ? `${row.insight}. ${agent} has done the automated legwork; this line needs a person, and the decision surface for it is not this one.`
              : settled
              ? `Settled. ${agent} holds ${row.party} to the agreed date and will raise it again if the line slips.`
              : `${agent} has told the affected customers that ${row.party} has moved the lead time out ${SLIP_DAYS} days. The supplier record updates for the next three months as soon as you confirm the figure.`
          }
          /* Current state, with the two figures the decision moves shown as
             `now → on confirm`. The rest are unaffected by the choice. */
          facts={[
            {
              label: "Lead time",
              value: settled ? `${rec.days} days` : `${rec.wasDays} days`,
              next: !settled && valid && leadNum !== rec.wasDays ? `${leadNum} days` : undefined,
            },
            {
              label: "Committed date",
              value: settled ? row.date : committedDate,
              next:
                !settled && valid && landsOn && landsOn !== committedDate ? landsOn : undefined,
            },
            {
              label: "Quantity",
              value: `${row.qtyValue} ${row.qtyUnit}`,
            },
            {
              label: "Exposure",
              value: formatUsd(row.value),
            },
            { label: "Cause", value: CAUSE_LABEL[causeOf(row.signal)] },
          ]}
        >
          {settled ? null : overriding ? (
            <OverridePanel
              agent={agent}
              subject="lead time"
              unit="days"
              reasons={LEAD_TIME_REASONS}
              value={lead}
              onValueChange={setLead}
              recommended={rec.days}
              reason={reason}
              onReasonChange={setReason}
              valid={valid}
              onCancel={() => {
                setOverriding(false);
                setReason(null);
                setLead(String(rec.days));
              }}
              onConfirm={commit}
            />
          ) : (
            <ChoiceSection
              name={`lead-${row.id}`}
              ariaLabel="Set the lead time"
              recommendation={{
                line: `${overridden ? "Set" : "Accept"} ${valid ? leadNum : rec.days} days for the next three months`,
                confidence: confidenceFor(row),
              }}
              onCancel={onClose}
              confirmLabel={`Confirm · ${valid ? leadNum : rec.days} days`}
              requireChoice={false}
              onConfirm={commit}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<PencilSimple size={14} />}
                    onClick={() => setOverriding(true)}
                  >
                    Override lead time
                  </Button>
                  {/* The Figma's primary here is Button/christy-primary — the
                      DS `christy` variant, whose --gradient-christy is the same
                      #1D4A86 → #3D348B the design specifies. */}
                  <Button
                    variant="christy"
                    size="sm"
                    iconLeft={<Check size={14} weight="bold" />}
                    disabled={!valid}
                    onClick={commit}
                  >
                    {`Confirm · ${valid ? leadNum : rec.days} days`}
                  </Button>
                </>
              }
            />
          )}
        </AgentSummary>

        {/* Supporting evidence for the call above — who the counterparty is,
            and what the money is actually made of. */}
        <Tabs
          variant="underline"
          /* The DS only rules the container on the `bordered` variant; the
             underline variant needs the divider to separate the bar from the
             panel below it. */
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "po", label: "PO details", icon: Receipt },
            { id: "supplier", label: "Vendor details", icon: Buildings },
            { id: "thread", label: "Email & call thread", icon: ChatsCircle, badge: thread.length },
            { id: "products", label: "Products", icon: Package, badge: lines.length },
            { id: "history", label: "Activity history", icon: ClockCounterClockwise, badge: history.length },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "po" ? (
          <PoDetails
            row={row}
            agent={agent}
            onOpenPanel={setPanel}
          />
        ) : panel === "supplier" ? (
          <SupplierDetails row={row} />
        ) : panel === "history" ? (
          <ActivityHistory
            row={row}
            agent={agent}
            leadProposed={!settled && valid ? String(leadNum) : undefined}
          />
        ) : panel === "thread" ? (
          <EmailThread row={row} agent={agent} />
        ) : (
          <LineItems row={row} />
        )}
      </div>
    </Modal>
  );
}
