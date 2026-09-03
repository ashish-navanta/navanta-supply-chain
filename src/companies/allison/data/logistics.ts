import { formatUsd } from "./action-center";
import { orderById } from "./service";

/**
 * The logistics seat's book — loads, the fleet that pulls them, the lanes they
 * run on, and what they cost beyond the linehaul.
 *
 * Terrence arbitrates between systems that each hold one piece of the truth. That
 * is the shape of this file: an ETA is never a field, it is a list of claims from
 * named systems at different scopes, and the reconciled answer is derived. Same
 * rule as `service.ts` — a figure that can be computed from the record is
 * computed, so a load's value, its accessorials and its cost per mile cannot
 * disagree with each other across four screens.
 *
 * Where a load carries an `orderId`, its units and value come from that order
 * rather than being restated here. The workshop's 120-unit order runs through
 * LD-70412, LD-70398 and LD-70402, so all four screens tell the same story from
 * the transport seat.
 */

/** Today, as the fixtures date it — the same day `lib/claim.ts` is set on. */
export const TODAY = "21 Aug";

/**
 * "3 lanes", "1 lane".
 *
 * Every count on these screens is derived from the fixtures, so any of them can
 * land on one as the book changes — and a KPI reading "1 lanes" undoes the care
 * taken over the figure above it.
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ═══════════════════════════════════════════════════════════════
 *  LOADS
 * ═══════════════════════════════════════════════════════════════ */

/** Where a load is in the transport run. Drives the stage dots. */
export type LoadStage = "tendered" | "dispatched" | "rolling" | "at-gate" | "delivered";

/* TMS vocabulary, not ours. Tendered, dispatched, in transit, at consignee,
   delivered is the run any transport planner already reads — "Rolling" was
   driver slang and "At gate" belongs to drayage and rail, where there is a gate.
   A account delivery arrives at a consignee. */
export const LOAD_STAGE_LABEL: Record<LoadStage, string> = {
  tendered: "Tendered",
  dispatched: "Dispatched",
  rolling: "In transit",
  "at-gate": "At consignee",
  delivered: "Delivered",
};

/**
 * What is wrong with a load, or that nothing is.
 *
 * Deliberately not a severity. "Damaged" and "unassigned" are different problems
 * needing different people, and collapsing them into red/amber would lose the
 * only thing that says which screen to open next.
 */
export type LoadHealth =
  | "clean"
  | "eta-conflict"
  | "window-risk"
  | "unassigned"
  | "recovering"
  | "damaged";

/* Named the way a freight desk names them. "Systems disagree" described our
   screen rather than the load — the condition is ETA variance between feeds.
   A delivery slot is an appointment, and a load nobody has been offered is
   untendered. */
export const LOAD_HEALTH_LABEL: Record<LoadHealth, string> = {
  clean: "No exception",
  "eta-conflict": "ETA variance",
  "window-risk": "Appointment at risk",
  unassigned: "Untendered",
  recovering: "In recovery",
  damaged: "Damage reported",
};

/** The loads that are not fine. Everything else is running to plan. */
export const LOAD_AT_RISK: ReadonlySet<LoadHealth> = new Set<LoadHealth>([
  "eta-conflict",
  "window-risk",
  "unassigned",
  "recovering",
  "damaged",
]);

/** Own iron or bought capacity — the decision the whole seat turns on. */
export type Haul = "fleet" | "purchased";

/**
 * One system's claim about when a load lands.
 *
 * `scope` is the part that matters and the part the CSR's order-level version
 * does not have. DC appointment book answers at shipment level, Carrier milestone at the trailer,
 * Forwarder feed at the tractor — so three systems can all be right and still
 * disagree, because they are not describing the same object. Showing the scope is
 * what turns a contradiction into an explanation.
 */
export interface LoadEta {
  system: "DC appointment book" | "Carrier milestone" | "Forwarder feed" | "SAP WM" | "TMW / TMT" | "Carrier site";
  scope: "shipment" | "trailer" | "tractor" | "dock" | "order";
  eta: string;
  /** How much the reconciler trusts it, 0–100. */
  confidence: number;
  note: string;
}

/** Proof of delivery. The exception line is the whole point — every system reads
 *  "complete" while the load sits damaged under the wrap. */
export interface Pod {
  signedBy: string;
  at: string;
  /** Set when the receipt was signed with an exception noted. */
  exception?: string;
  /** Pallets short or damaged, where the delivery was not clean. */
  shortPallets?: number;
}

export interface Load {
  id: string;
  /** The sales order this load carries, where there is one. Pallets and value
   *  are read off it rather than restated. */
  orderId?: string;
  account: string;
  lane: string;
  origin: string;
  destination: string;
  miles: number;
  haul: Haul;
  carrier: string;
  /** Power unit, for fleet hauls. */
  unitId?: string;
  trailerId?: string;
  stage: LoadStage;
  health: LoadHealth;
  /** Falls back to these when the load carries no order. */
  ownPallets?: number;
  ownValue?: number;
  /** The delivery appointment, where one is booked. */
  appointment?: string;
  etas: LoadEta[];
  pod?: Pod;
  /** Tova's line — what she already did, then what is left for a person. */
  note: string;
}

