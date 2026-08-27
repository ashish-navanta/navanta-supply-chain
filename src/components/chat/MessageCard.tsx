"use client";

import { useEffect, useState } from "react";
import { Check, PaperPlaneTilt } from "@phosphor-icons/react";
import type { MessageDraft } from "@/data/agent-actions";

/**
 * The message the agent sent, written out as it is written.
 *
 * The counterpart to the call recording. A chase by phone gets a transcript
 * because the outcome rests on what was asked; a message is the same claim in a
 * different medium, and "Sent them to the account" asks the reader to take on
 * trust that the right two options went out at the right prices with the right
 * dates. Here they can read it.
 *
 * It composes rather than appearing. A finished email dropped in whole reads as
 * a fixture; watching the options land one after the other is what makes it
 * feel like something being done on your behalf — and it gives the reader time
 * to object before the Sent stamp lands.
 */

/** How long the draft takes to write itself on screen. */
export const MESSAGE_LIVE_MS = 4200;

export function MessageCard({ draft }: { draft: MessageDraft }) {
  const [sent, setSent] = useState(false);
  const [shown, setShown] = useState(0);

  const beats = draft.lines.length + (draft.options?.length ?? 0);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / MESSAGE_LIVE_MS);
      setShown(Math.min(beats, Math.floor(p * beats) + 1));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setSent(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beats]);

  const bodyShown = Math.min(draft.lines.length, shown);
  const optsShown = Math.max(0, shown - draft.lines.length);

  return (
    <div className="flex flex-col gap-2.5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <PaperPlaneTilt
            size={13}
            weight="fill"
            className="shrink-0"
            style={{ color: "var(--color-iris-700)" }}
          />
          <span className="ds-body-medium truncate" style={{ color: "var(--ds-text-primary)" }}>
            {draft.to}
          </span>
        </span>
        {/* The stamp only lands when it has actually gone. Until then the card
            says what it is doing, which is also the window to object. */}
        <span className="ds-label shrink-0" style={{ color: "var(--text-muted)" }}>
          {sent ? (
            <span className="flex items-center gap-1">
              <Check size={11} weight="bold" />
              Sent
            </span>
          ) : (
            "Composing…"
          )}
        </span>
      </div>

      <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
        {draft.subject}
      </span>

      <div className="flex flex-col gap-1.5">
        {draft.lines.slice(0, bodyShown).map((l) => (
          <p key={l} className="ds-body call-turn" style={{ color: "var(--ds-text-secondary)" }}>
            {l}
          </p>
        ))}
      </div>

      {/* The options side by side, which is the whole point of this message —
          a account choosing between two dates should not have to reconstruct
          them from a paragraph. */}
      {draft.options && optsShown > 0 && (
        <div
          className="flex flex-col overflow-hidden rounded-[8px]"
          style={{ border: "1px solid var(--ds-border-subtle)" }}
        >
          {draft.options.slice(0, optsShown).map((o, i) => (
            <div
              key={o.label}
              className="call-turn flex flex-col gap-0.5 px-2.5 py-2"
              style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
            >
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                {o.label}
              </span>
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                {o.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      <span className="ds-label" style={{ color: "var(--text-muted)" }}>
        {sent ? `${draft.when} · ${draft.address}` : draft.address}
      </span>
    </div>
  );
}
