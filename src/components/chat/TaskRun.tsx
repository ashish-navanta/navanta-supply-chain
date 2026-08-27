"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CaretRight,
  CheckCircle,
  CheckSquare,
  Warning,
  Circle,
  Lightbulb,
  WarningCircle,
} from "@phosphor-icons/react";
import { AiStar, Button, Tabs } from "@navanta-ai/design-system";
import type { AgentStep, AgentTask, FlowArtifact } from "@/data/agent-actions";
import { CallCard } from "@/components/chat/CallCard";
import { stepDoing } from "@/lib/step-tense";
import { MathPanel } from "@/components/planning/deck/DeckPanels";
import { TrajectoryChart } from "@/components/planning/deck/TrajectoryChart";
import { waterfallFor } from "@/data/demand-deck";
import { POSITIONS, asException } from "@/data/planning";
import { gatesFor, type Gate } from "@/data/planning-approval";
import { MessageCard } from "@/components/chat/MessageCard";

/**
 * The cards a run of an agent task puts in the transcript.
 *
 * A step arrives already done — the row's button is the consent, so there is
 * nothing to confirm mid-run. What each step is for is showing the work: the
 * old one-press Approve wrote a figure and raised a toast, which reported the
 * outcome and none of the reasoning, so a person could not tell a considered
 * decision from a rubber stamp.
 */

/**
 * The whole run, in one container.
 *
 * Four separate cards at the transcript's own spacing read as four events; they
 * are one piece of work with four parts, so they share a frame and are ruled
 * rather than gapped. Rows appear as each step lands, so the container grows
 * while the agent works.
 *
 * Quiet on purpose. These are the agent showing its working, not a checklist to
 * acknowledge — a tick per line made them look like four things needing
 * approval and competed with the outcome card, which is the part worth reading.
 *
 * `<details>` rather than a button and state: it brings its own keyboard
 * handling, focus behaviour and open semantics, the same reason the email
 * thread's accordions are built this way.
 */