export const LOADS: Load[] = [
  /* ── The coolant changeover's legs ──────────────────────────── */
  {
    id: "LD-70412",
    orderId: "SO-4471",
    account: "Plant 12 Maintenance",
    lane: "Indy Central Stores → Plant 12, Indianapolis",
    origin: "Indy Central Stores",
    destination: "Plant 12, Indianapolis",
    miles: 6,
    haul: "fleet",
    carrier: "Stores shuttle",
    unitId: "218",
    trailerId: "TR-4471",
    stage: "rolling",
    health: "eta-conflict",
    appointment: "Today 14:20",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "Today 14:20",
        confidence: 92,
        note: "Shuttle telematics — two stops out on the campus loop, moving, and the only source reading the truck itself.",
      },
      {
        system: "Carrier milestone",
        scope: "trailer",
        eta: "Today 15:40",
        confidence: 74,
        note: "Trailer tracker last pinged 38 minutes ago at the Plant 3 gate — it lags the tractor by design.",
      },
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "Today 17:00",
        confidence: 41,
        note: "Shipment-level estimate built from the pick, not from the truck. Stale by two stops.",
      },
    ],
    note: "Three systems, three answers, one shuttle · the tractor feed is two stops out and the 14:20 dock slot holds",
  },
  {
    id: "LD-70398",
    orderId: "SO-4529",
    account: "Speedway Maintenance",
    lane: "Indy Central Stores → Speedway, IN",
    origin: "Indy Central Stores",
    destination: "Speedway, IN",
    miles: 9,
    haul: "fleet",
    carrier: "Stores shuttle",
    unitId: "104",
    trailerId: "TR-4408",
    stage: "at-gate",
    health: "window-risk",
    appointment: "Today 14:00",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "Today 13:40",
        confidence: 94,
        note: "At the gate, engine idling. Waiting on a dock door.",
      },
      {
        system: "SAP WM",
        scope: "dock",
        eta: "Today 15:30",
        confidence: 68,
        note: "Receiving has one door open and two trucks ahead. The slot is not the reality.",
      },
    ],
    note: "At the gate 20 minutes early · two ahead in the queue, so the 2pm window needs confirming with the crib",
  },
  {
    id: "LD-70402",
    orderId: "SO-4529",
    account: "Speedway Maintenance",
    lane: "Indy Central Stores → Speedway, IN",
    origin: "Indy Central Stores",
    destination: "Speedway, IN",
    miles: 9,
    haul: "fleet",
    carrier: "Stores shuttle",
    unitId: "104",
    trailerId: "TR-4408",
    stage: "delivered",
    health: "damaged",
    ownPallets: 2,
    ownValue: 4_740,
    etas: [
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "8 Aug",
        confidence: 100,
        note: "Delivered, signed, closed.",
      },
      {
        system: "SAP WM",
        scope: "dock",
        eta: "8 Aug",
        confidence: 100,
        note: "Goods receipt GR-4471-02 posted complete.",
      },
    ],
    pod: {
      signedBy: "Tony Bergeron",
      at: "8 Aug · 11:20",
      exception: "2 drums stove in under the strapping — photographed at the tailgate before the driver left",
      shortPallets: 2,
    },
    note: "Every system reads complete · the exception is on the paper receipt only, and the claim is Christy's to settle",
  },

  /* ── Carrier and capacity decisions ─────────────────────────── */
  {
    id: "LD-70455",
    orderId: "SO-4515",
    account: "Indianapolis Facilities",
    lane: "Harvey, IL → Indy Central Stores",
    origin: "Fuchs Lubricants · Harvey, IL",
    destination: "Indy Central Stores",
    miles: 184,
    haul: "purchased",
    carrier: "Freight · Dayton Freight",
    stage: "tendered",
    health: "unassigned",
    appointment: "Tomorrow 09:00",
    etas: [
      {
        system: "TMW / TMT",
        scope: "order",
        eta: "Tomorrow 09:00",
        confidence: 60,
        note: "Tender is out to Dayton Freight and unaccepted. The date is the ask, not a commitment.",
      },
    ],
    note: "Bulk coolant off the Fuchs blend run at Harvey · Dayton Freight quoted $2,400 over the dedicated all-in on this lane · #331 clears Indy Central Stores at 06:40 and could take it",
  },
  {
    id: "LD-70460",
    account: "Plant 3 Maintenance",
    lane: "Indy Central Stores → Plant 3, Indianapolis",
    origin: "Indy Central Stores",
    destination: "Plant 3, Indianapolis",
    miles: 4,
    haul: "fleet",
    carrier: "Dedicated carriage",
    unitId: "331",
    trailerId: "TR-4502",
    stage: "dispatched",
    health: "recovering",
    ownPallets: 72,
    ownValue: 88_400,
    appointment: "Today 16:00",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "Today 16:20",
        confidence: 88,
        note: "Recovery unit rolling from Indy Central Stores. Hours are legal to the relay point.",
      },
    ],
    note: "Original unit went out on a coolant fault on the Lebanon run · recovery costed at $2,400 and ready to dispatch",
  },
  {
    id: "LD-70471",
    account: "Plant 3 Tool Room",
    lane: "Lafayette, IN → Indy Central Stores",
    origin: "Kirby Risk · Lafayette, IN",
    destination: "Indy Central Stores",
    miles: 63,
    haul: "purchased",
    carrier: "Distributor truck · Kirby Risk",
    stage: "tendered",
    health: "unassigned",
    ownPallets: 60,
    ownValue: 41_800,
    appointment: "Today 11:15",
    etas: [
      {
        system: "TMW / TMT",
        scope: "order",
        eta: "Today 11:15",
        confidence: 55,
        note: "Booking window closes at 09:00 — after that the backhaul on this lane is gone.",
      },
    ],
    note: "Empty return on the Lafayette run costs $3,800 a month · a Lafayette backhaul is open and expires at 09:00",
  },

  /* ── Running clean ──────────────────────────────────────────── */
  {
    id: "LD-70470",
    orderId: "SO-4547",
    account: "Plant 14 Maintenance",
    lane: "Indy Central Stores → Plant 14, Indianapolis",
    origin: "Indy Central Stores",
    destination: "Plant 14, Indianapolis",
    miles: 11,
    haul: "fleet",
    carrier: "Dedicated carriage #276",
    unitId: "276",
    trailerId: "TR-4419",
    stage: "rolling",
    health: "clean",
    appointment: "24 Aug 08:00",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "24 Aug 07:40",
        confidence: 93,
        note: "On plan, twenty minutes ahead.",
      },
      {
        system: "Carrier milestone",
        scope: "trailer",
        eta: "24 Aug 07:55",
        confidence: 86,
        note: "Trailer agrees inside the tolerance.",
      },
    ],
    note: "Sources agree inside 15 minutes · nothing to do",
  },
  {
    id: "LD-70466",
    orderId: "SO-4436",
    account: "Szentgotthárd Maintenance",
    lane: "Indy Central Stores → Szentgotthárd Stores",
    origin: "Indy Central Stores",
    destination: "Szentgotthárd Stores",
    miles: 4_780,
    haul: "purchased",
    carrier: "Allison Global Supply · Air",
    stage: "rolling",
    health: "clean",
    appointment: "23 Aug 10:00",
    etas: [
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "23 Aug 10:30",
        confidence: 81,
        note: "Forwarder feed is current — uplifted at Chicago O'Hare this morning.",
      },
      {
        system: "Carrier site",
        scope: "shipment",
        eta: "23 Aug 12:00",
        confidence: 52,
        note: "The airline's portal is a day stale, as usual on this lane.",
      },
    ],
    note: "Purchased lane, forwarder feed current · no dedicated capacity crosses the Atlantic anyway",
  },
  {
    id: "LD-70463",
    orderId: "SO-4488",
    account: "Plant 14 Maintenance",
    lane: "Szentgotthárd Stores → Plant 14, Indianapolis",
    origin: "Szentgotthárd Stores",
    destination: "Plant 14, Indianapolis",
    miles: 4_780,
    haul: "purchased",
    carrier: "Allison Global Supply · Air",
    stage: "dispatched",
    health: "clean",
    appointment: "22 Aug 13:00",
    etas: [
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "22 Aug 12:40",
        confidence: 79,
        note: "Uplifted on time.",
      },
    ],
    note: "Running to plan · the transfer is 6% under the spot air rate on this lane",
  },
  {
    id: "LD-70448",
    orderId: "SO-4444",
    account: "Plant 3 Maintenance",
    lane: "Lafayette, IN → Plant 3, Indianapolis",
    origin: "Kirby Risk · Lafayette, IN",
    destination: "Plant 3, Indianapolis",
    miles: 67,
    haul: "purchased",
    carrier: "Distributor truck · Kirby Risk",
    stage: "dispatched",
    health: "clean",
    appointment: "27 Aug 09:00",
    etas: [
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "27 Aug 09:00",
        confidence: 77,
        note: "Tendered and accepted, loaded this morning.",
      },
    ],
    note: "Direct to the plant dock on the distributor's own truck · the shuttle never touches it, which is the point of the branch",
  },

  /* ── Delivered ──────────────────────────────────────────────── */
  {
    id: "LD-70441",
    orderId: "SO-4377",
    account: "Plant 3 Tool Room",
    lane: "Indy Central Stores → Plant 3 Tool Room, Indianapolis",
    origin: "Indy Central Stores",
    destination: "Plant 3 Tool Room, Indianapolis",
    miles: 4,
    haul: "fleet",
    carrier: "Dedicated carriage #276",
    unitId: "276",
    stage: "delivered",
    health: "clean",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "24 Jul",
        confidence: 100,
        note: "Delivered on the promised date.",
      },
    ],
    pod: { signedBy: "Marcus Reed", at: "24 Jul · 09:15" },
    note: "Signed clean, on the date promised · counted toward the seat's on-time number",
  },
  {
    id: "LD-70433",
    orderId: "SO-4408",
    account: "Szentgotthárd Maintenance",
    lane: "Indy Central Stores → Szentgotthárd Stores",
    origin: "Indy Central Stores",
    destination: "Szentgotthárd Stores",
    miles: 4_780,
    haul: "purchased",
    carrier: "Allison Global Supply · Air",
    stage: "delivered",
    health: "clean",
    etas: [
      {
        system: "DC appointment book",
        scope: "shipment",
        eta: "1 Aug",
        confidence: 100,
        note: "Delivered and signed.",
      },
    ],
    pod: { signedBy: "Dana Voss", at: "1 Aug · 14:05" },
    note: "Delivered clean · demurrage ran 3 hours at the Szentgotthárd dock and is still open at audit",
  },
  {
    id: "LD-70427",
    orderId: "SO-4402",
    account: "Plant 3 Tool Room",
    lane: "Indy Central Stores → Plant 3 Tool Room, Indianapolis",
    origin: "Indy Central Stores",
    destination: "Plant 3 Tool Room, Indianapolis",
    miles: 4,
    haul: "fleet",
    carrier: "Stores shuttle",
    unitId: "218",
    stage: "delivered",
    health: "clean",
    etas: [
      {
        system: "Forwarder feed",
        scope: "tractor",
        eta: "2 Aug",
        confidence: 100,
        note: "Delivered on plan.",
      },
    ],
    pod: { signedBy: "Marcus Reed", at: "2 Aug · 10:40" },
    note: "Signed clean · the shuttle picked up empty dunnage on the return, so the leg ran loaded both ways",
  },
];

