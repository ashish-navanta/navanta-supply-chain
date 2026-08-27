"use client";

import { Check } from "@phosphor-icons/react";
import type { TrackedStage } from "@/data/po-state";
import { CardHeading } from "@/components/ui/RecordCard";

/**
 * Where a tracked thing has got to, as the Customer Ops portal draws it.
 *
 * Ported from `components/ui/OrderStatusStepper.tsx` — 44px nodes, r=15 filled
 * green when complete, r=14 ringed when active or in error, hairline when
 * pending, and connectors drawn behind the circles so the run of colour stops
 * exactly at the stage reached.
 *
 * The connector logic is the part worth keeping exactly: green only where the
 * left stage is genuinely complete, blue where both ends are reached but the
 * left is still running, dashed grey into anything not started. Three states,
 * not two, because "reached but not finished" is the case a two-state line
 * quietly lies about.
 *
 * Shared between a account order and a purchase order. They run different stages
 * — Placed→Delivered against Raised→Delivered — but they are the same drawing,
 * and forking it would let the two seats disagree about what "in progress"
 * looks like while claiming to show the same shipment from either end.
 */

export type StepStatus = "completed" | "active" | "error" | "pending";

export interface StepperStep {
  label: string;
  status: StepStatus;
  date?: string;
  /** Items sitting at this stage, shown inside the ring. */
  count?: number;
}

/**
 * A tracked run, as steps.
 *
 * `dates` and `count` are optional because a purchase order's stages carry
 * neither — the PO queue knows a promise date, not a date per stage, and
 * inventing four would be the fixture talking.
 */
export function stagesToSteps(
  stages: readonly TrackedStage[],
  opts: { dates?: Record<string, string>; count?: number } = {},
): StepperStep[] {
  return stages.map((st) => ({
    label: st.label,
    status: st.state === "done" ? "completed" : st.state === "active" ? "active" : "pending",
    /* Never on a stage that has not happened. A date under a pending step reads
       as a fact — "Received at DC · 2 Sep" says it arrived — when at best it is a
       projection. Enforced here rather than trusted to callers, so no future
       stepper can quietly reintroduce it. */
    date: st.state === "pending" ? undefined : opts.dates?.[st.label],
    count: st.state === "active" ? opts.count : undefined,
  }));
}

function StepNode({ step }: { step: StepperStep }) {
  if (step.status === "completed") {
    return (
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: 44, height: 44 }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="absolute inset-0">
          <circle cx="22" cy="22" r="15" fill="#0D9467" />
        </svg>
        <Check size={12} weight="bold" className="relative text-white" />
      </div>
    );
  }

  if (step.status === "error" || step.status === "active") {
    const ring = step.status === "error" ? "#ef4444" : "#2b58a1";
    return (
      <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="14" stroke={ring} strokeWidth="2" fill="white" />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[12px] tracking-[0.12px]"
          style={{ color: "#0f172a" }}
        >
          {step.count ?? ""}
        </span>
      </div>
    );
  }

  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="14" stroke="#cbd5e1" strokeWidth="1.5" fill="white" />
      </svg>
    </div>
  );
}

export function StatusStepper({
  title = "Order Status",
  icon,
  steps,
  totalItems,
  children,
  className = "",
}: {
  /** The card's heading — "Order Status" for a account order, "PO Status" for a
   *  purchase order. */
  title?: string;
  icon?: React.ComponentType<{ size?: number; weight?: "duotone"; className?: string }>;
  steps: StepperStep[];
  totalItems: number;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      /* No bottom padding. The footer content the callers pass — an alert, the
         agent's band — is the card's last element and supplies its own edge; the
         pb-4 left a strip of white below it that read as the card having been
         cut short. */
      className={`flex flex-col items-start gap-2 overflow-hidden rounded-[12px] bg-[var(--surface-base)] ${className}`}
      style={{ boxShadow: "0px 0px 1px 0px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(10,24,48,0.08)" }}
    >
      <CardHeading
        icon={icon}
        right={
          <span
            className="whitespace-nowrap font-medium"
            style={{ fontSize: 14, lineHeight: 1.4, color: "var(--text-primary)" }}
          >
            {`${totalItems} Item${totalItems === 1 ? "" : "s"}`}
          </span>
        }
      >
        {title}
      </CardHeading>

      <div className="relative w-full px-6 pb-4" style={{ paddingTop: 8 }}>
        {/* Connectors first, behind the circles. */}
        <div
          className="absolute flex items-center"
          style={{ top: 8 + 22, left: 24 + 22, right: 24 + 22, height: 0 }}
        >
          {steps.slice(0, -1).map((step, i) => (
            <div
              key={`line-${step.label}`}
              className="flex-1"
              style={{
                height: 0,
                borderTop: (() => {
                  const left = step.status;
                  const right = steps[i + 1].status;
                  const reached = (v: StepStatus) => v !== "pending";
                  if (left === "completed" && reached(right)) return "2px solid #0D9467";
                  if (reached(left) && reached(right)) return "2px solid #2b58a1";
                  return "2px dashed #cbd5e1";
                })(),
              }}
            />
          ))}
        </div>

        <div className="relative flex w-full justify-between">
          {steps.map((step, i) => {
            /* The label is positioned, not laid out. Each column is the node's
               44px, and a centred label longer than that overhangs both sides
               equally — which ran "Delivered to account" off the card. Flex
               alignment cannot pull an overflowing child back inside its box, so
               the label block is absolute and anchored: the first hangs right
               off its node, the last hangs left, the rest stay centred on
               theirs. Any label length is safe at any step count. */
            const first = i === 0;
            const last = i === steps.length - 1;
            const anchor: React.CSSProperties = first
              ? { left: 0, textAlign: "left" }
              : last
                ? { right: 0, textAlign: "right" }
                : { left: "50%", transform: "translateX(-50%)", textAlign: "center" };
            return (
              <div
                key={step.label}
                className="relative flex flex-col items-center"
                /* Room for the node and the two lines under it, reserved here
                   because the label no longer takes part in layout. */
                style={{ width: 44, minHeight: 44 + 44 }}
              >
                <StepNode step={step} />
                <div
                  className="absolute flex flex-col whitespace-nowrap"
                  style={{ top: 44, ...anchor }}
                >
                  <span
                    className="text-[14px] font-normal leading-[22px]"
                    style={{ color: "#1E1E1E" }}
                  >
                    {step.label}
                  </span>
                  {step.date && (
                    <span
                      className="text-[13px] leading-[1.42] tracking-[0.13px]"
                      style={{ color: "#64748b" }}
                    >
                      {step.date}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
