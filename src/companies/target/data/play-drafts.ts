/**
 * Per-play Mercer next-move descriptors — one for every stage a play can be in.
 *
 * The opportunities screen has five tabs (Feed, Act, Committed, Parked,
 * Rejected). Each stage has a natural next thing to do, and Mercer has
 * something to hand back for each one — a drafted artifact on Feed, the next
 * playbook step on Act, a milestone log on Committed, a revive on Parked, a
 * reopen on Rejected. Kept as a pure lookup so the fixture stays a fixture and
 * the column reads the same way on every tab: what would you like Mercer to do
 * with this?
 */
import type { Play, PlayKind, PlayStage } from "./buying";
import { BASIS_LABEL, KIND_LABEL, band, money } from "./buying";
import type { AgentTask } from "./agent-actions";
import { BUYING_ROUTES, playRoute } from "./nav";

/** Matches the queue's `AgentIcon` set for visual consistency. */
export type PlayDraftIcon = "commit" | "email" | "send" | "flag" | "call";

/**
 * The intent behind the row-level button. Drives label wording, icon, filter
 * grouping, and which store mutation the click routes to.
 */
export type PlayDraftIntent =
  | "approve"
  | "advance"
  | "log"
  | "recover"
  | "archive"
  | "revive"
  | "reopen";

export type PlayDraft =
  | {
      kind: "ready";
      /** Verb phrase for the button label — imperative, ≤3 words. */
      label: string;
      /** Which glyph reads at a glance in the button. */
      icon: PlayDraftIcon;
      /** One-line subtitle — surfaced inside the chat run, not next to the button. */
      subtitle: string;
      /** Drives what happens when the button is pressed. */
      intent: PlayDraftIntent;
    }
  | {
      /** No artifact yet — the play needs the buyer to point at inputs. */
      kind: "needs-input";
      label: string;
      subtitle: string;
    }
  | {
      /** No automated move on this row. */
      kind: "none";
    };

/**
 * Short action-verb label per PlayKind — the buying seat's "Lever" column vocabulary.
 *
 * Kept separate from `KIND_LABEL` so other screens (queues, insights, the
 * command center) can keep the longer noun form. The Opportunities column
 * is a scan column: seven synonyms need to line up as verbs of the same
 * shape so the eye pattern-matches instead of reading.
 */
export const LEVER_LABEL: Record<PlayKind, string> = {
  consolidation: "Consolidate",
  "dual-source": "RFP",
  tariff: "Reclassify",
  terms: "Renegotiate terms",
  freight: "Freight & mode",
  "index-clause": "Index clause",
  "pack-moq": "Pack & MOQ",
  tail: "Tail rationalise",
  "index-hedge": "Index / hedge",
  "make-vs-buy": "Make vs buy",
  rfp: "RFP",
};

/**
 * The Action column's button, keyed by lever — the label is the verb, and the
 * click opens a Mercer chat scoped to the row. Every feed row has one; it is
 * the single AI entry point on the table.
 */
export const LEVER_ACTION: Record<PlayKind, { label: string; blurb: string }> = {
  "index-hedge": { label: "Review index", blurb: "review the commodity price hedge" },
  "make-vs-buy": { label: "Model make vs buy", blurb: "cost internal production against the quote" },
  rfp: { label: "Start RFP", blurb: "open an RFP scope conversation" },
  consolidation: { label: "Draft consolidation", blurb: "draft the vendor-consolidation case" },
  "dual-source": { label: "Start RFP", blurb: "open an RFP scope conversation" },
  tariff: { label: "Review reclass", blurb: "review the tariff reclassification" },
  terms: { label: "Review terms", blurb: "open the payment-terms round" },
  freight: { label: "Review freight", blurb: "review the lane and mode" },
  "index-clause": { label: "Review index", blurb: "review the index clause" },
  "pack-moq": { label: "Review pack", blurb: "review the pack and MOQ change" },
  tail: { label: "Review tail", blurb: "review the tail rationalisation" },
};

/** The filter value keys used by the column funnel. */
export const DRAFT_FILTER_KEYS = ["ready", "needs-input", "none"] as const;
export type DraftFilterKey = (typeof DRAFT_FILTER_KEYS)[number];