/* ── Derived off the load book ──────────────────────────────── */

export function loadById(id: string): Load | undefined {
  return LOADS.find((l) => l.id === id);
}

/** Pallets on a load — from its order where it carries one, so the two records
 *  cannot drift apart. */
export function loadPallets(l: Load): number {
  return l.ownPallets ?? orderById(l.orderId ?? "")?.units ?? 0;
}

/** Load value, on the same rule as `loadPallets`. */
export function loadValue(l: Load): number {
  return l.ownValue ?? orderById(l.orderId ?? "")?.value ?? 0;
}

/** The ETA worth repeating on a call — highest confidence wins, and the scope
 *  goes with it so the answer can be defended. */
export function bestLoadEta(l: Load): LoadEta {
  return [...l.etas].sort((a, b) => b.confidence - a.confidence)[0];
}

/** True when the sources name more than one arrival. The count of distinct
 *  dates, not a spread in minutes — two systems fifteen minutes apart are
 *  agreeing, and flagging that would train the eye to ignore the flag. */
export function hasLoadEtaConflict(l: Load): boolean {
  return new Set(l.etas.map((e) => e.eta)).size > 1;
}

/** How far apart the sources are, for the ones that do disagree. */
export function etaSpread(l: Load): number {
  return new Set(l.etas.map((e) => e.eta)).size;
}

