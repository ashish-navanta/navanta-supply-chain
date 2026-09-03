/* ═══════════════════════════════════════════════════════════════
 *  Allison — the plant service desk beyond the exception queue
 *
 *  The action center answers "what needs me in the next hour".
 *  This file holds the rest of Daniela's seat: the whole book of
 *  stores requisitions she answers for, every claim and its money,
 *  the deliveries maintenance crews ring about, and the maintenance
 *  teams behind all of it.
 *
 *  Grounded in the same reality as the queue — plant maintenance
 *  teams at Plant 3, Plant 12, Plant 14 and Speedway, plus the
 *  Szentgotthárd and Chennai cribs, served out of Indy Central Stores
 *  against a book of $109.3M MRO spend across 1,824 vendors, with the
 *  work order living in Maximo, the requisition and receipt in SAP ECC,
 *  bin truth in SAP WM and the truck in the stores appointment book.
 *  Those systems disagreeing is not a bug in the fixtures; it is the job.
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
} from "./action-center";

/* ═══════════════════════════════════════════════════════════════
 *  ORDERS
 * ═══════════════════════════════════════════════════════════════ */

/** Where the requisition is in the fulfilment run. Drives the tracking stepper. */
/**
 * Four stages, outbound.
 *
 * "Allocated at stores" and "Picked & staged" were two names for the same
 * waiting: both mean the requisition is in the crib's hands and neither is a
 * moment a maintenance planner would ask about. They collapse into one — the
 * order is in process at the stores — which leaves four stages, matches the
 * inbound stepper's four, and gives every label room to sit under its node.
 */
export type OrderStage = "placed" | "in-process" | "in-transit" | "delivered";

/**
 * A stores requisition runs OUTBOUND — Indy Central Stores to the plant dock —
 * which is the mirror of a purchase order's inbound run. Both steppers sit in
 * the same app, so the labels have to say which direction they point: a PO is
 * received at the stores, a requisition leaves them and is delivered to a crib.
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
 * along it is. A requisition can be in transit and perfectly fine, or in
 * transit and four days past the date a shutdown crew was booked against.
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
 * Derived rather than stored, from the health plus what the plant has riding
 * on it — a slip nobody has scheduled against is not the same problem as a
 * slip with a shutdown crew standing at the machine. Three levels and no more:
 * the insight column beside it explains the why, and a risk chip that also
 * tries to explain itself competes with the sentence written to do exactly that.
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
     fourteen-row book showed fourteen risk chips and the two requisitions that
     actually needed somebody were indistinguishable from the twelve that did
     not. An order running to its promise has nothing at risk; say nothing. */
  if (o.health === "on-track") return null;
  /* Delivered short is still open money, so it stays on the list. */
  if (o.health === "delivered-short") return "high";
  /* A booked crew turns any slip into a date somebody cannot move. The
     on-track guard that used to live in this condition is redundant now that it
     returns above — an order reaching here is already not on track. */
  if (o.health === "delayed" || o.crewBooked) return "critical";
  return "high";
}

/** An order is exposed when the plant has something booked against it that a
 *  slip would break — a shutdown crew, a PM window, a contractor on site. That,
 *  not the money alone, is what ranks the queue. */
export const AT_RISK: ReadonlySet<OrderHealth> = new Set([
  "at-risk",
  "delayed",
  "backordered",
]);

/**
 * One system's answer to "when does it arrive". Three of these disagreeing is
 * the single most common reason a maintenance planner calls, so the record
 * carries all of them rather than picking a winner. The source names are the
 * seat's own: SAP ECC holds the requisition, SAP WM the bin, the appointment
 * book the truck, and the carrier site whatever the carrier last scanned.
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
  /** Manufacturer lot — the thing that makes a substitution risky: two lots of the same coolant concentrate do not always mix to the same refractometer reading, and two lots of a bearing do not always carry the same internal clearance. */
  dyeLot: string;
  unitValue: number;
  /**
   * Where this line has got to, when it differs from the order's own stage.
   *
   * Lines do not always travel together: a split delivery leaves one SKU on the
   * shuttle and another on backorder, and a short delivery has one line
   * receipted and one still owed. The order-level stage is the summary, and a
   * planner ringing about a split asks about a line — so the line can say so.
   */
  stage?: OrderStage;
  /**
   * The part this line replaced, where the plant accepted an equivalent.
   *
   * Substitution is the service seat's main lever against a capped supplier or a
   * six-week OEM lead: one SKU of the requisition becomes a distributor
   * equivalent standing in the crib that the maintenance lead will sign an
   * engineering deviation for, and that part of the order stops waiting on the
   * vendor entirely. The line has to say what it stood in for, or the crew
   * arrives at the machine expecting a manufacturer nobody ordered.
   */
  alternateFor?: string;
  /**
   * The tracking reference this line is travelling under, where it differs.
   *
   * A split delivery puts two lines on two trucks with two PROs, which is the
   * case a crib rings about — "the belts arrived, where is the coolant". One
   * order-level PRO cannot answer that.
   */
  pro?: string;
}

/**
 * The lines on an order, matched to the purchase order behind it.
 *
 * SO-4471 and PO-4471 are the same 120 drums seen from either end, so they
 * should list the same SKUs. The fixtures held one line per order and the PO
 * derives three to five manufacturer variants, which had the two halves of one
 * delivery disagreeing about what was on it.
 *
 * The SKUs come from upstream; the quantities and the money are the ORDER's,
 * split across them on the same descending weights the PO uses, with the
 * remainder on the first line — so the lines still sum exactly to the order and
 * neither side has to be edited when the other changes.
 *
 * An order with no purchase order behind it keeps its own lines. Most stores
 * requisitions pick from bin stock and owe nothing to an open PO, and inventing
 * an upstream for them would be the fixture flattering itself.
 */
