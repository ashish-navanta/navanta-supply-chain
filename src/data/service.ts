/* ═══════════════════════════════════════════════════════════════
 *  Fossil — the service desk beyond the exception queue
 *
 *  The action center answers "what needs me in the next hour".
 *  This file holds the rest of Daniela's seat: the whole order book
 *  she answers for, every claim and its money, the shipments accounts
 *  ring about, and the accounts behind all of it.
 *
 *  Grounded in the same reality as the queue — residential and
 *  commercial account accounts served out of the GA distribution
 *  network, against a network running ~2,700 deliveries a day, with
 *  order status living in SAP ECC, warehouse truth in SAP WM
 *  and transit in DC appointment book. Those three disagreeing is not a bug in
 *  the fixtures; it is the job.
 *
 *  Order and claim references are shared with `action-center.ts` on
 *  purpose: SO-4471 on the queue is the same record on the orders
 *  page, and CLM-2041 is the same claim.
 * ═══════════════════════════════════════════════════════════════ */

import {
  QUEUES,
  formatUsd,
  formatUsdFull,
  daysFromToday,
  insightText,
  linesFor,
  shiftDate,
  type ActionRow,
} from "@/data/action-center";

/* ═══════════════════════════════════════════════════════════════
 *  ORDERS
 * ═══════════════════════════════════════════════════════════════ */

/** Where the order is in the fulfilment run. Drives the tracking stepper. */
/**
 * Four stages, outbound.
 *
 * "Allocated at DC" and "Picked & staged" were two names for the same waiting:
 * both mean the order is in the warehouse's hands and neither is a moment a
 * account would ask about. They collapse into one — the order is in process at
 * the DC — which leaves four stages, matches the inbound stepper's four, and
 * gives every label room to sit under its node.
 */
export type OrderStage = "placed" | "in-process" | "in-transit" | "delivered";

/**
 * A account order runs OUTBOUND — Fossil's DC to the account's dock — which is the
 * mirror of a purchase order's inbound run. Both steppers sit in the same app,
 * so the labels have to say which direction they point: a PO is received at a
 * DC, an order leaves one and is delivered to a account.
 */
/** The run, in order — the one list both seats count stages from. */
export const ORDER_STAGE_ORDER: readonly OrderStage[] = [
  "placed",
  "in-process",
  "in-transit",
  "delivered",
];

export const STAGE_LABEL: Record<OrderStage, string> = {
  placed: "Order placed",
  "in-process": "In process",
  "in-transit": "Out for delivery",
  delivered: "Delivered",
};

/**
 * How the order is actually doing, which is a different question from how far
 * along it is. An order can be in transit and perfectly fine, or in transit and
 * four days past the date a crew was booked against.
 */
export type OrderHealth =
  | "on-track"
  | "at-risk"
  | "delayed"
  | "backordered"
  | "delivered-clean"
  | "delivered-short";

export const HEALTH_LABEL: Record<OrderHealth, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  delayed: "Delayed",
  backordered: "Backordered",
  "delivered-clean": "Delivered complete",
  "delivered-short": "Delivered short",
};

/* ─── Risk ────────────────────────────────────────────────────────
 * How much trouble an order is in, as one word.
 *
 * Derived rather than stored, from the health plus what the account has riding
 * on it — a slip nobody has booked against is not the same problem as a slip
 * with a crew standing outside. Three levels and no more: the insight column
 * beside it explains the why, and a risk chip that also tries to explain itself
 * competes with the sentence written to do exactly that.
 * ─────────────────────────────────────────────────────────────── */

export type OrderRisk = "critical" | "high" | "medium";

export const RISK_LABEL: Record<OrderRisk, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

/** Null once an order is delivered clean — there is nothing left to be at risk. */
export function riskFor(o: ServiceOrder): OrderRisk | null {
  if (o.health === "delivered-clean") return null;
  /* On track is not a risk level. It used to fall through to "medium", so a
     twelve-row book showed twelve risk chips and the two orders that actually
     needed somebody were indistinguishable from the ten that did not. An order
     running to its promise has nothing at risk; say nothing. */
  if (o.health === "on-track") return null;
  /* Delivered short is still open money, so it stays on the list. */
  if (o.health === "delivered-short") return "high";
  /* A booked crew turns any slip into a date somebody cannot move. The
     on-track guard that used to live in this condition is redundant now that it
     returns above — an order reaching here is already not on track. */
  if (o.health === "delayed" || o.crewBooked) return "critical";
  return "high";
}

/** An order is exposed when the account has something booked against it that a
 *  slip would break. That, not the money alone, is what ranks the queue. */
export const AT_RISK: ReadonlySet<OrderHealth> = new Set([
  "at-risk",
  "delayed",
  "backordered",
]);

/**
 * One system's answer to "when does it arrive". Three of these disagreeing is
 * the single most common reason a account calls, so the record carries all of
 * them rather than picking a winner.
 */
export interface EtaClaim {
  source: "SAP ECC" | "SAP WM" | "DC appointment book" | "Carrier site";
  date: string;
  /** How much the reconciler trusts it, 0–100. */
  confidence: number;
  note: string;
}

export interface OrderMilestone {
  id: OrderStage;
  label: string;
  status: "completed" | "active" | "pending";
  date?: string;
  /** What happened at this stage that a reader would want to know. */
  events: {
    type: string;
    date: string;
    severity: "info" | "warning" | "critical";
    note?: string;
    resolved?: boolean;
  }[];
}

export interface OrderLine {
  style: string;
  sku: string;
  units: number;
  /** Production batch — the thing that makes a substitution risky: two batches of the same dial finish do not always match under the counter lights. */
  dyeLot: string;
  unitValue: number;
  /**
   * Where this line has got to, when it differs from the order's own stage.
   *
   * Lines do not always travel together: a split shipment leaves one SKU on a
   * truck and another on backorder, and a short delivery has one line receipted
   * and one still owed. The order-level stage is the summary, and a account
   * ringing about a split asks about a line — so the line can say so.
   */
  stage?: OrderStage;
  /**
   * The style this line replaced, where the account accepted an alternate.
   *
   * Substitution is the service seat's main lever against a capped factory: one SKU
   * of the order becomes something in stock that the customer will take, and
   * that part of the order stops waiting on the vendor entirely. The line has to
   * say what it stood in for, or the account's floor-set crew arrives expecting a
   * batch nobody ordered.
   */
  alternateFor?: string;
  /**
   * The tracking reference this line is travelling under, where it differs.
   *
   * A split shipment puts two lines on two trucks with two PROs, which is the
   * case a account rings about — "one unit arrived, where is the rest". One
   * order-level PRO cannot answer that.
   */
  pro?: string;
}

