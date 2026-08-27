"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Buildings,
  ChartLineUp,
  CheckSquare,
  ClockCounterClockwise,
  CurrencyDollar,
  Factory,
  Gauge,
  ListChecks,
  MapPin,
  Prohibit,
  Warning,
} from "@phosphor-icons/react";
import { AiStar, Button, Pill, TableShell } from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { StatusStepper, type StepperStep } from "@/components/ui/StatusStepper";
import { CARD_RADIUS, CARD_SHADOW, InfoRow, InfoSub, SectionCard } from "@/components/ui/RecordCard";
import { AgentBand } from "@/components/ui/AgentBand";
import { PlayTracker } from "@/components/buying/PlayTracker";
import { OverridePanel, SAVINGS_RATE_REASONS } from "@/components/chat/OverridePanel";
import {
  acceptPlay,
  addTask,
  attachToTask,
  commitPlay,
  dismissPlay,
  markTask,
  reopenPlay,
  usePlays,
} from "@/lib/plays";
import {
  BASIS_LABEL,
  KIND_LABEL,
  STAGE_LABEL,
  SUPPLIERS,
  type Play,
  type PlayStage,
} from "@/data/buying";
import { formatUsdFull } from "@/data/action-center";

/**
 * One play, from surfaced to realized.
 *
 * Ported from the Allison procurement opportunity workspace, whose shape is the
 * argument: **Review** makes the case, **Act** runs it step by step, and only
 * then is a figure **committed** and tracked. The buyer's earlier version
 * collapsed all three into one press — a tick in a table row that raised a
 * toast and left the play exactly where it was — which taught the reader that
 * the button did nothing.
 *
 * So accepting and committing are two different acts here. Accepting is
 * agreeing to run the play; committing is standing behind a number, and it
 * unlocks only once the work that produces the number has been done.
 */

/** The five stages a play runs through, as steps. */
const STAGE_ORDER: PlayStage[] = ["surfaced", "accepted", "committed", "realizing", "realized"];

function stepsFor(play: Play): StepperStep[] {
  /* Qualifying and surfaced are the same square on this board — the difference
     is whether anyone has opened it, which the stepper cannot show and the
     reader does not need. Dismissed has no position: it left the board. */
  const at = STAGE_ORDER.indexOf(play.stage === "qualifying" ? "surfaced" : play.stage);
  return STAGE_ORDER.map((s, i) => ({
    label: STAGE_LABEL[s].split(" — ")[0],
    status: i < at ? "completed" : i === at ? "active" : "pending",
    date: s === "committed" ? play.committedOn : undefined,
  }));
}

/** The rate the play's recommended figure implies, to one decimal. */
function recommendedRate(play: Play): number {
  return Math.round((play.recommended / play.addressable) * 1000) / 10;
}

const TABS = [
  { id: "act", label: "Act", icon: ListChecks },
  { id: "evidence", label: "Evidence", icon: CheckSquare },
  { id: "risks", label: "Risks", icon: Warning },
  { id: "suppliers", label: "Suppliers", icon: Buildings },
  { id: "tracking", label: "Tracking", icon: ChartLineUp },
  { id: "history", label: "Activity", icon: ClockCounterClockwise },
] as const;

type Panel = (typeof TABS)[number]["id"];