export const inFlightLoads = (): Load[] => LOADS.filter((l) => l.stage !== "delivered");

export const atRiskLoads = (): Load[] => LOADS.filter((l) => LOAD_AT_RISK.has(l.health));

/** Delivered but not delivered clean — the loads a claim may still come out of. */
export const exceptionPods = (): Load[] =>
  LOADS.filter((l) => l.pod?.exception !== undefined);

/* ═══════════════════════════════════════════════════════════════
 *  FLEET
 * ═══════════════════════════════════════════════════════════════ */

export type UnitStatus = "rolling" | "available" | "at-dock" | "maintenance" | "off-duty";

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  rolling: "En route",
  available: "Available",
  "at-dock": "At dock",
  maintenance: "In maintenance",
  "off-duty": "Off duty",
};

/**
 * Hours of service, as the clock the driver is actually against.
 *
 * Two numbers rather than one because they bind at different times: `drivingLeft`
 * ends the shift, `cycleLeft` ends the week. A unit with eight hours today and
 * four on the cycle cannot take a two-day run, and one number cannot say that.
 */
export interface Hos {
  /** Driving hours left in today's 11. */
  drivingLeft: number;
  /** Hours left in the 70-hour eight-day cycle. */
  cycleLeft: number;
  /** When the 34-hour restart becomes available, where it matters. */
  restartAt?: string;
}

export interface Maintenance {
  /** What is next due. */
  item: string;
  dueIn: number;
  /** Miles, or days when the interval is time-based. */
  dueUnit: "miles" | "days";
  /** Booked slot, once there is one. */
  bookedFor?: string;
}

export interface PowerUnit {
  /** Fleet number, as it is spoken — "#218". */
  id: string;
  tractor: string;
  driver: string;
  /** Years holding a CDL. Context for a recovery run, not decoration. */
  driverYears: number;
  domicile: string;
  status: UnitStatus;
  /** The load it is under, when it is under one. */
  loadId?: string;
  trailerId?: string;
  hos: Hos;
  maintenance: Maintenance;
  /** This month, from the telematics feed. */
  loadedMiles: number;
  emptyMiles: number;
  note: string;
}

/* The "fleet": dedicated contract carriage at the Indy Central Stores — carrier-owned
   iron under a monthly commitment, the only wheels Fossil pays for by the
   month. Fossil owns no fleet; the research found no TMS either, which is why
   every ETA on this seat is a list of claims from named systems rather than a
   field. */
