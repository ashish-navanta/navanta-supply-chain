"use client";

import { Button, Select } from "@navanta-ai/design-system";
import { Minus, Plus } from "@phosphor-icons/react";

/**
 * The manual-override panel — Figma W&B node 1865:14862, adapted from units to
 * days. It sits on the same action band as the recommendation it replaces:
 * a title and rationale, a stepper for the number, a REQUIRED reason, and the
 * pair of buttons. The reason is the point of the whole panel — an override
 * without one teaches the agent nothing.
 */

/** Why a buyer would depart from the agent's lead-time figure. Kept short and
 *  mutually exclusive so the calibration signal is usable. */
export const LEAD_TIME_REASONS = [
  "Supplier gave a firmer date than quoted",
  "Negotiated a shorter lead time",
  "Adding buffer for a known risk",
  "Past performance differs from the quote",
  "Customer commitment cannot move",
  "Other",
] as const;

/** Why a rep would depart from the agent's adjudicated credit. */
export const CREDIT_REASONS = [
  "Damage is worse than the photographs show",
  "Partial credit agreed with the account",
  "Replacement agreed instead of a credit",
  "Goodwill uplift for a repeat issue",
  "Policy caps the credit below the assessment",
  "Other",
] as const;

/** Why a buyer would commit a different savings rate than the sweep modelled.
 *  The rate is the override rather than the dollar figure: the addressable
 *  spend is a fact from the spend cube, so the only thing in dispute is how
 *  much of it this play can actually reach. */
export const SAVINGS_RATE_REASONS = [
  "Benchmark is optimistic for this category",
  "Supplier has already given part of this back",
  "Scope is narrower than the sweep assumed",
  "Quote on file supports a higher rate",
  "Holding a conservative number for the commit",
  "Other",
] as const;

/** Why a planner would depart from the agent's safety-stock figure. */
export const SAFETY_STOCK_REASONS = [
  "Demand signal is softer than the forecast",
  "Holding space at the node is constrained",
  "Alternate node can cover the gap",
  "Carrying cost outweighs the service risk",
  "Promotion or project pulls this forward",
  "Other",
] as const;

export interface OverridePanelProps {
  agent: string;
  /** What is being overridden — "lead time", "safety stock". */
  subject: string;
  /** The unit the figure is counted in — "days", "units". */
  unit: string;
  /** Current value of the override, as typed. */
  value: string;
  onValueChange: (next: string) => void;
  /** The figure being overridden, for the label and the step bounds. */
  recommended: number;
  /** Step size. A plant that ships in fours makes any other figure unshippable,
   *  so the stepper moves in that multiple — the Figma's "in pack of 4". */
  step?: number;
  reasons: readonly string[];
  reason: string | null;
  onReasonChange: (next: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** False when the number doesn't parse. */
  valid: boolean;
}

export function OverridePanel({
  agent,
  subject,
  unit,
  value,
  onValueChange,
  recommended,
  step = 1,
  reasons,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  valid,
}: OverridePanelProps) {
  const num = Number.parseInt(value, 10);
  const nudge = (by: number) => {
    const base = Number.isFinite(num) ? num : recommended;
    onValueChange(String(Math.min(999, Math.max(step, base + by * step))));
  };

  return (
    <div
      className="flex flex-col gap-4 p-3"
      style={{ background: "var(--gradient-agent-band)" }}
    >
      <div className="flex flex-col">
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
          {`Override ${subject}`}
        </span>
        <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
          {`Choose the ${subject} to commit instead of ${agent}'s recommendation. Your override will be logged for model calibration.`}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-wrap items-start gap-4">
          {/* Stepper — [−] [value] [+], each a DS button at 32px */}
          <div className="flex flex-col justify-center gap-1">
            <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
              {step > 1
                ? `Update ${subject} (in packs of ${step}, recommended ${recommended})`
                : `Update ${subject} (recommended ${recommended})`}
            </span>
            <div className="flex h-8 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 px-0"
                aria-label={`Decrease ${subject}`}
                onClick={() => nudge(-1)}
              >
                <Minus size={14} />
              </Button>
              <input
                type="number"
                min={step}
                max={999}
                step={step}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                aria-label={`${subject} in ${unit}`}
                className="ds-body-medium h-8 w-[66px] rounded-lg text-center outline-none focus:ring-1 focus:ring-[var(--ds-border-interactive)]"
                style={{
                  background: "var(--surface-base)",
                  border: `1px solid ${valid ? "var(--ds-border-default)" : "var(--ds-border-danger, #ffa2a2)"}`,
                  color: "var(--ds-text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 px-0"
                aria-label={`Increase ${subject}`}
                onClick={() => nudge(1)}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>

          {/* The required reason — what makes the override a calibration signal */}
          <div className="flex w-[350px] flex-col gap-1">
            <span className="ds-label flex gap-0.5" style={{ color: "var(--ds-text-secondary)" }}>
              Reason note
              <span style={{ color: "var(--ds-text-danger, #ca0005)" }}>*</span>
            </span>
            <Select value={reason ?? undefined} onValueChange={onReasonChange}>
              <Select.Trigger size="md" aria-label="Reason for the override">
                <Select.Value placeholder="Select a reason" />
              </Select.Trigger>
              <Select.Content>
                {reasons.map((r) => (
                  <Select.Item key={r} value={r}>
                    {r}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="christy"
            size="sm"
            disabled={!valid || !reason}
            onClick={onConfirm}
          >
            Confirm override
          </Button>
        </div>
      </div>
    </div>
  );
}
