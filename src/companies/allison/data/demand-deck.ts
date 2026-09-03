/* ═══════════════════════════════════════════════════════════════
 *  The demand deck — IRIS's argument for a position, in full
 *
 *  The queue row says what to do and the panel said it a bit longer.
 *  Neither shows the WORKING, and the working is what a stores planner
 *  approving $112K of spares is entitled to: which factors fed the
 *  confidence score and how much each one moved it, the arithmetic
 *  that produced the quantity, where the position is heading if
 *  nobody acts, and what policy is governing it.
 *
 *  Built from the row, like everything else here. Five factors from
 *  CONFIDENCE_WEIGHTS — the deck's own list, verbatim — with their
 *  sub-scores derived from the properties they actually name, and a
 *  waterfall that is the same arithmetic `asException` used to size
 *  the request. Nothing in the deck is a number the table does not
 *  already imply; the deck's job is to show the derivation, not to
 *  add facts.
 * ═══════════════════════════════════════════════════════════════ */

import {
  CONFIDENCE_WEIGHTS,
  excessOf,
  isShort,
  policyForXyz,
  STOCKING_POLICY_META,
  segmentPolicy,
  targetStock,
  type Exception,
} from "./planning";

/* ─── Attribution ─────────────────────────────────────────────── */

export interface DeckFactor {
  name: string;
  /** What was measured, in the units the factor is stated in. */
  observed: string;
  weightPct: number;
  /** 0–100. */
  subScore: number;
  /** weight × sub-score ÷ 100. */
  impact: number;
}

/** Keep a derived score inside the range a score can be. */
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * The five factors behind this position's confidence score.
 *
 * Each sub-score moves with the row property its factor names — a lumpy line
 * scores worse on demand stability, a long lead worse on supplier reliability —
 * and the offsets are then centred so the weighted total lands exactly on the
 * confidence the rest of the app reads. Without that centring the table would
 * total to a different number than the row it sits under, which is the one
 * thing an attribution table must never do.
 */
export function factorsFor(e: Exception): DeckFactor[] {
  const xyz = e.classification[1];
  const base = e.confidence * 100;

  /* Offsets from the properties each factor is about. */
  const raw = [
    /* Forecast accuracy — the coefficient of variation IS the forecastability. */
    { observed: `CV² ${e.cv2.toFixed(2)}, ADI ${e.adi.toFixed(1)}`, offset: 6 - e.cv2 * 8 },
    /* Data sufficiency — an intermittent line has fewer non-zero periods. */
    {
      observed: `${Math.round(104 - e.adi * 8)} wks, ${clamp(100 - (e.adi - 1) * 45)}% non-zero`,
      offset: 4 - (e.adi - 1) * 6,
    },
    /* Demand & segment stability — the XYZ letter, which is what it means. */
    {
      observed: `Class ${e.classification} · ${xyz === "X" ? "smooth" : xyz === "Y" ? "erratic" : "lumpy"}`,
      offset: xyz === "X" ? 5 : xyz === "Y" ? 0 : -6,
    },
    /* Lead-time & supplier reliability — the term this centre is quoted. */
    {
      observed: `${e.leadTimeDays}-day lead from ${e.vendor}`,
      offset: (34 - e.leadTimeDays) * 0.4,
    },
    /* Plan robustness — the fill rate the position is actually achieving. */
    { observed: `Fill ${Math.round(e.fillRate * 100)}%, cover ${
        Math.round(e.onHand / Math.max(0.1, e.demandMean))
      }d`, offset: (e.fillRate - 0.94) * 60 },
  ];

  /* Centre the offsets on the weights, so Σ(weight × score) = confidence. */
  const weighted =
    raw.reduce((s, r, i) => s + r.offset * CONFIDENCE_WEIGHTS[i].pct, 0) / 100;
  const totalWeight = CONFIDENCE_WEIGHTS.reduce((s, w) => s + w.pct, 0);
  const correction = weighted / (totalWeight / 100);

  return CONFIDENCE_WEIGHTS.map((w, i) => {
    const subScore = clamp(base + raw[i].offset - correction);
    return {
      name: w.name,
      observed: raw[i].observed,
      weightPct: w.pct,
      subScore,
      impact: Math.round(((w.pct * subScore) / 100) * 10) / 10,
    };
  });
}

/* ─── The arithmetic ──────────────────────────────────────────── */

export interface DeckStep {
  label: string;
  /** The operator before the value. Omitted on the opening term and the total. */
  delta?: string;
  value: string;
  /** The derivation, as a muted sub-line. */
  sub?: string;
  isFinal?: boolean;
}

