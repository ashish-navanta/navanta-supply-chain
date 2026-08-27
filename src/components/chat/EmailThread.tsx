"use client";

import { useState } from "react";
import { AiStar, Button, Input, Pill, Select, Textarea } from "@navanta-ai/design-system";
import {
  ArrowBendUpLeft,
  CaretDown,
  PaperPlaneTilt,
  PhoneCall,
} from "@phosphor-icons/react";
import { threadFor, type ActionRow, type ThreadEntry } from "@/data/action-center";
import { CallCard } from "@/components/chat/CallCard";

/** How a call the person placed themselves ended. */
const CALL_OUTCOMES = [
  "Answered",
  "No answer",
  "Voicemail left",
  "Left a message with a colleague",
  "Wrong number or line dead",
] as const;

/**
 * Every exchange behind the row, written and spoken. The agent places its own
 * calls, so a transcript summary sits in the same trail as the mail — a person
 * checking the agent's account should not have to look in two places, and "we
 * rang and they said" is often where a figure actually came from.
 *
 * Each entry is an accordion. A five-message thread rendered open was most of a
 * screen of prose to scroll past before reaching anything actionable; collapsed,
 * the subject line and the outcome are enough to decide what to open. The newest
 * entry starts expanded because it is the one that changed something, and a
 * collapsed entry the agent quoted keeps a star so its contribution is still
 * visible without unfolding it.
 *
 * Built on `<details>`/`<summary>` rather than a state hook: keyboard operation,
 * focus handling and the open/closed semantics come free and correct.
 */

export interface EmailThreadProps {
  row: ActionRow;
  agent: string;
  /** The reply composer. Omit and the thread is read-only — the decision modal
   *  shows the correspondence as evidence, not as an inbox. */
  compose?: {
    to: string;
    /** Who signs what they log — the person at this seat. */
    signer: string;
    /**
     * Which form is open. Host-controlled rather than internal because the
     * modal's band opens one directly: pressing "Call Duc Pham" there should
     * land on the call-notes form, not on a closed thread.
     */
    mode: "none" | "email" | "call";
    onMode: (next: "none" | "email" | "call") => void;
    draft: string;
    onDraftChange: (next: string) => void;
    onSend: () => void;
    /** Called when call notes are saved. Omit and only the email path shows. */
    onLogCall?: (note: { outcome: string; minutes: string; body: string }) => void;
    /** What the agent suggests saying — shown beside the notes field. */
    talkingPoints?: string[];
  };
}

