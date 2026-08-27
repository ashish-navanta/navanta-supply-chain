/**
 * Per-supplier "Mercer next move" descriptors.
 *
 * Mirrors `play-drafts.ts` for the Suppliers page. Each supplier gets one
 * button drawn from its actual state (slipping lead time, missing terms,
 * consolidation posture, etc.), and the button opens the same Mercer chat
 * run the queue and the Opportunities column use.
 *
 * Deliberately a pure lookup — no store, no per-row runtime — so a supplier
 * row can describe its own next move without the screen having to know why.
 */
import type { Supplier, SupplierStatus } from "@/data/buying";
import { SUPPLIER_STATUS_LABEL, money } from "@/data/buying";
import type { AgentTask } from "@/data/agent-actions";
import { BUYING_ROUTES } from "@/data/nav";

/** Matches the queue's icon vocabulary. */
export type SupplierDraftIcon = "commit" | "email" | "send" | "flag" | "call";

/** Every branch this column knows how to render. */
export type SupplierDraftIntent =
  | "chase"
  | "terms"
  | "consolidate"
  | "shortlist"
  | "exit"
  | "score";

export type SupplierDraft =
  | {
      kind: "ready";
      label: string;
      icon: SupplierDraftIcon;
      subtitle: string;
      intent: SupplierDraftIntent;
    }
  | { kind: "none" };

export const SUPPLIER_DRAFT_FILTER_KEYS = ["ready", "none"] as const;
export type SupplierDraftFilterKey = (typeof SUPPLIER_DRAFT_FILTER_KEYS)[number];

export const SUPPLIER_DRAFT_FILTER_LABEL: Record<SupplierDraftFilterKey, string> = {
  ready: "Ready for Mercer",
  none: "No action",
};

/**
 * Read a supplier and return the row's next move. Order matters — the first
 * branch that fits wins, because a slipping supplier who *also* has a terms
 * gap is a chase before it is a terms letter: the chase carries the terms
 * question, but the terms letter cannot be sent while the vendor has not
 * confirmed a date.
 */
export function supplierDraftFor(s: Supplier): SupplierDraft {
  /* Target-operated or dedicated lines — internal capacity is a schedule
     question, not a supplier one. No outbound CTA. */
  if (s.own) return { kind: "none" };

  if (s.leadTimeTrend === "slipping") {
    return {
      kind: "ready",
      intent: "chase",
      label: "Send chase",
      icon: "send",
      subtitle: `Chase drafted for ${s.name} · lead time ${s.quotedLeadDays}d`,
    };
  }
  if (s.paymentTermsDays === null) {
    return {
      kind: "ready",
      intent: "terms",
      label: "Send terms letter",
      icon: "send",
      subtitle: "Net 60 letter signed by finance",
    };
  }
  if (s.status === "consolidation-target") {
    return {
      kind: "ready",
      intent: "consolidate",
      label: "Score for consolidation",
      icon: "commit",
      subtitle: "Benchmark model + shortlist ranked",
    };
  }
  if (s.status === "dual-source-candidate") {
    return {
      kind: "ready",
      intent: "shortlist",
      label: "Add to shortlist",
      icon: "commit",
      subtitle: "RFQ package ready",
    };
  }
  if (s.status === "exit-planned") {
    return {
      kind: "ready",
      intent: "exit",
      label: "Confirm exit plan",
      icon: "flag",
      subtitle: "Exit timeline drafted",
    };
  }
  /* Preferred / active healthy suppliers — quiet CTA, still useful. */
  return {
    kind: "ready",
    intent: "score",
    label: "Score the book",
    icon: "commit",
    subtitle: "Benchmark rescore",
  };
}

/** For grouping into the column funnel. */
export function supplierDraftKey(s: Supplier): SupplierDraftFilterKey {
  return supplierDraftFor(s).kind;
}

/* ── Preset filters (toolbar dropdown, right of search) ────────────────── */

export type SupplierPresetId =
  | "ready-to-chase"
  | "terms-gaps"
  | "consolidation-targets"
  | "watchlist";

export type SupplierPreset = {
  id: SupplierPresetId;
  label: string;
  match: (s: Supplier) => boolean;
};

export const SUPPLIER_PRESETS: SupplierPreset[] = [
  {
    id: "ready-to-chase",
    label: "Ready to chase",
    match: (s) => !s.own && s.leadTimeTrend === "slipping",
  },
  {
    id: "terms-gaps",
    label: "Terms gaps",
    match: (s) => !s.own && s.paymentTermsDays === null,
  },
  {
    id: "consolidation-targets",
    label: "Consolidation targets",
    match: (s) => s.status === "consolidation-target",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    match: (s) =>
      s.leadTimeTrend === "slipping" ||
      s.status === "consolidation-target" ||
      s.status === "dual-source-candidate" ||
      s.status === "exit-planned" ||
      (!s.own && s.paymentTermsDays === null),
  },
];

/* ── Chat panel task builder ───────────────────────────────────────────── */

/** Hand-off destination for the outcome card's Continue link, per intent.
 *  Every path lands on the supplier's own record modal — same idea as the
 *  Opportunities `?play=` deep link. The chat panel narrates the run; the
 *  record modal is where the drafted artifact lives for a final read + Send. */
function handoffFor(
  intent: SupplierDraftIntent,
  supplierId: string,
): { label: string; href: string } {
  const href = `${BUYING_ROUTES.suppliers}?supplier=${encodeURIComponent(supplierId)}`;
  switch (intent) {
    case "chase":
      return { label: "Open chase draft", href };
    case "terms":
      return { label: "Open terms letter", href };
    case "consolidate":
    case "shortlist":
      return { label: "Open the shortlist", href };
    case "exit":
      return { label: "Open exit plan", href };
    case "score":
      return { label: "Open the record", href };
  }
}