export const FLEET: PowerUnit[] = [
  {
    id: "218",
    tractor: "Freightliner Cascadia · 2022",
    driver: "Ray Delgado",
    driverYears: 22,
    domicile: "Indy Central Stores",
    status: "rolling",
    loadId: "LD-70412",
    trailerId: "TR-4471",
    hos: { drivingLeft: 6.5, cycleLeft: 31 },
    maintenance: { item: "PM-B service", dueIn: 3_100, dueUnit: "miles" },
    loadedMiles: 8_240,
    emptyMiles: 1_180,
    note: "Under the Atlanta load and 41 miles out · hours are comfortable for a backhaul on the return",
  },
  {
    id: "104",
    tractor: "Peterbilt 579 · 2021",
    driver: "Wanda Kessler",
    driverYears: 14,
    domicile: "Indy Central Stores",
    status: "at-dock",
    loadId: "LD-70398",
    trailerId: "TR-4408",
    hos: { drivingLeft: 2.0, cycleLeft: 12 },
    maintenance: { item: "DOT annual inspection", dueIn: 9, dueUnit: "days", bookedFor: "28 Aug" },
    loadedMiles: 9_910,
    emptyMiles: 2_040,
    note: "Two hours left today and sitting in a dock queue · detention here costs the shift, not just the money",
  },
  {
    id: "331",
    tractor: "Freightliner Cascadia · 2023",
    driver: "Cole Buchanan",
    driverYears: 9,
    domicile: "Indy Central Stores",
    status: "available",
    hos: { drivingLeft: 11, cycleLeft: 58 },
    maintenance: { item: "PM-A service", dueIn: 6_400, dueUnit: "miles" },
    loadedMiles: 7_120,
    emptyMiles: 890,
    note: "Cleared Indy Central Stores at 06:40 with a full clock · the only unit legal for either the recovery or the Savannah tender",
  },
  {
    id: "276",
    tractor: "Kenworth T680 · 2020",
    driver: "Alma Reyes",
    driverYears: 17,
    domicile: "Fort Worth, TX",
    status: "rolling",
    loadId: "LD-70470",
    trailerId: "TR-4419",
    hos: { drivingLeft: 4.5, cycleLeft: 22 },
    maintenance: { item: "Brake relining", dueIn: 1_200, dueUnit: "miles" },
    loadedMiles: 8_760,
    emptyMiles: 1_610,
    note: "Brakes due inside 1,200 miles · the Asheville return uses 214 of them, so book the slot this week",
  },
  {
    id: "155",
    tractor: "Peterbilt 579 · 2019",
    driver: "Dwight Osei",
    driverYears: 26,
    domicile: "Fort Worth, TX",
    status: "maintenance",
    hos: { drivingLeft: 11, cycleLeft: 44 },
    maintenance: {
      item: "Coolant system — failed on LD-70460",
      dueIn: 0,
      dueUnit: "days",
      bookedFor: "In the shop now",
    },
    loadedMiles: 6_480,
    emptyMiles: 1_950,
    note: "Out of the pool since the Chattanooga fault · this is the unit LD-70460 is recovering from",
  },
  {
    id: "402",
    tractor: "Volvo VNL 760 · 2022",
    driver: "Priya Raman",
    driverYears: 7,
    domicile: "Indy Central Stores",
    status: "available",
    hos: { drivingLeft: 9, cycleLeft: 16 },
    maintenance: { item: "PM-A service", dueIn: 2_800, dueUnit: "miles" },
    loadedMiles: 8_010,
    emptyMiles: 2_330,
    note: "Nine hours today but only 16 on the cycle · fine for a regional run, not for anything overnight",
  },
  {
    id: "289",
    tractor: "Kenworth T680 · 2021",
    driver: "Hal Mercer",
    driverYears: 31,
    domicile: "Indy Central Stores",
    status: "off-duty",
    hos: { drivingLeft: 0, cycleLeft: 4, restartAt: "Tomorrow 06:00" },
    maintenance: { item: "PM-B service", dueIn: 4_900, dueUnit: "miles" },
    loadedMiles: 9_240,
    emptyMiles: 1_040,
    note: "On a 34-hour restart until 06:00 tomorrow · nothing can be planned on this unit today",
  },
  {
    id: "347",
    tractor: "Freightliner Cascadia · 2023",
    driver: "Tess Okonkwo",
    driverYears: 11,
    domicile: "Fort Worth, TX",
    status: "available",
    hos: { drivingLeft: 11, cycleLeft: 61 },
    maintenance: { item: "Tyre rotation", dueIn: 5_600, dueUnit: "miles" },
    loadedMiles: 5_890,
    emptyMiles: 720,
    note: "Full clock and the best loaded ratio in the fleet · under-used because Cline Tool & Service Co dispatches by habit",
  },
];

/* ── Derived off the fleet ──────────────────────────────────── */

export function unitById(id: string): PowerUnit | undefined {
  return FLEET.find((u) => u.id === id);
}

/** Miles run loaded, as a share of all miles. The number that says whether the
 *  fleet is being run as an asset. */
export function utilisation(u: PowerUnit): number {
  const total = u.loadedMiles + u.emptyMiles;
  return total === 0 ? 0 : Math.round((u.loadedMiles / total) * 100);
}

export function fleetUtilisation(): number {
  const loaded = FLEET.reduce((s, u) => s + u.loadedMiles, 0);
  const empty = FLEET.reduce((s, u) => s + u.emptyMiles, 0);
  const total = loaded + empty;
  return total === 0 ? 0 : Math.round((loaded / total) * 100);
}

/** Units that could take work right now — available, and with a clock that
 *  allows it. Off-duty and in-shop units are not capacity. */
export const availableUnits = (): PowerUnit[] =>
  FLEET.filter((u) => u.status === "available" && u.hos.drivingLeft > 0);

/**
 * A unit is on the watchlist when the record says something will bite this week:
 * maintenance inside 1,500 miles or 10 days, or a cycle that will not carry a
 * full shift. Derived, never stored — a flag that can disagree with the numbers
 * underneath it is worse than no flag.
 */
export function onWatch(u: PowerUnit): string | null {
  if (u.status === "maintenance") return "In the shop";
  if (u.maintenance.dueUnit === "miles" && u.maintenance.dueIn <= 1_500) {
    return `${u.maintenance.item} due in ${u.maintenance.dueIn.toLocaleString()} miles`;
  }
  if (u.maintenance.dueUnit === "days" && u.maintenance.dueIn <= 10) {
    return `${u.maintenance.item} due in ${u.maintenance.dueIn} days`;
  }
  if (u.hos.cycleLeft < 20) return `Only ${u.hos.cycleLeft}h left on the cycle`;
  return null;
}

export const unitsOnWatch = (): PowerUnit[] => FLEET.filter((u) => onWatch(u) !== null);

/* ═══════════════════════════════════════════════════════════════
 *  LANES & RATES
 * ═══════════════════════════════════════════════════════════════ */

