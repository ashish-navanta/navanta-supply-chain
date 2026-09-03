/* ═══════════════════════════════════════════════════════════════
 *  Target — the service desk beyond the exception queue
 *
 *  The action center answers "what needs me in the next hour".
 *  This file holds the rest of Daniela's seat: the whole order book
 *  she answers for, every claim and its money, the shipments accounts
 *  ring about, and the accounts behind all of it.
 *
 *  Grounded in the same reality as the queue — store regions, the
 *  digital fulfillment nodes and the wholesale partners served out of
 *  the RDC network (Woodland for the West, Cedar Falls for the Central
 *  book), against a network turning thousands of store deliveries a
 *  week, with order status living in the order-management system
 *  (SAP ECC), warehouse truth in the legacy WMS (SAP WM) and transit in
 *  the DC appointment book. Those three disagreeing is not a bug in
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
} from "./action-center";

/* ═══════════════════════════════════════════════════════════════
 *  ORDERS
 * ═══════════════════════════════════════════════════════════════ */

/** Where the order is in the fulfilment run. Drives the tracking stepper. */
/**
 * Four stages, outbound.
 *
 * "Allocated at DC" and "Picked & staged" were two names for the same waiting:
 * both mean the order is in the warehouse's hands and neither is a moment a
 * store would ask about. They collapse into one — the order is in process at
 * the RDC — which leaves four stages, matches the inbound stepper's four, and
 * gives every label room to sit under its node.
 */
export type OrderStage = "placed" | "in-process" | "in-transit" | "delivered";

/**
 * An account order runs OUTBOUND — the RDC to the store or partner dock — which
 * is the mirror of a purchase order's inbound run. Both steppers sit in the
 * same app, so the labels have to say which direction they point: a PO is
 * received at an RDC, an order leaves one and is delivered to an account.
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
 * four days past the date a set crew was booked against.
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
 * with a reset crew standing on the sales floor. Three levels and no more: the
 * insight column beside it explains the why, and a risk chip that also tries to
 * explain itself competes with the sentence written to do exactly that.
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
  /* A booked set crew turns any slip into a date somebody cannot move. The
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
 * the single most common reason a store calls, so the record carries all of
 * them rather than picking a winner. The order-management system holds the
 * promise, the legacy WMS holds the allocation, the appointment book holds the
 * truck.
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
  /** Production lot — the thing that makes a substitution risky: two glaze lots of the same colour do not always match under store lights. */
  dyeLot: string;
  unitValue: number;
  /**
   * Where this line has got to, when it differs from the order's own stage.
   *
   * Lines do not always travel together: a split shipment leaves one SKU on a
   * truck and another on backorder, and a short delivery has one line receipted
   * and one still owed. The order-level stage is the summary, and a store
   * ringing about a split asks about a line — so the line can say so.
   */
  stage?: OrderStage;
  /**
   * The item this line replaced, where the account accepted an alternate.
   *
   * Substitution is the service seat's main lever against a capped supplier:
   * one SKU of the order becomes something standing in an RDC that the account
   * will take, and that part of the order stops waiting on the vendor entirely.
   * The line has to say what it stood in for, or the account's set crew arrives
   * expecting a colourway nobody ordered.
   */
  alternateFor?: string;
  /**
   * The tracking reference this line is travelling under, where it differs.
   *
   * A split shipment puts two lines on two trucks with two PROs, which is the
   * case a store rings about — "one pallet arrived, where is the rest". One
   * order-level PRO cannot answer that.
   */
  pro?: string;
}

/**
 * The lines on an order, matched to the purchase order behind it.
 *
 * SO-4471 and PO-4471 are the same 10,200 units seen from either end, so they
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
      /* One lot per order, not per colourway: the lot is what the whole
         shipment was run on, and it is the thing a claim is filed against. */
      dyeLot: base.dyeLot,
      unitValue: Math.round(value / Math.max(1, units)),
      stage: base.stage,
      pro: base.pro,
    };
  });
  /* The alternates last, because they are the exception and a reader scanning
     for "what is still waiting on the supplier" wants the vendor lines together. */
  return [...derived, ...alternates];
}

/**
 * RDC to account, in days.
 *
 * One figure rather than a lane table: every order in this fixture runs a
 * store-delivery leg out of Woodland or Cedar Falls, and four days is what
 * Woodland RDC → Seattle takes on the retailer's dedicated fleet — receipt,
 * put-away, store-order pick and the outbound run.
 */
export const DC_TO_DEALER_DAYS = 4;

