"use client";

import { useState, type ReactNode } from "react";
import {
  Briefcase,
  NotePencil,
  ChartLineUp,
  PauseCircle,
  Target,
  Check,
  ClockCounterClockwise,
  Factory,
  Prohibit,
  Scales,
  WarningCircle,
} from "@phosphor-icons/react";
import { AiStar, Button, Pill } from "@navanta-ai/design-system";
import { Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import {
  AddContextBand,
  MercerSummaryCard,
  SummaryLink,
} from "@/components/buying/MercerSummaryCard";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { OverridePanel, SAVINGS_RATE_REASONS } from "@/components/chat/OverridePanel";
import { VendorRoster } from "@/components/buying/VendorRoster";
import { FunctionalFit, SavingsDerivation } from "@/components/buying/PlayAnalysis";
import {
  playCommit,
  playDismiss,
  recommendedRate,
  type CommitReport,
} from "@/components/chat/commit";
import {
  KIND_LABEL,
  STAGE_LABEL,
  band,
  money,
  supplierById,
  type Play,
} from "@/data/buying";

/**
 * Reviewing an opportunity, in the same shape as reviewing a purchase order:
 * the agent's summary and the figures the call turns on, an action band that
 * takes the recommendation or overrides it, and the supporting evidence in tabs
 * underneath. A buyer should not have to learn a second screen because the
 * subject changed from a date to a dollar.
 *
 * The override is the SAVINGS RATE, not the dollar figure. Addressable spend is
 * a fact out of the spend cube; what is actually in dispute is how much of it
 * this play can reach — so that is the number the buyer moves, and the dollars
 * follow from it.
 */

/** The dollars a rate commits. At the recommended rate that is the
 *  recommendation itself — the rate is a whole-point rounding of it, so
 *  re-multiplying would quietly restate a $2.4M play as $2.5M. */
function dollarsAt(play: Play, rate: number): number {
  if (rate === recommendedRate(play)) return play.recommended;
  return Math.round((play.addressable * rate) / 100);
}

/** A claim and where it came from, in the detail panels' visual language but
 *  without a label — the claim IS the label here. */
function SourcedLine({
  icon,
  claim,
  source,
}: {
  icon?: ReactNode;
  claim: string;
  source: string;
}) {
  return (
    <li className="flex gap-2">
      {icon}
      <span className="flex min-w-0 flex-col">
        <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
          {claim}
        </span>
        <span className="ds-label" style={{ color: "var(--text-muted)" }}>
          {source}
        </span>
      </span>
    </li>
  );
}

export interface PlayModalProps {
  play: Play;
  agent: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
  /** Committing closes the modal and raises the toast, exactly as the queue's
   *  decisions do — a confirmation panel inside a modal you are dismissing is a
   *  screen nobody reads. */
  onCommitted: (report: CommitReport) => void;
  onDismissed: (report: CommitReport) => void;
  /**
   * Take the play on — it moves to Act and the work begins.
   *
   * The primary action on a review, not the commit. Reviewing a play is
   * deciding whether to run it; the figure comes out of running it, and a
   * "Commit $2.4M" button on the review screen asks the buyer to stand behind a
   * number produced by nothing but a benchmark. The reference's flow is the
   * right one: accept here, commit in the Act workspace.
   */
  onAccepted?: () => void;
  /**
   * Park it — not now, but not never.
   *
   * The reference offers this beside Reject and it earns its place: most plays a
   * buyer says no to are a "no this quarter", and folding those into Reject loses
   * the difference between a play that was wrong and one that was early.
   */
  onParked?: () => void;
  /** Hand the play to the agent in the chat panel. */
  onAskAgent?: () => void;
  /**
   * Manual actions offered when the play has already been decided.
   *
   * The default footer for a decided play is a lone Close, which suits a play
   * already realized but leaves nothing to do for a play the buyer is looking
   * at from Act/Parked/Rejected. Each entry becomes a small footer button
   * (variant defaults to outline) so the caller decides what actions belong
   * on each tab — Commit on Act, Revive on Parked, Reopen on Rejected, and
   * so on — without this component knowing every stage's mutation.
   */
  decidedActions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "outline" | "christy";
    icon?: React.ReactNode;
  }>;
}