/**
 * A lane, with both sides of the fleet-versus-purchased question on it.
 *
 * `fleetCostPerMile` is all-in — driver, fuel, maintenance and the empty return
 * the lane actually runs. Quoting a fleet rate without the empty return is how a
 * lane looks cheap on own iron and is not, which is the specific mistake this
 * page exists to stop.
 */
export interface Lane {
  id: string;
  origin: string;
  destination: string;
  miles: number;
  loadsThisMonth: number;
  palletsThisMonth: number;
  /** All-in, including the empty return. */
  fleetCostPerMile: number;
  /** Freight audit benchmark for bought capacity on this lane. */
  purchasedRatePerMile: number;
  /** Share of this month's loads that ran on own iron, 0–100. */
  fleetShare: number;
  /** Share of return legs that ran loaded, 0–100. */
  backhaulCoverage: number;
  note: string;
}

export const LANES: Lane[] = [
  /* The outbound wholesale legs out of Dallas, plus the inbound dray. Fossil
     owns no fleet — "fleet" on these rows is DEDICATED CONTRACT CARRIAGE, a
     handful of units under a monthly commitment at the Indy Central Stores. The
     fleet-vs-purchased economics are real; the iron is the carrier's. */
  {
    id: "DAL-ATL",
    origin: "Indy Central Stores",
    destination: "Atlanta, GA",
    miles: 781,
    loadsThisMonth: 34,
    palletsThisMonth: 2_890,
    fleetCostPerMile: 2.18,
    purchasedRatePerMile: 2.74,
    fleetShare: 88,
    backhaulCoverage: 71,
    note: "Dense wholesale corridor — the dedicated units win clearly and already run it",
  },
  {
    id: "DAL-BHM",
    origin: "Indy Central Stores",
    destination: "Birmingham, AL",
    miles: 653,
    loadsThisMonth: 19,
    palletsThisMonth: 1_240,
    fleetCostPerMile: 2.31,
    purchasedRatePerMile: 2.66,
    fleetShare: 32,
    backhaulCoverage: 24,
    note: "Dedicated is $0.35 cheaper and runs a third of it · the empty return is what closed the gap",
  },
  {
    id: "LGB-DAL",
    origin: "Long Beach Port",
    destination: "Indy Central Stores",
    miles: 1_437,
    loadsThisMonth: 22,
    palletsThisMonth: 1_870,
    fleetCostPerMile: 2.06,
    purchasedRatePerMile: 2.44,
    fleetShare: 18,
    backhaulCoverage: 63,
    note: "The ocean book's inland leg — everything that sails lands here. Intermodal bought out of habit; the dedicated rate is $0.38 under on the weeks a unit is clear",
  },
  {
    id: "DAL-HOU",
    origin: "Indy Central Stores",
    destination: "Houston, TX",
    miles: 239,
    loadsThisMonth: 16,
    palletsThisMonth: 980,
    fleetCostPerMile: 2.42,
    purchasedRatePerMile: 2.51,
    fleetShare: 61,
    backhaulCoverage: 44,
    note: "Close to even · the return coverage is what decides it either way on this lane",
  },
  {
    id: "DAL-GSO",
    origin: "Indy Central Stores",
    destination: "Greensboro, NC",
    miles: 1_053,
    loadsThisMonth: 13,
    palletsThisMonth: 840,
    fleetCostPerMile: 2.29,
    purchasedRatePerMile: 2.58,
    fleetShare: 74,
    backhaulCoverage: 81,
    note: "Best return coverage on the book — Greensboro reloads reliably, which is what makes dedicated cheap here",
  },
  {
    id: "DAL-BIL",
    origin: "Indy Central Stores",
    destination: "Biloxi, MS",
    miles: 512,
    loadsThisMonth: 9,
    palletsThisMonth: 620,
    fleetCostPerMile: 2.61,
    purchasedRatePerMile: 2.49,
    fleetShare: 66,
    backhaulCoverage: 18,
    note: "Purchased is $0.12 cheaper and dedicated still runs two-thirds · a Gulf-coast return almost never reloads",
  },
  {
    id: "DFW-AIR",
    origin: "DFW airfreight",
    destination: "Indy Central Stores",
    miles: 28,
    loadsThisMonth: 11,
    palletsThisMonth: 660,
    fleetCostPerMile: 2.66,
    purchasedRatePerMile: 2.50,
    fleetShare: 9,
    backhaulCoverage: 36,
    note: "The air book's last mile — recovery and launch freight off the HKG consolidations. Bought, correctly, and worth leaving alone",
  },
  {
    id: "DAL-SLC",
    origin: "Indy Central Stores",
    destination: "Salt Lake City, UT",
    miles: 1_240,
    loadsThisMonth: 7,
    palletsThisMonth: 410,
    fleetCostPerMile: 2.88,
    purchasedRatePerMile: 2.34,
    fleetShare: 0,
    backhaulCoverage: 12,
    note: "Long haul, no dedicated share and none wanted · the hours alone rule it out",
  },
];

export function laneById(id: string): Lane | undefined {
  return LANES.find((l) => l.id === id);
}

/** Fleet advantage per mile. Positive means own iron is cheaper. */
export function laneDelta(l: Lane): number {
  return Number((l.purchasedRatePerMile - l.fleetCostPerMile).toFixed(2));
}

/** What the current split costs against running every load the cheaper way, for
 *  a month. The number that makes "decided by habit" visible as money. */
export function laneHabitCost(l: Lane): number {
  const delta = laneDelta(l);
  /* Loads on the dearer option: the purchased share when fleet is cheaper, the
     fleet share when it is not. */
  const wrongShare = delta > 0 ? (100 - l.fleetShare) / 100 : l.fleetShare / 100;
  return Math.round(Math.abs(delta) * l.miles * l.loadsThisMonth * wrongShare);
}

