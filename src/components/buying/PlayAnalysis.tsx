"use client";

import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { HAIR } from "@/components/ui/RecordCard";
import { formatUsdFull } from "@/data/action-center";
import { BASIS_LABEL, type Play } from "@/data/buying";

/**
 * How the number was got to, and whether the play can actually be run.
 *
 * The two questions a buyer asks of any modelled saving, and the review deck
 * they came from asks them on their own tabs rather than burying them in a
 * paragraph. A figure with no derivation is a figure nobody can argue with,
 * which sounds like a strength and is the opposite.
 */

/** The steps from the whole category down to the figure being recommended. */
export function SavingsDerivation({ play }: { play: Play }) {
  const rate = Math.round((play.recommended / play.addressable) * 1000) / 10;
  const bandLow = Math.round((play.savingsLow / play.addressable) * 1000) / 10;
  const bandHigh = Math.round((play.savingsHigh / play.addressable) * 1000) / 10;
  /* What the recommendation holds back from the top of the band — the part that
     depends on things going right. */
  const heldBack = play.savingsHigh - play.recommended;

  const steps: { label: string; detail: string; value: string }[] = [
    {
      label: "Addressable spend",
      detail: "What this play can actually reach — not the category total",
      value: formatUsdFull(play.addressable),
    },
    {
      label: "Modelled band",
      detail: `${bandLow}% – ${bandHigh}% on that spend`,
      value: `${formatUsdFull(play.savingsLow)} – ${formatUsdFull(play.savingsHigh)}`,
    },
    {
      label: "Applied rate",
      detail: `${rate}% — inside the band, and what ${BASIS_LABEL[play.basis].toLowerCase()} supports`,
      value: `${rate}%`,
    },
    {
      label: "Held back",
      detail: "The part of the band that depends on things going right",
      value: formatUsdFull(heldBack),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className="flex items-start justify-between gap-4 py-2.5"
            style={{ borderTop: i > 0 ? HAIR : undefined }}
          >
            <span className="flex min-w-0 flex-col">
              <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>{s.label}</span>
              <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>{s.detail}</span>
            </span>
            <span
              className="shrink-0 font-medium"
              style={{ fontSize: 14, color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex items-start justify-between gap-4 rounded-[8px] px-3 py-2.5"
        style={{ background: "var(--color-iris-50)" }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
          Recommended to commit
        </span>
        <span
          style={{ fontSize: 14, fontWeight: 600, color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
        >
          {formatUsdFull(play.recommended)}
        </span>
      </div>
    </div>
  );
}

type Verdict = "pass" | "watch" | "info";

const VERDICT: Record<Verdict, { icon: typeof CheckCircle; colour: string; label: string }> = {
  pass: { icon: CheckCircle, colour: "#0D9467", label: "Clear" },
  watch: { icon: WarningCircle, colour: "#f59e0b", label: "Watch" },
  info: { icon: Info, colour: "#64748b", label: "Note" },
};

/**
 * Whether the play is executable — the qualitative go/no-go beside the maths.
 *
 * Derived from the play's own basis, effort and risks rather than authored per
 * play: an authored fit check is a second place for the story to live, and the
 * risks are already written down.
 */
export function FunctionalFit({ play }: { play: Play }) {
  const dims: { label: string; detail: string; verdict: Verdict }[] = [
    {
      label: "Evidence behind the figure",
      detail:
        play.basis === "evidence"
          ? "A quote or a ruling is on file — the number rests on paper, not on a benchmark."
          : play.basis === "mixed"
            ? "Part quote, part benchmark. The quoted half is firm; the rest is a market comparison."
            : "Benchmark only. Nothing quoted yet, so treat the figure as a hypothesis to test.",
      verdict: play.basis === "benchmark" ? "watch" : "pass",
    },
    {
      label: "Effort against the window",
      detail: `${play.effortWeeks} weeks of work. ${
        play.effortWeeks > 10
          ? "Long enough that a slipped start pushes the saving into the next period."
          : "Short enough to land inside the period the saving is booked against."
      }`,
      verdict: play.effortWeeks > 10 ? "watch" : "pass",
    },
    {
      label: "Supplier concentration",
      detail:
        play.kind === "consolidation"
          ? `Consolidating onto ${play.supplierIds.length} names raises the exposure if one of them slips — the lead-time queue is already carrying that risk.`
          : `Spread across ${play.supplierIds.length} names, so no single one carries the play.`,
      verdict: play.kind === "consolidation" ? "watch" : "pass",
    },
    {
      label: "What could sink it",
      detail: play.risks[0] ?? "Nothing raised against this play yet.",
      verdict: play.risks.length ? "watch" : "pass",
    },
  ];

  return (
    <div className="flex flex-col">
      {dims.map((d, i) => {
        const v = VERDICT[d.verdict];
        const Icon = v.icon;
        return (
          <div
            key={d.label}
            className="flex items-start gap-2.5 py-2.5"
            style={{ borderTop: i > 0 ? HAIR : undefined }}
          >
            <Icon size={15} weight="duotone" className="mt-0.5 shrink-0" style={{ color: v.colour }} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
                  {d.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: v.colour }}>{v.label}</span>
              </span>
              <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ds-text-secondary)" }}>
                {d.detail}
              </span>
            </span>
          </div>
        );
      })}

      {play.risks.length > 1 && (
        <div className="flex flex-col gap-1.5 pt-3" style={{ borderTop: HAIR }}>
          {play.risks.slice(1).map((r) => (
            <span key={r} className="flex items-start gap-2">
              <WarningCircle
                size={13}
                weight="duotone"
                className="mt-0.5 shrink-0"
                style={{ color: "#f59e0b" }}
              />
              <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ds-text-primary)" }}>
                {r}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
