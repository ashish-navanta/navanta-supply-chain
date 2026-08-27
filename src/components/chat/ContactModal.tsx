"use client";

import { useState } from "react";
import {
  Buildings,
  ChatsCircle,
  ClockCounterClockwise,
  EnvelopeSimple,
  Package,
  PhoneCall,
  Receipt,
} from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { AgentSummary } from "@/components/chat/AgentSummary";
import type { CommitReport } from "@/components/chat/commit";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { EmailThread } from "@/components/chat/EmailThread";
import { LineItems } from "@/components/chat/LineItems";
import { PoDetails } from "@/components/chat/PoDetails";
import { SupplierDetails } from "@/components/chat/SupplierDetails";
import { ChoiceSection } from "@/components/chat/ChoiceSection";
import { draftFor } from "@/components/chat/SuggestionModal";
import {
  contactFor,
  historyFor,
  linesFor,
  talkingPointsFor,
  threadFor,
  type ActionRow,
} from "@/data/action-center";

/**
 * The chase/contact experience — the counterpart to the decision modal, for
 * rows where the missing thing is an ANSWER rather than a choice. The agent
 * has already chased; this is where the person picks the channel that will
 * actually get a reply: the drafted email, or a call with the number, the
 * hours and the talking points already on screen.
 */

/** The context card's tabs — who answers, and what's been tried. */
type View = "po" | "supplier" | "thread" | "products" | "history";

/** What the agent has already done and why this row reached a person. */
function summaryFor(label: string, row: ActionRow, agent: string): string {
  switch (label) {
    case "Contact supplier":
    case "Contact plant":
      return `${agent} has chased ${row.party} twice with no reply, and the promise date is now at risk. Escalated to you — a person asking tends to get what an agent can't. The email is drafted and the call script is ready; pick the channel.`;
    case "Chase":
      return `${agent} requested the second-source quote and has been chasing since. Nothing is blocked yet, but the decision on the capped line waits on this number. A nudge from you moves it faster than another automated chase.`;
    case "Follow up":
      return `${agent} sent the options and hasn't heard back. The install crew books soon — after that, every choice gets more expensive. This is the moment a human follow-up beats a third automated one.`;
    case "Contact terminal":
      return `${agent} has lost tracking on this load and reconciled what the feeds do show. What's missing is a position and a realistic arrival time — the terminal desk can give you both in one call.`;
    case "Contact customer":
      return `${agent} has the load out for delivery and the window set. One confirmation call protects the claim position: ask them to check under the wrap at the tailgate, not after signing.`;
    default:
      return `${agent} has done the automated legwork on this line. What's left needs a person on the other end — the draft and the contact details are ready.`;
  }
}

export interface ContactModalProps {
  /** The row action that was clicked — "Contact supplier", "Chase"… */
  label: string;
  row: ActionRow;
  agent: string;
  /** Who signs the email — the person at this seat. */
  signer: string;
  onClose: () => void;
  /** Prev/next through the queue, forwarded to the modal shell's header. */
  nav?: ModalProps["nav"];
  /** Called on send/log. The host closes this modal and raises the toast. */
  onCommitted: (report: CommitReport) => void;
  /** Open straight into a channel — the row's Email and Call buttons have
   *  already made that choice, so re-asking on arrival would be a dead step. */
  initialMode?: "email" | "call";
}

export function ContactModal({
  label,
  row,
  agent,
  signer,
  nav,
  onClose,
  onCommitted,
  initialMode,
}: ContactModalProps) {
  const contact = contactFor(row.party, row.partyOwn);
  const [draft, setDraft] = useState(() =>
    draftFor(label, { ref: row.ref, party: row.party, partyOwn: row.partyOwn }, signer),
  );
  /* Both channels are worked in the thread tab, so opening either from the band
     lands there. The band no longer hosts a call script of its own — the points
     belong beside the notes the person is taking. */
  const [view, setView] = useState<View>(initialMode ? "thread" : "po");
  const [mode, setMode] = useState<"none" | "email" | "call">(initialMode ?? "none");

  const points = talkingPointsFor(row, label);

  return (
    <Modal
      title={`${row.ref} — ${label.toLowerCase()}`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        /* The PO leads, same as the decision modal — this window is about the
           order, and contacting the supplier is what you are doing to it. */
        <div className="flex items-center" style={{ gap: 10 }}>
          <Package size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {row.ref}
          </span>
          <Pill variant={row.partyOwn ? "neutral" : "info"} size="sm">
            {row.party}
          </Pill>
          <Pill variant="neutral" size="sm">
            {label}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={summaryFor(label, row, agent)}
        >
          <ChoiceSection
            name={`channel-${row.id}`}
            ariaLabel="Choose a channel"
            requireChoice={false}
            recommendation={{
              line: `Reply to ${contact.name} — ${contact.respondsIn.toLowerCase()}`,
            }}
            onCancel={onClose}
            confirmLabel="Write a reply"
            onConfirm={() => {
              setView("thread");
              setMode("email");
            }}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<PhoneCall size={14} />}
                  onClick={() => {
                    setView("thread");
                    setMode("call");
                  }}
                >
                  {`Call ${contact.name}`}
                </Button>
                <Button
                  variant="christy"
                  size="sm"
                  iconLeft={<EnvelopeSimple size={14} weight="bold" />}
                  onClick={() => {
                    setView("thread");
                    setMode("email");
                  }}
                >
                  Write a reply
                </Button>
              </>
            }
          />
        </AgentSummary>

        {/* Who answers, and what's already been tried — the context that makes
            the channel choice an informed one. */}
        <Tabs
          variant="underline"
          /* The DS only rules the container on the `bordered` variant; the
             underline variant needs the divider to separate the bar from the
             panel below it. */
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "po", label: "PO details", icon: Receipt },
            { id: "supplier", label: "Vendor details", icon: Buildings },
            { id: "thread", label: "Email & call thread", icon: ChatsCircle, badge: threadFor(row, agent).length },
            { id: "products", label: "Products", icon: Package, badge: linesFor(row).length },
            { id: "history", label: "Activity history", icon: ClockCounterClockwise, badge: historyFor(row, agent).length },
          ]}
          activeTab={view}
          onChange={(id) => setView(id as View)}
        />

        {view === "po" ? (
          <PoDetails row={row} agent={agent} onOpenPanel={setView} />
        ) : view === "supplier" ? (
          <SupplierDetails row={row} />
        ) : view === "products" ? (
          <LineItems row={row} />
        ) : view === "thread" ? (
          <EmailThread
            row={row}
            agent={agent}
            compose={{
              to: contact.email,
              signer,
              mode,
              onMode: setMode,
              talkingPoints: points,
              draft,
              onDraftChange: setDraft,
              /* A call the rep placed themselves leaves no transcript, so the
                 thread takes the notes by hand. It does not commit the row —
                 the line stays open until the counterparty actually answers. */
              onLogCall: () => {},
              onSend: () =>
                onCommitted({
                  title: `${row.ref} — email sent to ${contact.name}`,
                  message: `Sent to ${contact.email}. The row stays open until it is answered, then ${agent} moves it to Settled.`,
                }),
            }}
          />
        ) : (
          <ActivityHistory row={row} agent={agent} />
        )}
      </div>
    </Modal>
  );
}