/**
 * The point below which a lane's split is not worth arguing about.
 *
 * Set against a month of freight rather than picked round: under this the gap is
 * inside the noise of a fuel week, and a rebalancing list that includes it trains
 * the reader to skim the list.
 */
export const HABIT_FLOOR = 250;

/** Lanes where the split is leaving money on the table, worst first. */
export const lanesToRebalance = (): Lane[] =>
  [...LANES]
    .filter((l) => laneHabitCost(l) >= HABIT_FLOOR)
    .sort((a, b) => laneHabitCost(b) - laneHabitCost(a));

/**
 * Money to the dollar.
 *
 * The shared `formatUsd` rounds to whole thousands above $1,000, which is right
 * for a load value — nobody negotiates a $142,800 order on the last $800. It is
 * wrong for the cost of habit, where $2,139 and $2,499 would both read "$2K" and
 * the figure is the entire argument for changing a lane's split.
 */
export function formatUsdExact(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/* ── Backhaul ───────────────────────────────────────────────── */

/** A return leg somebody else will pay for. Expires because the booking window
 *  is the whole constraint — a backhaul found after dispatch is not a backhaul. */
export interface BackhaulOffer {
  id: string;
  laneId: string;
  shipper: string;
  pickup: string;
  deliver: string;
  revenue: number;
  milesOutOfRoute: number;
  /** How long the booking window has left, in hours. */
  expiresInHours: number;
  /** The unit whose empty return this would fill. */
  unitId?: string;
}

export const BACKHAULS: BackhaulOffer[] = [
  {
    id: "BH-2214",
    laneId: "RGD-BHM",
    shipper: "Alabama Paper Mills",
    pickup: "Birmingham, AL · Today 15:00",
    deliver: "Chattanooga, TN · Today 19:30",
    revenue: 1_180,
    milesOutOfRoute: 12,
    expiresInHours: 2,
    unitId: "331",
  },
  {
    id: "BH-2209",
    laneId: "DAL-ATL",
    shipper: "Georgia Packaging Co.",
    pickup: "Atlanta, GA · Today 16:30",
    deliver: "Dallas, TX · Today 19:00",
    revenue: 640,
    milesOutOfRoute: 4,
    expiresInHours: 4,
    unitId: "218",
  },
  {
    id: "BH-2221",
    laneId: "DAL-GSO",
    shipper: "Carolina Textiles",
    pickup: "Greensboro, NC · Tomorrow 07:00",
    deliver: "Dallas, TX · Tomorrow 15:00",
    revenue: 1_420,
    milesOutOfRoute: 8,
    expiresInHours: 19,
  },
  {
    id: "BH-2218",
    laneId: "CTV-AVL",
    shipper: "Blue Ridge Lumber",
    pickup: "Asheville, NC · Tomorrow 09:00",
    deliver: "Indy Central Stores · Tomorrow 14:30",
    revenue: 890,
    milesOutOfRoute: 21,
    expiresInHours: 21,
    unitId: "276",
  },
  {
    id: "BH-2226",
    laneId: "SAV-RGD",
    shipper: "Port Logistics Group",
    pickup: "Savannah, GA · Tomorrow 11:00",
    deliver: "Atlanta, GA · Tomorrow 17:00",
    revenue: 1_060,
    milesOutOfRoute: 6,
    expiresInHours: 26,
  },
];

/** Offers still inside their booking window, soonest to expire first — the only
 *  order that matters when the window is the constraint. */
export const openBackhauls = (): BackhaulOffer[] =>
  [...BACKHAULS].sort((a, b) => a.expiresInHours - b.expiresInHours);

/* ═══════════════════════════════════════════════════════════════
 *  FREIGHT SPEND
 * ═══════════════════════════════════════════════════════════════ */

export type AccessorialKind =
  | "detention"
  | "layover"
  | "reconsignment"
  | "redelivery"
  | "lumper"
  | "fuel-surcharge";

export const ACCESSORIAL_LABEL: Record<AccessorialKind, string> = {
  detention: "Detention",
  layover: "Layover",
  reconsignment: "Reconsignment",
  redelivery: "Redelivery",
  lumper: "Lumper fee",
  "fuel-surcharge": "Fuel surcharge",
};

/**
 * A charge beyond the linehaul.
 *
 * `accruing` is the state this whole screen exists for. At freight audit every
 * one of these is `booked` and weeks old, which is a fact rather than a decision.
 * A detention clock running right now at a account's dock is something Terrence
 * can pick up a phone about.
 */
export interface Accessorial {
  id: string;
  loadId: string;
  account: string;
  kind: AccessorialKind;
  status: "accruing" | "booked" | "disputed";
  /** Hours the contract allows free before the charge starts. */
  freeHours?: number;
  /** Hours elapsed at the dock so far. */
  elapsedHours?: number;
  ratePerHour?: number;
  /** Charged so far, or finally. Derived for accruing detention. */
  amount: number;
  note: string;
}

export const ACCESSORIALS: Accessorial[] = [
  {
    id: "AC-8841",
    loadId: "LD-70398",
    account: "Speedway Maintenance",
    kind: "detention",
    status: "accruing",
    freeHours: 2,
    elapsedHours: 2.6,
    ratePerHour: 85,
    amount: 51,
    note: "Clock running now — #104 is in the gate queue with two ahead and two hours left on the driver's day",
  },
  {
    id: "AC-8836",
    loadId: "LD-70412",
    account: "Plant 12 Maintenance",
    kind: "detention",
    status: "accruing",
    freeHours: 2,
    elapsedHours: 0,
    ratePerHour: 85,
    amount: 0,
    note: "Not started · arriving 14:20 against a 14:20 appointment, so the free window should cover it",
  },
  {
    id: "AC-8802",
    loadId: "LD-70433",
    account: "Szentgotthárd Maintenance",
    kind: "detention",
    status: "booked",
    freeHours: 2,
    elapsedHours: 5,
    ratePerHour: 92,
    amount: 276,
    note: "Three hours over at Portland · third time this quarter on the same receiving dock",
  },
  {
    id: "AC-8798",
    loadId: "LD-70433",
    account: "Szentgotthárd Maintenance",
    kind: "lumper",
    status: "booked",
    amount: 340,
    note: "Portland requires a lumper and does not pre-notify · it lands at audit every time",
  },
  {
    id: "AC-8815",
    loadId: "LD-70460",
    account: "Plant 3 Maintenance",
    kind: "layover",
    status: "accruing",
    amount: 350,
    note: "Recovery unit lays over at Indy Central Stores tonight · costed into the $2,400 recovery, not a surprise",
  },
  {
    id: "AC-8790",
    loadId: "LD-70441",
    account: "Plant 3 Tool Room",
    kind: "detention",
    status: "booked",
    freeHours: 2,
    elapsedHours: 2.4,
    ratePerHour: 78,
    amount: 31,
    note: "Twenty-four minutes over · inside tolerance and not worth a call",
  },
  {
    id: "AC-8823",
    loadId: "LD-70448",
    account: "Plant 3 Maintenance",
    kind: "fuel-surcharge",
    status: "disputed",
    amount: 418,
    note: "Kuehne+Nagel billed the surcharge against a stale index · disputed 14 Aug, no answer yet",
  },
  {
    id: "AC-8779",
    loadId: "LD-70427",
    account: "Plant 3 Tool Room",
    kind: "redelivery",
    status: "booked",
    amount: 265,
    note: "Site closed on arrival, redelivered next morning · the appointment was never confirmed",
  },
  {
    id: "AC-8845",
    loadId: "LD-70466",
    account: "Szentgotthárd Maintenance",
    kind: "reconsignment",
    status: "accruing",
    amount: 480,
    note: "Portland asked for a different door mid-transit · Old Dominion will bill it, so it is booked before it arrives",
  },
];

/* ── Derived off spend ──────────────────────────────────────── */

/** Detention accruing right now, priced from the clock rather than stored — so
 *  the figure on screen is the figure at this moment. */
export function detentionNow(a: Accessorial): number {
  if (a.kind !== "detention" || a.status !== "accruing") return a.amount;
  const over = (a.elapsedHours ?? 0) - (a.freeHours ?? 0);
  return over <= 0 ? 0 : Math.round(over * (a.ratePerHour ?? 0));
}

export const accruingNow = (): Accessorial[] =>
  ACCESSORIALS.filter((a) => a.status === "accruing");

export function accessorialsFor(loadId: string): Accessorial[] {
  return ACCESSORIALS.filter((a) => a.loadId === loadId);
}

/**
 * What a account costs beyond the freight — the number pricing actually wants,
 * and the one that turns a chronically slow dock from a mood into a figure.
 */
export function costToServe(account: string): {
  account: string;
  accessorials: number;
  charges: Accessorial[];
  loads: number;
} {
  const charges = ACCESSORIALS.filter((a) => a.account === account);
  return {
    account,
    accessorials: charges.reduce((s, a) => s + detentionNow(a), 0),
    charges,
    loads: LOADS.filter((l) => l.account === account).length,
  };
}

/** Every account with a charge against them, dearest first. */
export function costToServeBook() {
  return [...new Set(ACCESSORIALS.map((a) => a.account))]
    .map(costToServe)
    .sort((a, b) => b.accessorials - a.accessorials);
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK — the figures the seat's screens open on
 * ═══════════════════════════════════════════════════════════════ */

export const LOGISTICS_BOOK = {
  get loadsInFlight() {
    return inFlightLoads().length;
  },
  get atRisk() {
    return atRiskLoads().length;
  },
  get etaConflicts() {
    return inFlightLoads().filter(hasLoadEtaConflict).length;
  },
  get inFlightValue() {
    return inFlightLoads().reduce((s, l) => s + loadValue(l), 0);
  },
  get unitsAvailable() {
    return availableUnits().length;
  },
  get fleetUtilisation() {
    return fleetUtilisation();
  },
  get accruingSpend() {
    return accruingNow().reduce((s, a) => s + detentionNow(a), 0);
  },
  get habitCost() {
    return lanesToRebalance().reduce((s, l) => s + laneHabitCost(l), 0);
  },
  get backhaulRevenue() {
    return BACKHAULS.reduce((s, b) => s + b.revenue, 0);
  },
} as const;

/** Loads that landed on the appointment they were given, as a percentage. The
 *  seat's headline number, computed rather than asserted. */
export function loadsOnTime(): { pct: number; kept: number; total: number } {
  const done = LOADS.filter((l) => l.stage === "delivered");
  const kept = done.filter((l) => l.pod?.exception === undefined);
  return {
    pct: done.length === 0 ? 0 : Math.round((kept.length / done.length) * 100),
    kept: kept.length,
    total: done.length,
  };
}

/** One money formatter across the seat, and it is the queue's. */
export { formatUsd };
