"use client";

import { useState } from "react";
import { CheckCircle, type Icon } from "@phosphor-icons/react";
import { AiStar, Button, Pill, Textarea } from "@navanta-ai/design-system";
import { Modal } from "@/components/ui/Modal";
import type { ChatSubject } from "@/context/ChatPanelContext";
import type { AnswerRow } from "@/data/chat-prompts";

export interface SuggestionModalProps {
  /** The chip or row action that was clicked. */
  label: string;
  /** Optional header icon. */
  icon?: Icon;
  /**
   * Present when the chip asks a question rather than starting a message. The
   * panel used to answer every chip with an email composer, which made "why is
   * the play drifting" into a draft addressed to nobody.
   */
  answer?: { note: string; rows: AnswerRow[] };
  /** What this is about — the row, when it came from one. */
  subject: ChatSubject | null;
  /** The agent working this seat, so the footer names the right one. */
  agent: string;
  /** Who signs the draft — the person at this seat. */
  signer?: string;
  onClose: () => void;
}

/** A short activity trail — "Recent activity" is a read, not a send, so it
 *  gets a timeline instead of a draft. */
const ACTIVITY: { when: string; what: string }[] = [
  { when: "Today 09:12", what: "Agent chased the supplier — no reply" },
  { when: "Yesterday 16:40", what: "Agent chased the supplier — no reply" },
  { when: "2 days ago", what: "Forwarder feed flagged the promise date at risk" },
  { when: "5 days ago", what: "PO issued and sent for acknowledgement" },
];

/** The drafted message per action. Deterministic, like the insight line — the
 *  agent drafts, the person reads it and presses send. Shared with the row-level
 *  ContactModal so both surfaces send the same words. */
export function draftFor(label: string, subject: ChatSubject | null, signer: string): string {
  const ref = subject?.ref ?? "the order";
  const who = subject?.party ?? "the supplier";
  const sign = `Thanks,\n${signer} · Target`;

  switch (label) {
    case "Contact supplier":
    case "Contact plant":
      return `Hello,\n\nYour lead time on ${ref} has moved out 10 days, and we're told that holds for the next three months. We've already replanned around it, so this is about the commercial position rather than the date.\n\nCan you confirm: is the 10 days firm for the full three months, and what would it take to pull any of it back? We'd rather price a known delay than absorb a moving one.\n\n${sign}`;

    case "Contact customer":
      return `Hello,\n\nYour order is out for delivery today and we'd like to confirm the window — we have it down for 2pm.\n\nOne ask: please check the load on arrival rather than signing and unwrapping later. If anything looks wrong under the wrap, photograph it at the tailgate and we'll handle it there and then.\n\n${sign}`;

    case "Contact terminal":
      return `Hello,\n\nWe're missing tracking on ${ref} and need a position and a realistic arrival time.\n\nCould you confirm where the trailer is and when it will clear? We have a delivery promise riding on it and would rather re-plan now than explain later.\n\n${sign}`;
    case "Request a date":
      return `Hello,\n\nWe still don't have an acknowledgement on ${ref}. Please confirm a firm ship date against the committed floor-set date, or tell us the earliest you can commit to.\n\nWe have downstream orders riding on this one, so a date we can plan against matters more than an optimistic one.\n\n${sign}`;

    case "Delay reason":
      return `Hello,\n\nCould you confirm the reason ${ref} has slipped, and give us the delay code you're recording against it?\n\nWe need the cause on file to decide whether to hold, substitute or re-source — a firm reason today saves a re-plan later.\n\n${sign}`;

    case "Escalate a level":
      return `Hello,\n\nEscalating ${ref}. We have chased ${who} twice with no reply and the promise date is now at risk.\n\nPlease have someone with scheduling authority come back to us today with either a firm date or a clear statement that the line cannot be met, so we can move the volume.\n\n${sign}`;

    /* The suggestion chips. These four are the ones the rail offers before any
       row has been picked, so they lean on the top line of the queue rather than
       a subject the reader chose — which is why each says what it is about in
       its first sentence rather than assuming shared context. */
    case "Draft an update":
      return `Wanted to get ahead of this rather than let you find out from a tracking page.\n\n${ref} has moved: the plant has taken the lead time out ten days and is holding it for three months. We have already replanned around it, and the contract price is unchanged.\n\nIf the date is a problem for a booked install, tell me today and I will put options in front of you rather than a slipped date.\n\n${sign}`;

    case "Offer alternates":
      return `Two ways to keep your floor-set date on ${ref}, both priced and both held for you until you decide.\n\nTake the alternate style: it ships now, your date holds, and the contract price is unchanged. Same construction and wear layer — only the pattern differs.\n\nOr wait for the original: ten days later, price still held, and we re-book the crew at our cost because the slip is ours.\n\nWhich would you rather protect — the date or the pattern?\n\n${sign}`;

    case "Chase a supplier":
      return `We still need a firm position on ${ref} from ${who}.\n\nThis has been chased twice with no reply, and the committed date has now passed. Please come back with either a date you will stand behind or a clear statement that the line cannot be met, so we can move the volume rather than keep planning against a guess.\n\n${sign}`;

    case "Warn the account":
      return `Rather than let this arrive as a surprise: ${ref} is running behind and I would rather you heard the position from me.\n\nWe are still working the date and will have a firm answer shortly. If you have a crew or an end client committed against it, tell me now and I will treat it as the first one to solve.\n\n${sign}`;

    default:
      return `Hello,\n\nFollowing up on ${ref}.\n\n${sign}`;
  }
}