/**
 * The lines on an order, matched to the purchase order behind it.
 *
 * SO-4471 and PO-4471 are the same 120 units seen from either end, so they
 * should list the same SKUs. The fixtures held one line per order and the PO
 * derives three to five colourway variants, which had the two halves of one
 * shipment disagreeing about what was on it.
 *
 * The SKUs come from upstream; the quantities and the money are the ORDER's,
 * split across them on the same descending weights the PO uses, with the
 * remainder on the first line — so the lines still sum exactly to the order and
 * neither side has to be edited when the other changes.
 *
 * An order with no purchase order behind it keeps its own lines. Not every
 * account order is fed by a live PO, and inventing an upstream for it would be
 * the fixture flattering itself.
 */
export function orderLines(order: ServiceOrder): OrderLine[] {
  const upstream = QUEUES.buyer.rows.find(
    (r) => r.ref.startsWith("PO-") && r.ref.slice(3) === order.id.slice(3),
  );
  if (!upstream) return order.lines;

  const skus = linesFor(upstream);
  if (skus.length <= 1) return order.lines;

  /* Anything the account took as an alternate is the order's own and survives the
     derivation. Those units are not on the purchase order — that is the entire
     point of a substitution — so deriving every line from upstream deleted the
     half of the order that had already been rescued, and the page then argued
     with its own alert about whether an alternate existed. */
  const alternates = order.lines.filter((l) => l.alternateFor);
  const substituted = alternates.reduce((n, l) => n + l.units, 0);
  const altValue = alternates.reduce((n, l) => n + l.units * l.unitValue, 0);

  const base = order.lines[0];
  const weights = skus.map((_, i) => skus.length - i);
  const wSum = weights.reduce((a, b) => a + b, 0);

  let palletsLeft = order.units - substituted;
  let valueLeft = order.value - altValue;
  const fromVendor = order.units - substituted;
  const vendorValue = order.value - altValue;
  const derived = skus.map((line, i) => {
    const last = i === skus.length - 1;
    const units = last ? palletsLeft : Math.max(1, Math.round((fromVendor * weights[i]) / wSum));
    const value = last ? valueLeft : Math.round((vendorValue * weights[i]) / wSum);
    palletsLeft -= units;
    valueLeft -= value;
    return {
      style: line.name,
      sku: line.sku,
      units,
      /* One batch per order, not per finish: the lot is what the whole
         shipment was run on, and it is the thing a claim is filed against. */
      dyeLot: base.dyeLot,
      unitValue: Math.round(value / Math.max(1, units)),
      stage: base.stage,
      pro: base.pro,
    };
  });
  /* The alternates last, because they are the exception and a reader scanning
     for "what is still waiting on the plant" wants the vendor lines together. */
  return [...derived, ...alternates];
}

/**
 * DC to account, in days.
 *
 * One figure rather than a lane table: every order in this fixture runs a
 * cross-country leg out of a Georgia or Nashville DC, and four days is what
 * Qi Guang Watch → Salt Lake City takes on Fossil's own fleet.
 */
export const DC_TO_DEALER_DAYS = 4;

/**
 * When the account can have it, where that depends on an inbound purchase order.
 *
 * Narrow on purpose. Most account orders ship out of stock already standing in a
 * DC and owe nothing to whatever is on the water — deriving every date from a
 * same-numbered PO moved eight orders that had no reason to move, and on the
 * buyer's WAITING rows it produced "3d ago" as a delivery date, because on those
 * rows `date` carries elapsed time rather than a promise.
 *
 * So it answers only for the case that is genuinely coupled: the service seat's
 * own queue names the purchase order this order is held up by, the order has not
 * been delivered, and that PO's date is a real promise. That is SO-4463 — the
 * capped line, the re-promise, the confirmed date — which is the one place the two
 * halves were a week apart and each authored on its own.
 */
export function dealerEtaFor(order: ServiceOrder): string {
  if (order.stage === "delivered") return order.deliveredOn ?? order.currentEta;

  /* Coupled only where the queue says so. `chainFrom` is the explicit tie; a
     shared number alone is not enough, because SO-4471 and PO-4471 can be the
     same style without this order waiting on that container. */
  const held = QUEUES.csr.rows.find((r) => r.ref === order.id)?.chainFrom;
  if (!held?.startsWith("PO-")) return order.currentEta;

  const upstream = QUEUES.buyer.rows.find((r) => r.ref === held);
  /* A waiting row's `date` is "3d silent", not a date. Only a promise can be
     shifted into a delivery. */
  if (!upstream || upstream.state === "waiting") return order.currentEta;

  /* Later of the two, never earlier. A longer lead time delays a delivery; a
     shorter one does not pull a promise forward, because the account has planned
     around the date they were given — SO-4390 took an alternate off a purchase
     order landing ten days sooner and that is slack, not a new promise. Moving it
     up would have Fossil arriving before a booked crew. */
    const derived = shiftDate(upstream.date, DC_TO_DEALER_DAYS);
    const a = daysFromToday(derived);
    const b = daysFromToday(order.currentEta);
    if (a === null || b === null) return order.currentEta;
    return a > b ? derived : order.currentEta;
}

/** The reference a line is travelling under — its own, or the order's. */
export function linePro(order: ServiceOrder, line: OrderLine): string | undefined {
  return line.pro ?? order.proNumber;
}

/** Where a line has got to — its own stage where it has one, the order's otherwise. */
export function lineStage(order: ServiceOrder, line: OrderLine): OrderStage {
  return line.stage ?? order.stage;
}

export interface ServiceOrder {
  id: string;
  account: string;
  /** The lead style on the order; `lines` carries the rest. */
  style: string;
  units: number;
  value: number;
  orderedOn: string;
  /** The date the account was promised, before anything moved. */
  promisedOn: string;
  /** The date the record currently believes. Equal to `promisedOn` when nothing
   *  has moved — a re-promise is the difference between these two. */
  currentEta: string;
  /** The account's floor-set date, where they gave one. This is what a slip breaks. */
  installOn?: string;
  /** True when a crew is booked and cannot be moved — the reason a two-day slip
   *  on a $143K order outranks a week's slip on a bigger one. */
  crewBooked: boolean;
  stage: OrderStage;
  health: OrderHealth;
  carrier: string;
  lane: string;
  proNumber?: string;
  etas: EtaClaim[];
  milestones: OrderMilestone[];
  lines: OrderLine[];
  /** Goods receipt, once delivered — what a claim is filed against. */
  receipt?: string;
  deliveredOn?: string;
  /** Pallets short or damaged on arrival, where the delivery was not clean. */
  shortPallets?: number;
  /**
   * When the account confirmed the revised date, where they have.
   *
   * A re-promise and an accepted re-promise are different situations and were
   * being drawn the same way — both as a red "Re-promised 15 Aug → 6 Sep". The
   * first is a problem the CSR still owns; the second is a date the customer has
   * agreed to. Without this the page could not tell them apart, so a finished job
   * kept reading as an open one.
   */
  confirmedOn?: string;
  /**
   * What the agent is proposing, before anybody has agreed to it.
   *
   * Held apart from the order's own fields on purpose. A proposal is not a fact:
   * writing the substitute into `lines` and the new date into `currentEta` would
   * have the record asserting a swap nobody authorised, and the rep would be
   * confirming something the page had already told them was true. The page draws
   * this as an argument to accept or decline; only the run that follows writes it
   * in.
   */
  proposed?: {
    /** The SKU the agent wants to substitute in, and how much of it. */
    sku: string;
    style: string;
    units: number;
    /** Where the substitute is standing today — why it can hold the date. */
    at: string;
    /** The date to promise the account, out of the conversation with them. */
    date: string;
    /**
     * When the substitute itself would land, if they take it.
     *
     * Distinct from `date`, which is the promise being accepted on the order —
     * the whole offer is that the alternate is standing at a DC and can beat
     * that promise. Without the two apart, the call had nothing to trade: it
     * offered a swap that arrived exactly when waiting would.
     */
    arrivesOn?: string;
    /** How many days taking it saves against waiting. Data rather than a number
     *  typed into three sentences, which is how they drift apart. */
    savesDays?: number;
    /** What the account actually said, in their words. */
    said: string;
  };
  /** Christy's line on the order — the same voice as the queue's insight. */
  note: string;
}