export const DRAFT_FILTER_LABEL: Record<DraftFilterKey, string> = {
  ready: "Ready for Mercer",
  "needs-input": "Needs your input",
  none: "No action",
};

/** Per-kind draft template used only on Feed / Qualifying. */
const READY_BY_KIND: Record<PlayKind, { label: string; icon: PlayDraftIcon; subtitle: string }> = {
  consolidation: { label: "Approve shortlist", icon: "commit", subtitle: "Ranked RFQ ready" },
  "dual-source": { label: "Approve benchmark", icon: "commit", subtitle: "Landed-cost model built" },
  tariff: { label: "Approve reclass", icon: "commit", subtitle: "CBP memo drafted" },
  terms: { label: "Approve terms letter", icon: "send", subtitle: "Draft signed by finance" },
  freight: { label: "Approve lane switch", icon: "send", subtitle: "Carrier quote in hand" },
  "index-clause": { label: "Approve clause", icon: "commit", subtitle: "Contract redline ready" },
  "pack-moq": { label: "Approve MOQ change", icon: "email", subtitle: "Vendor note drafted" },
  tail: { label: "Approve rollup", icon: "commit", subtitle: "Vendor list clustered" },
  "index-hedge": { label: "Approve hedge", icon: "commit", subtitle: "Index clause drafted" },
  "make-vs-buy": { label: "Approve make case", icon: "commit", subtitle: "Cost model built" },
  rfp: { label: "Approve RFP", icon: "send", subtitle: "RFP scope ready" },
};

/**
 * What has Mercer prepared for this play, given its current stage?
 *
 * - Surfaced/Qualifying → the ratification drafts (Approve X).
 * - Accepted (Act) → run the next playbook step.
 * - Committed/Realizing → log this quarter's milestone; if drift is flagged,
 *   run a recovery instead.
 * - Realized → archive & broadcast the win.
 * - Parked → revive to Feed.
 * - Dismissed → reopen to Feed.
 */
export function playDraftFor(p: Play): PlayDraft {
  switch (p.stage) {
    case "surfaced":
    case "qualifying": {
      const template = READY_BY_KIND[p.kind];
      if (!template) return { kind: "none" };
      if (p.confidencePct < 65) {
        return {
          kind: "needs-input",
          label: "Confirm inputs",
          subtitle: `${p.confidencePct}% confidence — basis is ${p.basis}`,
        };
      }
      return { kind: "ready", intent: "approve", ...template };
    }
    case "accepted":
      return {
        kind: "ready",
        intent: "advance",
        label: "Run next step",
        icon: "flag",
        subtitle: `Advance the ${p.effortWeeks}-week playbook`,
      };
    case "committed":
    case "realizing":
      if (p.drift?.flagged) {
        return {
          kind: "ready",
          intent: "recover",
          label: "Approve recovery",
          icon: "commit",
          subtitle: p.drift.note ?? "Recovery move drafted",
        };
      }
      return {
        kind: "ready",
        intent: "log",
        label: "Log this quarter",
        icon: "commit",
        subtitle: "Milestone update pre-filled",
      };
    case "realized":
      return {
        kind: "ready",
        intent: "archive",
        label: "Archive & broadcast",
        icon: "send",
        subtitle: "Win note drafted",
      };
    case "parked":
      return {
        kind: "ready",
        intent: "revive",
        label: "Revive to Feed",
        icon: "flag",
        subtitle: "Return to Feed for reconsideration",
      };
    case "dismissed":
      return {
        kind: "ready",
        intent: "reopen",
        label: "Reopen",
        icon: "flag",
        subtitle: "Put the play back in Feed",
      };
    default:
      return { kind: "none" };
  }
}

/** For grouping into the column funnel + preset chips. */
export function playDraftKey(p: Play): DraftFilterKey {
  return playDraftFor(p).kind;
}

/** Which stage the play lands in after Mercer runs the intent. Drives the
 *  hand-off `continueLink` on the outcome and the toast message copy. */
const NEXT_STAGE_LABEL: Record<PlayDraftIntent, { was: string; now: string; area: string }> = {
  approve: { was: "Surfaced", now: "Accepted", area: "Act" },
  advance: { was: "Accepted", now: "Accepted", area: "Act" },
  log: { was: "Realizing", now: "Realizing", area: "Committed" },
  recover: { was: "Drift flagged", now: "Recovering", area: "Committed" },
  archive: { was: "Realized", now: "Archived", area: "Value realization" },
  revive: { was: "Parked", now: "Surfaced", area: "Feed" },
  reopen: { was: "Rejected", now: "Surfaced", area: "Feed" },
};