export function PlayModal({
  play,
  agent,
  nav,
  onClose,
  onCommitted,
  onDismissed,
  onAccepted,
  onParked,
  onAskAgent,
  decidedActions,
}: PlayModalProps) {
  const recRate = recommendedRate(play);
  const [rate, setRate] = useState(String(recRate));
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const num = Number.parseInt(rate, 10);
  const valid = Number.isFinite(num) && num > 0 && num <= 100;
  const committing = valid ? dollarsAt(play, num) : play.recommended;

  /* A play that has already been decided is a record to read. The band goes,
     and the facts show what was committed rather than what would be. */
  const decided = play.stage !== "surfaced" && play.stage !== "qualifying";

  type Panel = "roster" | "derivation" | "fit" | "evidence" | "activity";
  const [panel, setPanel] = useState<Panel>("roster");

  const suppliers = play.supplierIds.map(supplierById).filter(Boolean) as NonNullable<
    ReturnType<typeof supplierById>
  >[];

  /* The wording comes from the shared helpers, so a play committed from the
     row's Commit button and one committed here report identically. */
  const commit = () => onCommitted(playCommit(play, agent, valid ? num : recRate, reason));
  const dismiss = () => onDismissed(playDismiss(play, agent));

  return (
    <Modal
      title={`${play.id} — ${decided ? "review" : "decide"}`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      footer={
        decided ? (
          /* All footer CTAs range right. Ask Mercer is dropped from a decided
             record's footer because the chat panel is already alongside the
             modal for that same play — a second entry point on this bar was a
             duplicate, and pushing it left forced the primary action to
             float halfway across the row. */
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {decidedActions?.map((a) => (
              <Button
                key={a.label}
                variant={a.variant ?? "outline"}
                size="sm"
                iconLeft={a.icon}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : (
          /* Every CTA ranges right. Ask Mercer sits in the cluster too —
             flushing it left made the primary Approve float halfway across the
             row and the reader's eye had to hunt for it. On the right, the
             order reads left-to-right in strength: talk to agent · reject ·
             park · approve. */
          <div className="flex w-full items-center justify-end gap-2">
            {onAskAgent && (
              <Button
                variant="christy"
                size="sm"
                iconLeft={<AiStar size={14} variant="small" />}
                onClick={onAskAgent}
              >
                {`Ask ${agent} about this`}
              </Button>
            )}
            {/* Outline styled to the DS destructive tone — red text, red icon,
                red border at full opacity. A solid red block read as the
                primary move; a half-opacity red read as disabled. This is the
                middle: an outline in the destructive color that says "closing
                a door" without competing with Approve for the eye. */}
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Prohibit size={14} />}
              onClick={dismiss}
              className="!border-destructive !text-destructive hover:!bg-destructive/10"
            >
              Reject
            </Button>
            {onParked && (
              <Button variant="outline" size="sm" iconLeft={<PauseCircle size={14} />} onClick={onParked}>
                Park
              </Button>
            )}
            <Button
              variant="christy"
              size="sm"
              iconLeft={<Check size={14} weight="bold" />}
              disabled={!valid || overriding}
              onClick={onAccepted ?? commit}
              title={overriding ? "Finish or cancel the override first" : undefined}
            >
              {onAccepted ? "Approve" : `Commit · ${money(committing)}`}
            </Button>
          </div>
        )
      }
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          <Briefcase size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {play.id}
          </span>
          <Pill variant="neutral" size="sm">
            {KIND_LABEL[play.kind]}
          </Pill>
          <Pill variant={decided ? "neutral" : "info"} size="sm">
            {STAGE_LABEL[play.stage]}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {/* The reference's summary card, measured rather than approximated:
            #F5EFFF at a 12px radius, body `gap-2 p-3`, tiles white at 8px with a
            1px #E3D2FF hairline, label 12/18 and value 14/22. The narrative that
            used to sit here is behind the "Why?" toggle, which is where the
            original keeps it — the default state is four figures and a decision,
            not four figures and an essay. */}
        <MercerSummaryCard
          agent={agent}
          rationale={[
            play.title,
            ...play.summary.split(" · ").map((c) => c.trim()).filter(Boolean),
          ]}
          tiles={[
            { label: "Addressable spend", value: money(play.addressable) },
            /* One figure, not a range. A band read as hedged — "somewhere
               between $2.1M and $3.3M" is a way of saying we haven't decided.
               Mercer's `recommended` is the point estimate the play actually
               stands on, and if the buyer is going to commit against a single
               number the tile should be that same number. */
            { label: "Estimated savings", value: money(play.recommended) },
            {
              label: decided ? "Committed" : "To commit",
              value: money(decided ? play.recommended : committing),
              action:
                decided || onAccepted ? undefined : (
                  <SummaryLink label="Override" icon={NotePencil} onClick={() => setOverriding(true)} />
                ),
            },
            { label: "Applied rate", value: `${valid ? num : recRate}%` },
            { label: "Effort", value: `${play.effortWeeks} weeks` },
          ]}
          band={
            overriding ? (
              <OverridePanel
                agent={agent}
                subject="savings rate"
                unit="percent"
                reasons={SAVINGS_RATE_REASONS}
                value={rate}
                onValueChange={setRate}
                recommended={recRate}
                reason={reason}
                onReasonChange={setReason}
                valid={valid}
                onCancel={() => {
                  setOverriding(false);
                  setReason(null);
                  setRate(String(recRate));
                }}
                onConfirm={commit}
              />
            ) : decided ? undefined : (
              <AddContextBand onAddContext={() => setOverriding(true)}>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {`Confidence ${play.confidencePct}% · ${play.action}`}
                </span>
              </AddContextBand>
            )
          }
        />

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          /* The reference deck's four tabs, in its order: what to do with each
             supplier, how the figure was got to, whether it can be run, and what
             has happened so far. "Evidence" was one static list standing in for
             the first three. */
          tabs={[
            { id: "roster", label: "Vendor roster", icon: Factory, badge: suppliers.length },
            { id: "derivation", label: "Savings derivation", icon: ChartLineUp },
            { id: "fit", label: "Functional fit", icon: Target },
            { id: "evidence", label: "Evidence", icon: Scales, badge: play.evidence.length },
            {
              id: "activity",
              label: "Activity history",
              icon: ClockCounterClockwise,
              badge: play.events.length,
            },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "roster" ? (
          <VendorRoster play={play} agent={agent} />
        ) : panel === "derivation" ? (
          <SavingsDerivation play={play} />
        ) : panel === "fit" ? (
          <FunctionalFit play={play} />
        ) : panel === "evidence" ? (
          <DetailCard>
            <DetailSection title="What the sweep read" columns={1}>
              <ul className="flex flex-col gap-3">
                {play.evidence.map((e) => (
                  <SourcedLine key={e.claim} claim={e.claim} source={e.source} />
                ))}
              </ul>
            </DetailSection>

            {play.risks.length > 0 && (
              <DetailSection title="What could sink it" columns={1}>
                <ul className="flex flex-col gap-3">
                  {play.risks.map((r) => (
                    <SourcedLine
                      key={r}
                      icon={
                        <WarningCircle
                          size={15}
                          weight="duotone"
                          className="mt-0.5 shrink-0"
                          style={{ color: "var(--text-warning)" }}
                        />
                      }
                      claim={r}
                      source={`Raised by ${agent} · not yet resolved`}
                    />
                  ))}
                </ul>
              </DetailSection>
            )}

            {play.dismissReason && (
              <DetailSection title="Why it was dismissed" columns={1}>
                <DetailItem
                  label="Reason"
                  value={play.dismissReason}
                  source="Logged for sweep calibration"
                />
              </DetailSection>
            )}
          </DetailCard>
        /* The scope panel is gone: its facts are the summary tiles above and
           its supplier list is the roster, where each name now carries a
           decision instead of a read-only row. */
        ) : (
          <ol
            className="flex flex-col gap-3 rounded-xl px-5 py-4"
            style={{ border: "1px solid var(--ds-border-default)" }}
          >
            {play.events.map((e) => (
              <li key={`${e.at}-${e.note}`} className="flex gap-4">
                <span
                  className="ds-label shrink-0"
                  style={{ width: 96, color: "var(--ds-text-secondary)" }}
                >
                  {e.at}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                    {e.note}
                  </span>
                  <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                    {e.actor}
                  </span>
                </span>
              </li>
            ))}
            {!decided && valid && num !== recRate && (
              <li className="flex gap-4">
                <span
                  className="ds-label shrink-0"
                  style={{ width: 96, color: "var(--ds-text-secondary)" }}
                >
                  Pending
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="ds-body" style={{ color: "var(--color-iris-700)" }}>
                    {`Rate staged at ${num}% — ${money(committing)}, not yet committed`}
                  </span>
                  <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                    {reason ?? "Reason not given yet"}
                  </span>
                </span>
              </li>
            )}
          </ol>
        )}
      </div>
    </Modal>
  );
}
