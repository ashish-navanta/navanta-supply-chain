/* ═══════════════════════════════════════════════════════════════
 *  Approving what IRIS proposed about a position
 *
 *  The buying seat's tasks are AUTHORED — a capped line at Luen Hing, a
 *  purchase order nobody has answered — and each one carries a written
 *  account of a real situation, down to the phone call that caused it.
 *  There are seven of them.
 *
 *  Inventory Planning has 105 positions, and there is no writing them.
 *  So this builds the task from the row, and the rule it keeps is that
 *  every line it narrates is arithmetic the row already contains: the
 *  cover, the buffer against the class, what the buying desk already
 *  has travelling, the gap between them. Nothing here says the agent
 *  rang anybody, because on a generated position it did not, and a run
 *  that invents a phone call is a run whose receipts have to be read in
 *  full every time — which defeats the point of a receipt.
 *
 *  `actAt` is the load-bearing field. Everything before it is the agent
 *  reading, and it runs unasked because it is what produced the
 *  proposal. Everything from it changes a record and waits for the
 *  press. See AgentTask.
 * ═══════════════════════════════════════════════════════════════ */

import type { AgentTask } from "@/data/agent-actions";
import { excessOf, isShort, otherDc, targetStock, type Exception } from "@/data/planning";

/* No reference number here, deliberately. A requisition is raised by the buying
   desk and a transfer order is cut by logistics — the planner approves a
   quantity, and numbering it REQ-4371 in this transcript claimed a document
   that does not exist yet and would carry a different number when it did. */

/**
 * The task the Approve button runs.
 *
 * Two shapes, because a position breaches its policy in two directions: short
 * of the buffer, which is a raise, or over it, which is stock to move out. The
 * words differ and the arithmetic differs; the structure does not.
 */