/**
 * The narrative run for the chat panel — same shape the queue's rows use.
 *
 * Shapes the steps + outcome to the play's current stage. All runs end
 * settled, and every run carries a `continueLink` in the outcome so the panel
 * can hand the buyer into the tab or page the write landed in — the flow
 * cannot dead-end at the receipt.
 */
export function playTaskFor(p: Play, agent: string): AgentTask | null {
  const d = playDraftFor(p);
  if (d.kind !== "ready") return null;

  const evidence1 = p.evidence[0]?.claim ?? p.summary;
  const evidence1Source = p.evidence[0]?.source ?? "Category book";

  const commonHead = {
    id: p.id,
    label: d.label,
    ask: `${d.label} on ${p.id}`,
    intro: `On it. ${p.title}.`,
    icon: d.icon,
  } as const;

  const stageMove = NEXT_STAGE_LABEL[d.intent];
  const continueLink = handoffFor(p, d.intent);

  if (d.intent === "approve") {
    const primaryRisk = p.risks[0];
    const evidence2 = p.evidence[1]?.claim;
    const evidence2Source = p.evidence[1]?.source ?? "Vendor file";
    const steps = [
      {
        label: "Read the case",
        text:
          `${p.summary} ${p.action} — basis is ${BASIS_LABEL[p.basis].toLowerCase()}, ` +
          `${p.confidencePct}% confidence.`,
        source: `${KIND_LABEL[p.kind]} · ${p.category}`,
      },
      {
        label: "Ran the numbers",
        text:
          `${money(p.recommended)} on the table against ${band(p.savingsLow, p.savingsHigh)} addressable. ` +
          `${evidence1}${evidence2 ? ` ${evidence2}.` : "."}`,
        source: evidence2 ? `${evidence1Source} · ${evidence2Source}` : evidence1Source,
      },
      {
        label: `Drafted the ${d.subtitle.toLowerCase()}`,
        text:
          `${d.subtitle} for ${p.id}${primaryRisk ? `. Called out one risk: ${primaryRisk.toLowerCase()}.` : "."}`,
        source: `${agent} · ${d.label.toLowerCase()}`,
      },
    ];
    return {
      ...commonHead,
      actAt: steps.length,
      steps,
      outcome: {
        kind: "settled",
        title: `${d.label} — moved to Act`,
        lines: [
          `${p.id} · ${p.title} is now under Act with the ${p.effortWeeks}-week playbook seeded.`,
          `${money(p.recommended)} to commit; the tracker is where the figure goes.`,
        ],
        changes: [
          { label: "Stage", was: stageMove.was, now: stageMove.now },
          { label: "To commit", was: "—", now: money(p.recommended) },
        ],
        continueLink,
      },
    };
  }

  if (d.intent === "advance") {
    const steps = [
      {
        label: "Read where the play is",
        text: `${p.id} is ${p.effortWeeks} weeks into ${KIND_LABEL[p.kind].toLowerCase()}. Playbook is seeded; owner is ${p.owner}.`,
        source: "Act tracker",
      },
      {
        label: "Ran the next step",
        text: `${evidence1} — attached to the playbook.`,
        source: evidence1Source,
      },
      {
        label: "Handed the step back",
        text: `Result is on the tracker for ${p.owner} to sign off. The next open step is waiting on the same page.`,
        source: `${agent} · ${d.label.toLowerCase()}`,
      },
    ];
    return {
      ...commonHead,
      actAt: steps.length,
      steps,
      outcome: {
        kind: "settled",
        title: "Next step done — playbook advanced",
        lines: [
          `The result is signed to ${p.id}'s playbook. Nothing else waits on Mercer until the next step is opened.`,
        ],
        continueLink,
      },
    };
  }

  if (d.intent === "log" || d.intent === "recover") {
    const drifted = !!p.drift?.flagged;
    const steps = [
      {
        label: drifted ? "Read the drift" : "Read where realization stands",
        text: drifted
          ? `Drift flagged: ${p.drift?.note ?? "milestone slipping"}. ${money(p.recommended)} committed, tracker behind ramp.`
          : `${money(p.recommended)} committed; the ramp is on schedule. Next milestone is due this quarter.`,
        source: `Value tracker · ${p.id}`,
      },
      {
        label: drifted ? "Drafted the recovery" : "Pre-filled this quarter's log",
        text: drifted
          ? "Recovery move drafted against the drifted milestone — a rebalance to the backup lane with the freight numbers already attached."
          : "This quarter's realization figure is filled and ready to submit. It reads what the tracker recorded, not a fresh estimate.",
        source: `${agent} · ${d.label.toLowerCase()}`,
      },
    ];
    return {
      ...commonHead,
      actAt: steps.length,
      steps,
      outcome: {
        kind: "settled",
        title: drifted ? "Recovery drafted — waiting on you" : "Quarterly log ready",
        lines: [
          drifted
            ? `${p.id} · Recovery is ready to submit. Approving it stops the drift as of this week; declining leaves the milestone slipping.`
            : `${p.id} · The quarterly figure is queued on the tracker. One click on the page publishes it.`,
        ],
        continueLink,
      },
    };
  }

  if (d.intent === "archive") {
    const steps = [
      {
        label: "Read the closed play",
        text: `${p.id} is realized. ${money(p.recommended)} landed against the committed figure.`,
        source: `Value tracker · ${p.id}`,
      },
      {
        label: "Drafted the win note",
        text: "A short internal note is ready with the number, the vendor lift, and the person who ran it.",
        source: `${agent} · win note`,
      },
    ];
    return {
      ...commonHead,
      actAt: steps.length,
      steps,
      outcome: {
        kind: "settled",
        title: "Win drafted — ready to broadcast",
        lines: [`${p.id} · The note is ready on the value page. One click sends it to the category channel.`],
        continueLink,
      },
    };
  }

  if (d.intent === "revive" || d.intent === "reopen") {
    const parked = d.intent === "revive";
    const steps = [
      {
        label: parked ? "Read the parked note" : "Read the dismissal note",
        text: p.dismissReason
          ? `Noted as: "${p.dismissReason}".`
          : parked
          ? "Parked without a reason — treating as 'right play, wrong quarter'."
          : "Dismissed without a reason — treating as 'not taken this cycle'.",
        source: `${p.id} · notes`,
      },
      {
        label: parked ? "Refreshed the case" : "Rechecked the case",
        text: `${p.summary} Basis is still ${BASIS_LABEL[p.basis].toLowerCase()}. ${p.confidencePct}% confidence at last sweep.`,
        source: `${KIND_LABEL[p.kind]} · ${p.category}`,
      },
    ];
    return {
      ...commonHead,
      actAt: steps.length,
      steps,
      outcome: {
        kind: "settled",
        title: parked ? "Revived to Feed" : "Reopened in Feed",
        lines: [
          `${p.id} · ${p.title} is back in the Feed for another look. Its previous decision is on the record; nothing was lost.`,
        ],
        changes: [{ label: "Stage", was: stageMove.was, now: stageMove.now }],
        continueLink,
      },
    };
  }

  return null;
}

/** Route the outcome's hand-off link to the tab or page the write landed in. */
function handoffFor(
  p: Play,
  intent: PlayDraftIntent,
): { label: string; href: string } {
  switch (intent) {
    case "approve":
      return { label: "Continue in Act", href: playRoute(p.id) };
    case "advance":
      return { label: "Open the playbook", href: playRoute(p.id) };
    case "log":
    case "recover":
      return { label: "Open value realization", href: BUYING_ROUTES.value };
    case "archive":
      return { label: "Open value realization", href: BUYING_ROUTES.value };
    case "revive":
    case "reopen":
      return { label: "Back to Feed", href: BUYING_ROUTES.opportunities };
  }
}

/** Stage a play should move to after Mercer runs the given intent. Called
 *  from the row-click so the visible state matches the outcome the panel
 *  narrates. */
export function stageAfterIntent(
  intent: PlayDraftIntent,
  currentStage: PlayStage,
): PlayStage {
  if (intent === "approve") return "accepted";
  if (intent === "revive" || intent === "reopen") return "surfaced";
  if (intent === "archive") return "realized";
  if (intent === "recover") return "realizing";
  return currentStage;
}