/**
 * When the account can have it, where that depends on an inbound purchase order.
 *
 * Narrow on purpose. Most account orders ship out of stock already standing in an
 * RDC and owe nothing to whatever is on the water — deriving every date from a
 * same-numbered PO moved eight orders that had no reason to move, and on the
 * buyer's WAITING rows it produced "3d ago" as a delivery date, because on those
 * rows `date` carries elapsed time rather than a promise.
 *
 * So it answers only for the case that is genuinely coupled: the service seat's
 * own queue names the purchase order this order is held up by, the order has not
 * been delivered, and that PO's date is a real promise. That is SO-4463 — the
 * capped kiln line, the re-promise, the confirmed date — which is the one place
 * the two halves were a week apart and each authored on its own.
 */
export function dealerEtaFor(order: ServiceOrder): string {
  if (order.stage === "delivered") return order.deliveredOn ?? order.currentEta;

  /* Coupled only where the queue says so. `chainFrom` is the explicit tie; a
     shared number alone is not enough, because SO-4471 and PO-4471 can be the
     same item without this order waiting on that container. */
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
     up would have the truck arriving before a booked set crew. */
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
  /** The lead item on the order; `lines` carries the rest. */
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
  /** True when a set crew is booked and cannot be moved — the reason a two-day
   *  slip on a $143K order outranks a week's slip on a bigger one. */
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
  /** Units short or damaged on arrival, where the delivery was not clean. */
  shortPallets?: number;
  /**
   * When the account confirmed the revised date, where they have.
   *
   * A re-promise and an accepted re-promise are different situations and were
   * being drawn the same way — both as a red "Re-promised 15 Aug → 6 Sep". The
   * first is a problem the CSR still owns; the second is a date the store has
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
     * the whole offer is that the alternate is standing at an RDC and can beat
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

/* ─── The book ────────────────────────────────────────────────────
 * Fourteen orders across eight accounts. Unit values are transfer
 * cost per unit — what the RDC books the item out at, roughly FOB plus
 * freight and duty — so a $14 throw and a $2.25 pouch of granola sit on
 * the same page as a $26 dinnerware set. Every line SKU is a real
 * catalogue reference: style number, dash, colourway number.
 * ─────────────────────────────────────────────────────────────── */

export const ORDERS: ServiceOrder[] = [
  {
    id: "SO-4471",
    account: "Eastbay Stores",
    style: "Chunky Knit Throw Blanket",
    units: 10_200,
    value: 142_800,
    orderedOn: "24 Jul",
    promisedOn: "9 Aug",
    currentEta: "19 Aug",
    installOn: "21 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Woodland RDC → Oakland, CA",
    etas: [
      { source: "SAP ECC", date: "19 Aug", confidence: 74, note: "Revised on the Luen Hing lead-time change" },
      { source: "SAP WM", date: "19 Aug", confidence: 81, note: "Allocation holds 10,200 units against 19 Aug" },
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
      { style: "Chunky Knit Throw Blanket", sku: "HH7108-7110", units: 10_200, dyeLot: "B-2419", unitValue: 14.0 },
    ],
    note: "Set crew booked for 21 Aug against a 19 Aug arrival. Two days of float on a $143K holiday-set order — the alternate is drafted and needs your send.",
  },
  {
    id: "SO-4488",
    account: "Northstar Stores",
    style: "Organic Granola Clusters 12oz",
    units: 27_200,
    value: 61_200,
    orderedOn: "1 Aug",
    promisedOn: "22 Aug",
    currentEta: "22 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Cedar Falls RDC → Minneapolis, MN",
    etas: [
      { source: "SAP ECC", date: "22 Aug", confidence: 68, note: "Holds the original promise" },
      { source: "SAP WM", date: "25 Aug", confidence: 77, note: "Cover at Cedar Falls is 0 days — allocation not firm" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "1 Aug", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Coverage gap", date: "18 Aug", severity: "warning", note: "Cedar Falls RDC is at 0 days cover on this SKU" },
        ],
      },
    ),
    lines: [
      { style: "Organic Granola Clusters 12oz", sku: "GG4735-5061", units: 27_200, dyeLot: "B-2431", unitValue: 2.25 },
    ],
    note: "The region took the alternate flavour and the original date holds. Nothing owed unless the lot splits.",
  },
  {
    id: "SO-4463",
    account: "Rainier Stores",
    style: "Stoneware Dinnerware Set 16pc",
    units: 3_400,
    value: 88_400,
    orderedOn: "18 Jul",
    promisedOn: "15 Aug",
    /* 6 Sep, not 29 Aug. PO-4463's revised promise is 2 Sep and the run out of
       Woodland RDC to Seattle takes four days, so 29 Aug was a date the goods
       could not physically make — the two halves of one shipment disagreeing by
       a week, each authored on its own. This is the arithmetic `dealerEtaFor`
       does; the stored value matches it so nothing on the page has to choose
       between them. */
    currentEta: "6 Sep",
    /* The delivery day. A set crew booked 2 Sep against a 6 Sep delivery had the
       crew arriving four days before the product; booking them for the day the
       sets land is tight but it is what Rainier has done, and it is the reason
       this row is worth anybody's morning — with no slack left, another day of
       slip costs them a crew rather than a date. */
    installOn: "6 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "delayed",
    carrier: "Dedicated carriage",
    lane: "Woodland RDC → Seattle, WA",
    /* Nothing agreed yet. Christy has had the conversation, has a substitute that
       holds the floor-set and a date the region can live with, and both are
       sitting in front of the rep as one proposal. `confirmedOn` stays unset
       until the run lands — see `proposed`. */
    proposed: {
      sku: "HH5605-5799",
      style: "Stoneware Dinnerware Set 16pc · Terracotta",
      units: 640,
      at: "Woodland RDC",
      date: "6 Sep",
      arrivesOn: "2 Sep",
      savesDays: 4,
      said: "Rainier will take a glaze change on the backfill if it holds the floor-set date, but not on the launch wall.",
    },
    etas: [
      { source: "SAP ECC", date: "6 Sep", confidence: 84, note: "Earliest achievable · PO-4463 receipt plus the Seattle run" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "18 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Kiln capacity capped", date: "10 Aug", severity: "warning", note: "Luen Hing's kiln line capped for three months · PO-4463", resolved: true },
          { type: "Account spoken to", date: "14 Aug", severity: "info", note: "Rainier will take a glaze change on the backfill, not the launch wall", resolved: true },
          { type: "Alternate and date proposed", date: "14 Aug", severity: "warning", note: "Swap 640 units to HH5605-5799 and re-promise 6 Sep · awaiting a rep" },
        ],
      },
    ),
    /* One colourway, as ordered. The substitute is a proposal and lives in
       `proposed`; writing it in here would have the record asserting a swap
       nobody has authorised. */
    lines: [
      { style: "Stoneware Dinnerware Set 16pc", sku: "HH5605-5605", units: 3_400, dyeLot: "B-2402", unitValue: 26.0 },
    ],
    note: "Rainier will take a glaze change on the backfill to hold the floor-set date, not on the launch wall. HH5605-5799 is standing at Woodland RDC, which covers those 640 units and puts the rest at 6 Sep — both halves of one answer, waiting on a rep.",
  },
  {
    id: "SO-4390",
    account: "Eastbay Stores",
    style: "Acacia Serving Board",
    units: 11_860,
    value: 118_600,
    orderedOn: "12 Jul",
    promisedOn: "26 Aug",
    currentEta: "26 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Dedicated fleet · expedite",
    lane: "Woodland RDC → Oakland, CA",
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
      { style: "Acacia Serving Board", sku: "HH2980-2980", units: 11_860, dyeLot: "B-2427", unitValue: 10.0 },
    ],
    note: "The alternate they accepted, shipped and running to date. Nothing needed unless it slips.",
  },
  {
    id: "SO-4515",
    account: "Phoenix Fulfillment Center",
    style: "Performance Bath Towel",
    units: 41_600,
    value: 246_400,
    orderedOn: "30 Jul",
    promisedOn: "28 Aug",
    currentEta: "28 Aug",
    installOn: "4 Sep",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Woodland RDC → Phoenix, AZ",
    proNumber: "WRN-441802",
    etas: [
      { source: "SAP WM", date: "28 Aug", confidence: 86, note: "Staged and tendered" },
      { source: "Carrier site", date: "28 Aug", confidence: 72, note: "Pickup window confirmed 26 Aug" },
    ],
    milestones: milestonesFor("in-process", { placed: "30 Jul", "in-process": "24 Aug", }),
    lines: [
      { style: "Performance Bath Towel", sku: "TH3184-3255", units: 35_000, dyeLot: "B-2440", unitValue: 4.4 },
      { style: "Chunky Knit Throw Blanket", sku: "HH7108-7331", units: 6_600, dyeLot: "B-2419", unitValue: 14.0 },
    ],
    note: "Biggest order on the book and the cleanest. Two items, two lots — worth a call if either line splits.",
  },
  {
    id: "SO-4436",
    account: "Columbia Stores",
    style: "Cold Brew Concentrate 32oz",
    units: 26_050,
    value: 104_200,
    orderedOn: "22 Jul",
    promisedOn: "20 Aug",
    currentEta: "23 Aug",
    crewBooked: false,
    stage: "in-transit",
    health: "on-track",
    carrier: "Purchased · Old Dominion",
    lane: "Woodland RDC → Spokane, WA",
    proNumber: "ODFL-88123401",
    /* Three systems, three answers — the ETA-conflict case the tracking page
       exists for. */
    etas: [
      { source: "SAP ECC", date: "20 Aug", confidence: 41, note: "Still holds the original promise — never updated" },
      { source: "DC appointment book", date: "23 Aug", confidence: 83, note: "Rolled at the Portland terminal, 3 days added" },
      { source: "Carrier site", date: "22 Aug", confidence: 61, note: "Carrier portal shows 22 Aug, unchanged since Tuesday" },
    ],
    milestones: milestonesFor(
      "in-transit",
      { placed: "22 Jul", "in-process": "16 Aug", "in-transit": "17 Aug" },
      {
        "in-transit": [
          { type: "Shipment rolled", date: "19 Aug", severity: "warning", note: "Held at the Portland terminal · 3 days added" },
          { type: "ETA conflict", date: "20 Aug", severity: "warning", note: "Order management 20 Aug · DC appointment book 23 Aug · carrier 22 Aug" },
        ],
      },
    ),
    lines: [
      { style: "Cold Brew Concentrate 32oz", sku: "GG3843-3843", units: 26_050, dyeLot: "B-2416", unitValue: 4.0 },
    ],
    note: "Reconciled to the DC appointment book and running to date. The feeds agree again — and the dating still clears the cooler by a month.",
  },
  {
    id: "SO-4529",
    account: "Redwood Coast Mercantile",
    style: "Chunky Knit Throw Blanket",
    units: 6_290,
    value: 88_060,
    orderedOn: "16 Jul",
    promisedOn: "8 Aug",
    currentEta: "8 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Dedicated fleet · expedite",
    lane: "Woodland RDC → Eureka, CA",
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
            note: "Six cases crushed under the stretch wrap · 4 photos on file · CLM-2041 opened",
          },
        ],
      },
    ),
    lines: [
      { style: "Chunky Knit Throw Blanket", sku: "HH7108-7325", units: 6_290, dyeLot: "B-2419", unitValue: 14.0 },
    ],
    receipt: "GR-4529-02",
    deliveredOn: "8 Aug",
    shortPallets: 48,
    note: "Every system read delivered complete. Six cases — 48 throws — were crushed under the wrap; the claim is open and adjudicated.",
  },
  {
    id: "SO-4377",
    account: "Sierra Foothills Mercantile",
    style: "Stoneware Dinnerware Set 16pc",
    units: 2_872,
    value: 71_800,
    orderedOn: "2 Jul",
    promisedOn: "24 Jul",
    currentEta: "24 Jul",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Woodland RDC → Auburn, CA",
    etas: [{ source: "DC appointment book", date: "24 Jul", confidence: 94, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "2 Jul", "in-process": "21 Jul",
      "in-transit": "22 Jul",
      delivered: "24 Jul",
    }),
    lines: [
      { style: "Stoneware Dinnerware Set 16pc", sku: "HH5605-5952", units: 2_872, dyeLot: "B-2388", unitValue: 25.0 },
    ],
    receipt: "GR-4377-01",
    deliveredOn: "24 Jul",
    note: "Clean delivery. The 192-set claim behind it was a glaze-lot mismatch, settled in July.",
  },
  {
    id: "SO-4418",
    account: "Prairie Home Marketplace",
    style: "Quick-Dry Bath Rug",
    units: 7_136,
    value: 44_600,
    orderedOn: "6 Aug",
    promisedOn: "30 Aug",
    currentEta: "11 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Cedar Falls RDC → Des Moines, IA",
    etas: [
      { source: "SAP ECC", date: "11 Sep", confidence: 58, note: "No allocation — next inbound 8 Sep" },
    ],
    milestones: milestonesFor(
      "placed",
      { placed: "6 Aug" },
      {
        placed: [
          { type: "Backordered", date: "12 Aug", severity: "critical", note: "Cedar Falls RDC at 9 days cover · no allocation available" },
        ],
      },
    ),
    lines: [{ style: "Quick-Dry Bath Rug", sku: "TH9204-9268", units: 7_136, dyeLot: "—", unitValue: 6.25 }],
    note: "Allocated off the 8 Sep inbound and inside the promise. Nothing owed.",
  },
  {
    id: "SO-4444",
    account: "Rainier Stores",
    style: "Stoneware Dinnerware Set 16pc",
    units: 1_600,
    value: 39_200,
    orderedOn: "28 Jul",
    promisedOn: "27 Aug",
    currentEta: "27 Aug",
    crewBooked: false,
    stage: "in-process",
    health: "on-track",
    carrier: "Forwarder · Kuehne+Nagel",
    lane: "Woodland RDC → Seattle, WA",
    proNumber: "WRN-441677",
    etas: [{ source: "SAP WM", date: "27 Aug", confidence: 85, note: "Staged, awaiting tender" }],
    milestones: milestonesFor("in-process", { placed: "28 Jul", "in-process": "23 Aug", }),
    lines: [{ style: "Stoneware Dinnerware Set 16pc", sku: "HH5605-6473", units: 1_600, dyeLot: "B-2409", unitValue: 24.5 }],
    note: "Running to date. Stoneware, so a chipped-rim check at receipt is worth a word to the region.",
  },
  {
    id: "SO-4547",
    account: "Northstar Stores",
    style: "Ceramic Bud Vase 8in",
    units: 17_100,
    value: 68_400,
    orderedOn: "14 Jul",
    promisedOn: "18 Aug",
    currentEta: "24 Aug",
    installOn: "26 Aug",
    crewBooked: true,
    stage: "in-process",
    health: "on-track",
    carrier: "Dedicated carriage",
    lane: "Cedar Falls RDC → Minneapolis, MN",
    etas: [
      { source: "SAP ECC", date: "24 Aug", confidence: 71, note: "Supplier confirmed a firm date on the chase" },
      { source: "SAP WM", date: "24 Aug", confidence: 66, note: "Allocation pending the supplier release" },
    ],
    milestones: milestonesFor(
      "in-process",
      { placed: "14 Jul", "in-process": "In progress" },
      {
        "in-process": [
          { type: "Supplier chased", date: "22 Aug", severity: "info", note: "Luen Hing silent 2 days · firm date requested" },
        ],
      },
    ),
    lines: [
      { style: "Ceramic Bud Vase 8in", sku: "HH3192-3298", units: 17_100, dyeLot: "B-2436", unitValue: 4.0 },
    ],
    note: "The supplier gave a firm date and the set crew still has its float. Nothing owed.",
  },
  {
    id: "SO-4552",
    account: "Phoenix Fulfillment Center",
    style: "Organic Granola Clusters 12oz",
    units: 29_140,
    value: 65_565,
    orderedOn: "11 Aug",
    promisedOn: "5 Sep",
    currentEta: "5 Sep",
    crewBooked: false,
    stage: "placed",
    health: "on-track",
    carrier: "—",
    lane: "Woodland RDC → Phoenix, AZ",
    etas: [{ source: "SAP ECC", date: "5 Sep", confidence: 80, note: "Cover holds at Cedar Mills Co-Pack" }],
    milestones: milestonesFor("placed", { placed: "11 Aug" }),
    lines: [
      { style: "Organic Granola Clusters 12oz", sku: "GG4735-4812", units: 29_140, dyeLot: "B-2431", unitValue: 2.25 },
    ],
    note: "Placed and covered. Nothing to do but let it run.",
  },
  {
    id: "SO-4408",
    account: "Columbia Stores",
    style: "Stoneware Dinnerware Set 16pc",
    units: 6_905,
    value: 165_720,
    orderedOn: "20 Jun",
    promisedOn: "1 Aug",
    currentEta: "1 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-short",
    carrier: "Purchased · Old Dominion",
    lane: "Woodland RDC → Spokane, WA",
    proNumber: "ODFL-87991020",
    etas: [{ source: "DC appointment book", date: "1 Aug", confidence: 90, note: "Delivered 1 Aug" }],
    milestones: milestonesFor(
      "delivered",
      { placed: "20 Jun", "in-process": "28 Jul", "in-transit": "29 Jul", delivered: "1 Aug" },
      {
        delivered: [
          { type: "Short shipment", date: "1 Aug", severity: "warning", note: "6,857 of 6,905 sets received · 48 short on the POD" },
        ],
      },
    ),
    lines: [
      { style: "Stoneware Dinnerware Set 16pc", sku: "HH5605-6099", units: 6_905, dyeLot: "B-2395", unitValue: 24.0 },
    ],
    receipt: "GR-4408-01",
    deliveredOn: "1 Aug",
    shortPallets: 48,
    note: "Forty-eight sets short — two dozen cases — and signed for that way. The shortage claim is open and inside the 30-day window until 31 Aug.",
  },
  {
    id: "SO-4402",
    account: "Sierra Foothills Mercantile",
    style: "Chunky Knit Throw Blanket",
    units: 6_970,
    value: 97_580,
    orderedOn: "8 Jul",
    promisedOn: "2 Aug",
    currentEta: "2 Aug",
    crewBooked: false,
    stage: "delivered",
    health: "delivered-clean",
    carrier: "Dedicated carriage",
    lane: "Woodland RDC → Auburn, CA",
    etas: [{ source: "DC appointment book", date: "2 Aug", confidence: 93, note: "Delivered on the promise" }],
    milestones: milestonesFor("delivered", {
      placed: "8 Jul", "in-process": "30 Jul",
      "in-transit": "31 Jul",
      delivered: "2 Aug",
    }),
    lines: [
      { style: "Chunky Knit Throw Blanket", sku: "HH7108-7112", units: 6_970, dyeLot: "B-2404", unitValue: 14.0 },
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
 * The claim types an account can file, with the window each one closes in. Shown
 * in full in the wizard, including the ones that are no longer eligible — a
 * greyed option that says why it closed teaches more than a hidden one.
 *
 * The defect window is the owned-brand quality guarantee — a year from
 * delivery, the same promise printed on the pack — where the others are the
 * carrier's and the DC's windows.
 */
export const CLAIM_TYPES: ClaimTypeDef[] = [
  {
    id: "transit-damage",
    label: "Damage in transit",
    description: "Visible damage to cases, units or wrap, found at the tailgate",
    windowDays: 15,
    needsPhotos: true,
  },
  {
    id: "concealed-damage",
    label: "Concealed damage",
    description: "Damage found after the case was opened, not visible at delivery",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "shortage",
    label: "Shortage",
    description: "Fewer cases or units received than the delivery receipt lists",
    windowDays: 30,
    needsPhotos: false,
  },
  {
    id: "wrong-style",
    label: "Wrong item or lot",
    description: "Received a different item, or a glaze or dye lot whose finish will not match the set",
    windowDays: 30,
    needsPhotos: true,
  },
  {
    id: "defect",
    label: "Manufacturing defect",
    description: "Glaze crazing, seam or stitch failure, warped boards, backing failure — the quality guarantee",
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
  /** Units claimed against. */
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
 * Authoring the dollars by hand is what let CLM-2041 sit at $4,740 for 48
 * throws off an order booked at $14 a unit — a figure the claim wizard, which
 * does the arithmetic honestly, immediately contradicted. So the claim carries
 * units and a kind, and the money comes from the order: the same units the
 * claim lists, priced at the order's own unit value.
 *
 * A lot mismatch is asked in full and usually settles at half: the product is
 * in spec and saleable where the match does not show.
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
    account: "Redwood Coast Mercantile",
    style: "Chunky Knit Throw Blanket",
    kind: "transit-damage",
    units: 48,
    requested: claimValue("SO-4529", 48),
    adjudicated: claimValue("SO-4529", 48),
    policyCap: 7_000,
    photos: 4,
    stage: "credit-ready",
    openedOn: "8 Aug",
    receipt: "GR-4529-02",
    batch: "B-2419",
    rootCause: "Load shifted under the stretch wrap · dedicated fleet",
    note: `Six cases crushed, four photos, credit built from the order and the receipt. ${formatUsd(
      claimValue("SO-4529", 48),
    )} sits inside the ${formatUsd(7_000)} cap — one signature.`,
  },
  {
    id: "CLM-2058",
    orderId: "SO-4408",
    account: "Columbia Stores",
    style: "Stoneware Dinnerware Set 16pc",
    kind: "shortage",
    units: 48,
    requested: claimValue("SO-4408", 48),
    adjudicated: claimValue("SO-4408", 48),
    policyCap: 9_000,
    photos: 0,
    stage: "credit-ready",
    openedOn: "2 Aug",
    receipt: "GR-4408-01",
    batch: "B-2395",
    rootCause: "6,857 of 6,905 sets tendered · carrier count short at origin",
    note: `Signed short on the POD, so the count is not in dispute. Christy has the credit at ${formatUsd(
      claimValue("SO-4408", 48),
    )} against the carrier, not the region.`,
  },
  {
    id: "CLM-2019",
    orderId: "SO-4377",
    account: "Sierra Foothills Mercantile",
    style: "Stoneware Dinnerware Set 16pc",
    kind: "wrong-style",
    units: 192,
    requested: claimValue("SO-4377", 192),
    adjudicated: claimValue("SO-4377", 192),
    policyCap: 25_000,
    photos: 6,
    stage: "settled",
    openedOn: "28 Jul",
    decidedOn: "31 Jul",
    receipt: "GR-4377-01",
    batch: "B-2388",
    rootCause: "Glaze lot B-2388 shipped against a set specified on B-2371 — the Sage reads a shade cooler under store lights",
    note: "Credit issued and the invoice corrected. Closed in three days.",
  },
  {
    id: "CLM-2064",
    orderId: "SO-4402",
    account: "Sierra Foothills Mercantile",
    style: "Chunky Knit Throw Blanket",
    kind: "concealed-damage",
    units: 72,
    requested: claimValue("SO-4402", 72),
    adjudicated: null,
    policyCap: 6_000,
    photos: 5,
    stage: "under-review",
    openedOn: "16 Aug",
    receipt: "GR-4402-01",
    batch: "B-2404",
    note: "Found after the cases were opened, 14 days after a clean POD. Inside the 30-day window; Luen Hing is being asked whether lot B-2404 has form.",
  },
  {
    id: "CLM-2071",
    orderId: "SO-4529",
    account: "Redwood Coast Mercantile",
    style: "Chunky Knit Throw Blanket",
    kind: "defect",
    units: 480,
    requested: claimValue("SO-4529", 480),
    adjudicated: null,
    policyCap: 6_000,
    photos: 7,
    stage: "under-review",
    openedOn: "18 Aug",
    receipt: "GR-4529-03",
    batch: "B-2419",
    note: `Seam failure on 480 throws from the same lot as the transit damage — a quality-guarantee claim, not a carrier one. ${formatUsd(
      claimValue("SO-4529", 480),
    )} asked against a ${formatUsd(6_000)} cap — this one needs a second signature whatever the outcome.`,
  },
  {
    id: "CLM-2077",
    orderId: "SO-4377",
    account: "Sierra Foothills Mercantile",
    style: "Stoneware Dinnerware Set 16pc",
    kind: "shortage",
    units: 24,
    requested: claimValue("SO-4377", 24),
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
    account: "Eastbay Stores",
    style: "Acacia Serving Board",
    kind: "transit-damage",
    units: 24,
    requested: claimValue("SO-4390", 24),
    adjudicated: claimValue("SO-4390", 24),
    policyCap: 3_000,
    photos: 3,
    stage: "settled",
    openedOn: "14 Jul",
    decidedOn: "16 Jul",
    receipt: "GR-4390-02",
    batch: "B-2427",
    rootCause: "Corner crush at the RDC, not in transit",
    note: "Four cases, settled in two days. Root cause was handling at Woodland, which is why the fleet was not charged.",
  },
  {
    id: "CLM-2088",
    orderId: "SO-4408",
    account: "Columbia Stores",
    style: "Stoneware Dinnerware Set 16pc",
    kind: "wrong-style",
    units: 288,
    requested: claimValue("SO-4408", 288),
    adjudicated: Math.round(claimValue("SO-4408", 288) / 2),
    policyCap: 20_000,
    photos: 4,
    stage: "approved",
    openedOn: "5 Aug",
    decidedOn: "19 Aug",
    receipt: "GR-4408-01",
    batch: "B-2395",
    rootCause: "Glaze variance within spec · half the sets saleable as open stock",
    note: "Half credit agreed with the region — the lot is inside spec and saleable where the match does not show. Approved, awaiting the credit note.",
  },
  {
    id: "CLM-1994",
    orderId: "SO-4402",
    account: "Sierra Foothills Mercantile",
    style: "Chunky Knit Throw Blanket",
    kind: "concealed-damage",
    units: 48,
    requested: claimValue("SO-4402", 48),
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
    account: "Eastbay Stores",
    style: "Chunky Knit Throw Blanket",
    kind: "defect",
    units: 96,
    requested: claimValue("SO-4471", 96),
    adjudicated: null,
    policyCap: 6_000,
    photos: 6,
    stage: "opened",
    openedOn: "21 Aug",
    receipt: "GR-4471-03",
    batch: "B-2419",
    note: "Third claim against lot B-2419. Christy has flagged the lot rather than the order — this is a pattern, not an incident.",
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
 * Four stages an account would recognise. `approved` and `declined` are
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

/** A lot with more than one claim against it is a supplier conversation, not an
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
 *  DEALERS — the accounts the service seat answers to
 *
 *  Four kinds of customer sit behind an RDC order. STORE REGIONS are
 *  the retailer's own districts, planned by set calendar and paid by
 *  intercompany transfer. DIGITAL FULFILLMENT nodes are the ship-to-
 *  home buildings, replenished on a steady programme. WHOLESALE
 *  PARTNERS carry the owned and partner brands in their own doors on
 *  trade terms, and the MARKETPLACE is the newest and thinnest of the
 *  four. Same claims, same re-promises, same substitution lever — the
 *  segment only changes who is on the other end of the phone.
 * ═══════════════════════════════════════════════════════════════ */

export type DealerSegment = "Store region" | "Wholesale partner" | "Marketplace" | "Digital fulfillment";
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
    name: "Eastbay Stores",
    city: "Oakland",
    state: "CA",
    segment: "Store region",
    since: "2014",
    ytdRevenue: 2_840_000,
    onTimePct: 91,
    claimRate: 2.4,
    paymentTerms: "Intercompany transfer",
    tier: "Gold",
    note: "Books set crews tight and expects the date to hold. Carla answers the phone during store hours and rarely emails.",
  },
  {
    id: "DLR-02",
    name: "Redwood Coast Mercantile",
    city: "Eureka",
    state: "CA",
    segment: "Wholesale partner",
    since: "2019",
    ytdRevenue: 1_120_000,
    onTimePct: 86,
    claimRate: 6.8,
    paymentTerms: "Net 30",
    tier: "Silver",
    note: "Highest claim rate on the book, and three of them trace to lot B-2419 rather than to the account. Tony wants a phone call, not a portal.",
  },
  {
    id: "DLR-03",
    name: "Northstar Stores",
    city: "Minneapolis",
    state: "MN",
    segment: "Store region",
    since: "2016",
    ytdRevenue: 1_960_000,
    onTimePct: 88,
    claimRate: 1.9,
    paymentTerms: "Intercompany transfer",
    tier: "Gold",
    note: "Reset calendar planned a season out, so a slip lands early enough to work. Sarah replies to email the same day.",
  },
  {
    id: "DLR-04",
    name: "Rainier Stores",
    city: "Seattle",
    state: "WA",
    segment: "Store region",
    since: "2011",
    ytdRevenue: 3_410_000,
    onTimePct: 93,
    claimRate: 1.2,
    paymentTerms: "Intercompany transfer",
    tier: "Platinum",
    note: "Biggest store region on the book and the least trouble. Normally takes the wait over a substitute, so accepting the Terracotta swap on SO-4463 is out of character — they are protecting a floor-set date, not being easy. Do not spend that twice.",
  },
  {
    id: "DLR-05",
    name: "Sierra Foothills Mercantile",
    city: "Auburn",
    state: "CA",
    segment: "Wholesale partner",
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
    name: "Prairie Home Marketplace",
    city: "Des Moines",
    state: "IA",
    segment: "Marketplace",
    since: "2023",
    ytdRevenue: 410_000,
    onTimePct: 79,
    claimRate: 3.3,
    paymentTerms: "Net 15",
    tier: "Bronze",
    note: "Newest partner and the worst service record — mostly because their orders land on the thinnest cover in the network.",
  },
  {
    id: "DLR-07",
    name: "Columbia Stores",
    city: "Spokane",
    state: "WA",
    segment: "Store region",
    since: "2017",
    ytdRevenue: 2_680_000,
    onTimePct: 84,
    claimRate: 5.2,
    paymentTerms: "Intercompany transfer",
    tier: "Gold",
    note: "Furthest lane out of Woodland, so transit does most of the damage. Two open claims, both against the carrier rather than the supplier.",
  },
  {
    id: "DLR-08",
    name: "Phoenix Fulfillment Center",
    city: "Phoenix",
    state: "AZ",
    segment: "Digital fulfillment",
    since: "2015",
    ytdRevenue: 4_120_000,
    onTimePct: 90,
    claimRate: 0.8,
    paymentTerms: "Intercompany transfer",
    tier: "Platinum",
    note: "Replenishment programme, so volume is steady and lot continuity matters more than speed. Cleanest claim record on the book.",
  },
];

export function dealerByName(name: string): Account | undefined {
  return DEALERS.find((d) => d.name === name);
}

/** Everything open against an account, on both sides of the desk. */
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
