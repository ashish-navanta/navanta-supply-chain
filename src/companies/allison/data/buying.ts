/* ═══════════════════════════════════════════════════════════════
 *  Allison Transmission — the indirect buying desk beyond the queue
 *
 *  Mercer's whole book: the vendor roster, the opportunity feed
 *  and the value ledger. Grounded in the operating reality the
 *  spend cube established — $109.3M of MRO across 1,824 vendors on
 *  two entities (AT in Indianapolis and Speedway, AOH in
 *  Szentgotthárd and Chennai), a blanket-PO distributor book with
 *  no master agreements, OEM sole-source spares that are spec-locked
 *  and carved out of "addressable", and a lever routing that is
 *  arithmetic rather than judgement: winner share ≥ 50% consolidates
 *  to the incumbent, anything under it goes to competitive RFP.
 */

/* ─── Money ──────────────────────────────────────────────────────── */

/** Compact dollars for cells and stat values — $2.1M, $840K, $312. */
export function money(n: number): string {
  /* Billions keep their own unit even though this book never reaches one — the
     executive seat reads the same formatter across every pack, and "$3682.2M"
     is four digits a reader has to count the places on, which is the one thing
     a unit exists to prevent. */
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** A savings band as one string — "$594K – $951K". */
export function band(low: number, high: number): string {
  return `${money(low)} – ${money(high)}`;
}

/* ═══════════════════════════════════════════════════════════════
 *  SUPPLIERS
 * ═══════════════════════════════════════════════════════════════ */

export type SupplierStatus =
  | "preferred"
  | "active"
  | "dual-source-candidate"
  | "consolidation-target"
  | "exit-planned";

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  preferred: "Preferred",
  active: "Active",
  "dual-source-candidate": "Dual-source candidate",
  "consolidation-target": "Consolidation target",
  "exit-planned": "Exit planned",
};

/** Which way the last four quarters of quoted lead time have moved. */
export type LeadTimeTrend = "improving" | "stable" | "slipping";

/** How much of this record we can actually stand behind. The vendor master was
 *  built through three paths — SAP ECC for AT, a separate AOH master, and the
 *  Maximo vendor list the crews requisition against — so terms and lead times
 *  are genuinely missing in places. The gap is the point, not a placeholder. */
export type Reliability = "high" | "medium" | "low";

/** One weighted line of the supplier score. The weights sum to 1. */
export interface ScoreLine {
  key: string;
  label: string;
  weight: number;
  score: number;
  note: string;
}

export interface Supplier {
  id: string;
  name: string;
  /** True for an Allison-operated source — the integrated-supply crib and the
   *  plant stores that transfer between sites. An internal source is
   *  rescheduled, not renegotiated, so the whole page treats the two
   *  differently. Four of these exist, and three are the Maximo ↔ SAP seam
   *  question. */
  own: boolean;
  site: string;
  country: string;
  region: "Midwest US" | "Europe" | "Asia" | "Other" | (string & {});
  /** What they supply, in the book's own MRO family language. */
  categories: string[];
  annualSpend: number;
  /** Share of the category this supplier holds, 0–100. */
  categoryShare: number;
  quotedLeadDays: number;
  leadTimeTrend: LeadTimeTrend;
  /** On time in full across the last 12 months, 0–100. */
  otifPct: number;
  /**
   * Lines delivered complete, 0–100 — the "in full" half of OTIF on its own.
   *
   * Held apart from `otifPct` because a single number cannot tell a distributor
   * who ships short from one who ships late, and those are different
   * conversations: one is a branch-stock problem, the other is a lead-time
   * problem. OTIF is the joint measure and is therefore always the lower of the
   * two — the gap between them is the volume that arrived complete but arrived
   * late.
   */
  fillRatePct: number;
  /** Rejected units per thousand received. */
  rejectRate: number;
  /** Null where the three vendor masters left no term on file. */
  paymentTermsDays: number | null;
  reliability: Reliability;
  score: number;
  scoreLines: ScoreLine[];
  status: SupplierStatus;
  contractExpiry: string | null;
  openPos: number;
  openPoValue: number;
  /** Mercer's one-line read on the relationship. */
  note: string;
}

/** Build the composite from its lines so the number on the row and the
 *  breakdown in the panel can never disagree. */
function composite(lines: ScoreLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.weight * l.score, 0));
}

function S(s: Omit<Supplier, "score">): Supplier {
  return { ...s, score: composite(s.scoreLines) };
}

/** The five criteria every supplier is scored on. Same weights for everyone,
 *  so two vendors in a category are genuinely comparable. */
const LINES = (
  cost: number,
  delivery: number,
  quality: number,
  resilience: number,
  terms: number,
  notes: [string, string, string, string, string],
): ScoreLine[] => [
  { key: "cost", label: "Landed cost vs benchmark", weight: 0.3, score: cost, note: notes[0] },
  { key: "delivery", label: "Delivery reliability", weight: 0.25, score: delivery, note: notes[1] },
  { key: "quality", label: "Quality & claims", weight: 0.2, score: quality, note: notes[2] },
  { key: "resilience", label: "Resilience & capacity", weight: 0.15, score: resilience, note: notes[3] },
  { key: "terms", label: "Commercial terms", weight: 0.1, score: terms, note: notes[4] },
];