export function SuggestionModal({
  label,
  icon,
  answer,
  subject,
  agent,
  signer = "Target Supply Chain",
  onClose,
}: SuggestionModalProps) {
  const [draft, setDraft] = useState(() => draftFor(label, subject, signer));
  const [sent, setSent] = useState(false);

  const subtitle = subject ? `${subject.party} · ${subject.ref}` : agent;

  /* A read: the agent answers and the person closes. `ACTIVITY` is the fallback
     for the one prompt that predates the authored answers. */
  if (answer || label === "Recent activity") {
    const rows: AnswerRow[] =
      answer?.rows ?? ACTIVITY.map((a) => ({ label: a.when, text: a.what }));
    const note = answer?.note ?? `Everything ${agent} has done on this line.`;
    return (
      <Modal
        title={label}
        subtitle={subtitle}
        icon={icon}
        size="default"
        onClose={onClose}
        footer={
          <>
            <span
              className="flex items-center type-caption font-normal"
              style={{ gap: 6, color: "var(--text-secondary)" }}
            >
              <AiStar size={14} variant="small" />
              {`${agent} read this off the record — nothing here has been sent.`}
            </span>
            <Button variant="outline" size="md" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="type-body" style={{ color: "var(--text-primary)" }}>
            {note}
          </p>
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.label + r.text} className="flex items-start gap-3">
                <span
                  className="type-caption shrink-0 font-normal"
                  style={{ width: 108, color: "var(--text-secondary)" }}
                >
                  {r.label}
                </span>
                <span className="type-body" style={{ color: "var(--text-primary)" }}>
                  {r.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={label}
      subtitle={subtitle}
      icon={icon}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <span
            className="flex items-center type-caption font-normal"
            style={{ gap: 6, color: "var(--text-secondary)" }}
          >
            <AiStar size={14} variant="small" />
            {sent
              ? `Sent — ${agent} will log the reply against the record.`
              : `${agent} drafted this from the record and the last two chases. Edit before sending.`}
          </span>
          <span className="flex items-center" style={{ gap: 8 }}>
            <Button variant="outline" size="md" onClick={onClose}>
              {sent ? "Close" : "Cancel"}
            </Button>
            {!sent && (
              <Button variant="primary" size="md" onClick={() => setSent(true)}>
                Send
              </Button>
            )}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {subject && (
          <div className="flex flex-wrap items-center gap-2">
            <Pill variant={subject.partyOwn ? "neutral" : "info"} size="sm">
              {subject.party}
            </Pill>
            <Pill variant="neutral" size="sm">
              {subject.ref}
            </Pill>
          </div>
        )}

        {sent ? (
          <div
            className="flex items-start gap-2 rounded-[10px] px-4 py-3"
            style={{ background: "var(--ds-bg-success-subtle)" }}
          >
            <CheckCircle
              size={16}
              weight="duotone"
              className="mt-[2px] shrink-0"
              style={{ color: "var(--ds-icon-success)" }}
            />
            <span className="type-body" style={{ color: "var(--text-primary)" }}>
              {`Sent to ${subject?.party ?? "the counterparty"}. The row stays `}
              <strong>Open</strong>
              {` until a reply comes back, then ${agent} moves it to `}
              <strong>Settled</strong>.
            </span>
          </div>
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            aria-label="Message draft"
          />
        )}
      </div>
    </Modal>
  );
}