export function EmailThread({ row, agent, compose }: EmailThreadProps) {
  /* Notes for a call the AGENT did not place. Its own calls arrive with a
     transcript summary; a call a person makes in the corridor or on their mobile
     leaves no record at all, and an undocumented call is the most common way a
     thread stops explaining what happened. The note is a local addition to the
     trail rather than something written to a system. */
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [minutes, setMinutes] = useState("5");
  const [note, setNote] = useState("");
  const [logged, setLogged] = useState<ThreadEntry[]>([]);
  /* Newest first — an inbox order. `threadFor` builds the correspondence
     chronologically because that is how it reads when written; reversing here
     keeps the data honest and puts the most recent exchange where the eye lands. */
  const entries = [...threadFor(row, agent), ...logged].reverse();

  const saveCall = () => {
    const entry: ThreadEntry = {
      id: `manual-${logged.length + 1}`,
      kind: "call",
      outbound: true,
      from: `${compose?.signer ?? "You"} (logged manually)`,
      to: compose?.to ?? row.party,
      when: "Just now",
      subject: "Call logged by hand",
      body: note.trim(),
      outcome,
      durationMin: Number.parseInt(minutes, 10) || undefined,
      automated: false,
    };
    setLogged((prev) => [...prev, entry]);
    compose?.onLogCall?.({ outcome, minutes, body: note });
    setNote("");
    compose?.onMode("none");
  };

  return (
    <div className="flex flex-col gap-2">
      {/* The composer heads the thread, above the newest entry — a reply goes at
          the top of the chain, not at the end of a scroll. */}
      {compose &&
        (compose.mode === "email" ? (
          <div
            /* A light grey fill rather than an accent outline: the form is the
               active surface either way, and the iris border competed with the
               brand band above it for the same job. */
            className="flex flex-col gap-3 rounded-xl p-3"
            style={{ background: "var(--surface-sunken)" }}
          >
            <div className="flex flex-col">
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                Reply to {compose.to}
              </span>
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                {`${agent} drafted this from the thread below. Edit before sending.`}
              </span>
            </div>
            <Textarea
              value={compose.draft}
              onChange={(e) => compose.onDraftChange(e.target.value)}
              rows={9}
              aria-label="Reply draft"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => compose.onMode("none")}>
                Cancel
              </Button>
              <Button
                variant="christy"
                size="sm"
                iconLeft={<PaperPlaneTilt size={14} weight="bold" />}
                onClick={compose.onSend}
              >
                Send reply
              </Button>
            </div>
          </div>
        ) : compose.mode === "call" ? (
          <div
            /* A light grey fill rather than an accent outline: the form is the
               active surface either way, and the iris border competed with the
               brand band above it for the same job. */
            className="flex flex-col gap-3 rounded-xl p-3"
            style={{ background: "var(--surface-sunken)" }}
          >
            <div className="flex flex-col">
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                Log a call
              </span>
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                {`For a call you made yourself — ${agent} only transcribes the ones it places.`}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <span className="flex flex-col gap-1" style={{ width: 260 }}>
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  Outcome
                </span>
                <Select value={outcome} onValueChange={setOutcome}>
                  <Select.Trigger size="md" aria-label="Call outcome">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {CALL_OUTCOMES.map((o) => (
                      <Select.Item key={o} value={o}>
                        {o}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </span>
              <span className="flex flex-col gap-1" style={{ width: 130 }}>
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  Duration
                </span>
                <Input
                  size="md"
                  type="number"
                  min={1}
                  max={240}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  suffix="min"
                  aria-label="Call duration in minutes"
                />
              </span>
            </div>
            {/* The prompts and the record of what was said belong together: the
                points are what to ask, the notes are what came back. */}
            {compose.talkingPoints && compose.talkingPoints.length > 0 && (
              <div
                className="flex flex-col gap-2 rounded-lg p-3"
                style={{ background: "var(--surface-base)" }}
              >
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  {`Talking points — drafted by ${agent}`}
                </span>
                {compose.talkingPoints.map((point) => (
                  <span key={point} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[8px] shrink-0 rounded-full"
                      style={{ width: 5, height: 5, background: "var(--color-iris-500)" }}
                    />
                    <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                      {point}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="What was said, and what was agreed. Anything a figure might later rest on."
              aria-label="Call notes"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => compose.onMode("none")}>
                Cancel
              </Button>
              <Button
                variant="christy"
                size="sm"
                disabled={note.trim().length === 0}
                iconLeft={<PhoneCall size={14} weight="bold" />}
                onClick={saveCall}
              >
                Save call notes
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => compose.onMode("email")}
              className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                background: "var(--surface-base)",
                border: "1px dashed var(--ds-border-default)",
              }}
            >
              <AiStar size={14} variant="small" />
              <span className="ds-body-medium" style={{ color: "var(--color-iris-700)" }}>
                Write a reply
              </span>
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                {`${agent} has a draft ready`}
              </span>
            </button>
            {compose.onLogCall && (
              <button
                type="button"
                onClick={() => compose.onMode("call")}
                className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                style={{
                  background: "var(--surface-base)",
                  border: "1px dashed var(--ds-border-default)",
                }}
              >
                <PhoneCall
                  size={14}
                  weight="duotone"
                  style={{ color: "var(--ds-icon-secondary)" }}
                />
                <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                  Log a call
                </span>
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  If you rang them yourself
                </span>
              </button>
            )}
          </div>
        ))}

      {entries.map((m, i) => {
        const call = m.kind === "call";
        const Icon = call ? PhoneCall : m.outbound ? PaperPlaneTilt : ArrowBendUpLeft;
        return (
          <details
            key={m.id}
            className="thread-entry overflow-hidden rounded-xl"
            open={i === 0}
            style={{
              background: "var(--surface-base)",
              border: `1px solid ${m.citedAs ? "var(--color-iris-200)" : "var(--ds-border-subtle)"}`,
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <Icon
                size={16}
                weight="duotone"
                className="shrink-0"
                style={{
                  color: call
                    ? "var(--color-iris-500)"
                    : m.outbound
                      ? "var(--ds-icon-secondary)"
                      : "var(--ds-icon-info)",
                }}
              />
              <span
                className="ds-body-medium min-w-0 flex-1 truncate"
                style={{ color: "var(--ds-text-primary)" }}
              >
                {m.subject}
              </span>
              {call && m.outcome && (
                <Pill variant={m.outcome === "Answered" ? "info" : "warning"} size="sm">
                  {m.outcome}
                </Pill>
              )}
              {/* Kept on the closed row so a quoted entry is findable without
                  opening every one to look for the bar. */}
              {m.citedAs && <AiStar size={13} variant="small" className="shrink-0" />}
              <span
                className="ds-label shrink-0"
                style={{ color: "var(--ds-text-secondary)" }}
              >
                {m.when}
              </span>
              <CaretDown
                size={14}
                className="thread-caret shrink-0"
                style={{ color: "var(--ds-icon-secondary)" }}
              />
            </summary>

            <div className="flex flex-col gap-1 px-3 pb-3 pl-[42px]">
              <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                {m.from} → {m.to}
              </span>
              {call && m.durationMin !== undefined && !m.turns && (
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  {m.automated
                    ? `${m.durationMin} min · automated call by ${agent}`
                    : `${m.durationMin} min · notes taken by hand`}
                </span>
              )}
              <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                {m.body}
              </p>
              {/* The recording under the summary the agent wrote from it. The
                  body line is the agent's account of the call; this is the
                  call — and on a line where three months of lead time turns on
                  what the supplier said, the account is exactly the thing a
                  buyer should be able to check rather than accept. */}
              {m.turns && m.turns.length > 0 && (
                <div
                  className="mt-1 overflow-hidden rounded-xl"
                  style={{ border: "1px solid var(--ds-border-subtle)" }}
                >
                  <CallCard
                    call={{
                      past: true,
                      with: m.to,
                      duration: `${m.durationMin ?? 1}:00`,
                      when: m.when,
                      number: m.to.split(" · ")[1] ?? "",
                      turns: m.turns,
                    }}
                  />
                </div>
              )}
            </div>

            {m.citedAs && (
              <div
                className="flex flex-wrap items-center gap-2 px-3 py-2"
                style={{
                  background: "var(--color-iris-50)",
                  borderTop: "1px solid var(--color-iris-200)",
                }}
              >
                <AiStar size={14} variant="small" />
                <span className="ds-body-medium" style={{ color: "var(--color-iris-700)" }}>
                  {`${agent} took from this:`}
                </span>
                <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                  {m.citedAs}
                </span>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