export const SUPPLIERS: Supplier[] = [
  /* ─── The Indiana distributors — where the machine-repairs book comes from ──
     Every name here is a real vendor on the spend cube. Sites are the
     servicing branch on the vendor master, not a corporate address — a
     distributor is bought from the branch that delivers to the dock. */
  S({
    id: "SUP-01",
    name: "Cline Tool & Service Co",
    own: false,
    site: "Indianapolis",
    country: "United States",
    region: "Midwest US",
    categories: ["Machine repair parts · Spindles & rebuilds"],
    annualSpend: 8_300_000,
    categoryShare: 64,
    quotedLeadDays: 21,
    leadTimeTrend: "slipping",
    otifPct: 91,
    fillRatePct: 97,
    rejectRate: 2.4,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(82, 74, 88, 71, 70, [
      "2.8% under the Midwest repair-parts benchmark on landed cost",
      "91% OTIF · quoted rebuild turn moved 14 → 21 days this quarter",
      "2.4 rejects per thousand units · no open quality claims",
      "One spindle line on the Plant 12 book, no qualified backup",
      "Net 60 · no early-payment discount on file",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 14,
    openPoValue: 1_180_000,
    /* Blanket-PO, like the whole distributor book: no master agreement exists
       to expire. The `contractExpiry: null` is the fact, not a data gap. */
    note: "The anchor of the machine-repairs family — 64% of the category on one roof. Cheapest landed cost we hold, and the longest rebuild turn on it.",
  }),
  S({
    id: "SUP-02",
    name: "Kirby Risk Supply Co",
    own: false,
    site: "Lafayette",
    country: "United States",
    region: "Midwest US",
    categories: ["Machine repair parts · Drives & motors", "Electrical · Allen-Bradley distribution"],
    annualSpend: 2_500_000,
    categoryShare: 19,
    quotedLeadDays: 14,
    leadTimeTrend: "stable",
    otifPct: 87,
    fillRatePct: 94,
    rejectRate: 3.1,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(76, 68, 79, 78, 62, [
      "At benchmark on drives, 2% over on Allen-Bradley pass-through",
      "87% OTIF · two same-day runs from Lafayette missed the dock cutoff last quarter",
      "3.1 rejects per thousand · one open contactor-coil claim",
      "Second branch stocked — capacity to take Cline overflow on parts",
      "Net 60 · the only distributor quoting an early-payment discount",
    ]),
    status: "consolidation-target",
    contractExpiry: null,
    openPos: 11,
    openPoValue: 410_000,
    note: "The electrical distributor — and 19% of machine repair parts that overlap Cline's book. The Allen-Bradley pass-through is OEM-locked; the overlap is the consolidation.",
  }),
  S({
    id: "SUP-03",
    name: "Lemak LLC",
    own: false,
    site: "Indianapolis",
    country: "United States",
    region: "Midwest US",
    categories: ["Chemicals · Process fluids"],
    annualSpend: 5_100_000,
    categoryShare: 41,
    quotedLeadDays: 10,
    leadTimeTrend: "improving",
    otifPct: 94,
    fillRatePct: 98,
    rejectRate: 1.8,
    paymentTermsDays: 45,
    reliability: "medium",
    scoreLines: LINES(74, 84, 82, 66, 68, [
      "1.9% over benchmark on coolant concentrate, closing on volume",
      "94% OTIF · best delivery record on the book",
      "1.8 rejects per thousand · drum-contamination claims closed out",
      "41% of chemicals on one vendor — the concentration is ours, not theirs",
      "Net 45 · terms renegotiated at the May review",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 6,
    openPoValue: 320_000,
    note: "The largest chemicals holder at 41% — under the 50% line, so the lever is an RFP, not an award. Watch the concentration, not the supplier.",
  }),
  S({
    id: "SUP-04",
    name: "Fuchs Lubricants Co.",
    own: false,
    site: "Harvey, IL",
    country: "United States",
    region: "Midwest US",
    categories: ["Chemicals · Metalworking fluids"],
    annualSpend: 3_400_000,
    categoryShare: 27,
    quotedLeadDays: 12,
    leadTimeTrend: "stable",
    otifPct: 84,
    fillRatePct: 92,
    rejectRate: 4.2,
    paymentTermsDays: 45,
    reliability: "medium",
    scoreLines: LINES(80, 62, 70, 74, 66, [
      "4.1% under benchmark — the reason the Szentgotthárd volume moved here",
      "84% OTIF · drum freight from Harvey, so every slip is a week's slip",
      "4.2 rejects per thousand · concentration-drift claims trending down",
      "Two plants, one blend — a formulation change hits both at once",
      "Net 45 · no terms movement in two years",
    ]),
    status: "dual-source-candidate",
    contractExpiry: null,
    openPos: 8,
    openPoValue: 290_000,
    note: "The metalworking-fluids anchor since the Szentgotthárd switch. Already on both entities' vendor masters — the RFP reaches all three plants through this row.",
  }),
  S({
    id: "SUP-05",
    name: "Qualichem Inc.",
    own: false,
    site: "Salem, VA",
    country: "United States",
    region: "Other",
    categories: ["Chemicals · Coolant concentrate"],
    annualSpend: 1_900_000,
    categoryShare: 15,
    quotedLeadDays: 18,
    leadTimeTrend: "slipping",
    otifPct: 79,
    fillRatePct: 90,
    rejectRate: 5.6,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(84, 54, 61, 58, 40, [
      "6% under benchmark — cheapest concentrate in the book",
      "79% OTIF · the worst delivery record we still buy from",
      "5.6 rejects per thousand · two open sump-foaming claims",
      "One plant, one blend line, no second site",
      "No payment term on file — onboarded through the Maximo vendor list",
    ]),
    status: "dual-source-candidate",
    contractExpiry: null,
    openPos: 4,
    openPoValue: 120_000,
    note: "Cheap and fragile. The terms gap is a data problem before it is a commercial one.",
  }),

  /* ─── Allison-operated sources — the crib and the plant stores ───────────
     Fastenal Onsite is the dedicated integrated-supply crib at Indy Central
     Stores. The three entries after it are plant storerooms that transfer
     stock between sites — whether a transfer is booked on Maximo or on SAP
     depends on which side of the seam the crew requisitioned from, which is
     one of the genuinely open questions, and their rows say so rather than
     resolving it. */
  S({
    id: "SUP-06",
    name: "Fastenal Onsite (Integrated Supply)",
    own: true,
    site: "Indianapolis · Indy Central Stores",
    country: "United States",
    region: "Midwest US",
    categories: ["Industrial supplies · Onsite crib"],
    annualSpend: 9_800_000,
    categoryShare: 29,
    quotedLeadDays: 3,
    leadTimeTrend: "stable",
    otifPct: 95,
    fillRatePct: 99,
    rejectRate: 1.2,
    paymentTermsDays: 45,
    reliability: "high",
    scoreLines: LINES(70, 88, 90, 62, 50, [
      "Cost-plus on the crib catalogue — the benchmark is a contract, not a market",
      "95% OTIF · the best record on the book, on the shortest leg",
      "1.2 rejects per thousand · vending and bin-stock audited quarterly",
      "One crib, one shift of Fastenal staff — the second shift is the integrated-supply play",
      "Net 45 on the managed-inventory agreement · no discount structure",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 5,
    openPoValue: 420_000,
    note: "The onsite crib — 29% of Industrial Supplies already, and the roof the 1,093-vendor tail can land on. Exactly why the integrated-supply play keeps coming up.",
  }),
  S({
    id: "SUP-07",
    name: "Szentgotthárd Stores (AOH)",
    own: true,
    site: "Szentgotthárd",
    country: "Hungary",
    region: "Europe",
    categories: ["Plant stores · Inter-plant transfer"],
    annualSpend: 1_400_000,
    categoryShare: 3,
    quotedLeadDays: 12,
    leadTimeTrend: "stable",
    otifPct: 90,
    fillRatePct: 96,
    rejectRate: 2.0,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(72, 78, 80, 55, 50, [
      "Transfer-priced — no external benchmark applies",
      "90% OTIF on what little moves through it",
      "2.0 rejects per thousand",
      "AOH storeroom, balances on the AOH master — the risk is opacity, not stock",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 60_000,
    note: "Still on the AOH vendor master as a source; not on the Maximo storeroom list. Whether its balances are visible from Indianapolis is an open question — reliability is marked low for that reason, not for performance.",
  }),
  S({
    id: "SUP-08",
    name: "Chennai Stores (AOH)",
    own: true,
    site: "Chennai",
    country: "India",
    region: "Asia",
    categories: ["Plant stores · Inter-plant transfer"],
    annualSpend: 900_000,
    categoryShare: 2,
    quotedLeadDays: 28,
    leadTimeTrend: "stable",
    otifPct: 89,
    fillRatePct: 95,
    rejectRate: 2.2,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(72, 76, 78, 55, 50, [
      "Transfer-priced — no external benchmark applies",
      "89% OTIF on a thin book",
      "2.2 rejects per thousand",
      "Same opacity as its Hungarian sibling, plus an import clearance on every transfer",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 40_000,
    note: "The Indian half of the AOH pair. Same Maximo ↔ SAP seam question, with customs on top.",
  }),
  S({
    id: "SUP-09",
    name: "Speedway Tool Crib",
    own: true,
    site: "Speedway",
    country: "United States",
    region: "Midwest US",
    categories: ["Plant stores · Inter-plant transfer"],
    annualSpend: 600_000,
    categoryShare: 1,
    quotedLeadDays: 2,
    leadTimeTrend: "stable",
    otifPct: 88,
    fillRatePct: 95,
    rejectRate: 2.1,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(70, 74, 78, 52, 50, [
      "Transfer-priced — no external benchmark applies",
      "88% OTIF on the smallest book of the three storerooms",
      "2.1 rejects per thousand",
      "Min/max table not reconciled to Indy Central Stores since the Maximo upgrade",
      "Internal — no commercial terms",
    ]),
    status: "exit-planned",
    contractExpiry: null,
    openPos: 1,
    openPoValue: 20_000,
    note: "The satellite crib the Plant 12 consolidation folds into Indy Central Stores. If the crib consolidation finishes anywhere, it finishes here.",
  }),

  /* ─── Facility supplies, cutting tools and the OEM tail ─────────────────── */
  S({
    id: "SUP-10",
    name: "HP Products (Ferguson)",
    own: false,
    site: "Indianapolis",
    country: "United States",
    region: "Midwest US",
    categories: ["Janitorial & facility supplies"],
    annualSpend: 2_800_000,
    categoryShare: 34,
    quotedLeadDays: 5,
    leadTimeTrend: "stable",
    otifPct: 88,
    fillRatePct: 96,
    rejectRate: 3.4,
    paymentTermsDays: 30,
    reliability: "high",
    scoreLines: LINES(75, 72, 74, 70, 72, [
      "At benchmark on towel, tissue and chemical dispensers",
      "88% OTIF · parcel-and-pallet and it barely matters at this margin",
      "3.4 rejects per thousand · packaging claims, all minor",
      "One of four janitorial distributors — the most replaceable spend we hold",
      "Net 30 · the shortest terms on the book",
    ]),
    status: "consolidation-target",
    contractExpiry: "31 Mar 2027",
    openPos: 3,
    openPoValue: 140_000,
    note: "Took the consolidated janitorial award in May. Folds into integrated supply next — consolidation candidate, not a risk.",
  }),
  S({
    id: "SUP-11",
    name: "United Tool Supply Inc",
    own: false,
    site: "Indianapolis",
    country: "United States",
    region: "Midwest US",
    categories: ["Cutting tools · Carbide & inserts"],
    annualSpend: 3_400_000,
    categoryShare: 29,
    quotedLeadDays: 7,
    leadTimeTrend: "improving",
    otifPct: 92,
    fillRatePct: 97,
    rejectRate: 2.6,
    paymentTermsDays: 30,
    reliability: "high",
    scoreLines: LINES(78, 80, 76, 72, 74, [
      "3% under benchmark since the January tooling review",
      "92% OTIF · improving two quarters running",
      "2.6 rejects per thousand · edge-chip claims closed",
      "Second branch qualified in Q2",
      "Net 30 · early-payment discount taken monthly",
    ]),
    status: "preferred",
    contractExpiry: "30 Sep 2026",
    openPos: 4,
    openPoValue: 180_000,
    note: "The carbide end mill every Indy line runs. Boring in the best way.",
  }),
  S({
    id: "SUP-12",
    name: "Fanuc America Corporation",
    own: false,
    site: "Rochester Hills, MI",
    country: "United States",
    region: "Midwest US",
    categories: ["OEM spares · CNC controls & drives"],
    annualSpend: 9_600_000,
    categoryShare: 74,
    quotedLeadDays: 42,
    leadTimeTrend: "stable",
    otifPct: 96,
    fillRatePct: 99,
    rejectRate: 0.4,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(66, 92, 96, 48, 70, [
      "A control board costs what Fanuc says it costs — there is no benchmark",
      "96% OTIF · the most reliable vendor on the book, on a six-week lead",
      "0.4 rejects per thousand · effectively zero",
      "74% of control spares on one OEM, and the machines are worse — every line runs the same control",
      "Net 60 · standard Fanuc terms, non-negotiable",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 3,
    openPoValue: 720_000,
    /* The sole-source OEM the engine carves OUT of addressable — a spec-locked
       control board has no competitive alternative. What it does have is an
       annual price escalator, which is what the index play reaches. */
    note: "The OEM sole-source behind every CNC line. Carved out of addressable by design; the escalator clause is the only lever that touches it.",
  }),
];
export function supplierById(id: string): Supplier | undefined {
  return SUPPLIERS.find((s) => s.id === id);
}

/* ═══════════════════════════════════════════════════════════════
 *  OPPORTUNITIES — the plays Mercer surfaces against the book
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Where a play sits in the loop. `surfaced` and `qualifying` are the feed;
 * `accepted` is being run; the last three are the realization ledger.
 * `dismissed` is kept rather than deleted — a rejected play with a reason on
 * it is the calibration signal for the next sweep.
 */
export type PlayStage =
  | "surfaced"
  | "qualifying"
  | "accepted"
  /** Not now, but not never — waiting on a trigger to come back. */
  | "parked"
  | "committed"
  | "realizing"
  | "realized"
  | "dismissed";

export const STAGE_LABEL: Record<PlayStage, string> = {
  surfaced: "Surfaced",
  qualifying: "In qualification",
  accepted: "Accepted — running",
  parked: "Parked",
  committed: "Committed",
  realizing: "Realizing",
  realized: "Realized",
  dismissed: "Dismissed",
};

/** What kind of move the play is. The buyer thinks in these, not in
 *  "opportunity" — the label is what tells them whether it is a negotiation, an
 *  engineering deviation, or a catalogue change. */
export type PlayKind =
  | "consolidation"
  | "dual-source"
  | "tariff"
  | "terms"
  | "freight"
  | "index-clause"
  | "pack-moq"
  | "tail"
  /* The engine's four levers, in the operator's own words. */
  | "index-hedge"
  | "make-vs-buy"
  | "rfp";

export const KIND_LABEL: Record<PlayKind, string> = {
  consolidation: "Consolidation",
  "dual-source": "Dual source",
  tariff: "Tariff & duty",
  terms: "Payment terms",
  freight: "Freight & mode",
  "index-clause": "Index clause",
  "pack-moq": "Pack & MOQ",
  tail: "Tail rationalisation",
  "index-hedge": "Index / hedge",
  "make-vs-buy": "Make vs buy",
  rfp: "RFP",
};

/** What the confidence figure rests on. A benchmark-only play is a hypothesis;
 *  an evidence play has a quote or a deviation on file behind it. */
export type Basis = "benchmark" | "evidence" | "mixed";

export const BASIS_LABEL: Record<Basis, string> = {
  benchmark: "Benchmark only",
  evidence: "Evidence on file",
  mixed: "Benchmark + evidence",
};

/** One line of Mercer's reasoning, with the system it came from. Same contract
 *  as the modals' DetailItem: every figure names its source. */
export interface Evidence {
  claim: string;
  source: string;
}

export interface RampPoint {
  period: string;
  projected: number;
  realized?: number;
}

export interface PlayMilestone {
  id: string;
  label: string;
  status: "completed" | "active" | "pending";
  date?: string;
}

export interface PlayEvent {
  at: string;
  actor: string;
  note: string;
}

export interface Play {
  id: string;
  title: string;
  kind: PlayKind;
  stage: PlayStage;
  category: string;
  /** The sourcing sub-category, as its own column on the feed. */
  subCategory?: string;
  /** Country of the primary spend, distinct from the coarse `region`. */
  country?: string;
  /** Total category spend — the figure `addressable` is a slice of. */
  totalSpend?: number;
  /** How many vendors hold the category, for the Vendors column. */
  vendorCount?: number;
  region: Supplier["region"] | "Multi-region";
  /** Spend the play can actually reach — not the category total. OEM
   *  sole-source spend is carved out before this figure is struck. */
  addressable: number;
  savingsLow: number;
  savingsHigh: number;
  /** The single figure Mercer recommends committing. Sits inside the band. */
  recommended: number;
  confidencePct: number;
  basis: Basis;
  /** Mercer's dense narrative, mid-dot separated — same voice as the queue. */
  summary: string;
  /** The one move, named so it can be handed to someone. */
  /**
   * The insight line — the trigger, then the move, and nothing else.
   *
   * It used to describe the situation in a full clause: "Launch an RFP scope
   * opening the field to a second fluid house". Two problems. It repeated the
   * action button beside it, and it took two wrapped lines of a table to say
   * what the buyer decides on in four words — a winner under 50% share goes to
   * RFP, and that is the whole sentence. So: the decisive fact, then the
   * imperative.
   */
  action: string;
  evidence: Evidence[];
  /** What could sink it. Shown before the commit, not after. */
  risks: string[];
  supplierIds: string[];
  /** Working weeks to run the play, for the effort column. */
  effortWeeks: number;
  /**
   * How far through its lever chain the play has got.
   *
   * A lever is not one action — an index play is reviewed, then modelled, then
   * clauses drafted — and the chain runs step by step in the chat. This is what
   * the row's button reads, so a play whose escalator has already been reviewed
   * offers the next move rather than the first one again.
   */
  flowStep?: number;
  owner: string;
  committedOn?: string;
  ramp?: RampPoint[];
  milestones?: PlayMilestone[];
  /** Raised when realized value falls behind the ramp. */
  drift?: { flagged: boolean; note: string };
  dismissReason?: string;
  events: PlayEvent[];
}

export const PLAYS: Play[] = [
  {
    id: "OPP-001",
    title: "Industrial supplies tail, onto the onsite crib",
    kind: "tail",
    stage: "surfaced",
    category: "Industrial Supplies",
    subCategory: "Consumables, PPE & fasteners",
    country: "US",
    totalSpend: 34_100_000,
    vendorCount: 1_093,
    region: "Midwest US",
    addressable: 11_900_000,
    savingsLow: 594_000,
    savingsHigh: 951_000,
    recommended: 760_000,
    confidencePct: 91,
    basis: "mixed",
    summary:
      "Industrial Supplies runs $34.1M across 1,093 vendors, and 1,040 of them are under $25K a year · the Fastenal onsite crib already stocks 62% of the SKUs the tail buys off-contract on P-cards. Routing the tail through integrated supply is a catalogue default in Maximo, not a negotiation — the 19 commodity plays underneath it price at $594K–$951K.",
    action: "1,093 vendors, one crib. Route the tail through integrated supply.",
    evidence: [
      { claim: "$34.1M across 1,093 vendors · 1,040 under $25K a year", source: "SAP ECC · spend cube FY26" },
      { claim: "62% of tail SKUs already on the Fastenal onsite catalogue", source: "Fastenal · onsite catalogue match" },
      { claim: "19 commodity plays sized at $594K–$951K on $11.9M addressable", source: "Mercer · Industrial Supplies sweep" },
    ],
    risks: [
      "Cost-plus on the crib can eat the tier if the catalogue markup is not re-based first",
      "Crews buy off-contract on P-cards — the play only lands if Maximo requisitions default to the crib",
    ],
    supplierIds: ["SUP-06", "SUP-10"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 91%" },
    ],
  },
  {
    id: "OPP-002",
    title: "Spindle rebuilds, in-house at Plant 12",
    kind: "make-vs-buy",
    stage: "surfaced",
    category: "Machine & Equipment Repairs",
    subCategory: "Spindle rebuilds",
    country: "US",
    totalSpend: 3_900_000,
    vendorCount: 1,
    region: "Midwest US",
    addressable: 3_900_000,
    savingsLow: 210_000,
    savingsHigh: 340_000,
    recommended: 270_000,
    confidencePct: 82,
    basis: "mixed",
    summary:
      "Every spindle on the Plant 3 and Plant 12 machining lines goes to Cline for rebuild at a 21-day turn · the Plant 12 maintenance shop has a balancing rig and a clean room, and it runs one shift. A second shift takes the routine rebuilds in-house and leaves the crash repairs with Cline.",
    action: "21-day turn on a one-shift shop. Cost the in-house rebuild.",
    evidence: [
      { claim: "100% of spindle rebuilds go to Cline · 21-day quoted turn", source: "Maximo · work-order history" },
      { claim: "Plant 12 rebuild shop utilised 54% on shift one", source: "Plant 12 · capacity survey" },
      { claim: "Cline rebuild averages $6,400 against $5,900 in-house, fully loaded at second-shift labour", source: "Mercer · should-cost model" },
    ],
    risks: [
      "A failed in-house rebuild is a spindle down for six weeks — the crash repairs must stay with Cline",
      "The shop is also the PM crew's home — the shift competes with the shutdown calendar",
    ],
    supplierIds: ["SUP-01"],
    effortWeeks: 14,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 82%" },
    ],
  },
  {
    id: "OPP-003",
    title: "Process chemicals, competitive RFP",
    kind: "rfp",
    stage: "surfaced",
    category: "Chemicals",
    subCategory: "Metalworking fluids & coolants",
    country: "US",
    totalSpend: 12_400_000,
    vendorCount: 3,
    region: "Multi-region",
    addressable: 7_200_000,
    savingsLow: 430_000,
    savingsHigh: 720_000,
    recommended: 560_000,
    confidencePct: 88,
    basis: "benchmark",
    summary:
      "Lemak holds 41% of chemicals, Fuchs 27% and Qualichem 15% — nobody clears the 50% line, so the lever is competition rather than an award · all three run the same 55-gallon coolant concentrate spec on the Indy lines, and Fuchs already supplies Szentgotthárd. One RFP across three plants prices the volume nobody has been offered.",
    action: "Top holder at 41%. Below the line — run the RFP.",
    evidence: [
      { claim: "Winner share 41% · under the 50% consolidate-to-incumbent threshold", source: "Mercer · lever routing" },
      { claim: "Same 55-gal coolant concentrate spec on every Indy line", source: "Engineering · fluid spec register" },
      { claim: "Fuchs Harvey supplies Szentgotthárd on a separate AOH contract", source: "SAP ECC · AOH vendor master" },
    ],
    risks: [
      "A coolant change is a fluid-compatibility trial on every sump — six weeks per line before volume moves",
      "Chennai buys through Instant Procurement Services — the RFP has to reach a vendor two tiers down",
    ],
    supplierIds: ["SUP-03", "SUP-04", "SUP-05"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 88%" },
    ],
  },
  {
    id: "OPP-004",
    title: "Machine repair parts, consolidate to Cline",
    kind: "consolidation",
    stage: "surfaced",
    category: "Machine & Equipment Repairs",
    subCategory: "Repair parts & rebuilds",
    country: "US",
    totalSpend: 12_900_000,
    vendorCount: 47,
    region: "Midwest US",
    addressable: 10_800_000,
    savingsLow: 380_000,
    savingsHigh: 540_000,
    recommended: 432_000,
    confidencePct: 86,
    basis: "mixed",
    summary:
      "Cline holds 64% of machine repair parts and Kirby Risk another 19% of the same part families · the winner clears the 50% line, so the lever routes to consolidate-to-the-incumbent. Moving Kirby's overlapping volume onto Cline's tier reaches $10.8M of addressable spend without touching the Allen-Bradley pass-through.",
    action: "64% with the incumbent. Consolidate Kirby's overlap to Cline.",
    evidence: [
      { claim: "Cline 64% + Kirby 19% of machine repair parts · $10.8M addressable", source: "SAP ECC · spend cube FY26" },
      { claim: "Cline volume tier at −4% from $10M quoted, never taken up", source: "Cline · quote 2026-0298" },
      { claim: "Winner share ≥ 50% → consolidate to incumbent", source: "Mercer · lever routing" },
    ],
    risks: [
      "Cline is capacity-capped on the spindle line — the volume must land on parts, not rebuilds",
      "Kirby's Allen-Bradley pass-through is OEM-locked and stays where it is",
    ],
    supplierIds: ["SUP-01", "SUP-02"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 86%" },
    ],
  },
  {
    id: "OPP-005",
    title: "Bearing surcharge, index the distributor price",
    kind: "index-hedge",
    stage: "surfaced",
    category: "Bearings",
    subCategory: "Ball & roller bearings",
    country: "US",
    totalSpend: 6_800_000,
    vendorCount: 3,
    region: "Midwest US",
    addressable: 4_500_000,
    savingsLow: 190_000,
    savingsHigh: 310_000,
    recommended: 240_000,
    confidencePct: 90,
    basis: "evidence",
    summary:
      "Bearing list prices carry an alloy surcharge that reset three times in two years, and the distributor passes each one through on the next blanket release · the bearing-steel marker has fallen 9% since the last pass-through and a 6205-2RS still costs what it did at the peak. An index clause on the distributor agreement returns the swing both ways.",
    action: "Three surcharges up, none down. Index the bearing price.",
    evidence: [
      { claim: "3 list-price increases passed through since Q1 25 · 0 reductions", source: "SAP ECC · PO price history" },
      { claim: "Bearing-steel marker down 9% over four quarters", source: "Benchmark · alloy surcharge index" },
    ],
    risks: [
      "A quarterly reset cuts both ways — the collar has to survive a spike in the marker",
    ],
    supplierIds: ["SUP-02"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 90%" },
    ],
  },
  {
    id: "OPP-006",
    title: "Hydraulic filter elements, cross-reference the OEM box",
    kind: "rfp",
    stage: "surfaced",
    category: "Filters",
    subCategory: "Hydraulic & lube filtration",
    country: "US",
    totalSpend: 4_100_000,
    vendorCount: 2,
    region: "Midwest US",
    addressable: 2_600_000,
    savingsLow: 120_000,
    savingsHigh: 210_000,
    recommended: 160_000,
    confidencePct: 75,
    basis: "benchmark",
    summary:
      "74% of hydraulic filter elements come through the machine OEM's parts channel at list, and the element inside the OEM box is a standard 10µ cartridge · a cross-referenced element from the filter maker needs a 30-day engineering deviation, not a redesign. The deviation clock is the whole lead time on this play.",
    action: "74% through the OEM box. Qualify the cross-reference.",
    evidence: [
      { claim: "Makino parts channel holds 74% of filter element spend", source: "SAP ECC · spend cube" },
      { claim: "OEM element cross-references to a standard 10µ cartridge", source: "Engineering · filter cross-reference" },
      { claim: "Filters family deviation window is 30 days", source: "Engineering · deviation policy" },
    ],
    risks: [
      "A failed element on a hydraulic circuit is a spindle down — the deviation must carry a trial on one line first",
    ],
    supplierIds: ["SUP-06"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 75%" },
    ],
  },
  {
    id: "OPP-007",
    title: "Adhesives & sealants, spec parity",
    kind: "rfp",
    stage: "surfaced",
    category: "Chemicals",
    subCategory: "Adhesives & sealants",
    country: "US",
    totalSpend: 2_300_000,
    vendorCount: 3,
    region: "Midwest US",
    addressable: 1_600_000,
    savingsLow: 70_000,
    savingsHigh: 120_000,
    recommended: 95_000,
    confidencePct: 82,
    basis: "benchmark",
    summary:
      "The threadlocker and RTV spec names two Henkel Loctite grades by trade name, and two other houses now hold the same OEM approvals on the same anaerobic chemistry · qualifying either one returns the line to competition without moving the volume.",
    action: "Spec written to a trade name. Qualify the second house.",
    evidence: [
      { claim: "Henkel holds 100% of adhesives spend on a trade-name spec", source: "SAP ECC · spend cube" },
      { claim: "Two houses hold matching OEM approvals on the anaerobic chemistry", source: "Supplier master · approvals" },
    ],
    risks: [
      "Trade-name specs sit in 340 Maximo job plans — the spec change is a document sweep before it is a sourcing move",
    ],
    supplierIds: ["SUP-03"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 82%" },
    ],
  },
  {
    id: "OPP-008",
    title: "Nitrile gloves, carton to pallet",
    kind: "consolidation",
    stage: "surfaced",
    category: "Industrial Supplies",
    subCategory: "PPE · gloves",
    country: "US",
    totalSpend: 1_800_000,
    vendorCount: 2,
    region: "Midwest US",
    addressable: 1_100_000,
    savingsLow: 40_000,
    savingsHigh: 75_000,
    recommended: 55_000,
    confidencePct: 79,
    basis: "mixed",
    summary:
      "Nitrile gloves ship to four plant cribs by the carton on a weekly parcel run, and a third of the volume moves as split cartons · one pallet drop a fortnight into Indy Central Stores clears the parcel surcharge on both ends and prices below the carton rate at current volume.",
    action: "38% moving as split cartons. Book the fortnightly pallet.",
    evidence: [
      { claim: "38% of glove volume moved as split cartons in the last 12 months", source: "Fastenal · order history" },
      { claim: "Pallet drop quoted at $7.10 a box all-in against $7.90 by the carton", source: "Fastenal · quote 26-Q3-0912" },
      { claim: "Parcel adds 2 days at the dock on every split", source: "Indy Central Stores · receiving log" },
    ],
    risks: [
      "A fortnightly drop needs the volume to hold through the summer shutdown",
    ],
    supplierIds: ["SUP-06"],
    effortWeeks: 8,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 79%" },
    ],
  },
  {
    id: "OPP-105",
    title: "Expedite premium, OEM spares",
    kind: "freight",
    stage: "accepted",
    category: "Machine & Equipment Repairs",
    region: "Multi-region",
    addressable: 2_400_000,
    savingsLow: 180_000,
    savingsHigh: 290_000,
    recommended: 220_000,
    confidencePct: 81,
    basis: "mixed",
    summary:
      "OEM spares fly overnight at $180–420 a shipment and that is right for a machine down — it is not right for PM-scheduled replacements the shutdown calendar has known about for months · moving the planned half of the book to the OEM's standard lead holds the PM window and returns the premium. The breakdowns stay on overnight, which is the whole point of having both programs.",
    action: "Breakdowns fly, PM ships standard. Split the two programs.",
    evidence: [
      { claim: "Expedite premium runs $180–420 a shipment, 6–11% of part value", source: "Freight cost model" },
      { claim: "Fanuc and Makino run overnight and standard lead as standing programs", source: "OEM parts portals" },
      { claim: "PM-driven parts demand is known 90 days out on the shutdown calendar", source: "Maximo · PM schedule" },
    ],
    risks: [
      "A standard-lead slip on a PM part becomes an overnight recovery — the saving must fund its own insurance",
    ],
    supplierIds: ["SUP-12", "SUP-01"],
    effortWeeks: 8,
    owner: "Marcus Whitfield",
    events: [
      { at: "24 Jul 2026", actor: "Mercer", note: "Surfaced · confidence 81%" },
      { at: "31 Jul 2026", actor: "Marcus Whitfield", note: "Accepted · standard-lead program opened pending Maximo default change" },
    ],
  },
  {
    id: "OPP-107",
    title: "Distributor terms, net 60 standard",
    kind: "terms",
    stage: "realizing",
    category: "MRO distributors",
    region: "Midwest US",
    addressable: 4_200_000,
    savingsLow: 200_000,
    savingsHigh: 350_000,
    recommended: 240_000,
    confidencePct: 74,
    basis: "evidence",
    summary:
      "The distributor book runs on blanket POs with no master agreements, and terms were onboarded three different ways across AT, AOH and the Maximo vendor list · the distributors carry the branch stock already, so terms are the one commercial lever that costs them nothing structural. Net 60 as the book standard, discount for earlier.",
    action: "Three vendor masters, one standard. Paper net 60.",
    evidence: [
      { claim: "Terms range net 30–60 with two records missing entirely", source: "SAP ECC · vendor master" },
      { claim: "Blanket-PO book — no contract renegotiation required to move terms", source: "Indirect sourcing policy" },
    ],
    risks: [
      "The distributors fund the branch stock — push terms too far and the catalogue markup absorbs it",
    ],
    supplierIds: ["SUP-01", "SUP-02", "SUP-05"],
    effortWeeks: 4,
    owner: "Marcus Whitfield",
    committedOn: "14 Apr 2026",
    ramp: [
      { period: "Q2 26", projected: 40_000, realized: 38_000 },
      { period: "Q3 26", projected: 60_000, realized: 64_000 },
      { period: "Q4 26", projected: 70_000 },
      { period: "Q1 27", projected: 70_000 },
    ],
    milestones: [
      { id: "m1", label: "Vendor master harmonised", status: "completed", date: "22 Apr 2026" },
      { id: "m2", label: "First net-60 invoices paid", status: "completed", date: "6 May 2026" },
      { id: "m3", label: "DPO gain verified by treasury", status: "active", date: "In progress" },
      { id: "m4", label: "Working-capital baseline re-cut", status: "pending" },
    ],
    events: [
      { at: "2 Apr 2026", actor: "Mercer", note: "Surfaced · confidence 74%" },
      { at: "14 Apr 2026", actor: "Marcus Whitfield", note: "Committed $240K · owner Marcus Whitfield" },
      { at: "6 May 2026", actor: "Mercer", note: "First net-60 invoices confirmed on three distributors" },
    ],
  },
  {
    id: "OPP-108",
    title: "Satellite cribs, fold into Indy Central Stores",
    kind: "tail",
    stage: "committed",
    category: "Plant stores",
    region: "Midwest US",
    addressable: 3_900_000,
    savingsLow: 450_000,
    savingsHigh: 600_000,
    recommended: 480_000,
    confidencePct: 69,
    basis: "mixed",
    summary:
      "Four satellite cribs carry the same 1,200 SKUs Indy Central Stores holds, and every stockout escalation lands at Central first · consolidating the Plant 12 and Speedway cribs onto one stocking location replaces four min/max tables with one and takes $3.9M of duplicated inventory down to plan.",
    action: "Four cribs, one hub. Fold the satellites into Central.",
    evidence: [
      { claim: "1,200 SKUs duplicated across four cribs · $3.9M on hand", source: "Maximo · storeroom balances" },
      { claim: "Every stockout escalation routes to Indy Central Stores first", source: "Maximo · escalation log" },
    ],
    risks: [
      "A crib folded before the Maximo storeroom defaults change is a stockout with a longer walk",
    ],
    supplierIds: ["SUP-09"],
    effortWeeks: 9,
    owner: "Marcus Whitfield",
    committedOn: "2 Jul 2026",
    ramp: [
      { period: "Q3 26", projected: 60_000, realized: 44_000 },
      { period: "Q4 26", projected: 140_000 },
      { period: "Q1 27", projected: 140_000 },
      { period: "Q2 27", projected: 140_000 },
    ],
    milestones: [
      { id: "m1", label: "Stocking list agreed", status: "completed", date: "18 Jul 2026" },
      { id: "m2", label: "First 12 vendors redirected to the Central dock", status: "active", date: "In progress" },
      { id: "m3", label: "Remaining 16 redirected", status: "pending" },
      { id: "m4", label: "Speedway storeroom closed in Maximo", status: "pending" },
    ],
    drift: {
      flagged: true,
      note: "Q3 landed $44K against a $60K ramp — three vendors still deliver direct to the Speedway dock and the crews requisition there.",
    },
    events: [
      { at: "10 Jun 2026", actor: "Mercer", note: "Surfaced · confidence 69%" },
      { at: "2 Jul 2026", actor: "Marcus Whitfield", note: "Committed $480K" },
      { at: "5 Aug 2026", actor: "Mercer", note: "Drift flagged · Q3 realization 27% behind ramp" },
    ],
  },
  {
    id: "OPP-109",
    title: "Janitorial consolidation, HP Products award",
    kind: "consolidation",
    stage: "realizing",
    category: "Industrial Supplies",
    region: "Midwest US",
    addressable: 5_200_000,
    savingsLow: 320_000,
    savingsHigh: 520_000,
    recommended: 390_000,
    confidencePct: 77,
    basis: "evidence",
    summary:
      "Four janitorial distributors, top holder at 29% · one award consolidates the book onto the best delivery record on the roster and funds the dispenser standardisation from the volume step.",
    action: "Four distributors to one. Consolidate the janitorial award.",
    evidence: [
      { claim: "Four suppliers, top holder at 29% of the category", source: "SAP ECC · spend cube FY26" },
      { claim: "HP Products quoted −4% from the consolidated tier", source: "RFQ 2026-0311" },
    ],
    risks: [
      "Concentration replaces fragmentation — the integrated-supply play inherits the risk",
    ],
    supplierIds: ["SUP-10"],
    effortWeeks: 11,
    owner: "Marcus Whitfield",
    committedOn: "19 May 2026",
    ramp: [
      { period: "Q2 26", projected: 50_000, realized: 52_000 },
      { period: "Q3 26", projected: 110_000, realized: 108_000 },
      { period: "Q4 26", projected: 115_000 },
      { period: "Q1 27", projected: 115_000 },
    ],
    milestones: [
      { id: "m1", label: "HP Products capacity confirmed", status: "completed", date: "28 May 2026" },
      { id: "m2", label: "Plant 3 and Plant 14 switched over", status: "completed", date: "1 Jul 2026" },
      { id: "m3", label: "Last legacy PO placed", status: "active", date: "Due 31 Aug 2026" },
      { id: "m4", label: "Legacy dispenser spec retired", status: "pending" },
    ],
    events: [
      { at: "4 May 2026", actor: "Mercer", note: "Surfaced · confidence 77%" },
      { at: "19 May 2026", actor: "Marcus Whitfield", note: "Committed $390K" },
      { at: "1 Jul 2026", actor: "Mercer", note: "Plant 3 and Plant 14 switched over on schedule" },
    ],
  },
  {
    id: "OPP-110",
    title: "Cutting tool supplier consolidation",
    kind: "consolidation",
    stage: "realized",
    category: "Cutting Tools",
    region: "Midwest US",
    addressable: 1_400_000,
    savingsLow: 110_000,
    savingsHigh: 160_000,
    recommended: 130_000,
    confidencePct: 86,
    basis: "evidence",
    summary:
      "Forty-one vendors sold carbide end mills and inserts into the Indy lines — the most fragmented spend on the book for the least differentiated product · the award moved the standard-geometry volume to two houses and the saving realized ahead of ramp.",
    action: "41 vendors sell end mills. Two are enough for standard geometry.",
    evidence: [
      { claim: "41 suppliers across $3.9M · 28 under $60K each", source: "SAP ECC · spend cube FY25" },
    ],
    risks: [
      "Shutdown rebuilds spike tooling demand — two houses must absorb the peaks",
    ],
    supplierIds: ["SUP-11"],
    effortWeeks: 6,
    owner: "Marcus Whitfield",
    committedOn: "8 Sep 2025",
    ramp: [
      { period: "Q4 25", projected: 30_000, realized: 31_000 },
      { period: "Q1 26", projected: 33_000, realized: 35_000 },
      { period: "Q2 26", projected: 33_000, realized: 34_000 },
      { period: "Q3 26", projected: 34_000, realized: 34_000 },
    ],
    milestones: [
      { id: "m1", label: "Tooling catalogue agreed", status: "completed", date: "20 Sep 2025" },
      { id: "m2", label: "All four plants migrated", status: "completed", date: "14 Nov 2025" },
      { id: "m3", label: "Saving verified by finance", status: "completed", date: "12 Aug 2026" },
    ],
    events: [
      { at: "8 Sep 2025", actor: "Marcus Whitfield", note: "Committed $130K" },
      { at: "12 Aug 2026", actor: "Mercer", note: "Realized $134K · verified with finance, play closed" },
    ],
  },
  {
    id: "OPP-111",
    title: "Chennai consumables, single-vendor award",
    kind: "consolidation",
    stage: "dismissed",
    category: "Industrial Supplies",
    region: "Asia",
    addressable: 1_600_000,
    savingsLow: 90_000,
    savingsHigh: 140_000,
    recommended: 110_000,
    confidencePct: 58,
    basis: "benchmark",
    summary:
      "Consolidating Chennai's consumables onto Instant Procurement Services priced 5% under the split book · dismissed because one intermediary two tiers from the makers turns every import clearance into a single point of failure. The split IS the hedge.",
    action: "5% cheaper, one intermediary. Keep the split — dismissed.",
    evidence: [
      { claim: "Instant Procurement Services quote −5% vs the split book", source: "RFQ 2026-0287" },
      { claim: "All Chennai imports clear through one broker on the vendor's account", source: "AOH · import log" },
    ],
    risks: [
      "Price beats resilience only until the first customs hold lands on the single intermediary",
    ],
    supplierIds: ["SUP-08"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    dismissReason: "Capacity cannot hold the volume",
    events: [
      { at: "17 Jul 2026", actor: "Mercer", note: "Surfaced · confidence 58%" },
      {
        at: "21 Jul 2026",
        actor: "Marcus Whitfield",
        note: "Dismissed · one warehouse at 94% utilisation and 83% OTIF. Logged for sweep calibration.",
      },
    ],
  },
];

/* ─── Derived sets, so a page never re-states which stages it means ── */

export const FEED_STAGES: ReadonlySet<PlayStage> = new Set(["surfaced", "qualifying"]);
export const LEDGER_STAGES: ReadonlySet<PlayStage> = new Set([
  "committed",
  "realizing",
  "realized",
]);

export const feedPlays = (): Play[] => PLAYS.filter((p) => FEED_STAGES.has(p.stage));
export const acceptedPlays = (): Play[] => PLAYS.filter((p) => p.stage === "accepted");
export const ledgerPlays = (): Play[] => PLAYS.filter((p) => LEDGER_STAGES.has(p.stage));
export const dismissedPlays = (): Play[] => PLAYS.filter((p) => p.stage === "dismissed");

/**
 * The value-realization lifecycle, derived from stage — the engine's own
 * three-stage track machine on this book's stages.
 *
 *   committed  → signed off, not yet in execution (awaiting go-live)
 *   live       → in execution, on the ramp, RAG-tracked  (stage "realizing")
 *   realized   → ERP-confirmed and closed                (stage "realized")
 *
 * A play only appears on the savings ramp once it is live: projected bars
 * stand alone until SAP posts actuals, and realized fills in behind them.
 */
export type TrackStage = "committed" | "live" | "realized";

export function trackStage(p: Play): TrackStage {
  if (p.stage === "realized") return "realized";
  if (p.stage === "realizing") return "live";
  return "committed";
}

export function playById(id: string): Play | undefined {
  return PLAYS.find((p) => p.id === id);
}

/** Realized to date across the ledger, from the ramp rather than a stored
 *  total — the chart and the KPI then cannot disagree. */
export function realizedToDate(p: Play): number {
  return (p.ramp ?? []).reduce((sum, r) => sum + (r.realized ?? 0), 0);
}

/** What the ramp said should have landed by now, counting only the periods
 *  that have actually reported. */
export function rampToDate(p: Play): number {
  return (p.ramp ?? [])
    .filter((r) => r.realized !== undefined)
    .reduce((sum, r) => sum + r.projected, 0);
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK — the figures the command center opens on
 * ═══════════════════════════════════════════════════════════════ */

export const BOOK = {
  /** Spend the detailed roster holds. The whole MRO book is $109.3M; the
   *  ~1,800 vendors not detailed above carry the tail to it. */
  spend: SUPPLIERS.reduce((sum, s) => sum + s.annualSpend, 0),
  /** Vendors on the book, of which the file above details twelve. */
  suppliers: 1_824,
  /** Share bought outside the United States — the AOH plants' book. */
  importShare: 11,
  /** Purchase orders open right now across the book. */
  openPos: SUPPLIERS.reduce((sum, s) => sum + s.openPos, 0),
  openPoValue: SUPPLIERS.reduce((sum, s) => sum + s.openPoValue, 0),
  /** The savings band the sweep is measured against — $594K–$951K on $11.9M
   *  of addressable Industrial Supplies is 5.0–8.0%, and that is the book's
   *  benchmark for what a commodity play should return. */
  benchmarkLow: 5.0,
  benchmarkHigh: 8.0,
} as const;

/** What a category is called on an axis, where "Machine repair parts ·
 *  Spindles & rebuilds" has room for about eight characters. The full name
 *  stays on the supplier record; this is only for the chart. */
const AXIS_LABEL: Record<string, string> = {
  "Machine repair parts · Spindles & rebuilds": "Repairs",
  "Machine repair parts · Drives & motors": "Drives",
  "Chemicals · Process fluids": "Chemicals",
  "Chemicals · Metalworking fluids": "Fluids",
  "Chemicals · Coolant concentrate": "Coolant",
  "Industrial supplies · Onsite crib": "Crib",
  "Plant stores · Inter-plant transfer": "Transfers",
  "Janitorial & facility supplies": "Janitorial",
  "Cutting tools · Carbide & inserts": "Tooling",
  "OEM spares · CNC controls & drives": "OEM",
};

/** Spend by category, for the command center's concentration chart. */
export function spendByCategory(): { label: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const s of SUPPLIERS) {
    const key = AXIS_LABEL[s.categories[0]] ?? s.categories[0];
    buckets.set(key, (buckets.get(key) ?? 0) + s.annualSpend);
  }
  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Suppliers with no payment term on file, by name — the three-vendor-master
 *  data gap the terms play has to close before it can be run. External
 *  suppliers only: an internal transfer has no commercial term to be missing. */
export function termsGaps(): Supplier[] {
  return SUPPLIERS.filter((s) => !s.own && s.paymentTermsDays === null);
}

/* ═══════════════════════════════════════════════════════════════
 *  Running a play — the Act workspace
 *
 *  Accepting a play is not doing it. Between "yes, run this" and
 *  "committed $432K" there is a fortnight of work with an order to
 *  it: you cannot benchmark a category before you know what is in
 *  scope, and you cannot commit a figure before anyone has spoken to
 *  the distributor. The tracker is that order, made visible.
 *
 *  The engine's Act tracker: a step list per play kind, each step
 *  naming what the agent can do for it, and the first step an upload
 *  that GATES the rest — the scope file is the thing every later
 *  figure is computed against, so working ahead of it produces
 *  numbers nobody can stand behind.
 * ═══════════════════════════════════════════════════════════════ */

/** What the agent can do for a step. Drives the step's own affordance. */
export type StepKind =
  | "upload" // the scope file; completing it unlocks the rest
  | "validate" // the agent runs a check
  | "model" // the agent models volume and price
  | "benchmark" // the agent benchmarks against the market
  | "shortlist" // the agent builds a supplier shortlist
  | "draft" // the agent drafts a document
  | "manual"; // nothing to run — the buyer does it and says so

/** Kinds the agent actually runs, producing an inline result. */
export const RUN_KINDS: ReadonlySet<StepKind> = new Set([
  "validate",
  "model",
  "benchmark",
  "shortlist",
]);

/** What the agent offers on a step, in its own voice. */
export const STEP_SUPPORT: Record<StepKind, { cta: string; helper: string } | null> = {
  upload: { cta: "Attach the file", helper: "Everything after this is computed against it." },
  validate: { cta: "Run the check", helper: "Capacity, service and terms against the record." },
  model: { cta: "Model it", helper: "Consolidated volume and the price it supports." },
  benchmark: { cta: "Benchmark it", helper: "This category against the market and should-cost." },
  shortlist: { cta: "Build the shortlist", helper: "Qualified vendors, ranked, with why." },
  draft: { cta: "Draft it", helper: "A first version you edit before it goes out." },
  manual: null,
};

export interface PlayStep {
  label: string;
  kind: StepKind;
}

export interface PlayTask extends PlayStep {
  /** open → worked in order; done and skipped both count as fulfilled. */
  status: "open" | "done" | "skipped";
  /** Files attached by an upload step. */
  attachment?: string;
  /** True for steps the buyer added rather than the playbook seeding. */
  custom?: boolean;
}

/**
 * The playbook per kind of play.
 *
 * Five steps at most, and step one is always the scope upload. The cap is not
 * tidiness: a list long enough to scroll stops being a plan and becomes a
 * backlog, and the buyer loses the one thing the tracker is for — knowing what
 * is next.
 */
export const PLAYBOOKS: Record<PlayKind, PlayStep[]> = {
  consolidation: [
    { label: "Confirm scope and the OEM sole-source carve-outs", kind: "upload" },
    { label: "Validate the incumbent — capacity, service and terms", kind: "validate" },
    { label: "Model the consolidated volume and target price", kind: "model" },
    { label: "Draft the consolidation proposal", kind: "draft" },
    { label: "Negotiate, sign and award", kind: "manual" },
  ],
  "dual-source": [
    { label: "Confirm scope, specs and the deviation requirements", kind: "upload" },
    { label: "Qualify the second source", kind: "validate" },
    { label: "Draft the qualification plan", kind: "draft" },
    { label: "Run the trial order on one line and validate", kind: "manual" },
    { label: "Ramp, award and capture the saving", kind: "manual" },
  ],
  tariff: [
    { label: "Attach the entry summaries and the ruling", kind: "upload" },
    { label: "Validate the classification against the ruling", kind: "validate" },
    { label: "Draft the protest or reclassification filing", kind: "draft" },
    { label: "File it and track the refund", kind: "manual" },
  ],
  terms: [
    { label: "Pull the current terms across the three vendor masters", kind: "upload" },
    { label: "Benchmark the terms against the market", kind: "benchmark" },
    { label: "Draft the terms ask, distributor by distributor", kind: "draft" },
    { label: "Run the conversations", kind: "manual" },
    { label: "Agree and capture the working-capital gain", kind: "manual" },
  ],
  freight: [
    { label: "Attach the expedite and standard-lead history", kind: "upload" },
    { label: "Model the program split and its downtime exposure", kind: "model" },
    { label: "Shortlist carriers for the plant shuttle", kind: "shortlist" },
    { label: "Draft the program change", kind: "draft" },
    { label: "Change the Maximo default and capture the premium", kind: "manual" },
  ],
  "index-clause": [
    { label: "Attach the agreements and the index history", kind: "upload" },
    { label: "Benchmark the index against realised cost", kind: "benchmark" },
    { label: "Draft the clause and its cap", kind: "draft" },
    { label: "Agree the clause at renewal", kind: "manual" },
  ],
  "pack-moq": [
    { label: "Attach the pack specs and order history", kind: "upload" },
    { label: "Model the pack change against demand", kind: "model" },
    { label: "Draft the pack and MOQ ask", kind: "draft" },
    { label: "Agree it and update the material master", kind: "manual" },
  ],
  tail: [
    { label: "Attach the tail spend extract", kind: "upload" },
    { label: "Shortlist the integrator or the surviving vendors", kind: "shortlist" },
    { label: "Draft the migration and cut-over plan", kind: "draft" },
    { label: "Migrate the tail and close the vendor accounts", kind: "manual" },
  ],

  /* The engine's levers. `PlayKind` gained these three and the record did not,
     so `tasksFor` would have handed back undefined for any play on one of
     them — a tracker with no steps in it. */
  "index-hedge": [
    { label: "Attach the surcharge exposure and the volume it prices", kind: "upload" },
    { label: "Validate the index against what the distributor actually bills", kind: "validate" },
    { label: "Model the clause — coverage, reset cadence and the collar", kind: "model" },
    { label: "Draft the clause for legal and treasury", kind: "draft" },
  ],
  "make-vs-buy": [
    { label: "Attach the part list and the current bought-in cost", kind: "upload" },
    { label: "Validate shop capacity and the tooling it would need", kind: "validate" },
    { label: "Model make against buy at volume, landed", kind: "model" },
    { label: "Draft the recommendation with the second-shift ask", kind: "draft" },
  ],
  rfp: [
    { label: "Attach the specification and the volumes to quote", kind: "upload" },
    { label: "Shortlist the bidders and check they are qualified", kind: "shortlist" },
    { label: "Model the bids on a landed, like-for-like basis", kind: "model" },
    { label: "Draft the award recommendation", kind: "draft" },
    { label: "Award and paper the agreement", kind: "manual" },
  ],
};

/** The seeded task list for a play — its playbook, all steps open. */
export function tasksFor(play: Play): PlayTask[] {
  return PLAYBOOKS[play.kind].map((s) => ({ ...s, status: "open" as const }));
}
