"use client";

import type { ReactNode } from "react";
import { AiStar } from "@navanta-ai/design-system";
import { ArrowRight } from "@phosphor-icons/react";

/**
 * The agent's briefing block: what it already handled, the figures the call
 * turns on, and the action band where the person answers.
 *
 * Typography and metrics follow the design system's named text styles as the
 * Figma specifies them — Body Medium (14/22·500) for headings and stat values,
 * Body (14/22·400) for prose, Label (12/18·400) for field labels — expressed
 * through the app's `.type-*` classes rather than ad-hoc sizes.
 */

export interface Fact {
  label: string;
  value: string;
  /**
   * What this figure becomes if the pending decision is confirmed. Shown as
   * `current → next`, so the two numbers the buyer is choosing between sit side
   * by side instead of the card silently switching to the new one — nothing has
   * been written yet.
   */
  next?: string;
  /**
   * The caption under a `current → next` pair. Defaults to "on confirm", which
   * is right on a decision surface and wrong everywhere else: on an order the
   * arrow is a re-promise that has already happened, and captioning history as
   * pending would be a plain misstatement.
   */
  nextLabel?: string;
}

function FactCards({ facts }: { facts: Fact[] }) {
  return (
    <div
      className="grid gap-2 opacity-90"
      style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
    >
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex flex-col gap-1 rounded-lg p-2"
          style={{
            background: "var(--surface-base)",
            border: "1px solid var(--color-iris-200)",
          }}
        >
          <span
            className="ds-label"
            style={{ color: "var(--ds-text-secondary)" }}
          >
            {f.label}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="ds-body-medium truncate"
              style={{ color: f.next ? "var(--ds-text-secondary)" : "var(--ds-text-primary)" }}
            >
              {f.value}
            </span>
            {f.next && (
              <>
                <ArrowRight
                  size={12}
                  weight="bold"
                  className="shrink-0"
                  style={{ color: "var(--ds-icon-secondary)" }}
                />
                <span
                  className="ds-body-medium truncate"
                  style={{ color: "var(--color-iris-700)" }}
                >
                  {f.next}
                </span>
              </>
            )}
          </span>
          {f.next && (
            <span className="ds-label" style={{ color: "var(--text-muted)" }}>
              {f.nextLabel ?? "on confirm"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export interface AgentSummaryProps {
  agent: string;
  /** What the agent already handled — sets up what's left for the person. */
  text: string;
  /** The figures the decision turns on, read at a glance rather than fished
   *  out of the paragraph. */
  facts?: Fact[];
  /** The options the agent prepared, and the commit. */
  children?: ReactNode;
}

export function AgentSummary({ agent, text, facts, children }: AgentSummaryProps) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ background: "var(--color-iris-50)" }}
    >
      <div className="flex flex-col gap-2 p-3">
        <span className="flex items-center gap-2">
          <AiStar size={16} variant="small" />
          <span
            className="ds-body-medium"
            style={{ color: "var(--ds-text-primary)" }}
          >
            {agent} Summary
          </span>
        </span>
        <p
          className="ds-body px-1"
          style={{ color: "var(--ds-text-primary)" }}
        >
          {text}
        </p>
        {facts && facts.length > 0 && <FactCards facts={facts} />}
      </div>
      {children}
    </div>
  );
}