/** Build the five-stage stepper from where the order actually is. Derived so a
 *  stage and a health flag can never contradict each other. */
function milestonesFor(
  stage: OrderStage,
  dates: Partial<Record<OrderStage, string>>,
  events: Partial<Record<OrderStage, OrderMilestone["events"]>> = {},
): OrderMilestone[] {
  const order = ORDER_STAGE_ORDER;
  const at = order.indexOf(stage);
  return order.map((id, i) => ({
    id,
    label: STAGE_LABEL[id],
    status: i < at ? "completed" : i === at ? "active" : "pending",
    date: dates[id],
    events: events[id] ?? [],
  }));
}

export const ORDERS: ServiceOrder[] = [
  {
    id: "SO-4471",
    account: "Peachtree Jewelers",
    style: "Runway 38",
    units: 2880,
    value: 142_800,
    orderedOn: "24 Jul",
    promisedOn: "9 Aug",
    currentEta: "19 Aug",
    installOn: "21 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Dallas DC → Atlanta, GA",
    etas: [
      { source: "SAP ECC", date: "19 Aug", confidence: 74, note: "Revised on the Qi Guang Watch lead-time change" },
      { source: "SAP WM", date: "19 Aug", confidence: 81, note: "Allocation holds 120 units against 19 Aug" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "24 Jul", "in-process": "In progress" },
      {
        "in-process": [
          {
            type: "Inbound slipped",
            date: "6 Aug",
            severity: "critical",
            note: "Supplier moved the lead time out 10 days · promise 9 Aug → 19 Aug",
          },
        ],
      },
    ),
    lines: [
      { style: "Runway 38", sku: "MK7108-7110", units: 2880, dyeLot: "B-2419", unitValue: 49.6 },
    ],
    note: "Crew booked for 21 Aug against a 19 Aug arrival. Two days of float on a $143K order — the alternate is drafted and needs your send.",
  },
  {
    id: "SO-4488",
    account: "Blue Ridge Jewelers",
    style: "Grant Chronograph 44",
    units: 1008,
    value: 61_200,
    orderedOn: "1 Aug",
    promisedOn: "22 Aug",
    currentEta: "22 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Eggstätt DC → Asheville, NC",
    etas: [
      { source: "SAP ECC", date: "22 Aug", confidence: 68, note: "Holds the original promise" },
      { source: "SAP WM", date: "25 Aug", confidence: 77, note: "Cover at Nashville is 0 days — allocation not firm" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "1 Aug", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Coverage gap", date: "18 Aug", severity: "warning", note: "Eggstätt DC is at 0 days cover on this SKU" },
        ],
      },
    ),
    lines: [
      { style: "Grant Chronograph 44", sku: "FS4735-4735", units: 1008, dyeLot: "B-2431", unitValue: 60.7 },
    ],
    note: "The account took the alternate style and the original date holds. Nothing owed unless the batch splits.",
  },
  {
    id: "SO-4463",
    account: "Summit Department Stores",
    style: "Bradshaw Chronograph 43",
    units: 1536,
    value: 88_400,
    orderedOn: "18 Jul",
    promisedOn: "15 Aug",
    /* 6 Sep, not 29 Aug. PO-4463's revised promise is 2 Sep and the run out of
       Qi Guang Watch to Salt Lake City takes four days, so 29 Aug was a date the
       goods could not physically make — the two halves of one shipment
       disagreeing by a week, each authored on its own. This is the arithmetic
       `dealerEtaFor` does; the stored value matches it so nothing on the page has
       to choose between them. */
    currentEta: "6 Sep",
    /* The delivery day. A crew booked 2 Sep against a 6 Sep delivery had the
       fitters arriving four days before the floor; booking them for the day the
       units land is tight but it is what Summit has done, and it is the reason
       this row is worth anybody's morning — with no slack left, another day of
       slip costs them a crew rather than a date. */
    installOn: "6 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Dallas DC → Salt Lake City, UT",
    /* Nothing agreed yet. Christy has had the conversation, has a substitute that
       holds the floor-set and a date the account can live with, and both are sitting
       in front of the rep as one proposal. `confirmedOn` stays unset until the run
       lands — see `proposed`. */
    proposed: {
      sku: "MK5605-5799",
      style: "Bradshaw Chronograph 43 · Maple Frost",
      units: 288,
      at: "Dallas DC",
      date: "6 Sep",
      arrivesOn: "2 Sep",
      savesDays: 4,
      said: "Summit will take a finish change on the backfill if it holds the floor-set date, but not on the launch wall.",
    },
    etas: [
      { source: "SAP ECC", date: "6 Sep", confidence: 84, note: "Earliest achievable · PO-4463 receipt plus the Salt Lake City run" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "18 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Tufting capacity capped", date: "10 Aug", severity: "warning", note: "Solan's line capped for three months · PO-4463", resolved: true },
          { type: "Account spoken to", date: "14 Aug", severity: "info", note: "Summit will take a finish change on the backfill, not the launch wall", resolved: true },
          { type: "Alternate and date proposed", date: "14 Aug", severity: "warning", note: "Swap 12 units to MK5605-5799 and re-promise 6 Sep · awaiting a rep" },
        ],
      },
    ),
    /* One style, as ordered. The substitute is a proposal and lives in
       `proposed`; writing it in here would have the record asserting a swap
       nobody has authorised. */
    lines: [
      { style: "Bradshaw Chronograph 43", sku: "MK5605-5605", units: 1536, dyeLot: "B-2402", unitValue: 57.5 },
    ],
    note: "Summit will take a finish change on the backfill to hold the floor-set date, not on the launch wall. MK5605-5799 is standing at Qi Guang Watch, which covers those 12 units and puts the rest at 6 Sep — both halves of one answer, waiting on a rep.",
  },
  {
    id: "SO-4390",
    account: "Peachtree Jewelers",
    style: "Parker Leather 39",
    units: 2304,
    value: 118_600,
    orderedOn: "12 Jul",
    promisedOn: "26 Aug",
    currentEta: "26 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Fossil East · Air",
    lane: "Dallas DC → Atlanta, GA",
    proNumber: "SF-70412",
    etas: [
      { source: "DC appointment book", date: "26 Aug", confidence: 88, note: "Tractor 218 on schedule, 41 miles out" },
      { source: "SAP WM", date: "26 Aug", confidence: 84, note: "Shipment confirmed complete at pick" },
    ],
    milestones: milestonesFor("in-transit", {
      placed: "12 Jul", "in-process": "24 Aug",
      "in-transit": "25 Aug",
    }),
    lines: [
      { style: "Parker Leather 39", sku: "MK2980-2980", units: 2304, dyeLot: "B-2427", unitValue: 51.5 },
    ],
    note: "The alternate they accepted, shipped and running to date. Nothing needed unless it slips.",
  },
  {
    id: "SO-4515",
    account: "Lone Star Surfaces",
    style: "Neutra Automatic 44",
    units: 5040,
    value: 246_400,
    orderedOn: "30 Jul",
    promisedOn: "28 Aug",
    currentEta: "28 Aug",
    installOn: "4 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Dallas DC → Austin, TX",
    proNumber: "WRN-441802",
    etas: [
      { source: "SAP WM", date: "28 Aug", confidence: 86, note: "Staged and tendered" },
      { source: "Carrier site", date: "28 Aug", confidence: 72, note: "Pickup window confirmed 26 Aug" },
    ],
    milestones: milestonesFor("in-process", { placed: "30 Jul", "in-process": "24 Aug", }),
    lines: [
      { style: "Neutra Automatic 44", sku: "ME3184-3184", units: 3840, dyeLot: "B-2440", unitValue: 49.1 },
      { style: "Runway 38", sku: "MK7108-7110", units: 1200, dyeLot: "B-2419", unitValue: 49.6 },
    ],
    note: "Biggest order on the book and the cleanest. Two styles, two batches — worth a call if either line splits.",
  },
  {
    id: "SO-4436",
    account: "Cascade Commercial Interiors",
    style: "Jacqueline 36",
    units: 2112,
    value: 104_200,
    orderedOn: "22 Jul",
    promisedOn: "20 Aug",
    currentEta: "23 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Purchased · Old Dominion",
    lane: "Dallas DC → Portland, OR",
    proNumber: "ODFL-88123401",
    /* Three systems, three answers — the ETA-conflict case the tracking page
       exists for. */
    etas: [
      { source: "SAP ECC", date: "20 Aug", confidence: 41, note: "Still holds the original promise — never updated" },
      { source: "DC appointment book", date: "23 Aug", confidence: 83, note: "Rolled at the Salt Lake terminal, 3 days added" },
      { source: "Carrier site", date: "22 Aug", confidence: 61, note: "Carrier portal shows 22 Aug, unchanged since Tuesday" },
    ],
    milestones: milestonesFor(
      "in-transit",
      { placed: "22 Jul", "in-process": "16 Aug", "in-transit": "17 Aug" },
      {
        "in-transit": [
          { type: "Shipment rolled", date: "19 Aug", severity: "warning", note: "Held at the Salt Lake terminal · 3 days added" },
          { type: "ETA conflict", date: "20 Aug", severity: "warning", note: "Fusion 20 Aug · DC appointment book 23 Aug · carrier 22 Aug" },
        ],
      },
    ),
    lines: [
      { style: "Jacqueline 36", sku: "ES3843-3843", units: 2112, dyeLot: "B-2416", unitValue: 49.3 },
    ],
    note: "Reconciled to DC appointment book and running to date. The feeds agree again.",
  },
  {
    id: "SO-4529",
    account: "Gulf Coast Jewelers",
    style: "Runway 38",
    units: 1776,
    value: 88_060,
    orderedOn: "16 Jul",
    promisedOn: "8 Aug",
    currentEta: "8 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Fossil East · Air",
    lane: "Dallas DC → Biloxi, MS",
    proNumber: "SF-70398",
    etas: [{ source: "DC appointment book", date: "8 Aug", confidence: 92, note: "Delivered 8 Aug, POD signed" }],
    milestones: milestonesFor(
      "delivered",
      { placed: "16 Jul", "in-process": "5 Aug", "in-transit": "6 Aug", delivered: "8 Aug" },
      {
        delivered: [
          {
            type: "Damage found at tailgate",
            date: "8 Aug",
            severity: "critical",
            note: "Two units crushed under the wrap · 4 photos on file · CLM-2041 opened",
          },
        ],
      },
    ),
    lines: [
      { style: "Runway 38", sku: "MK7108-7110", units: 1776, dyeLot: "B-2419", unitValue: 49.6 },
    ],
    receipt: "GR-4529-02",
    deliveredOn: "8 Aug",
    shortPallets: 2,
    note: "Every system read delivered complete. Two units were crushed under the wrap — the claim is open and adjudicated.",
  },
  {
    id: "SO-4377",
    account: "Piedmont Jewelers",
    style: "Bradshaw Chronograph 43",
    units: 1248,
    value: 71_800,
    orderedOn: "2 Jul",
    promisedOn: "24 Jul",
    currentEta: "24 Jul",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Dallas DC → Greensboro, NC",
    etas: [{ source: "DC appointment book", date: "24 Jul", confidence: 94, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "2 Jul", "in-process": "21 Jul",
      "in-transit": "22 Jul",
      delivered: "24 Jul",
    }),
    lines: [
      { style: "Bradshaw Chronograph 43", sku: "MK5605-5605", units: 1248, dyeLot: "B-2388", unitValue: 57.5 },
    ],
    receipt: "GR-4377-01",
    deliveredOn: "24 Jul",
    note: "Clean delivery. The 8-unit claim behind it was a batch mismatch, settled in July.",
  },
  {
    id: "SO-4418",
    account: "Lowcountry Floor Co.",
    style: "Super Sea Wolf 53 Compression",
    units: 864,
    value: 44_600,
    orderedOn: "6 Aug",
    promisedOn: "30 Aug",
    currentEta: "11 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Eggstätt DC → Charleston, SC",
    etas: [
      { source: "SAP ECC", date: "11 Sep", confidence: 58, note: "No allocation — next inbound 8 Sep" },
    ],
    milestones: milestonesFor(
      "placed",
      { placed: "6 Aug" },
      {
        placed: [
          { type: "Backordered", date: "12 Aug", severity: "critical", note: "Eggstätt DC at 9 days cover · no allocation available" },
        ],
      },
    ),
    lines: [{ style: "Super Sea Wolf 53 Compression", sku: "ZO9204-9204", units: 864, dyeLot: "—", unitValue: 51.6 }],
    note: "Allocated off the 8 Sep inbound and inside the promise. Nothing owed.",
  },
  {
    id: "SO-4444",
    account: "Summit Department Stores",
    style: "Bradshaw Chronograph 43",
    units: 672,
    value: 39_200,
    orderedOn: "28 Jul",
    promisedOn: "27 Aug",
    currentEta: "27 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Dallas DC → Salt Lake City, UT",
    proNumber: "WRN-441677",
    etas: [{ source: "SAP WM", date: "27 Aug", confidence: 85, note: "Staged, awaiting tender" }],
    milestones: milestonesFor("in-process", { placed: "28 Jul", "in-process": "23 Aug", }),
    lines: [{ style: "Bradshaw Chronograph 43", sku: "MK5605-5605", units: 672, dyeLot: "B-2409", unitValue: 58.3 }],
    note: "Running to date. Hardwood, so moisture at receipt is worth a word to the account.",
  },
  {
    id: "SO-4547",
    account: "Blue Ridge Jewelers",
    style: "Darci 33",
    units: 1440,
    value: 68_400,
    orderedOn: "14 Jul",
    promisedOn: "18 Aug",
    currentEta: "24 Aug",
    installOn: "26 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Dedicated carriage",
    lane: "Dallas DC → Asheville, NC",
    etas: [
      { source: "SAP ECC", date: "24 Aug", confidence: 71, note: "Plant confirmed a firm date on the chase" },
      { source: "SAP WM", date: "24 Aug", confidence: 66, note: "Allocation pending the plant release" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "14 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Plant chased", date: "22 Aug", severity: "info", note: "Qi Guang Watch silent 2 days · firm date requested" },
        ],
      },
    ),
    lines: [
      { style: "Darci 33", sku: "54833-33500", units: 1440, dyeLot: "B-2436", unitValue: 47.5 },
    ],
    note: "The plant gave a firm date and the crew still has its float. Nothing owed.",
  },
  {
    id: "SO-4552",
    account: "Lone Star Surfaces",
    style: "Grant Chronograph 44",
    units: 1080,
    value: 65_565,
    orderedOn: "11 Aug",
    promisedOn: "5 Sep",
    currentEta: "5 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Dallas DC → Austin, TX",
    etas: [{ source: "SAP ECC", date: "5 Sep", confidence: 80, note: "Cover holds at Renley Watch Mfg" }],
    milestones: milestonesFor("placed", { placed: "11 Aug" }),
    lines: [
      { style: "Grant Chronograph 44", sku: "FS4735-4735", units: 1080, dyeLot: "B-2431", unitValue: 60.7 },
    ],
    note: "Placed and covered. Nothing to do but let it run.",
  },
  {
    id: "SO-4408",
    account: "Cascade Commercial Interiors",
    style: "Bradshaw Chronograph 43",
    units: 2880,
    value: 165_720,
    orderedOn: "20 Jun",
    promisedOn: "1 Aug",
    currentEta: "1 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Purchased · Old Dominion",
    lane: "Dallas DC → Portland, OR",
    proNumber: "ODFL-87991020",
    etas: [{ source: "DC appointment book", date: "1 Aug", confidence: 90, note: "Delivered 1 Aug" }],
    milestones: milestonesFor(
      "delivered",
      { placed: "20 Jun", "in-process": "28 Jul", "in-transit": "29 Jul", delivered: "1 Aug" },
      {
        delivered: [
          { type: "Short shipment", date: "1 Aug", severity: "warning", note: "116 of 120 units received · 4 short on the POD" },
        ],
      },
    ),
    lines: [
      { style: "Bradshaw Chronograph 43", sku: "MK5605-5605", units: 2880, dyeLot: "B-2395", unitValue: 57.5 },
    ],
    receipt: "GR-4408-01",
    deliveredOn: "1 Aug",
    shortPallets: 4,
    note: "Four units short and signed for that way. The shortage claim is open and inside the 30-day window until 31 Aug.",
  },
  {
    id: "SO-4402",
    account: "Piedmont Jewelers",
    style: "Runway 38",
    units: 1968,
    value: 97_580,
    orderedOn: "8 Jul",
    promisedOn: "2 Aug",
    currentEta: "2 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Dallas DC → Greensboro, NC",
    etas: [{ source: "DC appointment book", date: "2 Aug", confidence: 93, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "8 Jul", "in-process": "30 Jul",
      "in-transit": "31 Jul",
      delivered: "2 Aug",
    }),
    lines: [
      { style: "Runway 38", sku: "MK7108-7110", units: 1968, dyeLot: "B-2404", unitValue: 49.6 },
    ],
    receipt: "GR-4402-01",
    deliveredOn: "2 Aug",
    note: "Clean, on the promise, nothing outstanding.",
  },
];