export function StepList({
  steps,
  shown,
  landed,
}: {
  steps: AgentStep[];
  /** How many have landed so far. */
  shown: number;
  /** Index of the one that has just arrived, for the brief highlight. */
  landed: number;
}) {
  if (shown <= 0) return null;
  const rendered = steps.slice(0, shown);
  /* More still to come, which is what the dashed tail under the last node says.
     The steps themselves stay unrendered until they land — a pending node would
     have to carry its label, and a label like "Confirmed it with the account"
     announces the confirmation before the call that got it. */
  const more = shown < steps.length;

  return (
    <div className="flex shrink-0 flex-col">
      {rendered.map((step, i) => {
        const last = i === rendered.length - 1;
        /* The one that just arrived. Anything above it has been superseded and
           reads as done; this one is where the run currently is. */
        const working = landed === i;
        /* A recording is not a disclosure. Everything else here is a one-line
           claim you can open if you doubt it, but the call IS the evidence —
           folding it away would hide the only part of a chase worth reading and
           leave "Called Joe" standing on its own again.
           A live call or a sent message is the event itself, so it stands
           uncollapsed. A call that already happened is REFERENCE — collapsed to
           its one-line result, with the recording behind the caret for whoever
           wants to check what was said before they sign off on it. */
        const asCard = (step.call && !step.call.past) || step.message;

        return (
          <div key={step.label} className="flex items-stretch" style={{ gap: 10 }}>
            {/* The rail. Same vocabulary as the DS PanelTimeline — a node per
                step, a hairline between them, dashed where the sequence has not
                got there yet — so the agent's steps and a delivery's milestones
                read as the same kind of object in this app. */}
            <div className="flex shrink-0 flex-col items-center" style={{ width: 18 }}>
              <span
                className="flex shrink-0 items-center justify-center"
                /* Nudged to sit on the first line's centre rather than its top. */
                style={{ width: 18, height: 18, marginTop: 2 }}
              >
                {working ? (
                  /* Where the run is now, in the agent's own colour: a node, not
                     a tick. Ticking a step the same instant it appears would make
                     the timeline read as finished four times over. */
                  <span
                    className="block rounded-full"
                    style={{
                      width: 12,
                      height: 12,
                      background: "var(--surface-base)",
                      boxShadow: "0 0 0 3px var(--color-iris-700) inset",
                    }}
                  />
                ) : (
                  <CheckCircle size={18} weight="fill" style={{ color: "var(--success)" }} />
                )}
              </span>
              {(!last || more) && (
                <span
                  className="flex-1"
                  style={{
                    width: 1.5,
                    marginTop: 2,
                    marginBottom: 2,
                    background: last ? undefined : "var(--ds-border-default)",
                    backgroundImage: last
                      ? "repeating-linear-gradient(180deg, var(--ds-border-default) 0, var(--ds-border-default) 4px, transparent 4px, transparent 8px)"
                      : undefined,
                  }}
                />
              )}
            </div>

            <div
              className="min-w-0 flex-1"
              /* Enough that the connector between two nodes reads as a line
                 rather than as a gap with a mark in it — at 12 the rail came out
                 8px long between a pair of 18px nodes, which is a dot, not a
                 timeline. */
              style={{ paddingBottom: last ? (more ? 16 : 0) : 16 }}
            >
              {asCard ? (
                /* Its own border now that the list has none. A recording is an
                   artifact and should look like one sitting on the rail, rather
                   than like the paragraph above it. */
                <div
                  className="overflow-hidden rounded-[12px]"
                  style={{ border: "1px solid var(--ds-border-default)" }}
                >
                  {step.call ? <CallCard call={step.call} /> : <MessageCard draft={step.message!} />}
                </div>
              ) : (
                <details className="step-entry">
                  <summary className="flex cursor-pointer list-none items-center gap-2">
                    <span
                      className="ds-body min-w-0 flex-1"
                      style={{
                        color: working ? "var(--color-iris-700)" : "var(--ds-text-secondary)",
                        transition: "color 500ms ease-out",
                      }}
                    >
                      {/* Present tense while it is happening, past once it has.
                          A step cannot be "Confirmed it with Summit Department Stores" in
                          the same instant it appears — that is the run reporting
                          the result a beat before it has it. */}
                      {working ? stepDoing(step.label) : step.label}
                    </span>
                    <CaretRight
                      size={12}
                      weight="bold"
                      className="step-caret shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </summary>
                  <div className="flex flex-col gap-0.5 pt-1">
                    <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                      {step.text}
                    </span>
                    {step.source && (
                      <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                        {step.source}
                      </span>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * What the run came to.
 *
 * `open` and `settled` are visually different on purpose. Half of these tasks
 * ask somebody a question and change nothing — reporting that with the same
 * green tick as a committed write would be the prototype flattering itself.
 */
const EVIDENCE_LABEL: Partial<Record<FlowArtifact["kind"], string>> = {
  gates: "Gates",
  math: "Calculation",
  trajectory: "Trajectory",
};

/**
 * The evidence behind a result, in one card with a tab each.
 *
 * They were two cards, which put the calculation and the graph side by side as
 * peers of the verdict — three bordered blocks for what is really one answer and
 * its receipt. Tabbed, the evidence is one object the reader chooses a view of,
 * and the transcript reads as two cards: what backs the decision, and what the
 * decision was.
 */
function EvidenceTabs({ artifacts }: { artifacts: FlowArtifact[] }) {
  const [at, setAt] = useState(0);
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[12px]"
      style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-subtle)" }}
    >
      <div style={{ padding: "0 12px" }}>
        <Tabs
          variant="underline"
          size="sm"
          tabs={artifacts.map((a, i) => ({
            id: String(i),
            label: EVIDENCE_LABEL[a.kind] ?? a.kind,
          }))}
          activeTab={String(at)}
          onChange={(id) => setAt(Number(id))}
        />
      </div>
      {/* No gutter of its own. Every panel inside already carries a 12px one, so
          the wrapper's was doubling it — and on the calculation the total row is a
          filled block that should reach the card's edges rather than floating 12px
          inside them. */}
      <div style={{ padding: "4px 0 0" }}>
        <ArtifactCard artifact={artifacts[at]} bare />
      </div>
    </div>
  );
}

/**
 * What a run got confirmed, one row per ask.
 *
 * The alternative was the paragraph this replaced — "X has someone on the dock
 * from 07:00 for the 6 Sep delivery, and Marco is the one checking the units
 * before they are signed for" — which is accurate and makes the reader parse a
 * sentence to answer "did both asks land?". Two ticked rows answer it at a
 * glance, and the panel is 300px wide, so the label and its detail stack rather
 * than sharing a line neither of them fits on.
 *
 * A filled green check box per row: each of these is a thing settled, and the
 * box carries that further than a bare tick — the row reads as ticked off rather
 * than as decorated.
 *
 * Except where the row is a refusal. A real call came back a no and this list
 * rendered "Window declined" behind the same green tick as a thing achieved,
 * which reads as the run having got what it rang for. A refused row keeps its
 * place — it IS what the call established — but takes the amber mark that says
 * outstanding rather than the green one that says done.
 */
function ConfirmedList({
  items,
}: {
  items: NonNullable<AgentTask["outcome"]["confirmed"]>;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--surface-sunken)",
      }}
    >
      {items.map((it) => {
        const refused = it.tone === "warn";
        return (
        <span key={it.label} className="flex items-start" style={{ gap: 7 }}>
          {/* Nudged onto the first line's baseline rather than centred on a block
              that may wrap to three lines. */}
          {refused ? (
            <WarningCircle
              size={14}
              weight="fill"
              className="mt-[3px] shrink-0"
              style={{ color: "var(--text-warning)" }}
            />
          ) : (
            <CheckSquare
              size={14}
              weight="fill"
              className="mt-[3px] shrink-0"
              style={{ color: "var(--success)" }}
            />
          )}
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
              {it.label}
            </span>
            <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
              {it.detail}
            </span>
          </span>
        </span>
        );
      })}
    </div>
  );
}

export function OutcomeCard({ task }: { task: AgentTask }) {
  const settled = task.outcome.kind === "settled";
  /* Undo is a one-shot — once pressed, the write is reversed and the button
     should not be pressable again on the same card. Kept local so the two
     cards a person may see (this outcome, plus a follow-on run) each have
     their own state. */
  const [undone, setUndone] = useState(false);

  /* Where a run's result IS an argument in parts, the parts are siblings.
     Nesting them inside the outcome card made a card containing three cards,
     each with its own border — three frames deep for one answer. The transcript
     is already a gap-3 column, so a fragment of cards spaces itself. */
  const stacked = (task.outcome.artifacts?.length ?? 0) > 0;

  /* Green wherever the run wrote something the reader decided.
     It used to key off `stacked` — having artifacts — which made the tick a side
     effect of whether a run happened to carry a chart. An override carries none
     on purpose and came out amber, reading as a warning on the one card telling
     the planner their decision landed.
     `settleBucket` is the honest signal: it is set by exactly the runs that move
     a row, and unset on a read. What stays open is the ORDER, not the decision,
     and the copy says so. */
  const wrote = stacked || settled || task.settleBucket !== undefined;
  const done = wrote;
  const verdict = (
    <div
      className="flex flex-col gap-2 rounded-[12px] p-3"
      style={{
        background: "var(--surface-base)",
        border: `1px solid ${
          wrote && !settled
            ? "var(--success)"
            : settled
              ? "var(--color-iris-200)"
              : "var(--ds-border-default)"
        }`,
      }}
    >
      <span className="flex items-center gap-2">
        {wrote && !settled ? (
          <CheckCircle
            size={15}
            weight="fill"
            className="shrink-0"
            style={{ color: "var(--success)" }}
          />
        ) : done ? (
          <AiStar size={15} variant="small" className="shrink-0" />
        ) : (
          <Circle size={14} weight="duotone" className="shrink-0" style={{ color: "var(--text-warning)" }} />
        )}
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
          {task.outcome.title}
        </span>
      </span>
      {/* The particulars first, then why they matter. A list of what came back
          reads as the answer to what was asked; the prose underneath is the
          consequence, and a consequence stated before its facts asks the reader
          to hold it until they arrive. */}
      {task.outcome.confirmed && <ConfirmedList items={task.outcome.confirmed} />}
      {task.outcome.lines.map((l) => (
        <p key={l} className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
          {l}
        </p>
      ))}
      {task.outcome.rag && <RagBanner level={task.outcome.rag.level} text={task.outcome.rag.text} />}
      {task.outcome.tiles && <TileRow tiles={task.outcome.tiles} />}
      {task.outcome.ramp && <RampMiniChart ramp={task.outcome.ramp} />}
      {task.outcome.artifact && <ArtifactCard artifact={task.outcome.artifact} />}
      {task.outcome.changes && <ChangeTable rows={task.outcome.changes} />}
      {(task.outcome.continueLink || task.outcome.action || task.outcome.undo) && (
        /* Hand-off row: an action or a continue link, plus an optional undo.
           Once Undo lands both the action and the link vanish — the record is
           retracted and there is nothing to walk into. */
        <div className="mt-1 flex flex-wrap items-center" style={{ gap: 8 }}>
          {task.outcome.action && !undone && (
            /* DS primary button (christy) — same weight as Approve on the play
               modal, so a Make live in the chat reads as the same class of
               decision as one taken from the record. */
            <Button
              size="sm"
              variant="christy"
              iconLeft={<AiStar size={13} variant="small" />}
              onClick={() => task.outcome.action?.onAction()}
            >
              {task.outcome.action.label}
            </Button>
          )}
          {task.outcome.continueLink && !undone && (
            <Link
              href={task.outcome.continueLink.href}
              target={task.outcome.continueLink.newTab ? "_blank" : undefined}
              rel={task.outcome.continueLink.newTab ? "noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-iris-700)",
                background: "var(--color-iris-50, #f5f3ff)",
                border: "1px solid var(--color-iris-200, #e6e1fa)",
              }}
              onClick={() => {
                /* Belt-and-suspenders for a same-route continue: a Link that
                   only changes ?supplier= does not always re-fire the target
                   screen's effect, so also announce the id on a window event
                   the screen listens for. The navigation still handles the
                   cross-page case. */
                const href = task.outcome.continueLink!.href;
                const m = /[?&]supplier=([^&]+)/.exec(href);
                if (m) {
                  window.dispatchEvent(
                    new CustomEvent("shaw:open-supplier", { detail: decodeURIComponent(m[1]) }),
                  );
                }
              }}
            >
              {task.outcome.continueLink.label}
              <ArrowRight size={13} weight="bold" />
            </Link>
          )}
          {task.outcome.undo && !undone && (
            <button
              type="button"
              onClick={() => {
                task.outcome.undo?.onUndo();
                setUndone(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ds-text-secondary)",
                background: "transparent",
                border: "1px solid var(--ds-border-default)",
                cursor: "pointer",
              }}
            >
              <ArrowCounterClockwise size={13} weight="bold" />
              {task.outcome.undo.label}
            </button>
          )}
          {undone && (
            <span
              style={{
                fontSize: 13,
                color: "var(--ds-text-tertiary)",
                fontStyle: "italic",
              }}
            >
              Undone
            </span>
          )}
        </div>
      )}
      {task.outcome.suggestion && (
        /* Below the receipt, and visibly not part of it. This is the agent
           saying what it noticed and chose not to do — if it looked like
           another row of the table it would read as a third thing that
           happened. */
        <div
          className="flex flex-col gap-1 rounded-[8px] p-2.5"
          style={{ background: "var(--surface-sunken)" }}
        >
          <span className="flex items-start gap-1.5">
            <Lightbulb
              size={13}
              weight="duotone"
              className="mt-0.5 shrink-0"
              style={{ color: "var(--ds-text-secondary)" }}
            />
            <span className="ds-label" style={{ fontWeight: 500, color: "var(--ds-text-primary)" }}>
              {task.outcome.suggestion.title}
            </span>
          </span>
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {task.outcome.suggestion.body}
          </span>
        </div>
      )}
    </div>
  );

  if (!stacked) return verdict;

  /* Calculation, then the graph, then the verdict. The parts build to the
     conclusion rather than hanging beneath it — and each is a card the reader
     can check on its own. */
  return (
    <>
      {stacked && <EvidenceTabs artifacts={task.outcome.artifacts!} />}
      {verdict}
    </>
  );
}

/**
 * What moved, as a table rather than a sentence.
 *
 * A commit writes more than one field — safety stock AND the reorder point that
 * has to follow it — and the person is accountable for all of them. Prose can
 * carry one figure gracefully and starts hiding the others; two columns says
 * every before and every after at a glance, which is what someone signing off
 * on a write actually needs to check.
 *
 * A real table, not a grid of divs: these are rows of data with a header, and
 * the semantics are free.
 */
function ChangeTable({ rows }: { rows: NonNullable<AgentTask["outcome"]["changes"]> }) {
  /* A list of rows, not a Was/Now grid.
     The grid was three columns wide and two of them were usually empty: on an
     approval nothing was replaced, so every "Was" read "—", and a column earning
     its width to say nothing happened before is a column of nothing. On an
     override exactly one row has a prior value and the other two still printed
     the dash.
     So the transition lives in the row that has one — "186 units → 240
     units", struck through on the old figure, which reads as a change rather
     than as two cells a reader has to line up — and rows with no prior print
     their value plainly. Nothing is spent drawing an absence. */
  return (
    <div className="flex flex-col">
      {rows.map((r) => {
        const replaced = !!r.was && r.was !== "—";
        return (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3"
            style={{
              padding: "6px 0",
              borderTop: "1px solid var(--ds-border-subtle)",
              fontSize: 12,
              lineHeight: "18px",
            }}
          >
            <span className="shrink-0" style={{ color: "var(--ds-text-secondary)" }}>
              {r.label}
            </span>
            <span
              className="flex min-w-0 flex-wrap items-baseline justify-end gap-1.5 text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {replaced && (
                <>
                  {/* Muted, not struck. The arrow already says the old figure has
                      been replaced, and a strike on top of it says it twice —
                      then a struck "186 units" beside a live one reads as an
                      error being corrected rather than a decision being made. */}
                  <span style={{ color: "var(--text-muted)" }}>{r.was}</span>
                  <ArrowRight
                    size={11}
                    weight="bold"
                    className="shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  />
                </>
              )}
              <span
                className="font-medium"
                style={{ color: "var(--ds-text-primary)", overflowWrap: "anywhere" }}
              >
                {r.now}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const RAG_TONE: Record<
  NonNullable<AgentTask["outcome"]["rag"]>["level"],
  { fg: string; bg: string; label: string }
> = {
  "on-track": { fg: "var(--text-success-vivid)", bg: "var(--surface-sunken)", label: "On track" },
  behind: { fg: "var(--text-warning)", bg: "var(--surface-sunken)", label: "Behind" },
  "at-risk": { fg: "var(--text-danger)", bg: "var(--surface-sunken)", label: "At risk" },
};

/** The RAG read on a live commit — a tinted one-liner, same weight as the
 *  Realization risk callout in the reference. */
function RagBanner({
  level,
  text,
}: {
  level: NonNullable<AgentTask["outcome"]["rag"]>["level"];
  text: string;
}) {
  const t = RAG_TONE[level];
  return (
    <div
      className="flex items-start gap-2 rounded-[8px] p-2.5"
      style={{ background: t.bg, borderLeft: `3px solid ${t.fg}` }}
    >
      <span
        className="ds-label shrink-0"
        style={{ fontWeight: 600, color: t.fg, minWidth: 52 }}
      >
        {t.label}
      </span>
      <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
        {text}
      </span>
    </div>
  );
}

/** The figure tiles above the ramp — committed, realized, against-ramp. */
function TileRow({ tiles }: { tiles: NonNullable<AgentTask["outcome"]["tiles"]> }) {
  const toneColor = (tone?: "good" | "behind" | "quiet") =>
    tone === "good"
      ? "var(--text-success-vivid)"
      : tone === "behind"
      ? "var(--text-warning)"
      : "var(--ds-text-primary)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, 1fr)`,
        gap: 6,
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col rounded-[8px] p-2"
          style={{ background: "var(--surface-sunken)", gap: 2 }}
        >
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {t.label}
          </span>
          {t.href ? (
            <Link
              href={t.href}
              target={t.newTab ? "_blank" : undefined}
              rel={t.newTab ? "noreferrer" : undefined}
              className="hover:underline"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-iris-700)",
                fontVariantNumeric: "tabular-nums",
                textUnderlineOffset: 2,
              }}
            >
              {t.value}
            </Link>
          ) : (
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: toneColor(t.tone),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * The commit's savings ramp, drawn inside the transcript.
 *
 * Two bars a quarter — projected in iris, realized in green — so the chat that
 * opens on Review carries the same picture the value screen shows, scoped to
 * this one commit. Realized bars are absent until the ERP posts them, matching
 * the page-level ramp's "fills once the ERP is connected".
 */
function RampMiniChart({ ramp }: { ramp: NonNullable<AgentTask["outcome"]["ramp"]> }) {
  const max = Math.max(1, ...ramp.map((r) => Math.max(r.projected, r.realized ?? 0)));
  /* Reserve a strip at the top for the value labels — the labels sit above the
     bars in the reference, and without their own space the tallest bar hits
     the ceiling and its label overlaps the legend. */
  const AREA = 110;
  const money = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  /* "Q3 26" → "Q3 '26" to match the reference axis. */
  const label = (period: string) => {
    const m = /^Q(\d)\s+(\d{2})$/.exec(period.trim());
    return m ? `Q${m[1]} '${m[2]}` : period;
  };
  return (
    <div
      className="flex flex-col rounded-[8px] p-3"
      style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-subtle)", gap: 10 }}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#3B82F6" }} />
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>Projected</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#16A34A" }} />
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>Realized</span>
        </span>
      </div>
      <div
        className="flex items-end justify-between"
        style={{ gap: 12, height: AREA + 24, borderBottom: "1px solid var(--ds-border-subtle)" }}
      >
        {ramp.map((r) => (
          <div key={r.period} className="flex flex-1 items-end justify-center" style={{ gap: 3 }}>
            <MiniBar value={r.projected} max={max} area={AREA} color="#3B82F6" period={r.period} kind="Projected" money={money} />
            <MiniBar value={r.realized} max={max} area={AREA} color="#16A34A" period={r.period} kind="Realized" money={money} />
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: 12 }}>
        {ramp.map((r) => (
          <span
            key={r.period}
            className="ds-label flex-1 text-center"
            style={{ color: "var(--ds-text-secondary)" }}
          >
            {label(r.period)}
          </span>
        ))}
      </div>
      <span className="ds-label" style={{ color: "var(--text-muted)" }}>
        Realized fills once the ERP is connected.
      </span>
    </div>
  );
}

/** One bar in the mini ramp — value printed above, hairline stub for
 *  unreported realized. Matches the page-level `RampBar` at smaller scale. */
function MiniBar({
  value,
  max,
  area,
  color,
  period,
  kind,
  money,
}: {
  value: number | undefined;
  max: number;
  area: number;
  color: string;
  period: string;
  kind: "Projected" | "Realized";
  money: (n: number) => string;
}) {
  const reported = value !== undefined && value > 0;
  const h = reported ? Math.max(3, (value! / max) * area) : 2;
  return (
    <span
      title={reported ? `${kind} ${period} · ${money(value!)}` : `${kind} ${period} · not reported`}
      className="flex flex-1 flex-col items-center justify-end"
      style={{ gap: 3 }}
    >
      {reported && (
        <span
          style={{
            fontSize: 10.5,
            lineHeight: "12px",
            color: "var(--ds-text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {money(value!)}
        </span>
      )}
      <span
        style={{
          width: "100%",
          height: h,
          borderRadius: "3px 3px 0 0",
          background: reported ? color : "var(--ds-border-subtle)",
        }}
      />
    </span>
  );
}

/**
 * The visible artifact under the outcome — a doc preview, a cost compare, a
 * ranked shortlist, or a mini chart. Every feed-flow step produces one, so
 * "Draft RFP" or "Rank vendors" actually shows the thing it produced.
 */
/**
 * The criteria the engine applied, one row each.
 *
 * Rule on the left, this position's figure on the right, verdict in the glyph —
 * the three things needed to check a decision rather than accept it. Laid out
 * like the calculation panel beside it on purpose: both are a list of terms with
 * a number against each, and a reader moving between the tabs should not have to
 * relearn where to look.
 *
 * A flagged gate draws amber with a warning glyph rather than being hidden. The
 * grid routes on confidence and severity alone, so a position whose stocking
 * policy has been overridden still auto-routes — and that is the one thing on
 * this card a planner most needs to see.
 */
function GatePanel({ gates }: { gates: Gate[] }) {
  return (
    /* Its own 12px gutter, the same one `MathPanel` carries, so a reader moving
       between the tabs sees the rows start on one line rather than shifting. */
    <div className="flex flex-col" style={{ padding: "0 12px" }}>
      {gates.map((g, i) => (
        <div
          key={g.name}
          className="flex items-start justify-between"
          style={{
            gap: 12,
            padding: "10px 0",
            borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)",
          }}
        >
          <span className="flex min-w-0 items-start" style={{ gap: 7 }}>
            {g.cleared ? (
              <CheckSquare
                size={14}
                weight="fill"
                className="mt-[3px] shrink-0"
                style={{ color: "var(--success)" }}
              />
            ) : (
              <Warning
                size={14}
                weight="fill"
                className="mt-[3px] shrink-0"
                style={{ color: "var(--text-warning)" }}
              />
            )}
            <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                {g.name}
              </span>
              <span
                className="ds-label"
                style={{ color: g.cleared ? "var(--ds-text-secondary)" : "var(--text-warning-dark)" }}
              >
                {g.criterion}
              </span>
            </span>
          </span>
          <span
            className="ds-body-medium shrink-0"
            style={{
              color: "var(--ds-text-primary)",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {g.measured}
          </span>
        </div>
      ))}
    </div>
  );
}

function ArtifactCard({ artifact, bare }: { artifact: FlowArtifact; bare?: boolean }) {
  if (artifact.kind === "doc") return <DocPreview {...artifact} />;
  if (artifact.kind === "compare") return <ComparePreview {...artifact} />;
  if (artifact.kind === "ranked") return <RankedPreview {...artifact} />;
  /* The deck's own chart, not a second one. Resolved from the position key so
     the transcript and the deck cannot disagree about the same line. */
  if (artifact.kind === "gates") {
    const row = POSITIONS.find((p) => p.key === artifact.positionKey);
    return row ? <GatePanel gates={gatesFor(asException(row))} /> : null;
  }
  if (artifact.kind === "math") {
    const row = POSITIONS.find((p) => p.key === artifact.positionKey);
    return row ? <MathPanel steps={waterfallFor(asException(row))} bare={bare} /> : null;
  }
  if (artifact.kind === "trajectory") {
    const row = POSITIONS.find((p) => p.key === artifact.positionKey);
    return row ? <TrajectoryChart row={asException(row)} compact bare={bare} /> : null;
  }
  return <IndexChartPreview {...artifact} />;
}

const artifactShell: React.CSSProperties = {
  background: "var(--surface-sunken)",
  border: "1px solid var(--ds-border-subtle)",
  borderRadius: 10,
};

function ArtifactHeader({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      {kicker && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: "var(--ds-text-secondary)",
          }}
        >
          {kicker}
        </span>
      )}
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ds-text-primary)",
          lineHeight: "18px",
        }}
      >
        {title}
      </span>
    </div>
  );
}

/** A written document: RFP scope, clause language, sourcing rule, email. */
function DocPreview({
  kicker,
  title,
  fields,
  body,
}: Extract<FlowArtifact, { kind: "doc" }>) {
  return (
    <div className="flex flex-col p-3" style={{ ...artifactShell, gap: 10 }}>
      <ArtifactHeader kicker={kicker} title={title} />
      {fields && fields.length > 0 && (
        <div className="flex flex-col" style={{ gap: 3 }}>
          {fields.map((f) => (
            <span key={f.label} className="flex" style={{ gap: 6, fontSize: 12.5 }}>
              <span style={{ color: "var(--ds-text-secondary)", minWidth: 62 }}>{f.label}</span>
              <span style={{ color: "var(--ds-text-primary)" }}>{f.value}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col" style={{ gap: 6 }}>
        {body.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: "18px",
              color: "var(--ds-text-primary)",
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

/** A two-column cost compare — make-vs-buy, before/after. */
function ComparePreview({
  title,
  aLabel,
  bLabel,
  rows,
}: Extract<FlowArtifact, { kind: "compare" }>) {
  const toneColor = (tone?: "good" | "behind") =>
    tone === "good"
      ? "var(--text-success-vivid)"
      : tone === "behind"
      ? "var(--text-warning)"
      : "var(--ds-text-primary)";
  return (
    <div className="flex flex-col p-3" style={{ ...artifactShell, gap: 8 }}>
      <ArtifactHeader kicker="DRAFT · cost compare" title={title} />
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          lineHeight: "18px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", color: "var(--text-muted)", fontWeight: 400, paddingBottom: 4 }}>
              <span className="sr-only">Line</span>
            </th>
            <th style={{ textAlign: "right", color: "var(--text-muted)", fontWeight: 400, paddingBottom: 4 }}>
              {aLabel}
            </th>
            <th style={{ textAlign: "right", color: "var(--text-muted)", fontWeight: 400, paddingBottom: 4 }}>
              {bLabel}
            </th>
            <th style={{ textAlign: "right", color: "var(--text-muted)", fontWeight: 400, paddingBottom: 4 }}>
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderTop: "1px solid var(--ds-border-subtle)" }}>
              <td style={{ color: "var(--ds-text-secondary)", padding: "5px 0" }}>{r.label}</td>
              <td style={{ textAlign: "right", color: "var(--text-muted)", padding: "5px 0" }}>{r.a}</td>
              <td
                style={{
                  textAlign: "right",
                  color: "var(--ds-text-primary)",
                  fontWeight: 500,
                  padding: "5px 0",
                }}
              >
                {r.b}
              </td>
              <td
                style={{
                  textAlign: "right",
                  color: toneColor(r.tone),
                  fontWeight: 500,
                  padding: "5px 0",
                }}
              >
                {r.delta ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A ranked vendor shortlist with a highlighted leader. */
function RankedPreview({
  title,
  columns,
  rows,
  footnote,
}: Extract<FlowArtifact, { kind: "ranked" }>) {
  return (
    <div className="flex flex-col p-3" style={{ ...artifactShell, gap: 8 }}>
      <ArtifactHeader kicker="DRAFT · shortlist" title={title} />
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          lineHeight: "18px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  color: "var(--text-muted)",
                  fontWeight: 400,
                  paddingBottom: 4,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              style={{
                borderTop: "1px solid var(--ds-border-subtle)",
                background: r.leader ? "var(--color-iris-50, #f5f3ff)" : "transparent",
              }}
            >
              {r.cells.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: ci === 0 ? "left" : "right",
                    color:
                      ci === 0
                        ? r.leader
                          ? "var(--color-iris-700)"
                          : "var(--ds-text-primary)"
                        : "var(--ds-text-primary)",
                    fontWeight: r.leader && ci === 0 ? 600 : 500,
                    padding: "6px 0",
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footnote && (
        <span className="ds-label" style={{ color: "var(--text-muted)" }}>
          {footnote}
        </span>
      )}
    </div>
  );
}

/** A one-series bar chart — the index marker's trend behind a hedge review. */
function IndexChartPreview({
  title,
  unit,
  points,
  note,
}: Extract<FlowArtifact, { kind: "mini-chart" }>) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = Math.max(1, max - min);
  const H = 96;
  return (
    <div className="flex flex-col p-3" style={{ ...artifactShell, gap: 10 }}>
      <ArtifactHeader kicker="INDEX · four-quarter trend" title={title} />
      <div
        className="flex items-end justify-between"
        style={{
          gap: 10,
          height: H + 24,
          borderBottom: "1px solid var(--ds-border-subtle)",
        }}
      >
        {points.map((p) => {
          /* Normalize so the smallest bar still stands, but the shape follows
             the actual movement — a falling series reads as falling. */
          const h = Math.max(14, ((p.value - min) / range) * H + 14);
          return (
            <span
              key={p.period}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ gap: 4 }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--ds-text-secondary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {unit}
                {p.value.toLocaleString()}
              </span>
              <span
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: "3px 3px 0 0",
                  background: "#3B82F6",
                }}
              />
            </span>
          );
        })}
      </div>
      <div className="flex" style={{ gap: 10 }}>
        {points.map((p) => (
          <span
            key={p.period}
            className="ds-label flex-1 text-center"
            style={{ color: "var(--ds-text-secondary)" }}
          >
            {p.period}
          </span>
        ))}
      </div>
      {note && (
        <span className="ds-label" style={{ color: "var(--text-muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

/** The line the agent leads with, before any step lands. */
export function TaskIntro({ task }: { task: AgentTask }) {
  return (
    <div className="flex gap-2">
      <AiStar size={14} variant="small" className="mt-0.5 shrink-0" />
      <p className="ds-body flex-1" style={{ color: "var(--ds-text-primary)" }}>
        {task.intro}
      </p>
    </div>
  );
}