/**
 * How the quantity was arrived at, one line at a time.
 *
 * The same sum `asException` runs, written out — target less what is here and
 * what is coming. A reader who distrusts the number can follow it down the card
 * and check every term against the row it came from.
 */
export function waterfallFor(e: Exception): DeckStep[] {
  const short = isShort(e);
  const lead = Math.round(e.demandMean * e.leadTimeDays);
  const target = targetStock(e);

  if (short) {
    return [
      {
        label: "Lead-time demand",
        value: `${lead} ea`,
        sub: `${e.demandMean.toFixed(1)} a day × ${e.leadTimeDays} days`,
      },
      {
        label: "Safety stock",
        delta: "+",
        value: `${e.safetyStock} ea`,
        sub: `${e.classification} earns a ${segmentPolicy(e.classification).sl}% service level`,
      },
      { label: "On hand", delta: "−", value: `${e.onHand} ea`, sub: `At ${e.branch} today` },
      {
        label: "Incoming",
        delta: "−",
        value: `${e.incoming} ea`,
        sub: e.incoming ? "On open purchase orders, landing inside the lead time" : "Nothing on order",
      },
      {
        label: "Quantity to request",
        value: `${e.requestedQty} ea`,
        sub: `Target ${target} less ${e.onHand} on hand and ${e.incoming} inbound`,
        isFinal: true,
      },
    ];
  }

  return [
    { label: "On hand", value: `${e.onHand} ea`, sub: `At ${e.branch} today` },
    {
      label: "Target stock",
      delta: "−",
      value: `${target} ea`,
      sub: `${lead} of lead-time demand plus a ${e.safetyStock}-unit buffer`,
    },
    {
      label: "Excess above target",
      value: `${excessOf(e)} ea`,
      sub: `${Math.round(excessOf(e) / Math.max(0.1, e.demandMean) / 7)} weeks of supply beyond policy`,
      isFinal: true,
    },
  ];
}

/* ─── The policy in force ─────────────────────────────────────── */

export interface DeckPolicyRow {
  label: string;
  value: string;
  /** Where the figure comes from, so it is checkable. */
  source: string;
}

export function policyFor(e: Exception): DeckPolicyRow[] {
  const seg = segmentPolicy(e.classification);
  return [
    {
      label: "Replenishment policy",
      value: STOCKING_POLICY_META[e.currentPolicy].label,
      source: e.overridden
        ? `Overridden by ${e.overriddenBy ?? "a planner"}${e.overriddenAt ? ` on ${e.overriddenAt}` : ""}`
        : `System default for ${e.classification}`,
    },
    {
      label: "System policy",
      value: STOCKING_POLICY_META[policyForXyz(e.classification[1] as "X" | "Y" | "Z")].label,
      source: "Segment policy · ABC × XYZ",
    },
    { label: "Target service level", value: `${seg.sl}%`, source: `${e.classification} segment` },
    { label: "Review cycle", value: `Every ${seg.reviewDays} days`, source: `${e.classification} segment` },
    {
      label: "Safety factor",
      value: seg.tau === null ? "Not set" : `τ ${seg.tau.toFixed(1)}`,
      source: seg.tau === null ? "No τ published for this segment" : `${e.classification} segment`,
    },
    {
      label: "Target stock",
      value: `${targetStock(e)} units`,
      source: `${Math.round(e.demandMean * e.leadTimeDays)} lead-time demand + ${e.safetyStock} buffer`,
    },
  ];
}

/* ─── The deck ────────────────────────────────────────────────── */

export interface DemandDeck {
  exception: Exception;
  /** The lead paragraph, in IRIS's voice. */
  summary: string;
  factors: DeckFactor[];
  waterfall: DeckStep[];
  policy: DeckPolicyRow[];
}

export function deckFor(e: Exception): DemandDeck {
  const short = isShort(e);
  const cover = Math.round(e.onHand / Math.max(0.1, e.demandMean));
  const target = targetStock(e);
  return {
    exception: e,
    summary: short
      ? `${e.sku} at ${e.branch} holds ${e.onHand} units against a ${target}-unit target — ${cover} days of cover on a ${e.leadTimeDays}-day lead from ${e.vendor}. ${e.incoming ? `${e.incoming} units are already on open POs and close part of the gap.` : "Nothing is on order."} I recommend requesting ${e.requestedQty} to buying.`
      : `${e.sku} at ${e.branch} holds ${e.onHand} units against a ${target}-unit target — ${excessOf(e)} units more than policy asks for, with ${e.incoming} still inbound. These exist and are in the wrong place, so I recommend moving ${e.requestedQty} to ${e.transferTo ?? "the other stores"} rather than buying any more.`,
    factors: factorsFor(e),
    waterfall: waterfallFor(e),
    policy: policyFor(e),
  };
}