export function orderById(id: string): ServiceOrder | undefined {
  return ORDERS.find((o) => o.id === id);
}

/** True when the systems of record do not agree on the arrival date. Derived
 *  rather than flagged, so a fixture can never claim a conflict it hasn't got. */
export function hasEtaConflict(o: ServiceOrder): boolean {
  return new Set(o.etas.map((e) => e.date)).size > 1;
}

/** The date worth telling the account: the highest-confidence source. */
export function bestEta(o: ServiceOrder): EtaClaim {
  return [...o.etas].sort((a, b) => b.confidence - a.confidence)[0];
}

/** Orders still moving — the tracking page's subject. */
export const inFlight = (): ServiceOrder[] =>
  ORDERS.filter((o) => o.stage !== "delivered");

export const atRiskOrders = (): ServiceOrder[] => ORDERS.filter((o) => AT_RISK.has(o.health));

/* ═══════════════════════════════════════════════════════════════
 *  CLAIMS
 * ═══════════════════════════════════════════════════════════════ */

export type ClaimKind =
  | "transit-damage"
  | "concealed-damage"
  | "shortage"
  | "wrong-style"
  | "defect";

export interface ClaimTypeDef {
  id: ClaimKind;
  label: string;
  /** What it covers, in the account's words. */
  description: string;
  /** Days from delivery in which it can be filed. */
  windowDays: number;
  /** Photographs are the evidence for anything physical. */
  needsPhotos: boolean;
}