export function PlayDetailScreen({ id }: { id: string }) {
  const { persona } = usePersona();
  const agent = PERSONAS[persona].agent;
  const { byId, tasks: tasksOf, fulfilled } = usePlays();

  const [panel, setPanel] = useState<Panel>("act");
  const [overriding, setOverriding] = useState(false);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState<string | null>(null);

  const play = byId(id);

  /* Above the early return: a hook behind a condition changes the hook order
     between renders, which is the one thing React will not tolerate. */
  const suppliers = useMemo(
    () => (play ? SUPPLIERS.filter((s) => play.supplierIds.includes(s.id)) : []),
    [play],
  );

  if (!play) return null;

  const tasks = tasksOf(play);
  const done = fulfilled(play);
  const recRate = recommendedRate(play);

  const inFeed = play.stage === "surfaced" || play.stage === "qualifying";
  const inAct = play.stage === "accepted";
  const tracked = play.stage === "committed" || play.stage === "realizing" || play.stage === "realized";
  const dismissed = play.stage === "dismissed";

  /* The figure being committed, as a rate. The rate is what is in dispute, not
     the dollars: the addressable spend is a fact from the spend cube, so the
     only judgement is how much of it this play can actually reach. */
  const rateNum = Number.parseFloat(rate || String(recRate));
  const validRate = Number.isFinite(rateNum) && rateNum > 0 && rateNum < 60;
  const committedValue = Math.round(play.addressable * (rateNum / 100));

  const closeOverride = () => {
    setOverriding(false);
    setReason(null);
    setRate("");
  };

  /* The agent's read, composed from the play's own figures. */
  const summary = [
    play.summary,
    inAct
      ? done
        ? `Every step is done — the figure is ready to commit.`
        : `${tasks.filter((t) => t.status !== "open").length} of ${tasks.length} steps done. The commit unlocks when the work behind the number is finished.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* What the band offers, and it changes with the stage — because "accept this
     play" and "commit this number" are different promises and a single label
     for both is how a prototype ends up claiming work it has not done. */
  const band = inFeed
    ? {
        actionLine: play.action,
        confirmLabel: "Accept and run it",
        onConfirm: () => acceptPlay(play),
        overrideLabel: undefined as string | undefined,
      }
    : inAct
      ? {
          actionLine: `Commit ${formatUsdFull(play.recommended)} at ${recRate}% of ${formatUsdFull(play.addressable)}`,
          confirmLabel: `Commit ${formatUsdFull(play.recommended)}`,
          onConfirm: () => commitPlay(play, { on: "12 Aug" }),
          overrideLabel: "Override the rate",
        }
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div
        className="flex items-end justify-between"
        style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Briefcase size={20} weight="duotone" className="shrink-0" style={{ color: "var(--color-iris-700)" }} />
            <h1 style={{ fontSize: 20, fontWeight: 600, lineHeight: "144%", color: "#212121" }}>
              {play.id}
            </h1>
            <Pill
              variant={dismissed ? "neutral" : tracked ? "info" : inAct ? "warning" : "danger"}
              size="sm"
            >
              {STAGE_LABEL[play.stage]}
            </Pill>
            <Pill variant="neutral" size="sm">
              {KIND_LABEL[play.kind]}
            </Pill>
          </div>
          <p
            className="truncate font-medium"
            style={{ fontSize: 14, lineHeight: 1.5, color: "#333" }}
          >
            {play.title}
          </p>
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-2">
          {inFeed && (
            <Button
              size="sm"
              variant="outline"
              iconLeft={<Prohibit size={14} />}
              onClick={() => dismissPlay(play, "Not worth the effort this cycle")}
            >
              Dismiss
            </Button>
          )}
          {(tracked || dismissed) && (
            <Button size="sm" variant="outline" onClick={() => reopenPlay(play)}>
              Put it back in the feed
            </Button>
          )}
        </div>
      </div>

      {/* ── Top row: where the play is + what it is worth ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          columnGap: 16,
          alignItems: "stretch",
          marginBottom: 4,
        }}
      >
        <div style={{ gridColumn: "span 8" }} className="flex flex-col">
          <StatusStepper
            className="flex-1"
            title="Play status"
            steps={stepsFor(play)}
            totalItems={tasks.length}
          >
            <div className="flex w-full flex-col gap-3 px-4 pb-1">
              {band ? (
                <AgentBand
                  agent={agent}
                  summary={summary}
                  confidencePct={play.confidencePct}
                  actionLine={band.actionLine}
                  confirmLabel={band.confirmLabel}
                  onConfirm={band.onConfirm}
                  override={
                    band.overrideLabel
                      ? {
                          label: band.overrideLabel,
                          open: overriding,
                          onOpen: () => {
                            setRate(String(recRate));
                            setOverriding(true);
                          },
                          panel: (
                            <OverridePanel
                              agent={agent}
                              subject="savings rate"
                              unit="%"
                              reasons={SAVINGS_RATE_REASONS}
                              value={rate}
                              onValueChange={setRate}
                              recommended={recRate}
                              reason={reason}
                              onReasonChange={setReason}
                              valid={validRate}
                              onCancel={closeOverride}
                              onConfirm={() => {
                                commitPlay(play, {
                                  rate: rateNum,
                                  reason: reason ?? undefined,
                                  on: "12 Aug",
                                });
                                closeOverride();
                              }}
                            />
                          ),
                        }
                      : undefined
                  }
                />
              ) : (
                <div
                  className="flex w-full flex-col gap-1 rounded-[12px] p-3"
                  style={{ background: "#F5EFFF" }}
                >
                  <span className="flex items-center gap-2">
                    <AiStar size={16} variant="small" />
                    <span
                      className="font-medium"
                      style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
                    >
                      {`${agent} Summary`}
                    </span>
                  </span>
                  <p className="px-1" style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}>
                    {dismissed
                      ? `Dismissed. ${play.dismissReason ?? "Not taken this cycle."} ${agent} keeps the evidence and will raise it again if the picture changes.`
                      : `Committed ${play.committedOn ? `on ${play.committedOn}` : ""} — tracking now runs against the ramp. ${agent} flags it if realised value falls behind.`}
                  </p>
                </div>
              )}
            </div>
          </StatusStepper>
        </div>

        <div
          className="flex flex-col overflow-hidden bg-[var(--surface-base)]"
          style={{ gridColumn: "span 4", borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center px-4 py-3">
            <span className="text-[16px] font-medium leading-[21px]" style={{ color: "#1E1E1E" }}>
              What it is worth
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-between p-[16px]">
            <div className="flex flex-col gap-[19px] pb-[12px]">
              {[
                ["Addressable spend", formatUsdFull(play.addressable)],
                [
                  "Modelled band",
                  `${formatUsdFull(play.savingsLow)} – ${formatUsdFull(play.savingsHigh)}`,
                ],
                ["Recommended rate", `${recRate}%`],
                ["Effort", `${play.effortWeeks} weeks`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 text-[14px] leading-[1.5]"
                >
                  <span className="whitespace-nowrap text-[#71717a]">{label}</span>
                  <span className="text-right font-medium text-[#18181b]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between whitespace-nowrap border-t border-[#e4e4e7] py-[16px] text-right text-[14px] font-semibold leading-[1.33] text-[#212121]">
              <span>{tracked ? "Committed" : "Recommended"}</span>
              <span>
                {formatUsdFull(
                  tracked && validRate && rateNum !== recRate ? committedValue : play.recommended,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between whitespace-nowrap text-[14px]">
              <span className="leading-[1.5] text-[#71717a]">Basis</span>
              <span className="text-right font-medium leading-[1.5] text-[#212121]">
                {BASIS_LABEL[play.basis]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── The work, the evidence, and the record ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          columnGap: 16,
          marginTop: 4,
        }}
      >
        <div style={{ gridColumn: "span 8" }} className="flex min-w-0 flex-col gap-5">
          <TableShell
            title="Play record"
            icon={Briefcase}
            customize={false}
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
              badge:
                t.id === "act"
                  ? tasks.length
                  : t.id === "evidence"
                    ? play.evidence.length
                    : t.id === "risks"
                      ? play.risks.length
                      : t.id === "suppliers"
                        ? suppliers.length
                        : t.id === "history"
                          ? play.events.length
                          : undefined,
            }))}
            activeTab={panel}
            onTabChange={(next) => setPanel(next as Panel)}
            totalItems={tasks.length}
            currentPage={1}
            onPageChange={() => {}}
            pageSize={25}
            onPageSizeChange={() => {}}
            className="ts-no-pager ts-scroll-tabs"
          >
            <div className="p-4">
              {panel === "act" ? (
                inFeed ? (
                  <p style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
                    {`Nothing to work yet. Accepting the play seeds its playbook — ${tasks.length} steps for a ${KIND_LABEL[play.kind].toLowerCase()} — and the first one attaches the scope file everything after it is measured against.`}
                  </p>
                ) : (
                  <PlayTracker
                    agent={agent}
                    tasks={tasks}
                    onMark={(i, status) => markTask(play, i, status)}
                    onAttach={(i, name) => attachToTask(play, i, name)}
                    onAdd={(label) => addTask(play, label)}
                    onRemove={(i) => {
                      markTask(play, i, "skipped");
                    }}
                    onReopenAll={() => tasks.forEach((_, i) => markTask(play, i, "open"))}
                  />
                )
              ) : panel === "evidence" ? (
                <div className="flex flex-col">
                  {play.evidence.map((e, i) => (
                    <div
                      key={e.claim}
                      className="flex flex-col gap-0.5 py-2.5"
                      style={{ borderTop: i > 0 ? "1px solid var(--ds-border-subtle)" : undefined }}
                    >
                      <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>{e.claim}</span>
                      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
                        {e.source}
                      </span>
                    </div>
                  ))}
                </div>
              ) : panel === "risks" ? (
                <div className="flex flex-col gap-2.5">
                  {play.risks.map((r) => (
                    <span key={r} className="flex items-start gap-2">
                      <Warning
                        size={14}
                        weight="duotone"
                        className="mt-0.5 shrink-0"
                        style={{ color: "#f59e0b" }}
                      />
                      <span style={{ fontSize: 14, lineHeight: "22px", color: "var(--ds-text-primary)" }}>
                        {r}
                      </span>
                    </span>
                  ))}
                </div>
              ) : panel === "suppliers" ? (
                <div className="flex flex-col">
                  {suppliers.map((sup, i) => (
                    <div
                      key={sup.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                      style={{ borderTop: i > 0 ? "1px solid var(--ds-border-subtle)" : undefined }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="truncate font-medium"
                          style={{ fontSize: 14, color: "var(--ds-text-primary)" }}
                        >
                          {sup.name}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
                          {`${sup.region} · ${formatUsdFull(sup.annualSpend)} a year · ${sup.otifPct}% on time`}
                        </span>
                      </span>
                      <Pill variant={sup.own ? "neutral" : "info"} size="sm">
                        {sup.own ? "Target plant" : "External"}
                      </Pill>
                    </div>
                  ))}
                </div>
              ) : panel === "tracking" ? (
                <RampTable play={play} tracked={tracked} agent={agent} />
              ) : (
                <div className="flex flex-col">
                  {[...play.events].reverse().map((e, i) => (
                    <div
                      key={`${e.at}-${e.note}`}
                      className="flex flex-col gap-0.5 py-2.5"
                      style={{ borderTop: i > 0 ? "1px solid var(--ds-border-subtle)" : undefined }}
                    >
                      <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>{e.note}</span>
                      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
                        {`${e.at} · ${e.actor}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableShell>
        </div>

        <div style={{ gridColumn: "span 4" }} className="flex flex-col gap-5">
          <SectionCard title="Play details">
            <div className="flex flex-col">
              <InfoRow icon={Briefcase} label="Kind">
                {KIND_LABEL[play.kind]}
              </InfoRow>
              <InfoRow icon={Factory} label="Category">
                <span className="truncate">{play.category}</span>
              </InfoRow>
              <InfoRow icon={MapPin} label="Region">
                {play.region}
              </InfoRow>
              <InfoRow icon={Gauge} label="Confidence">
                <span>{`${play.confidencePct}%`}</span>
                <InfoSub>{BASIS_LABEL[play.basis]}</InfoSub>
              </InfoRow>
              <InfoRow icon={CurrencyDollar} label="Addressable">
                {formatUsdFull(play.addressable)}
              </InfoRow>
              <InfoRow icon={ClockCounterClockwise} label="Owner" last>
                <span>{play.owner}</span>
                <InfoSub>{`${play.effortWeeks} weeks of work`}</InfoSub>
              </InfoRow>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/**
 * The ramp — projected against realised, per period.
 *
 * A table rather than a chart, and deliberately: the question the buyer asks of
 * a ramp is "are we behind, and by how much", which is a subtraction. A line
 * chart makes that a visual estimate; a column of differences answers it.
 */
function RampTable({ play, tracked, agent }: { play: Play; tracked: boolean; agent: string }) {
  const ramp = play.ramp ?? [];

  if (!tracked || ramp.length === 0) {
    return (
      <p style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
        {tracked
          ? "No ramp on this play yet — the first period opens once the award lands."
          : `Nothing to track until the value is committed. ${agent} starts measuring against the ramp the moment it is.`}
      </p>
    );
  }

  const projected = ramp.reduce((sum, r) => sum + r.projected, 0);
  const realized = ramp.reduce((sum, r) => sum + (r.realized ?? 0), 0);
  const behind = realized < projected;

  return (
    <div className="flex flex-col gap-3">
      {play.drift?.flagged && (
        <span
          className="flex items-start gap-2 rounded-[8px] px-3 py-2"
          style={{ background: "#fffbeb" }}
        >
          <Warning size={14} weight="duotone" className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: 13, lineHeight: "20px", color: "#1E1E1E" }}>
            {play.drift.note}
          </span>
        </span>
      )}

      <div className="flex flex-col">
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
            padding: "8px 0",
            borderBottom: "1px solid var(--ds-border-subtle)",
          }}
        >
          {["Period", "Projected", "Realised", "Difference"].map((h, i) => (
            <span
              key={h}
              style={{ fontSize: 12, color: "#64748b", textAlign: i === 0 ? "left" : "right" }}
            >
              {h}
            </span>
          ))}
        </div>
        {ramp.map((r) => {
          const got = r.realized ?? 0;
          const diff = got - r.projected;
          return (
            <div
              key={r.period}
              className="grid items-center"
              style={{
                gridTemplateColumns: "minmax(0,1.4fr) 1fr 1fr 1fr",
                padding: "10px 0",
                borderBottom: "1px solid var(--ds-border-subtle)",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>{r.period}</span>
              <span
                className="text-right"
                style={{ fontSize: 14, color: "#52525c", fontVariantNumeric: "tabular-nums" }}
              >
                {formatUsdFull(r.projected)}
              </span>
              <span
                className="text-right font-medium"
                style={{ fontSize: 14, color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
              >
                {r.realized === undefined ? "—" : formatUsdFull(got)}
              </span>
              <span
                className="text-right font-medium"
                style={{
                  fontSize: 14,
                  color: r.realized === undefined ? "#94A3B8" : diff < 0 ? "#DE1010" : "#008234",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.realized === undefined
                  ? "—"
                  : `${diff >= 0 ? "+" : "−"}${formatUsdFull(Math.abs(diff)).slice(1)}`}
              </span>
            </div>
          );
        })}
      </div>

      <span style={{ fontSize: 13, color: behind ? "#DE1010" : "#008234" }}>
        {`${formatUsdFull(realized)} realised against ${formatUsdFull(projected)} projected — ${
          behind
            ? `${formatUsdFull(projected - realized)} behind the ramp`
            : "on or ahead of the ramp"
        }.`}
      </span>
    </div>
  );
}