/** Copy templates per intent — the narrated steps + settled outcome. */
const STEPS_BY_INTENT: Record<
  SupplierDraftIntent,
  (s: Supplier) => { steps: AgentTask["steps"]; outcomeTitle: string; outcomeLine: string }
> = {
  chase: (s) => ({
    steps: [
      {
        label: "Read the last four quarters",
        text: `${s.name} is quoting ${s.quotedLeadDays} days, up from where they held. OTIF ${s.otifPct}% on ${money(s.annualSpend)} of business. The trend is what earned the chase.`,
        source: `Supplier record · ${s.id}`,
      },
      {
        label: "Drafted the chase",
        text: `A one-page mail to ${s.name} asking for the ETA and the reason the line moved. Signed by category, ready to go under your name.`,
        source: `Mercer · chase draft`,
      },
    ],
    outcomeTitle: "Chase drafted — ready to send",
    outcomeLine: `${s.name}: the mail is queued in the outbox and their PO refs are attached. Sending it opens the ETA question with them.`,
  }),
  terms: (s) => ({
    steps: [
      {
        label: "Read what is on file",
        text: `${s.name} has ${SUPPLIER_STATUS_LABEL[s.status].toLowerCase()} standing and no payment term recorded. The Net 60 play is blocked until the letter is countersigned.`,
        source: `Supplier record · ${s.id}`,
      },
      {
        label: "Drafted the terms letter",
        text: `Net 60 letter drafted against the master supply agreement, signed by finance, addressed to the commercial contact of record.`,
        source: `Mercer · terms letter`,
      },
    ],
    outcomeTitle: "Terms letter — ready to send",
    outcomeLine: `${s.name}: letter is in the outbox with finance's signature. Sending it opens Net 60 negotiation formally.`,
  }),
  consolidate: (s) => ({
    steps: [
      {
        label: "Read the category share",
        text: `${s.name} holds ${s.categoryShare}% of ${s.categories[0]}. The book carries this vendor plus two others at similar share — the case for one carrying more of the volume is arithmetic.`,
        source: `Category book · ${s.categories[0]}`,
      },
      {
        label: "Ran the benchmark",
        text: `Landed-cost model across the three suppliers with a ranked shortlist attached. ${s.name} sits second on the scorecard.`,
        source: `Mercer · benchmark model`,
      },
    ],
    outcomeTitle: "Benchmark ready — shortlist ranked",
    outcomeLine: `${s.name} · Consolidation shortlist is on the supplier page. Signing off carries the play into Act.`,
  }),
  shortlist: (s) => ({
    steps: [
      {
        label: "Read the dual-source posture",
        text: `${s.name} is on the dual-source watch — a working relationship, and the single-source risk on ${s.categories[0]} is the reason.`,
        source: `Supplier record · ${s.id}`,
      },
      {
        label: "Packed the RFQ",
        text: `RFQ package with volumes, spec sheets, and the delivery window Target Sourcing Services asks for. Ready to send to the shortlisted set.`,
        source: `Mercer · RFQ package`,
      },
    ],
    outcomeTitle: "Shortlist ready — RFQ packed",
    outcomeLine: `${s.name}: added to the dual-source shortlist. The RFQ can go once the second name is agreed.`,
  }),
  exit: (s) => ({
    steps: [
      {
        label: "Read the exit posture",
        text: `${s.name} is on exit — the case has been made, the alternative is on the shortlist, and the window to wind the volume down needs a date.`,
        source: `Supplier record · ${s.id}`,
      },
      {
        label: "Drafted the exit timeline",
        text: `Three-quarter timeline against current PO cover, with the last committed order and the handover date to the successor vendor.`,
        source: `Mercer · exit timeline`,
      },
    ],
    outcomeTitle: "Exit timeline drafted",
    outcomeLine: `${s.name}: timeline is on the supplier page. Confirming it publishes the wind-down to procurement and finance.`,
  }),
  score: (s) => ({
    steps: [
      {
        label: "Refreshed the scorecard",
        text: `${s.name} scored ${s.score}. Cost, delivery, quality, resilience and terms all re-run against the last four quarters.`,
        source: `Supplier record · ${s.id}`,
      },
      {
        label: "Wrote the score to the record",
        text: `The composite figure and each of the five lines are on the supplier page. Nothing else moved on the record.`,
        source: `Mercer · scorecard`,
      },
    ],
    outcomeTitle: "Scorecard refreshed",
    outcomeLine: `${s.name}: the composite figure is current. Nothing else changed.`,
  }),
};

/**
 * The narrated run for the chat panel. All runs are ratifications of a
 * pre-worked artifact — no consent-mid-run, no store side effect. The write
 * is symbolic; the panel is the receipt.
 */
export function supplierTaskFor(s: Supplier, agent: string): AgentTask | null {
  const d = supplierDraftFor(s);
  if (d.kind !== "ready") return null;

  const { steps, outcomeTitle, outcomeLine } = STEPS_BY_INTENT[d.intent](s);
  return {
    id: s.id,
    label: d.label,
    ask: `${d.label} on ${s.name}`,
    intro: `On it. ${s.name}.`,
    icon: d.icon,
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: outcomeTitle,
      lines: [outcomeLine],
      continueLink: handoffFor(d.intent, s.id),
      undo: {
        label: "Withdraw draft",
        onUndo: () => {
          /* Symbolic — no supplier store. Withdrawing removes the receipt
             from the transcript and hides the Continue link. */
        },
      },
    },
  };
}