/**
 * The claim types a account can file, with the window each one closes in. Shown
 * in full in the wizard, including the ones that are no longer eligible — a
 * greyed option that says why it closed teaches more than a hidden one.
 */
export const CLAIM_TYPES: ClaimTypeDef[] = [
  {
    id: "transit-damage",
    label: "Damage in transit",
    description: "Visible damage to units, units or wrap, found at the tailgate",
    windowDays: 15,
    needsPhotos: true,
  },
  {
    id: "concealed-damage",
    label: "Concealed damage",
    description: "Damage found after the unit was opened, not visible at delivery",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "shortage",
    label: "Shortage",
    description: "Fewer units or units received than the delivery receipt lists",
    windowDays: 30,
    needsPhotos: false,
  },
  {
    id: "wrong-style",
    label: "Wrong style or batch",
    description: "Received a different style, or a batch whose finish will not match the run",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "defect",
    label: "Manufacturing defect",
    description: "Edge swell, delamination, wear-layer or backing failure",
    windowDays: 365,
    needsPhotos: true,
  },
];

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = Object.fromEntries(
  CLAIM_TYPES.map((t) => [t.id, t.label]),
) as Record<ClaimKind, string>;

/** Where the claim is. `credit-ready` is the one that needs a person: Christy
 *  has adjudicated it and the credit is waiting on a signature. */
