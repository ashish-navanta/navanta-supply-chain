/**
 * The Mercer chat runs behind the value-realization screen.
 *
 * Review on a committed play opens `valueTaskFor` — the agent reads the ramp,
 * weighs realized against plan, and lands an outcome card that carries the
 * commit's figure tiles, its RAG read, and the projected-vs-realized ramp as
 * a small chart inside the transcript. "Make live" opens `makeLiveTaskFor`.
 *
 * Everything the card renders comes from the play's own `ramp`, so the graph
 * in the chat and the graph on the page are the same numbers.
 */
import {
  KIND_LABEL,
  money,
  rampToDate,
  realizedToDate,
  trackStage,
  type Play,
} from "./buying";
import type { AgentTask } from "./agent-actions";
import type { PlayRisk } from "@/lib/plays";

/** The RAG read on a live commit — pace vs plan, or schedule pre-ERP. */
export function ragFor(p: Play, forced?: PlayRisk): {
  level: "on-track" | "behind" | "at-risk";
  text: string;
} {
  if (forced) {
    const text =
      forced === "on-track"
        ? "Set on track from your read of execution."
        : forced === "behind"
        ? "Flagged behind the committed pace — recoverable."
        : "Flagged at risk — the committed figure is in doubt.";
    return { level: forced, text };
  }
  const expected = rampToDate(p);
  const actual = realizedToDate(p);
  if (expected === 0) {
    return {
      level: "on-track",
      text: "Live and on the ramp — realized figures fill once the ERP is connected.",
    };
  }
  const pace = actual / expected;
  if (pace >= 0.95)
    return { level: "on-track", text: `${money(actual)} landed against ${money(expected)} due — on pace.` };
  if (pace >= 0.7)
    return {
      level: "behind",
      text: `${money(actual)} landed against ${money(expected)} due — behind the ramp, recoverable.`,
    };
  return {
    level: "at-risk",
    text: `${money(actual)} landed against ${money(expected)} due — at risk of missing the commit.`,
  };
}

/** The figure tiles shared by the review + make-live runs. */
function tilesFor(p: Play): NonNullable<AgentTask["outcome"]["tiles"]> {
  const actual = realizedToDate(p);
  const expected = rampToDate(p);
  return [
    { label: "Committed", value: money(p.recommended) },
    {
      label: "Realized",
      value: actual > 0 ? money(actual) : "—",
      tone: expected === 0 ? "quiet" : actual >= expected ? "good" : "behind",
    },
    {
      label: "Against ramp",
      value: expected === 0 ? "not reporting" : `${Math.round((actual / expected) * 100)}%`,
      tone: expected === 0 ? "quiet" : actual >= expected ? "good" : "behind",
    },
  ];
}

/** Review → open the chat with the commit's data + graph. When the commit
 *  has not yet gone live the outcome offers a Make live CTA; the caller
 *  supplies the transition callback so the store write happens on click. */
export function valueTaskFor(
  p: Play,
  agent: string,
  forced?: PlayRisk,
  onMakeLive?: (play: Play) => void,
): AgentTask {
  const stage = trackStage(p);
  const rag = ragFor(p, forced);
  const stageWord =
    stage === "committed" ? "committed, not yet live" : stage === "live" ? "live" : "realized and closed";

  const steps = [
    {
      label: "Read the commitment",
      text:
        `${p.title} · ${KIND_LABEL[p.kind]}. ${money(p.recommended)} committed` +
        `${p.committedOn ? ` on ${p.committedOn}` : ""} — currently ${stageWord}.`,
      source: `Value ledger · ${p.id}`,
    },
    {
      label: "Weighed realized against the ramp",
      text:
        rampToDate(p) === 0
          ? "Nothing has come due yet — the ramp starts reporting once the first quarter lands in the ERP."
          : `${money(realizedToDate(p))} realized against ${money(rampToDate(p))} the ramp planned by now.`,
      source: `${agent} · realization model`,
    },
    {
      label: "Drew the ramp",
      text: "Projected against realized, quarter by quarter, for this commit alone.",
      source: `${agent} · ${p.id} ramp`,
    },
  ];

  return {
    id: `${p.id}-review`,
    label: "Review realization",
    ask: `Review realization on ${p.id}`,
    intro: `On it. ${p.title}.`,
    icon: "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${p.id} — ${stageWord}`,
      lines: [],
      tiles: tilesFor(p),
      rag: stage === "committed" ? undefined : rag,
      ramp: (p.ramp ?? []).map((r) => ({
        period: r.period,
        projected: r.projected,
        realized: r.realized,
      })),
      /* A committed commit is a promise that has not yet started running.
         The natural next move from a Review of that read is Make live — so
         it lands as the CTA here rather than a link back to the page the
         reader already came from. */
      action:
        stage === "committed" && onMakeLive
          ? { label: "Make live", onAction: () => onMakeLive(p) }
          : undefined,
    },
  };
}

/** Make live → narrate the go-live and show the ramp it now sits on. */
export function makeLiveTaskFor(p: Play, agent: string): AgentTask {
  const steps = [
    {
      label: "Checked the commitment is ready",
      text: `${p.title} · ${money(p.recommended)} committed${p.committedOn ? ` on ${p.committedOn}` : ""}. Playbook closed out; nothing blocks execution.`,
      source: `Value ledger · ${p.id}`,
    },
    {
      label: "Put it into execution",
      text: "The play is now live and on the savings ramp. Projected stands alone until the ERP posts the first quarter's actuals.",
      source: `${agent} · go-live`,
    },
  ];
  return {
    id: `${p.id}-live`,
    label: "Make live",
    ask: `Make ${p.id} live`,
    intro: `On it. ${p.title}.`,
    icon: "flag",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${p.id} is live`,
      lines: [`${p.title} has moved into execution and started reporting against its ramp.`],
      tiles: tilesFor(p),
      rag: { level: "on-track", text: "Live and on the ramp — realized fills once the ERP is connected." },
      ramp: (p.ramp ?? []).map((r) => ({
        period: r.period,
        projected: r.projected,
        realized: undefined,
      })),
    },
  };
}