export function orderLines(order: ServiceOrder): OrderLine[] {
  const upstream = QUEUES.buyer.rows.find(
    (r) => r.ref.startsWith("PO-") && r.ref.slice(3) === order.id.slice(3),
  );
  if (!upstream) return order.lines;

  const skus = linesFor(upstream);
  if (skus.length <= 1) return order.lines;

  /* Anything the plant took as an equivalent is the order's own and survives the
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
      /* One lot per order, not per manufacturer: the lot is what the whole
         delivery was received on, and it is the thing a claim is filed against. */
      dyeLot: base.dyeLot,
      unitValue: Math.round(value / Math.max(1, units)),
      stage: base.stage,
      pro: base.pro,
    };
  });
  /* The alternates last, because they are the exception and a reader scanning
     for "what is still waiting on the vendor" wants the vendor lines together. */
  return [...derived, ...alternates];
}

/**
 * Stores to plant dock, in days.
 *
 * One figure rather than a lane table, and it is the crib's four days rather
 * than the truck's: goods receipt at Indy Central Stores, the QA hold every
 * OEM-equivalent part sits through, binning, pick and the shuttle run. The
 * physical leg from Indy Central Stores to Plant 3 is four miles; the four days
 * are what receipt-to-dock actually takes when the part is not already in a bin.
 */
export const DC_TO_DEALER_DAYS = 4;

/**
 * When the plant can have it, where that depends on an inbound purchase order.
 *
 * Narrow on purpose. Most requisitions pick from stock already standing in a
 * bin and owe nothing to whatever is on order — deriving every date from a
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
     same part without this order waiting on that inbound. */
  const held = QUEUES.csr.rows.find((r) => r.ref === order.id)?.chainFrom;
  if (!held?.startsWith("PO-")) return order.currentEta;

  const upstream = QUEUES.buyer.rows.find((r) => r.ref === held);
  /* A waiting row's `date` is "3d silent", not a date. Only a promise can be
     shifted into a delivery. */
  if (!upstream || upstream.state === "waiting") return order.currentEta;

  /* Later of the two, never earlier. A longer lead time delays a delivery; a
     shorter one does not pull a promise forward, because the plant has planned
     its PM window around the date they were given — SO-4390 took an equivalent
     off a purchase order landing ten days sooner and that is slack, not a new
     promise. Moving it up would have the stores arriving before the crew. */
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
  /** The lead part on the requisition; `lines` carries the rest. */
  style: string;
  units: number;
  value: number;
  orderedOn: string;
  /** The date the plant was promised, before anything moved. */
  promisedOn: string;
  /** The date the record currently believes. Equal to `promisedOn` when nothing
   *  has moved — a re-promise is the difference between these two. */
  currentEta: string;
  /** The plant's PM or shutdown date, where they gave one. This is what a slip breaks. */
  installOn?: string;
  /** True when a shutdown crew or contractor is booked and cannot be moved — the
   *  reason a two-day slip on a $143K coolant release outranks a week's slip on
   *  a bigger one. */
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
  /** Cartons or drums short or damaged on arrival, where the delivery was not clean. */
  shortPallets?: number;
  /**
   * When the plant confirmed the revised date, where they have.
   *
   * A re-promise and an accepted re-promise are different situations and were
   * being drawn the same way — both as a red "Re-promised 15 Aug → 6 Sep". The
   * first is a problem the CSR still owns; the second is a date the maintenance
   * lead has agreed to. Without this the page could not tell them apart, so a
   * finished job kept reading as an open one.
   */
  confirmedOn?: string;
  /**
   * What the agent is proposing, before anybody has agreed to it.
   *
   * Held apart from the order's own fields on purpose. A proposal is not a fact:
   * writing the substitute into `lines` and the new date into `currentEta` would
   * have the record asserting an engineering deviation nobody authorised, and
   * the rep would be confirming something the page had already told them was
   * true. The page draws this as an argument to accept or decline; only the run
   * that follows writes it in.
   */
  proposed?: {
    /** The SKU the agent wants to substitute in, and how much of it. */
    sku: string;
    style: string;
    units: number;
    /** Where the substitute is standing today — why it can hold the date. */
    at: string;
    /** The date to promise the plant, out of the conversation with them. */
    date: string;
    /**
     * When the substitute itself would land, if they take it.
     *
     * Distinct from `date`, which is the promise being accepted on the order —
     * the whole offer is that the equivalent is standing in a bin and can beat
     * that promise. Without the two apart, the call had nothing to trade: it
     * offered a swap that arrived exactly when waiting would.
     */
    arrivesOn?: string;
    /** How many days taking it saves against waiting. Data rather than a number
     *  typed into three sentences, which is how they drift apart. */
    savesDays?: number;
    /** What the maintenance lead actually said, in their words. */
    said: string;
  };
  /** Christy's line on the order — the same voice as the queue's insight. */
  note: string;
}