export function approvalTaskFor(e: Exception): AgentTask {
  const short = isShort(e);
  const pct = (e.confidence * 100).toFixed(0);
  const to = e.transferTo ?? otherDc(e.branch);
  const target = targetStock(e);

  return {
    id: e.key,
    /* Approved, not merely settled — Inventory Planning has an Approved tab and
       a Watchlist, and the row has to know which one it just joined. */
    settleBucket: "approved",
    label: e.recommendedAction,
    /* First person, because the press IS the person asking. The panel prints
       this as their turn in the transcript. */
    /* One statement of the move. It used to append the recommendation
       lower-cased, which said the quantity twice and turned Luen Hing
       Housewares into "luen hing housewares" — "Approve 67 units — request 67
       from luen hing housewares on HH5605-6473". The supplier is a proper noun
       and the figure only needs saying once. */
    ask: short
      ? `Approve ${e.requestedQty} units from ${e.vendor} on ${e.sku} at ${e.branch}.`
      : `Transfer ${e.requestedQty} units to ${to} from ${e.sku} at ${e.branch}.`,
    /* One clause. The deck made the case before the press — five factors, the
       waterfall, the trajectory — so repeating it here is the agent explaining a
       decision back to the person who just made it. */
    intro: short
      ? `${target - e.onHand - e.incoming} units under target. Sending ${e.requestedQty} to buying.`
      : `${excessOf(e)} units over target. Moving ${e.requestedQty} to ${to}.`,
    icon: "commit",

    /* ── Two reads, then the write ────────────────────────────
       It used to be four reads and two writes, which is nine seconds of
       narration for a decision the reader had already made by pressing the
       button. The deck is where the working lives now — five factors, a
       waterfall, a trajectory and the policy, all of it available before the
       press. So the run's job is not to re-argue the case: it is to confirm
       what it read, do the one thing, and show what changed. */
    actAt: 2,
    steps: [
      {
        label: `Re-read the position at ${e.branch}`,
        text: `${e.onHand} on hand, ${e.incoming} inbound, ${e.demandMean.toFixed(1)} a day against a ${target}-carton target. Unchanged since the deck was drawn.`,
        source: `Stocking policy · ${e.sku}@${e.branch}`,
      },
      {
        label: short ? "Confirm the gap" : "Confirm the surplus",
        text: short
          ? `${target - e.onHand - e.incoming} units short of target at ${pct}% confidence.`
          : `${excessOf(e)} units above target at ${pct}% confidence.`,
        source: "IRIS · replenishment model",
      },
      {
        label: short
          ? `Send ${e.requestedQty} units to the buying desk`
          : `Send the transfer to logistics — ${e.branch} to ${to}`,
        text: short
          ? `Approved as demand, suggested source ${e.vendor}. Buying raises the requisition and places it.`
          : `Approved to move. Logistics cuts the transfer order and books the lane.`,
        source: short ? "Buying · requisition queue" : "Logistics · transfer queue",
      },
    ],

    outcome: {
      /* Open, not settled: it ends with a request on somebody else's desk and
         the units do not exist until they act. */
      kind: "open",
      /* Just the fact. Whose desk it sits on is the line below and the receipt
         row underneath that — saying it a third time in the headline made the
         card's first line the longest thing on it. */
      title: `${e.requestedQty} units approved`,
      /* One line. The case was made in the deck; this says what happens next
         and nothing else. The old copy re-derived the whole sum and closed on
         "which meets its 443-carton target" — which is true by construction,
         since the quantity was computed to meet it, and reads as an insight
         that is really a tautology. */
      lines: [
        short
          ? `${e.vendor} is the suggested source. Nothing is committed until buying places it.`
          : `${to} takes it without a new order. Nothing moves until logistics books the lane.`,
      ],
      /* Three cards, in the order a reader checks them: how the number was
         reached, what it does to the line, and what was actually written. Both
         are the deck's own panels keyed on this position, so the run cannot
         derive the sum or draw the chart a second way. */
      artifacts: [
        { kind: "math", positionKey: e.key },
        { kind: "trajectory", positionKey: e.key },
      ],
      changesTitle: short ? "Approved" : "Approved for transfer",
      /* Two rows, and neither reports a "was" — nothing was replaced, a
         quantity was approved and handed on. Days of cover came out: the
         trajectory card above draws that, and a figure that is also a picture
         two cards up is the receipt repeating the argument. */
      changes: [
        { label: "Approved quantity", was: "—", now: `${e.requestedQty} units` },
        { label: "Sits with", was: "—", now: short ? "Buying · Mercer" : "Logistics · Tova" },
      ],
      /* Noticed, not done. The button named one thing, so one thing happened. */
      suggestion: e.overridden
        ? {
            title: "This position is on a manual policy",
            body: `Its stocking policy was overridden to order-to-demand${e.overriddenAt ? ` on ${e.overriddenAt}` : ""}, so IRIS is not managing the reorder point here. It will breach again on the same cycle until the override is lifted.`,
          }
        : undefined,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Why a position was settled without a planner
 *
 *  The Auto-routed tab used to carry an "Iris Insight" column that
 *  said "Auto-approved · all gates cleared" on every row — a claim
 *  with no way to check it, which is the one thing an auto-approval
 *  must never be. A reader asked to trust nine of these has to be
 *  able to open one.
 *
 *  So the column is an action now, and this is what it opens: the
 *  gate, step by step, in the order the engine walked it. Every line
 *  is the row's own arithmetic — the score, the two bands it falls
 *  in, the cell of the routing grid they select, and the quantity
 *  that fell out. Nothing is asserted that the row does not contain.
 *
 *  No `actAt`: nothing here writes. It already happened, and this is
 *  the receipt rather than the act.
 * ═══════════════════════════════════════════════════════════════ */

import {
  CONFIDENCE_WEIGHTS,
  ROUTING_GRID,
  STOCKING_POLICY_META,
  confidenceBand,
  riskBand,
  segmentMeaning,
} from "@/data/planning";

/**
 * The band at which this row would have come to a planner.
 *
 * Walks down its own column of the grid rather than quoting a threshold: the cut
 * that matters depends on the risk, because high confidence clears every risk and
 * a column can turn manual one row sooner than the reader expects.
 */
function escape(cRow: 0 | 1 | 2, rCol: 0 | 1 | 2): string {
  const opens = ["96%", "93%", "0%"];
  for (let row = cRow + 1; row < ROUTING_GRID.initial.length; row += 1) {
    if (ROUTING_GRID.initial[row][rCol] === "manual") {
      return `Nothing waited on a planner because nothing was in doubt. Below ${opens[row - 1]} confidence at this severity it would have come to you instead.`;
    }
  }
  return `Nothing waited on a planner because nothing was in doubt. At ${ROUTING_GRID.colHeaders[rCol].toLowerCase()} this grid auto-routes at every confidence band, so no score would have sent it to you — only a policy change would.`;
}

/* ═══════════════════════════════════════════════════════════════
 *  The gate, as a list of criteria rather than a sentence
 *
 *  "Auto-approved · all gates cleared" was the claim this whole flow
 *  exists to replace, and a run that narrates the walk in prose is only
 *  a longer version of the same ask: believe me. A criterion is
 *  checkable when the reader can see the rule, the number this position
 *  measured, and which way the comparison went.
 *
 *  All four are the engine's own, and every threshold quoted here is
 *  read from the policy rather than restated: the band openings from
 *  `confidenceBand`, the cell from `ROUTING_GRID`, the fill-rate and
 *  exposure cuts from `severityFor`. Nothing is a gate that the engine
 *  does not actually apply — a list padded with checks nobody performs
 *  is the original claim with more rows.
 * ═══════════════════════════════════════════════════════════════ */

export interface Gate {
  name: string;
  /** The rule, with the number it turns on. */
  criterion: string;
  /** What this position measured against it. */
  measured: string;
  cleared: boolean;
}

/** Where each confidence band opens — the cuts `confidenceBand` applies. */
const BAND_OPENS = [96, 93, 0];

/** $86,000 → "$86K", for a criterion that has to fit a 300px panel. */
function k(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

/**
 * Why this position sits in the risk column it does.
 *
 * `severityFor` is two comparisons on fill rate and exposure, so the criterion
 * names the clause that actually fired rather than reciting all three tiers.
 * Elevated fires on either condition and can fire on both, which is why the
 * text is built from what is true here rather than fixed per tier.
 */
function severityCriterion(e: Exception): string {
  const fill = `${(e.fillRate * 100).toFixed(1)}% fill`;
  const money = `${k(e.dollarsAtRisk)} exposed`;
  if (e.severity === "critical") {
    return `Critical below 90% fill with over $60K exposed — ${fill}, ${money}`;
  }
  if (e.severity === "elevated") {
    const low = e.fillRate < 0.95;
    const rich = e.dollarsAtRisk > 25_000;
    const why = low && rich ? `${fill} and ${money}` : low ? fill : money;
    return `Elevated below 95% fill or over $25K exposed — ${why}`;
  }
  return `Healthy at 95% fill or better and under $25K — ${fill}, ${money}`;
}

/** The four criteria the engine applied to this position, in the order it applied them. */
export function gatesFor(e: Exception): Gate[] {
  const cRow = confidenceBand(e.confidence);
  const rCol = riskBand(e.severity);
  const cell = ROUTING_GRID.initial[cRow][rCol];

  return [
    {
      name: "Confidence score",
      criterion: `${ROUTING_GRID.rowHeaders[cRow]} opens at ${BAND_OPENS[cRow]}.0%`,
      measured: `${(e.confidence * 100).toFixed(1)}%`,
      /* True by construction — the band is derived FROM the score, so a score
         cannot fall outside the band it selected. Stated anyway, because the
         reader's question is which band and how far into it. */
      cleared: true,
    },
    {
      name: "Severity",
      criterion: severityCriterion(e),
      measured: ROUTING_GRID.colHeaders[rCol],
      cleared: true,
    },
    {
      name: "Routing cell",
      criterion: `${ROUTING_GRID.rowHeaders[cRow]} × ${ROUTING_GRID.colHeaders[rCol]}`,
      measured: cell === "auto" ? "Auto" : "Manual",
      cleared: cell === "auto",
    },
    {
      name: "Stocking policy",
      /* The one gate that can fail on a row that still auto-routed, and it does
         on a few of the auto-routed book: the grid decides routing on confidence and
         severity alone, so an overridden policy does not stop it. That is worth
         a planner seeing rather than smoothing over — IRIS is not managing the
         reorder point on those, and the position will breach again on the same
         cycle until the override is lifted. */
      criterion: e.overridden
        ? `Overridden to ${STOCKING_POLICY_META[e.currentPolicy].label.toLowerCase()}${e.overriddenAt ? ` on ${e.overriddenAt}` : ""} — IRIS is not managing the reorder point`
        : `IRIS-managed, no manual override in force`,
      /* The policy's own label, not its key — `currentPolicy` is an enum and
         "stock-1" is a value in the model, not a thing a planner calls it. */
      measured: e.overridden ? "Overridden" : STOCKING_POLICY_META[e.currentPolicy].label,
      cleared: !e.overridden,
    },
  ];
}

export function autoRouteTaskFor(e: Exception): AgentTask {
  const pct = (e.confidence * 100).toFixed(1);
  const cRow = confidenceBand(e.confidence);
  const rCol = riskBand(e.severity);
  const target = targetStock(e);
  const short = isShort(e);
  const gap = short ? target - e.onHand - e.incoming : excessOf(e);
  const gates = gatesFor(e);
  const flagged = gates.filter((g) => !g.cleared);

  return {
    id: `auto-${e.key}`,
    label: "Review",
    ask: `Why was ${e.sku} at ${e.branch} approved without me?`,
    intro: `Because it cleared the gate. ${ROUTING_GRID.rowHeaders[cRow].toLowerCase()} on ${ROUTING_GRID.colHeaders[rCol].toLowerCase()} routes itself.`,
    icon: "flag",
    /* Past the last step, so nothing in this run waits for a press. Everything
       here already happened — the run is the receipt, not the act. */
    actAt: 4,
    steps: [
      {
        label: "Scored the position",
        /* The five weights are IRIS's own — naming them is what makes the
           number checkable rather than a figure to be believed. */
        text: `${pct}% confidence, weighted across ${CONFIDENCE_WEIGHTS.length} factors: ${CONFIDENCE_WEIGHTS.map(
          (w) => `${w.name.toLowerCase()} ${w.pct}%`,
        ).join(", ")}.`,
        source: `IRIS · confidence model`,
      },
      {
        /* One step, not two. It used to place the score on the grid and then read
           the cell, which is the Gates table below said twice in prose — and the
           table is the better place for it, since a criterion the reader can see
           the threshold and the measurement for does not need narrating. */
        label: "Walked the gate",
        text: `${gates.length} criteria: ${pct}% is ${ROUTING_GRID.rowHeaders[cRow].toLowerCase()} against a ${
          BAND_OPENS[cRow]
        }.0% opening, severity ${e.severity} is ${ROUTING_GRID.colHeaders[
          rCol
        ].toLowerCase()}, and that cell reads ${ROUTING_GRID.initial[cRow][rCol]}. ${
          flagged.length === 0
            ? "All four cleared."
            : `${gates.length - flagged.length} cleared, ${flagged.length} flagged — see ${flagged
                .map((g) => g.name.toLowerCase())
                .join(" and ")}.`
        }`,
        source: `Policy · ${e.classification} · ${segmentMeaning(e.classification)}`,
      },
      {
        label: "Sized what it approved",
        text: short
          ? `${e.onHand} on hand and ${e.incoming} inbound against a ${target}-carton target — ${gap} short, so ${e.requestedQty} to ${e.vendor}.`
          : `${e.onHand} on hand against a ${target}-carton target — ${gap} over, so ${e.requestedQty} to ${e.transferTo ?? otherDc(e.branch)}.`,
        source: `Stocking policy · ${e.sku}@${e.branch}`,
      },
    ],
    outcome: {
      kind: "settled",
      title: `Cleared on ${ROUTING_GRID.rowHeaders[cRow].toLowerCase()}, ${ROUTING_GRID.colHeaders[rCol].toLowerCase()}`,
      /* What it would have taken to reach a planner, which is the only thing left
         for a reader who disagrees with the outcome — and it is derived, not
         asserted. The first version said "under 96%" on every row, which is wrong
         wherever the grid auto-routes at med confidence: this position is med on
         high risk and still cleared, so 96 was never its gate. `escape` walks the
         column and finds the band that actually breaks it. */
      lines: [escape(cRow, rCol)],
      /* Gates first. The question this run answers is "why was this approved
         without me", and the criteria ARE the answer — the calculation and the
         trajectory argue for the quantity, which is the second question. */
      artifacts: [
        { kind: "gates", positionKey: e.key },
        { kind: "math", positionKey: e.key },
        { kind: "trajectory", positionKey: e.key },
      ],
      changesTitle: "What the engine wrote",
      changes: [
        { label: "Routed", was: "—", now: "Auto · no planner" },
        { label: "Approved quantity", was: "—", now: `${e.requestedQty} units` },
        { label: "Sits with", was: "—", now: short ? "Buying · Mercer" : "Logistics · Tova" },
      ],
      prompts: [
        "What would have sent this to me?",
        "Which cells are critical?",
        "How is A cut?",
      ],
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Overriding what the policy proposed
 *
 *  The old override run drafted a cost-compare card and stopped —
 *  three rows of "Today" against "Policy says" that were identical
 *  in every column, because nothing had changed yet. It showed the
 *  position it was about to override rather than letting anybody
 *  override it.
 *
 *  A planner overriding a quantity is doing two things: naming a
 *  different figure, and saying why. Both go on the record, and the
 *  reason is the half that matters — it is what the next planner
 *  reads when the position breaches again on the same cycle.
 *
 *  Same outcome card as an approval, deliberately, because it is the
 *  same kind of act: a quantity approved and handed on. What it does
 *  NOT carry is the calculation and the trajectory. Those argue for
 *  the figure the policy proposed, and this run exists because the
 *  planner disagreed with it — showing the model's own case under a
 *  decision that overruled it reads as the agent arguing back.
 * ═══════════════════════════════════════════════════════════════ */

export function overrideTaskFor(e: Exception, qty: number, reason: string): AgentTask {
  const short = isShort(e);
  const to = e.transferTo ?? otherDc(e.branch);
  const delta = qty - e.requestedQty;

  return {
    id: `override-${e.key}`,
    settleBucket: "approved",
    label: `Override to ${qty}`,
    /* The planner's own words, because the press was theirs — the figure and the
       reason in one line, which is what the record will hold. */
    ask: `Override ${e.sku} at ${e.branch} to ${qty} units — ${reason}.`,
    intro:
      delta === 0
        ? `Same quantity, reason recorded. Sending ${qty} to ${short ? "buying" : "logistics"}.`
        : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} on the policy figure. Sending ${qty} to ${short ? "buying" : "logistics"}.`,
    icon: "flag",
    /* One read then the write. The planner has already decided; re-arguing the
       position would be the agent explaining a decision back to the person who
       just made it. */
    actAt: 1,
    steps: [
      {
        label: "Recorded the override",
        text: `Policy proposed ${e.requestedQty}; you set ${qty}. Reason on the line: "${reason}".`,
        source: `Stocking policy · ${e.sku}@${e.branch}`,
      },
      {
        label: short
          ? `Send ${qty} units to the buying desk`
          : `Send the transfer to logistics — ${e.branch} to ${to}`,
        text: short
          ? `Overridden as demand, suggested source ${e.vendor}. Buying raises the requisition and places it.`
          : `Overridden to move. Logistics cuts the transfer order and books the lane.`,
        source: short ? "Buying · requisition queue" : "Logistics · transfer queue",
      },
    ],
    outcome: {
      kind: "open",
      title: `${qty} units overridden`,
      lines: [
        short
          ? `${e.vendor} is the suggested source. Nothing is committed until buying places it.`
          : `${to} takes it without a new order. Nothing moves until logistics books the lane.`,
      ],
      /* No artifacts. The calculation and the trajectory make the case for the
         figure this run just overruled. */
      changesTitle: "Overridden",
      /* The only run on this seat whose changes carry a "was" — an override
         replaces a figure, where an approval accepts one. */
      changes: [
        { label: "Approved quantity", was: `${e.requestedQty} units`, now: `${qty} units` },
        { label: "Reason on the record", was: "—", now: reason },
        { label: "Sits with", was: "—", now: short ? "Buying · Mercer" : "Logistics · Tova" },
      ],
      prompts: [
        "Why was it cut from the asked figure?",
        "What happens if we do nothing?",
        "Which cells are critical?",
      ],
    },
  };
}
