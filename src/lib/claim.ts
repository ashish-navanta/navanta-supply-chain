import {
  CLAIM_TYPES,
  ORDERS,
  formatUsd,
  type ClaimKind,
  type ClaimTypeDef,
  type ServiceOrder,
} from "@/data/service";

/**
 * The rules a claim is filed under: which types are still open against a
 * delivery, and what the agent adjudicates once one is chosen.
 *
 * Lifted out of the old ClaimWizard modal when filing moved into the chat, so
 * the rules have one home rather than living inside whichever surface asks for
 * them. The arithmetic is unchanged — that wizard's month table, its half-credit
 * rule for dye-lot mismatches, and its cap.
 */

/** Days between two "8 Aug"-style dates. The fixtures all sit inside one
 *  season, so a year is never needed. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(date: string): number | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})$/.exec(date.trim());
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return null;
  return CUMULATIVE[mi] + parseInt(m[1], 10);
}

/** Today, as the fixtures date it. The whole prototype is set on this day. */
export const TODAY = "21 Aug";

export function daysSinceDelivery(order: ServiceOrder): number | null {
  const from = order.deliveredOn ? dayOfYear(order.deliveredOn) : null;
  const to = dayOfYear(TODAY);
  return from === null || to === null ? null : to - from;
}

export interface Eligibility {
  eligible: boolean;
  /** Why not, or how long is left. */
  reason: string;
}

/**
 * Whether a claim type can still be filed against this delivery, and why.
 *
 * An ineligible type keeps its reason rather than disappearing: "the
 * concealed-damage window closed 11 days ago" is an answer Daniela can give the
 * account, and a missing option is not.
 */
export function eligibilityFor(type: ClaimTypeDef, order: ServiceOrder): Eligibility {
  const elapsed = daysSinceDelivery(order);
  if (elapsed === null) {
    return { eligible: false, reason: "No delivery date on the receipt" };
  }
  if (type.id === "shortage" && !order.shortPallets) {
    return {
      eligible: true,
      reason: `Receipt is signed complete — a shortage claim will need the tailgate count · ${type.windowDays - elapsed} days left`,
    };
  }
  const left = type.windowDays - elapsed;
  if (left < 0) {
    return {
      eligible: false,
      reason: `${type.windowDays}-day window closed ${Math.abs(left)} days ago`,
    };
  }
  return { eligible: true, reason: `${left} of ${type.windowDays} days left to file` };
}

export interface Assessment {
  credit: number;
  cap: number;
  perPallet: number;
  /** True when the dye-lot half-credit rule applied. */
  halfRate: boolean;
  /** Credit is over the policy cap, so it needs a second signature. */
  overCap: boolean;
}

/**
 * What the agent will adjudicate. Pro-rated from the order's own line value, so
 * the figure is derived from the record the claim is filed against rather than
 * typed in.
 */
export function adjudicate(order: ServiceOrder, units: number, kind: ClaimKind): Assessment {
  const perPallet = order.value / order.units;
  /* A dye-lot mismatch is usually half credit — the material is in spec and
     usable where the match does not show. Everything else is full value. */
  const rate = kind === "wrong-style" ? 0.5 : 1;
  const credit = Math.round(perPallet * units * rate);
  /* The cap scales with the claim rather than being a magic number, and lands on
     the same order of magnitude as the caps already on the queue's claims. */
  const cap = Math.round((perPallet * order.units * 0.08) / 500) * 500;
  return {
    credit,
    cap,
    perPallet: Math.round(perPallet),
    halfRate: rate === 0.5,
    overCap: credit > cap,
  };
}

/** Deliveries a claim can be filed against — the receipted ones. */
export function receiptedOrders(): ServiceOrder[] {
  return ORDERS.filter((o) => o.receipt);
}

/**
 * Find a delivery by order number, goods receipt or account name — the three
 * identifiers on the record. Flooring has no serial number to type.
 */
export function lookupDelivery(query: string): ServiceOrder | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    receiptedOrders().find(
      (o) =>
        o.id.toLowerCase() === q ||
        o.receipt?.toLowerCase() === q ||
        o.account.toLowerCase().includes(q),
    ) ?? null
  );
}

export function claimTypeFor(kind: ClaimKind): ClaimTypeDef | null {
  return CLAIM_TYPES.find((t) => t.id === kind) ?? null;
}

/**
 * The sentence the filed claim reports back. Kept here rather than in the flow
 * so the wording has one home, the way commit.ts owns the queue's.
 */
export function claimFiledReport(
  order: ServiceOrder,
  type: ClaimTypeDef,
  units: number,
  assessment: Assessment,
  agent: string,
): { title: string; message: string } {
  return {
    title: `Claim filed against ${order.id}`,
    message:
      `${type.label} on ${units} ${units === 1 ? "unit" : "units"}, against ${order.receipt}. ` +
      `${agent} adjudicated ${formatUsd(assessment.credit)}` +
      (assessment.halfRate ? " at half credit — the lot is in spec and usable" : "") +
      (assessment.overCap
        ? ` — over the ${formatUsd(assessment.cap)} cap, so it needs a second signature.`
        : ` and it sits inside the ${formatUsd(assessment.cap)} cap.`) +
      ` It is now in your action center for approval.`,
  };
}