export type ClaimStage =
  | "opened"
  | "under-review"
  | "credit-ready"
  | "approved"
  | "settled"
  | "declined";

export const CLAIM_STAGE_LABEL: Record<ClaimStage, string> = {
  opened: "Opened",
  "under-review": "Under review",
  "credit-ready": "Credit ready",
  approved: "Approved",
  settled: "Settled",
  declined: "Declined",
};

/** Claims that are still somebody's problem. */
export const OPEN_CLAIM_STAGES: ReadonlySet<ClaimStage> = new Set([
  "opened",
  "under-review",
  "credit-ready",
]);

export interface ServiceClaim {
  id: string;
  orderId: string;
  account: string;
  style: string;
  kind: ClaimKind;
  /** Pallets claimed against. */
  units: number;
  /** What the account asked for. */
  requested: number;
  /** What Christy adjudicated from the order and the receipt. Null until it has
   *  been through review — an un-adjudicated claim has no number yet. */
  adjudicated: number | null;
  /** What policy allows without a second signature. */
  policyCap: number;
  photos: number;
  stage: ClaimStage;
  openedOn: string;
  decidedOn?: string;
  receipt: string;
  batch: string;
  /** Where the fault actually was, once known. */
  rootCause?: string;
  note: string;
}

/**
 * Claim money, derived from the order it is filed against.
 *
 * Authoring the dollars by hand is what let CLM-2041 sit at $4,740 for two
 * units of an order priced at $1,190 a unit — a figure the claim wizard,
 * which does the arithmetic honestly, immediately contradicted. So the claim
 * carries units and a kind, and the money comes from the order.
 *
 * A batch mismatch is asked in full and usually settles at half: the material
 * is in spec and usable where the match does not show.
 */
function claimValue(orderId: string, units: number): number {
  const o = orderById(orderId);
  if (!o) return 0;
  return Math.round((o.value / o.units) * units);
}

export const CLAIMS: ServiceClaim[] = [
  {
    id: "CLM-2041",
    orderId: "SO-4529",
    account: "Gulf Coast Jewelers",
    style: "Runway 38",
    kind: "transit-damage",
    units: 48,
    requested: claimValue("SO-4529", 2),
    adjudicated: claimValue("SO-4529", 2),
    policyCap: 7_000,
    photos: 4,
    stage: "credit-ready",
    openedOn: "8 Aug",
    receipt: "GR-4529-02",
    batch: "B-2419",
    rootCause: "Load shifted under the wrap · Fossil East · Air",
    note: `Two units crushed, four photos, credit built from the order and the receipt. ${formatUsd(
      claimValue("SO-4529", 2),
    )} sits inside the ${formatUsd(7_000)} cap — one signature.`,
  },
  {
    id: "CLM-2058",
    orderId: "SO-4408",
    account: "Cascade Commercial Interiors",
    style: "Bradshaw Chronograph 43",
    kind: "shortage",
    units: 96,
    requested: claimValue("SO-4408", 4),
    adjudicated: claimValue("SO-4408", 4),
    policyCap: 9_000,
    photos: 0,
    stage: "credit-ready",
    openedOn: "2 Aug",
    receipt: "GR-4408-01",
    batch: "B-2395",
    rootCause: "116 of 120 units tendered · carrier count short at origin",
    note: `Signed short on the POD, so the count is not in dispute. Christy has the credit at ${formatUsd(
      claimValue("SO-4408", 4),
    )} against the carrier, not the account.`,
  },
  {
    id: "CLM-2019",
    orderId: "SO-4377",
    account: "Piedmont Jewelers",
    style: "Bradshaw Chronograph 43",
    kind: "wrong-style",
    units: 192,
    requested: claimValue("SO-4377", 8),
    adjudicated: claimValue("SO-4377", 8),
    policyCap: 25_000,
    photos: 6,
    stage: "settled",
    openedOn: "28 Jul",
    decidedOn: "31 Jul",
    receipt: "GR-4377-01",
    batch: "B-2388",
    rootCause: "Batch B-2388 shipped against a run specified on B-2371",
    note: "Credit issued and the invoice corrected. Closed in three days.",
  },
  {
    id: "CLM-2064",
    orderId: "SO-4402",
    account: "Piedmont Jewelers",
    style: "Runway 38",
    kind: "concealed-damage",
    units: 72,
    requested: claimValue("SO-4402", 3),
    adjudicated: null,
    policyCap: 6_000,
    photos: 5,
    stage: "under-review",
    openedOn: "16 Aug",
    receipt: "GR-4402-01",
    batch: "B-2404",
    note: "Found after the units were opened, 14 days after a clean POD. Inside the 30-day window; the plant is being asked whether B-2404 has form.",
  },
  {
    id: "CLM-2071",
    orderId: "SO-4529",
    account: "Gulf Coast Jewelers",
    style: "Runway 38",
    kind: "defect",
    units: 144,
    requested: claimValue("SO-4529", 6),
    adjudicated: null,
    policyCap: 6_000,
    photos: 7,
    stage: "under-review",
    openedOn: "18 Aug",
    receipt: "GR-4529-03",
    batch: "B-2419",
    note: `Edge swell on six units from the same lot as the transit damage. ${formatUsd(
      claimValue("SO-4529", 6),
    )} asked against a ${formatUsd(6_000)} cap — this one needs a second signature whatever the outcome.`,
  },
  {
    id: "CLM-2077",
    orderId: "SO-4377",
    account: "Piedmont Jewelers",
    style: "Bradshaw Chronograph 43",
    kind: "shortage",
    units: 24,
    requested: claimValue("SO-4377", 1),
    adjudicated: null,
    policyCap: 3_000,
    photos: 0,
    stage: "opened",
    openedOn: "20 Aug",
    receipt: "GR-4377-02",
    batch: "B-2388",
    note: "Opened this morning against a receipt signed complete. Christy is pulling the tailgate count before it goes to review.",
  },
  {
    id: "CLM-2002",
    orderId: "SO-4390",
    account: "Peachtree Jewelers",
    style: "Parker Leather 39",
    kind: "transit-damage",
    units: 24,
    requested: claimValue("SO-4390", 1),
    adjudicated: claimValue("SO-4390", 1),
    policyCap: 3_000,
    photos: 3,
    stage: "settled",
    openedOn: "14 Jul",
    decidedOn: "16 Jul",
    receipt: "GR-4390-02",
    batch: "B-2427",
    rootCause: "Corner crush at the DC, not in transit",
    note: "One unit, settled in two days. Root cause was handling at Dallas, which is why the fleet was not charged.",
  },
  {
    id: "CLM-2088",
    orderId: "SO-4408",
    account: "Cascade Commercial Interiors",
    style: "Bradshaw Chronograph 43",
    kind: "wrong-style",
    units: 288,
    requested: claimValue("SO-4408", 12),
    adjudicated: Math.round(claimValue("SO-4408", 12) / 2),
    policyCap: 20_000,
    photos: 4,
    stage: "approved",
    openedOn: "5 Aug",
    decidedOn: "19 Aug",
    receipt: "GR-4408-01",
    batch: "B-2395",
    rootCause: "Batch variance within spec · half the units saleable as open stock",
    note: "Half credit agreed with the account — the lot is inside spec and usable where the match does not show. Approved, awaiting the credit note.",
  },
  {
    id: "CLM-1994",
    orderId: "SO-4402",
    account: "Piedmont Jewelers",
    style: "Runway 38",
    kind: "concealed-damage",
    units: 48,
    requested: claimValue("SO-4402", 2),
    adjudicated: 0,
    policyCap: 6_000,
    photos: 2,
    stage: "declined",
    openedOn: "2 Jul",
    decidedOn: "9 Jul",
    receipt: "GR-4402-01",
    batch: "B-2371",
    rootCause: "Filed 41 days after delivery · outside the 30-day concealed-damage window",
    note: "Declined on the window, not the evidence. Worth saying plainly — the photos supported the claim, the date did not.",
  },
  {
    id: "CLM-2081",
    orderId: "SO-4471",
    account: "Peachtree Jewelers",
    style: "Runway 38",
    kind: "defect",
    units: 96,
    requested: claimValue("SO-4471", 4),
    adjudicated: null,
    policyCap: 6_000,
    photos: 6,
    stage: "opened",
    openedOn: "21 Aug",
    receipt: "GR-4471-03",
    batch: "B-2419",
    note: "Third claim against batch B-2419. Christy has flagged the lot rather than the order — this is a pattern, not an incident.",
  },
];

