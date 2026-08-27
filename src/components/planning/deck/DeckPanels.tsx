"use client";

import { GitBranch, MathOperations, ShieldCheck } from "@phosphor-icons/react";
import type { DeckFactor, DeckPolicyRow, DeckStep } from "@/data/demand-deck";

/* ═══════════════════════════════════════════════════════════════
 *  The four panels behind an IRIS recommendation
 *
 *  One per tab: what drove the decision, the arithmetic, where the
 *  position is heading, and the policy in force. Laid out after the
 *  IRIS project's demand deck so a reader who knows one knows both —
 *  a titled card, a header strip, and rows that read down into a
 *  shaded total.
 * ═══════════════════════════════════════════════════════════════ */

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * The card every panel sits in.
 *
 * `bare` drops the frame and the title row, for when the panel is a tab inside
 * a card that already has both — otherwise the tab strip sits above a second
 * border and a second copy of its own label.
 */
function Card({
  icon: Icon,
  title,
  bare = false,
  children,
}: {
  icon: React.ComponentType<{ size?: number; weight?: "duotone"; color?: string }>;
  title: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  if (bare) return <div className="overflow-hidden">{children}</div>;
  return (
    <div
      className="overflow-hidden rounded-[12px]"
      style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-subtle)" }}
    >
      <div className="flex items-center" style={{ padding: 12, gap: 8 }}>
        <Icon size={16} weight="duotone" color="#181A1B" />
        <span style={{ fontSize: 14, fontWeight: 500, color: "#181A1B" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── What drove this decision ────────────────────────────────── */

const FACTOR_COLS = "minmax(0, 1.7fr) minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 0.9fr)";

/**
 * Model feature attribution: weight × sub-score = impact, totalling to the
 * confidence the row carries.
 *
 * The five factors are IRIS's own, from `CONFIDENCE_WEIGHTS`, and the sub-scores
 * move with the properties they name — see `factorsFor`. The total row is the
 * point of the table: a confidence score nobody can decompose is a number you
 * either believe or do not, and this one adds up.
 */
export function FactorPanel({ factors, confidence }: { factors: DeckFactor[]; confidence: number }) {
  const weight = factors.reduce((s, f) => s + f.weightPct, 0);
  const impact = Math.round(factors.reduce((s, f) => s + f.impact, 0) * 10) / 10;
  const verdict = impact >= 80 ? "High" : impact >= 60 ? "Medium" : "Low";
  return (
    <Card icon={GitBranch} title="What drove this decision · model feature attribution">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: FACTOR_COLS,
          padding: "0 12px",
          gap: 12,
          height: 36,
          fontSize: 12,
          fontWeight: 600,
          background: "#F5F5F5",
          borderTop: "1px solid #E4E4E7",
          borderBottom: "1px solid #E4E4E7",
          color: "#181A1B",
        }}
      >
        <span>Factor</span>
        <span>Observed value</span>
        <span>Weight</span>
        <span>Sub-score</span>
        <span>Impact</span>
      </div>

      {factors.map((f, i) => (
        <div
          key={f.name}
          className="grid items-center transition-colors hover:bg-[var(--surface-hover)]"
          style={{
            gridTemplateColumns: FACTOR_COLS,
            padding: "0 12px",
            gap: 12,
            minHeight: 52,
            fontSize: 13,
            color: "#18181B",
            borderTop: i === 0 ? undefined : "1px solid #F1F3F5",
          }}
        >
          <span>{f.name}</span>
          <span style={{ color: "var(--ds-text-secondary)" }}>{f.observed}</span>
          <span style={numeric}>{`${f.weightPct}%`}</span>
          <span style={numeric}>{f.subScore}</span>
          <span style={numeric}>{f.impact.toFixed(1)}</span>
        </div>
      ))}

      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: FACTOR_COLS,
          padding: "0 12px",
          gap: 12,
          height: 52,
          fontSize: 13,
          fontWeight: 600,
          color: "#18181B",
          background: "var(--surface-sunken, #F4F4F5)",
          borderTop: "1px solid #E4E4E7",
        }}
      >
        <span>Confidence</span>
        <span />
        <span style={numeric}>{`${weight}%`}</span>
        <span />
        <span style={numeric}>
          {`${impact.toFixed(1)} → ${verdict}`}
          {Math.abs(impact - confidence * 100) > 1 && ""}
        </span>
      </div>
    </Card>
  );
}

/* ─── The arithmetic ──────────────────────────────────────────── */

/** The worked sum, reading down into its total. */
export function MathPanel({ steps, bare }: { steps: DeckStep[]; bare?: boolean }) {
  const formula = steps
    .filter((s) => !s.isFinal)
    .map((s, i) => (i === 0 ? s.label : `${s.delta ?? "+"} ${s.label}`))
    .join(" ");
  return (
    <Card icon={MathOperations} title="How we got there · math waterfall" bare={bare}>
      <div className="flex flex-col" style={{ padding: "0 12px" }}>
        {steps.map((s, i) => {
          const total = !!s.isFinal;
          return (
            <div
              key={s.label}
              className="flex items-center justify-between"
              style={{
                gap: 16,
                minHeight: total ? 46 : 56,
                padding: total ? "10px 12px" : "10px 0",
                margin: total ? "0 -12px" : undefined,
                background: total ? "var(--surface-sunken, #F4F4F5)" : undefined,
                borderTop: i === 0 ? undefined : "1px solid #F1F3F5",
              }}
            >
              <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: total ? 600 : 400, color: "#18181B" }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
                  {total ? formula : s.sub}
                </span>
              </span>
              <span className="flex shrink-0 items-center" style={{ gap: 10 }}>
                {!total && s.delta && (
                  <span aria-hidden style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>
                    {s.delta}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: total ? 600 : 400,
                    color: "#18181B",
                    whiteSpace: "nowrap",
                    ...numeric,
                  }}
                >
                  {s.value}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* The trajectory lives in its own file — see TrajectoryChart, ported from the
   IRIS deck. It was an SVG hand-rolled from the screenshot for a while, which is
   why it looked nothing like the original. */

/* ─── The policy in force ─────────────────────────────────────── */

/** What is governing this position, and where each figure comes from. */
export function PolicyPanel({ rows }: { rows: DeckPolicyRow[] }) {
  return (
    <Card icon={ShieldCheck} title="Active policy">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="flex items-start justify-between gap-4"
          style={{
            padding: "10px 12px",
            borderTop: i === 0 ? "1px solid #F1F3F5" : "1px solid #F1F3F5",
          }}
        >
          <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 13, color: "#18181B" }}>{r.label}</span>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>{r.source}</span>
          </span>
          <span
            className="shrink-0 font-medium"
            style={{ fontSize: 13, color: "#18181B", ...numeric }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </Card>
  );
}
