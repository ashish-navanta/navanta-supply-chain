"use client";

import type { ReactNode } from "react";
import { Button, Pill, Radio } from "@navanta-ai/design-system";

/**
 * The "pick one, then commit" section that sits on the action band of the
 * agent summary. Both seats' modals are the same shape underneath — a row of
 * costed options, the consequence of the one you picked, and a footer that
 * commits it — so it lives here rather than being written twice.
 *
 * The section owns no state: the caller holds the pick and the committed flag,
 * because what "committed" means differs per surface (a decision writes back,
 * a contact sends).
 */

export interface Choice {
  id: string;
  /** Card title — lead with the move, put the date in the label. */
  label: string;
  /** Second line: what it does, and what it costs. */
  helper: string;
  /** Shown under the cards once picked — what this costs somebody else. */
  consequence?: string;
  /** Short pill beside the label — the agent's recommendation, so the person
   *  has an anchor to accept or argue with rather than a flat menu. */
  badge?: string;
}

export interface ChoiceSectionProps {
  /** Radio group name. Must be unique per open section — pass the row id. */
  name: string;
  ariaLabel: string;
  /** Omit for a section with no options — a recommendation the person edits
   *  rather than picks from. The commit band works either way. */
  choices?: Choice[];
  value?: string | null;
  onChange?: (id: string) => void;
  /** Cards per row, capped at three: past that the helper line truncates and
   *  the options stop being comparable, which is the whole point of the row. */
  columns?: number;

  /** Rendered between the cards and the footer — a draft, talking points… */
  children?: ReactNode;

  /** Left-hand footer line: how the agent prepared these options. Ignored when
   *  `recommendation` is set. */
  note?: string;
  /** The agent's standing recommendation, shown in the band as a labelled
   *  headline instead of `note` — "Recommended action · Confidence 82%" over
   *  the action itself. */
  recommendation?: { line: string; confidence?: number };
  cancelLabel?: string;
  onCancel: () => void;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onConfirm: () => void;
  /** Replaces the default Cancel/Confirm pair when the surface needs its own
   *  set — override, watchlist, approve. The caller then owns disabled state. */
  actions?: ReactNode;
  /** Block confirm until something is picked. Off for a section that
   *  pre-selects a sensible default (the contact modal opens on Email). */
  requireChoice?: boolean;

}

export function ChoiceSection({
  name,
  ariaLabel,
  choices = [],
  value = null,
  onChange,
  columns = 3,
  children,
  note,
  recommendation,
  cancelLabel = "Cancel",
  onCancel,
  confirmLabel,
  confirmIcon,
  onConfirm,
  actions,
  requireChoice = true,
}: ChoiceSectionProps) {
  const picked = choices.find((c) => c.id === value) ?? null;

  return (
    <>
      {/* The options side by side, so the dates and costs compare at a glance
          — DS Radio cards, the layout from the Figma spec. */}
      {choices.length > 0 && (
      <div
        className="grid gap-2 px-3 pb-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(columns, 3, choices.length)}, minmax(0, 1fr))`,
        }}
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {choices.map((c) => (
          <Radio
            key={c.id}
            card
            name={name}
            value={c.id}
            checked={c.id === value}
            onChange={() => onChange?.(c.id)}
            label={c.label}
            helperText={c.helper}
            badge={
              c.badge ? (
                <Pill variant="info" size="sm">
                  {c.badge}
                </Pill>
              ) : undefined
            }
            /* Hook only — globals.css reaches the wrapping label through it. */
            className="choice-card"
          />
        ))}
      </div>
      )}

      {children && <div className="px-3 pb-3">{children}</div>}

      {/* The commit band. Everything above is "here are your options"; this is
          "here is what confirming does" — a deeper shade of the panel's own
          brand tint draws that line without a rule or another card.

          The negative margins full-bleed it to the panel edge: this section is
          always rendered inside AgentSummary's `px-5 pb-4`, whose
          `overflow-hidden rounded-[12px]` clips the corners for us. */}
      <div
        className="flex flex-col gap-2 p-3"
        style={{ background: "var(--gradient-agent-band)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {recommendation ? (
            <span className="flex min-w-0 flex-col">
              <span
                className="ds-label"
                style={{ color: "var(--color-iris-700)" }}
              >
                {recommendation.confidence === undefined
                  ? "Recommended action"
                  : `Recommended action · Confidence ${recommendation.confidence}%`}
              </span>
              <span
                className="ds-body-medium"
                style={{ color: "var(--ds-text-primary)" }}
              >
                {recommendation.line}
              </span>
            </span>
          ) : (
            <span
              className="ds-label"
              style={{ color: "var(--ds-text-secondary)" }}
            >
              {note}
            </span>
          )}
          <span className="flex items-center" style={{ gap: 8 }}>
            {actions ?? (
              <>
                <Button variant="outline" size="sm" onClick={onCancel}>
                  {cancelLabel}
                </Button>
                {/* Christy is the DS's agent-action CTA and the variant the
                    Figma names as Button/christy-primary. */}
                <Button
                  variant="christy"
                  size="sm"
                  iconLeft={confirmIcon}
                  disabled={requireChoice && choices.length > 0 && !picked}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </>
            )}
          </span>
        </div>
      </div>
    </>
  );
}