export function claimById(id: string): ServiceClaim | undefined {
  return CLAIMS.find((c) => c.id === id);
}

/**
 * A claim projected onto the queue's row shape.
 *
 * Everything that talks to the agent — the review modal, the activity trail, the
 * task the band offers — is written against `ActionRow`, because that is the
 * object the four queues share. A claim is a different record with the same
 * question inside it ("here is what I worked out, release it or correct it"), so
 * it is projected rather than given its own parallel set of agent surfaces that
 * would then have to be kept in step.
 *
 * Lived inside `ClaimsScreen` until the claim got a page of its own, at which
 * point two callers needed the same projection and the copy that came with it.
 */
export function claimAsRow(claim: ServiceClaim): ActionRow {
  const order = orderById(claim.orderId);
  const credit = claim.adjudicated ?? claim.requested;
  return {
    id: claim.id,
    state: OPEN_CLAIM_STAGES.has(claim.stage) ? "decide" : "settled",
    ref: claim.id,
    refSub: `${CLAIM_KIND_LABEL[claim.kind]} · ${claim.units} units`,
    party: claim.account,
    partyOwn: false,
    product: claim.style,
    qtyValue: String(claim.units),
    qtyUnit: "units",
    date: claim.openedOn,
    status: CLAIM_STAGE_LABEL[claim.stage],
    signal: claim.stage === "settled" ? "settled" : "damage",
    value: credit,
    action: claim.stage === "credit-ready" ? "Approve credit" : "Review claim",
    chainFrom: claim.orderId,
    claim: {
      damagedUnits: claim.units,
      credit,
      policyCap: claim.policyCap,
      photos: claim.photos,
      deliveredOn: order?.deliveredOn ?? claim.openedOn,
      receipt: claim.receipt,
      batch: claim.batch,
    },
    insight: insightText(claim.stage === "settled" ? "settled" : "damage", {
      amount: credit,
      units: claim.units,
    }),
  };
}

/* ─── The claim's run ─────────────────────────────────────────────
 * Four stages a account would recognise. `approved` and `declined` are
 * outcomes rather than places: an approved claim is at the credit, and
 * a declined one stopped at the review, which is where its marker
 * belongs. Inventing a fifth node for "declined" would draw a journey
 * that carried on after it had ended.
 * ─────────────────────────────────────────────────────────────── */

export const CLAIM_RUN = ["Opened", "Under review", "Credit ready", "Settled"] as const;

/** How far along the run a claim has got, and whether it stopped there. */
export function claimRunPosition(claim: ServiceClaim): { reached: number; failed: boolean } {
  switch (claim.stage) {
    case "opened":
      return { reached: 0, failed: false };
    case "under-review":
      return { reached: 1, failed: false };
    case "declined":
      return { reached: 1, failed: true };
    case "credit-ready":
    case "approved":
      return { reached: 2, failed: false };
    case "settled":
      return { reached: 3, failed: false };
  }
}

/**
 * A date against each stage the claim has actually reached.
 *
 * Only two dates exist on the record — when it was filed and when it was decided
 * — so only the stages those belong to get one. A date under every node would be
 * four facts where the fixture holds two.
 */
export function claimRunDates(claim: ServiceClaim): Record<string, string> {
  const dates: Record<string, string> = { Opened: claim.openedOn };
  if (claim.decidedOn) {
    const { reached } = claimRunPosition(claim);
    dates[CLAIM_RUN[Math.min(reached, CLAIM_RUN.length - 1)]] = claim.decidedOn;
  }
  return dates;
}

export const openClaims = (): ServiceClaim[] =>
  CLAIMS.filter((c) => OPEN_CLAIM_STAGES.has(c.stage));

/** Claims where Christy has a figure and is waiting on a person. */
export const claimsNeedingAction = (): ServiceClaim[] =>
  CLAIMS.filter((c) => c.stage === "credit-ready");

/** Approved or settled as a share of everything decided — the reference
 *  portal's "approval rate", computed rather than stated. */
export function approvalRate(): { pct: number; approved: number; decided: number } {
  const decided = CLAIMS.filter((c) => c.decidedOn !== undefined);
  const approved = decided.filter((c) => c.stage !== "declined");
  return {
    pct: decided.length === 0 ? 0 : Math.round((approved.length / decided.length) * 100),
    approved: approved.length,
    decided: decided.length,
  };
}

/** A lot with more than one claim against it is a supplier conversation, not a
 *  account one. Surfaced on the claims page because nobody spots it row by row. */