/** Build the four-stage stepper from where the order actually is. Derived so a
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

/* Unit economics are MRO's: a 55-gallon drum of spindle coolant concentrate
   runs about $1,190, a 6205-2RS bearing $9.40, a half-inch carbide end mill
   $38, a box of nitrile gloves $7.90, a B-section V-belt $24, a carton of
   absorbent pads $62, a 10-micron hydraulic element $74 and an Allen-Bradley
   100-C23 contactor $185. Order values are units × unit price, so the book
   keeps its shape — the coolant release for the summer shutdown is still the
   $143K row — without a bearing ever costing what a watch did. */
export const ORDERS: ServiceOrder[] = [
  {
    id: "SO-4471",
    account: "Plant 12 Maintenance",
    style: "Spindle Coolant Concentrate 55gal",
    units: 120,
    value: 142_800,
    orderedOn: "24 Jul",
    promisedOn: "9 Aug",
    currentEta: "19 Aug",
    installOn: "21 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Indy Central Stores → Plant 12, Indianapolis",
    etas: [
      { source: "SAP ECC", date: "19 Aug", confidence: 74, note: "Revised on the Cline Tool lead-time change" },
      { source: "SAP WM", date: "19 Aug", confidence: 81, note: "Allocation holds 120 drums against 19 Aug" },
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
      { style: "Spindle Coolant Concentrate 55gal", sku: "AL7108-7110", units: 120, dyeLot: "L-2419", unitValue: 1190 },
    ],
    note: "Shutdown crew booked for the 21 Aug coolant changeover against a 19 Aug arrival. Two days of float on a $143K release — the equivalent is drafted and needs your send.",
  },
  {
    id: "SO-4488",
    account: "Plant 14 Maintenance",
    style: "Nitrile Gloves 8mil 100ct",
    units: 7750,
    value: 61_225,
    orderedOn: "1 Aug",
    promisedOn: "22 Aug",
    currentEta: "22 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Allison Global Supply · Air",
    lane: "Szentgotthárd Stores → Plant 14, Indianapolis",
    etas: [
      { source: "SAP ECC", date: "22 Aug", confidence: 68, note: "Holds the original promise" },
      { source: "SAP WM", date: "25 Aug", confidence: 77, note: "Cover at Szentgotthárd Stores is 0 days — allocation not firm" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "1 Aug", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Coverage gap", date: "18 Aug", severity: "warning", note: "Szentgotthárd Stores is at 0 days cover on this SKU" },
        ],
      },
    ),
    lines: [
      { style: "Nitrile Gloves 8mil 100ct", sku: "AL4735-4735", units: 7750, dyeLot: "L-2431", unitValue: 7.9 },
    ],
    note: "The plant took the equivalent grade off the Szentgotthárd crib and the original date holds. Nothing owed unless the lot splits.",
  },
  {
    id: "SO-4463",
    account: "Plant 3 Maintenance",
    style: "Deep Groove Ball Bearing 6205-2RS",
    units: 9400,
    value: 88_360,
    orderedOn: "18 Jul",
    promisedOn: "15 Aug",
    /* 6 Sep, not 29 Aug. PO-4463's revised promise is 2 Sep and receipt-to-dock
       through Indy Central Stores takes four days, so 29 Aug was a date the
       parts could not physically make — the two halves of one delivery
       disagreeing by a week, each authored on its own. This is the arithmetic
       `dealerEtaFor` does; the stored value matches it so nothing on the page has
       to choose between them. */
    currentEta: "6 Sep",
    /* The delivery day. A PM crew booked 2 Sep against a 6 Sep delivery had the
       millwrights arriving four days before the bearings; booking them for the
       day the parts land is tight but it is what Plant 3 has done, and it is the
       reason this row is worth anybody's morning — with no slack left, another
       day of slip costs them a crew rather than a date. */
    installOn: "6 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Indy Central Stores → Plant 3, Indianapolis",
    /* Nothing agreed yet. Christy has had the conversation, has an NSK
       equivalent that holds the PM window and a date the plant can live with,
       and both are sitting in front of the rep as one proposal. `confirmedOn`
       stays unset until the run lands — see `proposed`. */
    proposed: {
      sku: "AL5605-5799",
      style: "Deep Groove Ball Bearing 6205-2RS · NSK",
      units: 1200,
      at: "Indy Central Stores",
      date: "6 Sep",
      arrivesOn: "2 Sep",
      savesDays: 4,
      said: "Plant 3 will take an NSK equivalent on the conveyor PM backfill if it holds the shutdown date, but not on the spindle rebuilds.",
    },
    etas: [
      { source: "SAP ECC", date: "6 Sep", confidence: 84, note: "Earliest achievable · PO-4463 receipt plus receipt-to-dock at Indy Central Stores" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "18 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Supplier capacity capped", date: "10 Aug", severity: "warning", note: "Cline Tool's repair line capped for three months · PO-4463", resolved: true },
          { type: "Plant spoken to", date: "14 Aug", severity: "info", note: "Plant 3 will take an NSK equivalent on the conveyor backfill, not the spindle rebuilds", resolved: true },
          { type: "Equivalent and date proposed", date: "14 Aug", severity: "warning", note: "Swap 1,200 units to AL5605-5799 and re-promise 6 Sep · awaiting a rep" },
        ],
      },
    ),
    /* One manufacturer, as requisitioned. The substitute is a proposal and lives
       in `proposed`; writing it in here would have the record asserting an
       engineering deviation nobody has authorised. */
    lines: [
      { style: "Deep Groove Ball Bearing 6205-2RS", sku: "AL5605-5605", units: 9400, dyeLot: "L-2402", unitValue: 9.4 },
    ],
    note: "Plant 3 will take an NSK equivalent on the conveyor backfill to hold the shutdown date, not on the spindle rebuilds. AL5605-5799 is standing at Indy Central Stores, which covers those 1,200 units and puts the rest at 6 Sep — both halves of one answer, waiting on a rep.",
  },
  {
    id: "SO-4390",
    account: "Plant 12 Maintenance",
    style: "Carbide End Mill 1/2in 4-Flute",
    units: 3120,
    value: 118_560,
    orderedOn: "12 Jul",
    promisedOn: "26 Aug",
    currentEta: "26 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Stores shuttle",
    lane: "Indy Central Stores → Plant 12, Indianapolis",
    proNumber: "SS-70412",
    etas: [
      { source: "DC appointment book", date: "26 Aug", confidence: 88, note: "Shuttle 218 on schedule, 4 miles out" },
      { source: "SAP WM", date: "26 Aug", confidence: 84, note: "Pick confirmed complete at the stores" },
    ],
    milestones: milestonesFor("in-transit", {
      placed: "12 Jul", "in-process": "24 Aug",
      "in-transit": "25 Aug",
    }),
    lines: [
      { style: "Carbide End Mill 1/2in 4-Flute", sku: "AL2980-2980", units: 3120, dyeLot: "L-2427", unitValue: 38 },
    ],
    note: "The equivalent grade they accepted, picked and running to date. Nothing needed unless it slips.",
  },
  {
    id: "SO-4515",
    account: "Indianapolis Facilities",
    style: "V-Belt B-Section 68in",
    units: 2950,
    value: 246_300,
    orderedOn: "30 Jul",
    promisedOn: "28 Aug",
    currentEta: "28 Aug",
    installOn: "4 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Freight · Dayton Freight",
    lane: "Indy Central Stores → Facilities, Indianapolis",
    proNumber: "DFL-441802",
    etas: [
      { source: "SAP WM", date: "28 Aug", confidence: 86, note: "Staged and tendered" },
      { source: "Carrier site", date: "28 Aug", confidence: 72, note: "Pickup window confirmed 26 Aug" },
    ],
    milestones: milestonesFor("in-process", { placed: "30 Jul", "in-process": "24 Aug", }),
    lines: [
      { style: "V-Belt B-Section 68in", sku: "AL3184-3184", units: 2800, dyeLot: "L-2440", unitValue: 24 },
      { style: "Spindle Coolant Concentrate 55gal", sku: "AL7108-7110", units: 150, dyeLot: "L-2419", unitValue: 1194 },
    ],
    note: "Biggest requisition on the book and the cleanest — the year-end PM belt change plus the powerhouse coolant fill. Two parts, two lots — worth a call if either line splits.",
  },
  {
    id: "SO-4436",
    account: "Szentgotthárd Maintenance",
    style: "Absorbent Pads 15×19 100ct",
    units: 1680,
    value: 104_160,
    orderedOn: "22 Jul",
    promisedOn: "20 Aug",
    currentEta: "23 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Allison Global Supply · Air",
    lane: "Indy Central Stores → Szentgotthárd Stores",
    proNumber: "AGS-88123401",
    /* Three systems, three answers — the ETA-conflict case the tracking page
       exists for. */
    etas: [
      { source: "SAP ECC", date: "20 Aug", confidence: 41, note: "Still holds the original promise — never updated" },
      { source: "DC appointment book", date: "23 Aug", confidence: 83, note: "Held at the Frankfurt hub, 3 days added" },
      { source: "Carrier site", date: "22 Aug", confidence: 61, note: "Forwarder portal shows 22 Aug, unchanged since Tuesday" },
    ],
    milestones: milestonesFor(
      "in-transit",
      { placed: "22 Jul", "in-process": "16 Aug", "in-transit": "17 Aug" },
      {
        "in-transit": [
          { type: "Shipment rolled", date: "19 Aug", severity: "warning", note: "Held at the Frankfurt hub · 3 days added" },
          { type: "ETA conflict", date: "20 Aug", severity: "warning", note: "SAP ECC 20 Aug · appointment book 23 Aug · forwarder 22 Aug" },
        ],
      },
    ),
    lines: [
      { style: "Absorbent Pads 15×19 100ct", sku: "AL3843-3843", units: 1680, dyeLot: "L-2416", unitValue: 62 },
    ],
    note: "Reconciled to the appointment book and running to date. The feeds agree again.",
  },
  {
    id: "SO-4529",
    account: "Speedway Maintenance",
    style: "Spindle Coolant Concentrate 55gal",
    units: 74,
    value: 88_060,
    orderedOn: "16 Jul",
    promisedOn: "8 Aug",
    currentEta: "8 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Stores shuttle",
    lane: "Indy Central Stores → Speedway, IN",
    proNumber: "SS-70398",
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
            note: "Two drums crushed under the wrap · 4 photos on file · CLM-2041 opened",
          },
        ],
      },
    ),
    lines: [
      { style: "Spindle Coolant Concentrate 55gal", sku: "AL7108-7110", units: 74, dyeLot: "L-2419", unitValue: 1190 },
    ],
    receipt: "GR-4529-02",
    deliveredOn: "8 Aug",
    shortPallets: 2,
    note: "Every system read delivered complete. Two drums were crushed under the wrap — the claim is open and adjudicated.",
  },
  {
    id: "SO-4377",
    account: "Plant 3 Tool Room",
    style: "Deep Groove Ball Bearing 6205-2RS",
    units: 7640,
    value: 71_816,
    orderedOn: "2 Jul",
    promisedOn: "24 Jul",
    currentEta: "24 Jul",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Indy Central Stores → Plant 3 Tool Room, Indianapolis",
    etas: [{ source: "DC appointment book", date: "24 Jul", confidence: 94, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "2 Jul", "in-process": "21 Jul",
      "in-transit": "22 Jul",
      delivered: "24 Jul",
    }),
    lines: [
      { style: "Deep Groove Ball Bearing 6205-2RS", sku: "AL5605-5605", units: 7640, dyeLot: "L-2388", unitValue: 9.4 },
    ],
    receipt: "GR-4377-01",
    deliveredOn: "24 Jul",
    note: "Clean delivery. The 800-piece claim behind it was a wrong-grade pick, settled in July.",
  },
  {
    id: "SO-4418",
    account: "Chennai Maintenance",
    style: "Allen-Bradley Contactor 100-C23",
    units: 240,
    value: 44_400,
    orderedOn: "6 Aug",
    promisedOn: "30 Aug",
    currentEta: "11 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Chennai Stores → Chennai Plant",
    etas: [
      { source: "SAP ECC", date: "11 Sep", confidence: 58, note: "No allocation — next OEM inbound 8 Sep" },
    ],
    milestones: milestonesFor(
      "placed",
      { placed: "6 Aug" },
      {
        placed: [
          { type: "Backordered", date: "12 Aug", severity: "critical", note: "Chennai Stores at 9 days cover · no allocation available · OEM sole-source, six-week lead" },
        ],
      },
    ),
    lines: [{ style: "Allen-Bradley Contactor 100-C23", sku: "AL9204-9204", units: 240, dyeLot: "—", unitValue: 185 }],
    note: "Allocated off the 8 Sep OEM inbound and inside the promise. Nothing owed.",
  },
  {
    id: "SO-4444",
    account: "Plant 3 Maintenance",
    style: "Deep Groove Ball Bearing 6205-2RS",
    units: 4200,
    value: 39_480,
    orderedOn: "28 Jul",
    promisedOn: "27 Aug",
    currentEta: "27 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Distributor truck · Kirby Risk",
    lane: "Lafayette, IN → Plant 3, Indianapolis",
    proNumber: "KR-441677",
    etas: [{ source: "SAP WM", date: "27 Aug", confidence: 85, note: "Staged, awaiting tender" }],
    milestones: milestonesFor("in-process", { placed: "28 Jul", "in-process": "23 Aug", }),
    lines: [{ style: "Deep Groove Ball Bearing 6205-2RS", sku: "AL5605-5605", units: 4200, dyeLot: "L-2409", unitValue: 9.4 }],
    note: "Running to date. Sealed 2RS bearings, so shelf date and storage orientation at receipt are worth a word to the crib.",
  },
  {
    id: "SO-4547",
    account: "Plant 14 Maintenance",
    style: "Hydraulic Filter Element 10µ",
    units: 924,
    value: 68_376,
    orderedOn: "14 Jul",
    promisedOn: "18 Aug",
    currentEta: "24 Aug",
    installOn: "26 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Dedicated carriage",
    lane: "Indy Central Stores → Plant 14, Indianapolis",
    etas: [
      { source: "SAP ECC", date: "24 Aug", confidence: 71, note: "OEM confirmed a firm date on the chase" },
      { source: "SAP WM", date: "24 Aug", confidence: 66, note: "Allocation pending the OEM release" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "14 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "OEM chased", date: "22 Aug", severity: "info", note: "Cline Tool silent 2 days on the OEM element · firm date requested" },
        ],
      },
    ),
    lines: [
      { style: "Hydraulic Filter Element 10µ", sku: "AL3192-3192", units: 924, dyeLot: "L-2436", unitValue: 74 },
    ],
    note: "The OEM gave a firm date and the press PM crew still has its float. Nothing owed.",
  },
  {
    id: "SO-4552",
    account: "Indianapolis Facilities",
    style: "Nitrile Gloves 8mil 100ct",
    units: 8300,
    value: 65_570,
    orderedOn: "11 Aug",
    promisedOn: "5 Sep",
    currentEta: "5 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Indy Central Stores → Facilities, Indianapolis",
    etas: [{ source: "SAP ECC", date: "5 Sep", confidence: 80, note: "Cover holds at Kirby Risk" }],
    milestones: milestonesFor("placed", { placed: "11 Aug" }),
    lines: [
      { style: "Nitrile Gloves 8mil 100ct", sku: "AL4735-4735", units: 8300, dyeLot: "L-2431", unitValue: 7.9 },
    ],
    note: "Placed and covered. Nothing to do but let it run.",
  },
  {
    id: "SO-4408",
    account: "Szentgotthárd Maintenance",
    style: "Deep Groove Ball Bearing 6205-2RS",
    units: 17600,
    value: 165_440,
    orderedOn: "20 Jun",
    promisedOn: "1 Aug",
    currentEta: "1 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Allison Global Supply · Air",
    lane: "Indy Central Stores → Szentgotthárd Stores",
    proNumber: "AGS-87991020",
    etas: [{ source: "DC appointment book", date: "1 Aug", confidence: 90, note: "Delivered 1 Aug" }],
    milestones: milestonesFor(
      "delivered",
      { placed: "20 Jun", "in-process": "28 Jul", "in-transit": "29 Jul", delivered: "1 Aug" },
      {
        delivered: [
          { type: "Short shipment", date: "1 Aug", severity: "warning", note: "172 of 176 cartons received · 4 short on the POD" },
        ],
      },
    ),
    lines: [
      { style: "Deep Groove Ball Bearing 6205-2RS", sku: "AL5605-5605", units: 17600, dyeLot: "L-2395", unitValue: 9.4 },
    ],
    receipt: "GR-4408-01",
    deliveredOn: "1 Aug",
    shortPallets: 4,
    note: "Four cartons short and signed for that way. The short-pick claim is open and inside the 30-day window until 31 Aug.",
  },
  {
    id: "SO-4402",
    account: "Plant 3 Tool Room",
    style: "Spindle Coolant Concentrate 55gal",
    units: 82,
    value: 97_580,
    orderedOn: "8 Jul",
    promisedOn: "2 Aug",
    currentEta: "2 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Indy Central Stores → Plant 3 Tool Room, Indianapolis",
    etas: [{ source: "DC appointment book", date: "2 Aug", confidence: 93, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "8 Jul", "in-process": "30 Jul",
      "in-transit": "31 Jul",
      delivered: "2 Aug",
    }),
    lines: [
      { style: "Spindle Coolant Concentrate 55gal", sku: "AL7108-7110", units: 82, dyeLot: "L-2404", unitValue: 1190 },
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

/** The date worth telling the plant: the highest-confidence source. */
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
  /** What it covers, in the crib's words. */
  description: string;
  /** Days from delivery in which it can be filed. */
  windowDays: number;
  /** Photographs are the evidence for anything physical. */
  needsPhotos: boolean;
}

/**
 * The claim types a plant can file against a stores requisition, with the
 * window each one closes in. Shown in full in the wizard, including the ones
 * that are no longer eligible — a greyed option that says why it closed teaches
 * more than a hidden one.
 *
 * The 365-day window on a defective part is the OEM warranty story: an OEM
 * sole-source spare carries twelve months from the factory, and a distributor
 * equivalent bought under an engineering deviation carries whatever the
 * distributor's manufacturer gives — which is the argument the buyer has to win
 * before the substitute is worth its saving.
 */
export const CLAIM_TYPES: ClaimTypeDef[] = [
  {
    id: "transit-damage",
    label: "Damage in transit",
    description: "Visible damage to drums, cartons or wrap, found at the dock",
    windowDays: 15,
    needsPhotos: true,
  },
  {
    id: "concealed-damage",
    label: "Concealed damage",
    description: "Damage found after the carton or drum was opened, not visible at delivery",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "shortage",
    label: "Short pick",
    description: "Fewer pieces or cartons received than the delivery receipt lists",
    windowDays: 30,
    needsPhotos: false,
  },
  {
    id: "wrong-style",
    label: "Wrong part or grade",
    description: "Received a different part, or a manufacturer whose grade does not meet the requisition's spec",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "defect",
    label: "Defective part",
    description: "Premature failure, out-of-tolerance dimensions, separated concentrate or a breached seal — the OEM warranty claim",
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
  /** Pieces claimed against — drums, cartons or parts in the order's own unit. */
  units: number;
  /** What the plant asked for. */
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
 * drums of an order priced at $1,190 a drum — a figure the claim wizard,
 * which does the arithmetic honestly, immediately contradicted. So the claim
 * carries units and a kind, and the money comes from the order.
 *
 * A wrong-grade pick is asked in full and usually settles at half: the part
 * is in spec and usable on the positions where the manufacturer does not matter.
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
    account: "Speedway Maintenance",
    style: "Spindle Coolant Concentrate 55gal",
    kind: "transit-damage",
    units: 2,
    requested: claimValue("SO-4529", 2),
    adjudicated: claimValue("SO-4529", 2),
    policyCap: 7_000,
    photos: 4,
    stage: "credit-ready",
    openedOn: "8 Aug",
    receipt: "GR-4529-02",
    batch: "L-2419",
    rootCause: "Load shifted under the wrap · Stores shuttle",
    note: `Two drums crushed, four photos, credit built from the order and the receipt. ${formatUsd(
      claimValue("SO-4529", 2),
    )} sits inside the ${formatUsd(7_000)} cap — one signature.`,
  },
  {
    id: "CLM-2058",
    orderId: "SO-4408",
    account: "Szentgotthárd Maintenance",
    style: "Deep Groove Ball Bearing 6205-2RS",
    kind: "shortage",
    units: 400,
    requested: claimValue("SO-4408", 400),
    adjudicated: claimValue("SO-4408", 400),
    policyCap: 9_000,
    photos: 0,
    stage: "credit-ready",
    openedOn: "2 Aug",
    receipt: "GR-4408-01",
    batch: "L-2395",
    rootCause: "172 of 176 cartons tendered · forwarder count short at origin",
    note: `Signed short on the POD, so the count is not in dispute. Christy has the credit at ${formatUsd(
      claimValue("SO-4408", 400),
    )} against the forwarder, not the plant.`,
  },
  {
    id: "CLM-2019",
    orderId: "SO-4377",
    account: "Plant 3 Tool Room",
    style: "Deep Groove Ball Bearing 6205-2RS",
    kind: "wrong-style",
    units: 800,
    requested: claimValue("SO-4377", 800),
    adjudicated: claimValue("SO-4377", 800),
    policyCap: 25_000,
    photos: 6,
    stage: "settled",
    openedOn: "28 Jul",
    decidedOn: "31 Jul",
    receipt: "GR-4377-01",
    batch: "L-2388",
    rootCause: "Lot L-2388 picked as House brand against a requisition specifying SKF · L-2371",
    note: "Credit issued and the requisition corrected. Closed in three days.",
  },
  {
    id: "CLM-2064",
    orderId: "SO-4402",
    account: "Plant 3 Tool Room",
    style: "Spindle Coolant Concentrate 55gal",
    kind: "concealed-damage",
    units: 3,
    requested: claimValue("SO-4402", 3),
    adjudicated: null,
    policyCap: 6_000,
    photos: 5,
    stage: "under-review",
    openedOn: "16 Aug",
    receipt: "GR-4402-01",
    batch: "L-2404",
    note: "Found after the drums were opened — bungs breached, 14 days after a clean POD. Inside the 30-day window; the supplier is being asked whether L-2404 has form.",
  },
  {
    id: "CLM-2071",
    orderId: "SO-4529",
    account: "Speedway Maintenance",
    style: "Spindle Coolant Concentrate 55gal",
    kind: "defect",
    units: 6,
    requested: claimValue("SO-4529", 6),
    adjudicated: null,
    policyCap: 6_000,
    photos: 7,
    stage: "under-review",
    openedOn: "18 Aug",
    receipt: "GR-4529-03",
    batch: "L-2419",
    note: `Separated concentrate in six drums from the same lot as the transit damage. ${formatUsd(
      claimValue("SO-4529", 6),
    )} asked against a ${formatUsd(6_000)} cap — this one needs a second signature whatever the outcome.`,
  },
  {
    id: "CLM-2077",
    orderId: "SO-4377",
    account: "Plant 3 Tool Room",
    style: "Deep Groove Ball Bearing 6205-2RS",
    kind: "shortage",
    units: 100,
    requested: claimValue("SO-4377", 100),
    adjudicated: null,
    policyCap: 3_000,
    photos: 0,
    stage: "opened",
    openedOn: "20 Aug",
    receipt: "GR-4377-02",
    batch: "L-2388",
    note: "Opened this morning against a receipt signed complete. Christy is pulling the dock count before it goes to review.",
  },
  {
    id: "CLM-2002",
    orderId: "SO-4390",
    account: "Plant 12 Maintenance",
    style: "Carbide End Mill 1/2in 4-Flute",
    kind: "transit-damage",
    units: 10,
    requested: claimValue("SO-4390", 10),
    adjudicated: claimValue("SO-4390", 10),
    policyCap: 3_000,
    photos: 3,
    stage: "settled",
    openedOn: "14 Jul",
    decidedOn: "16 Jul",
    receipt: "GR-4390-02",
    batch: "L-2427",
    rootCause: "Tube crushed at the stores pick, not in transit",
    note: "One ten-pack, settled in two days. Root cause was handling at Indy Central Stores, which is why the shuttle was not charged.",
  },
  {
    id: "CLM-2088",
    orderId: "SO-4408",
    account: "Szentgotthárd Maintenance",
    style: "Deep Groove Ball Bearing 6205-2RS",
    kind: "wrong-style",
    units: 1200,
    requested: claimValue("SO-4408", 1200),
    adjudicated: Math.round(claimValue("SO-4408", 1200) / 2),
    policyCap: 20_000,
    photos: 4,
    stage: "approved",
    openedOn: "5 Aug",
    decidedOn: "19 Aug",
    receipt: "GR-4408-01",
    batch: "L-2395",
    rootCause: "Grade variance within spec · half the pieces usable on non-spindle positions",
    note: "Half credit agreed with the plant — the lot is inside spec and usable where the manufacturer does not matter. Approved, awaiting the credit note.",
  },
  {
    id: "CLM-1994",
    orderId: "SO-4402",
    account: "Plant 3 Tool Room",
    style: "Spindle Coolant Concentrate 55gal",
    kind: "concealed-damage",
    units: 2,
    requested: claimValue("SO-4402", 2),
    adjudicated: 0,
    policyCap: 6_000,
    photos: 2,
    stage: "declined",
    openedOn: "2 Jul",
    decidedOn: "9 Jul",
    receipt: "GR-4402-01",
    batch: "L-2371",
    rootCause: "Filed 41 days after delivery · outside the 30-day concealed-damage window",
    note: "Declined on the window, not the evidence. Worth saying plainly — the photos supported the claim, the date did not.",
  },
  {
    id: "CLM-2081",
    orderId: "SO-4471",
    account: "Plant 12 Maintenance",
    style: "Spindle Coolant Concentrate 55gal",
    kind: "defect",
    units: 4,
    requested: claimValue("SO-4471", 4),
    adjudicated: null,
    policyCap: 6_000,
    photos: 6,
    stage: "opened",
    openedOn: "21 Aug",
    receipt: "GR-4471-03",
    batch: "L-2419",
    note: "Third claim against lot L-2419. Christy has flagged the lot rather than the order — this is a pattern, not an incident, and it is a supplier conversation before the shutdown fill goes in.",
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
 * Four stages a maintenance planner would recognise. `approved` and
 * `declined` are outcomes rather than places: an approved claim is at
 * the credit, and a declined one stopped at the review, which is where
 * its marker belongs. Inventing a fifth node for "declined" would draw
 * a journey that carried on after it had ended.
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
 *  plant one — and on a coolant lot going into a shutdown fill, an urgent one.
 *  Surfaced on the claims page because nobody spots it row by row. */
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
 *  ACCOUNTS — the maintenance teams the stores serve
 * ═══════════════════════════════════════════════════════════════ */

/* The "segment" is what the team maintains, because that is what decides how
   a slip lands: a production-maintenance crew loses machine hours, a tool room
   loses a regrind schedule, facilities loses a powerhouse PM window. The tier
   is the plant's criticality standing with the stores — a Platinum team's
   requisitions are picked first when a bin runs thin. */
export type DealerSegment = "Production maintenance" | "Tool room" | "Facilities" | "Test & validation";
export type LoyaltyTier = "Platinum" | "Gold" | "Silver" | "Bronze";

export interface Account {
  id: string;
  name: string;
  city: string;
  state: string;
  segment: DealerSegment;
  since: string;
  /** Stores issues charged to the team, year to date. */
  ytdRevenue: number;
  /** Deliveries on the promise, last 12 months. */
  onTimePct: number;
  /** Claims raised per hundred requisitions. */
  claimRate: number;
  /** The team's charge-back cycle against the stores cost centre. */
  paymentTerms: string;
  tier: LoyaltyTier;
  /** Christy's read on the relationship. */
  note: string;
}

export const DEALERS: Account[] = [
  {
    id: "DLR-01",
    name: "Plant 12 Maintenance",
    city: "Indianapolis",
    state: "IN",
    segment: "Production maintenance",
    since: "2014",
    ytdRevenue: 2_840_000,
    onTimePct: 91,
    claimRate: 2.4,
    paymentTerms: "Net 30",
    tier: "Gold",
    note: "Books shutdown crews tight and expects the date to hold — the campus hub, so every stockout escalation lands here first. Carla answers the radio on first shift and rarely email.",
  },
  {
    id: "DLR-02",
    name: "Speedway Maintenance",
    city: "Speedway",
    state: "IN",
    segment: "Production maintenance",
    since: "2019",
    ytdRevenue: 1_120_000,
    onTimePct: 86,
    claimRate: 6.8,
    paymentTerms: "Net 30",
    tier: "Silver",
    note: "Highest claim rate on the book, and three of them trace to coolant lot L-2419 rather than to the team. Tony wants a phone call, not a Maximo note.",
  },
  {
    id: "DLR-03",
    name: "Plant 14 Maintenance",
    city: "Indianapolis",
    state: "IN",
    segment: "Production maintenance",
    since: "2016",
    ytdRevenue: 1_960_000,
    onTimePct: 88,
    claimRate: 1.9,
    paymentTerms: "Net 45",
    tier: "Gold",
    note: "Runs a real PM calendar with real lead times, so a slip lands early enough to work. Sarah replies to email the same day.",
  },
  {
    id: "DLR-04",
    name: "Plant 3 Maintenance",
    city: "Indianapolis",
    state: "IN",
    segment: "Production maintenance",
    since: "2011",
    ytdRevenue: 3_410_000,
    onTimePct: 93,
    claimRate: 1.2,
    paymentTerms: "Net 45",
    tier: "Platinum",
    note: "Biggest production account and the least trouble. Normally takes the wait over a substitute, so signing the NSK deviation on SO-4463 is out of character — they are protecting a shutdown date, not being easy. Do not spend that twice.",
  },
  {
    id: "DLR-05",
    name: "Plant 3 Tool Room",
    city: "Indianapolis",
    state: "IN",
    segment: "Tool room",
    since: "2008",
    ytdRevenue: 2_260_000,
    onTimePct: 95,
    claimRate: 4.1,
    paymentTerms: "Net 30",
    tier: "Gold",
    note: "Best on-time record we have and still four claims this quarter — every one a lot or a count, none a date. A tool room notices a wrong grade before anyone else does.",
  },
  {
    id: "DLR-06",
    name: "Chennai Maintenance",
    city: "Chennai",
    state: "TN",
    segment: "Production maintenance",
    since: "2023",
    ytdRevenue: 410_000,
    onTimePct: 79,
    claimRate: 3.3,
    paymentTerms: "Net 15",
    tier: "Bronze",
    note: "Newest crib and the worst service record — mostly because their requisitions land on the thinnest cover in the network, and every OEM part is a six-week lead from Indianapolis.",
  },
  {
    id: "DLR-07",
    name: "Szentgotthárd Maintenance",
    city: "Szentgotthárd",
    state: "Vas",
    segment: "Production maintenance",
    since: "2017",
    ytdRevenue: 2_680_000,
    onTimePct: 84,
    claimRate: 5.2,
    paymentTerms: "Net 45",
    tier: "Gold",
    note: "Furthest lane on the book, so the air transfer does most of the damage. Two open claims, both against the forwarder rather than the supplier.",
  },
  {
    id: "DLR-08",
    name: "Indianapolis Facilities",
    city: "Indianapolis",
    state: "IN",
    segment: "Facilities",
    since: "2015",
    ytdRevenue: 4_120_000,
    onTimePct: 90,
    claimRate: 0.8,
    paymentTerms: "Net 60",
    tier: "Platinum",
    note: "Powerhouse and site services, so volume is steady and lot continuity on coolant matters more than speed. Cleanest claim record on the book.",
  },
];

export function dealerByName(name: string): Account | undefined {
  return DEALERS.find((d) => d.name === name);
}

/** Everything open against a team, on both sides of the desk. */
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
  /** Value on requisitions that have not yet landed. */
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