export function repeatLots(): { batch: string; claims: ServiceClaim[] }[] {
  const buckets = new Map<string, ServiceClaim[]>();
  for (const c of CLAIMS) {
    if (c.batch === "—") continue;
    buckets.set(c.batch, [...(buckets.get(c.batch) ?? []), c]);
  }
  return [...buckets.entries()]
    .filter(([, cs]) => cs.length > 1)
    .map(([batch, claims]) => ({ batch, claims }))
    .sort((a, b) => b.claims.length - a.claims.length);
}

/* ═══════════════════════════════════════════════════════════════
 *  DEALERS
 * ═══════════════════════════════════════════════════════════════ */

export type DealerSegment = "Independent jeweler" | "Department store" | "Duty free & travel" | "E-commerce";
export type LoyaltyTier = "Platinum" | "Gold" | "Silver" | "Bronze";

export interface Account {
  id: string;
  name: string;
  city: string;
  state: string;
  segment: DealerSegment;
  since: string;
  ytdRevenue: number;
  /** Deliveries on the promise, last 12 months. */
  onTimePct: number;
  /** Claims raised per hundred orders. */
  claimRate: number;
  paymentTerms: string;
  tier: LoyaltyTier;
  /** Christy's read on the relationship. */
  note: string;
}

export const DEALERS: Account[] = [
  {
    id: "DLR-01",
    name: "Peachtree Jewelers",
    city: "Atlanta",
    state: "GA",
    segment: "Independent jeweler",
    since: "2014",
    ytdRevenue: 2_840_000,
    onTimePct: 91,
    claimRate: 2.4,
    paymentTerms: "Net 30",
    tier: "Gold",
    note: "Books crews tight and expects the date to hold. Carla answers the phone during store hours and rarely email.",
  },
  {
    id: "DLR-02",
    name: "Gulf Coast Jewelers",
    city: "Biloxi",
    state: "MS",
    segment: "Independent jeweler",
    since: "2019",
    ytdRevenue: 1_120_000,
    onTimePct: 86,
    claimRate: 6.8,
    paymentTerms: "Net 30",
    tier: "Silver",
    note: "Highest claim rate on the book, and three of them trace to batch B-2419 rather than to the account. Tony wants a phone call, not a portal.",
  },
  {
    id: "DLR-03",
    name: "Blue Ridge Jewelers",
    city: "Asheville",
    state: "NC",
    segment: "Department store",
    since: "2016",
    ytdRevenue: 1_960_000,
    onTimePct: 88,
    claimRate: 1.9,
    paymentTerms: "Net 45",
    tier: "Gold",
    note: "Commercial projects with real lead times, so a slip lands early enough to work. Sarah replies to email the same day.",
  },
  {
    id: "DLR-04",
    name: "Summit Department Stores",
    city: "Salt Lake City",
    state: "UT",
    segment: "Independent jeweler",
    since: "2011",
    ytdRevenue: 3_410_000,
    onTimePct: 93,
    claimRate: 1.2,
    paymentTerms: "Net 45",
    tier: "Platinum",
    note: "Biggest residential account and the least trouble. Normally takes the wait over a substitute, so accepting the Sustain Loop swap on SO-4463 is out of character — they are protecting an floor-set date, not being easy. Do not spend that twice.",
  },
  {
    id: "DLR-05",
    name: "Piedmont Jewelers",
    city: "Greensboro",
    state: "NC",
    segment: "Independent jeweler",
    since: "2008",
    ytdRevenue: 2_260_000,
    onTimePct: 95,
    claimRate: 4.1,
    paymentTerms: "Net 30",
    tier: "Gold",
    note: "Best on-time record we have and still four claims this quarter — every one a lot or a count, none a date.",
  },
  {
    id: "DLR-06",
    name: "Lowcountry Watch & Gift",
    city: "Charleston",
    state: "SC",
    segment: "Independent jeweler",
    since: "2023",
    ytdRevenue: 410_000,
    onTimePct: 79,
    claimRate: 3.3,
    paymentTerms: "Net 15",
    tier: "Bronze",
    note: "Newest account and the worst service record — mostly because their orders land on the thinnest cover in the network.",
  },
  {
    id: "DLR-07",
    name: "Cascade Department Stores",
    city: "Portland",
    state: "OR",
    segment: "Department store",
    since: "2017",
    ytdRevenue: 2_680_000,
    onTimePct: 84,
    claimRate: 5.2,
    paymentTerms: "Net 45",
    tier: "Gold",
    note: "Furthest lane on the book, so transit does most of the damage. Two open claims, both against the carrier rather than the plant.",
  },
  {
    id: "DLR-08",
    name: "Lone Star Jewelers",
    city: "Austin",
    state: "TX",
    segment: "E-commerce",
    since: "2015",
    ytdRevenue: 4_120_000,
    onTimePct: 90,
    claimRate: 0.8,
    paymentTerms: "Net 60",
    tier: "Platinum",
    note: "Builder programme, so volume is steady and batch continuity matters more than speed. Cleanest claim record on the book.",
  },
];

export function dealerByName(name: string): Account | undefined {
  return DEALERS.find((d) => d.name === name);
}

/** Everything open against a account, on both sides of the desk. */
export function dealerBook(name: string): {
  orders: ServiceOrder[];
  claims: ServiceClaim[];
  openValue: number;
  atRisk: number;
} {
  const orders = ORDERS.filter((o) => o.account === name);
  const claims = CLAIMS.filter((c) => c.account === name);
  const live = orders.filter((o) => o.stage !== "delivered");
  return {
    orders,
    claims,
    openValue: live.reduce((s, o) => s + o.value, 0),
    atRisk: orders.filter((o) => AT_RISK.has(o.health)).length,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK — figures the command center opens on
 * ═══════════════════════════════════════════════════════════════ */

export const SERVICE_BOOK = {
  accounts: DEALERS.length,
  /** Value on orders that have not yet landed. */
  get openValue() {
    return inFlight().reduce((s, o) => s + o.value, 0);
  },
  get atRisk() {
    return atRiskOrders().length;
  },
  get inTransit() {
    return ORDERS.filter((o) => o.stage === "in-transit").length;
  },
  get etaConflicts() {
    return inFlight().filter(hasEtaConflict).length;
  },
  get openClaimValue() {
    return openClaims().reduce((s, c) => s + (c.adjudicated ?? c.requested), 0);
  },
} as const;

/** Deliveries that hit the promised date, as a percentage — the seat's headline
 *  number, computed from the orders rather than asserted. */
export function promisesKept(): { pct: number; kept: number; total: number } {
  const done = ORDERS.filter((o) => o.stage === "delivered");
  const kept = done.filter((o) => o.currentEta === o.promisedOn);
  return {
    pct: done.length === 0 ? 0 : Math.round((kept.length / done.length) * 100),
    kept: kept.length,
    total: done.length,
  };
}

/** Re-exported so the service screens have one money formatter and it is the
 *  same one the queue uses. */
export { formatUsd, formatUsdFull };
