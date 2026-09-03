/* ═══════════════════════════════════════════════════════════════
 *  Target — the buying desk beyond the exception queue
 *
 *  Mercer's whole book: the supplier roster, the opportunity feed
 *  and the value ledger. Grounded in the operating reality the
 *  research established — a PO-only import book across ~91 Tier 1
 *  suppliers on the loaded home-and-grocery priority book, one
 *  dedicated co-manufacturing plant at River Falls, origin
 *  consolidation run by the sourcing arm at Yantian and Cai Mep, raw
 *  materials bought by the factory rather than by Target, and a
 *  duty regime where classification and valuation — Section 301
 *  above all — are commercial levers, not compliance chores.
 */

/* ─── Money ──────────────────────────────────────────────────────── */

/** Compact dollars for cells and stat values — $2.1M, $840K, $312. */
export function money(n: number): string {
  /* Billions get their own unit. The executive book runs to $3.7bn now that its
     figures are at company scale, and "$3682.2M" is four digits a reader has to
     count the places on — which is the one thing a unit exists to prevent. */
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** A savings band as one string — "$2.1M – $3.3M". */
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

/** How much of this record we can actually stand behind. The import book was
 *  onboarded through three different systems, so terms and lead times are
 *  genuinely missing in places — the gap is the point, not a placeholder. */
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
  /** True for a Target-owned or dedicated entity — an internal source is
   *  rescheduled, not renegotiated, so the whole page treats the two
   *  differently. Four of these exist: the dedicated co-pack lines and
   *  the sourcing arm's three origin nodes. */
  own: boolean;
  site: string;
  country: string;
  region: "South China" | "Vietnam" | "US Midwest" | "Other" | (string & {});
  /** What they make for us, in the book's own product language. */
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
   * Held apart from `otifPct` because a single number cannot tell a supplier who
   * ships short from one who ships late, and those are different conversations:
   * one is a capacity problem, the other is a lead-time problem. OTIF is the
   * joint measure and is therefore always the lower of the two — the gap between
   * them is the volume that arrived complete but arrived late.
   */
  fillRatePct: number;
  /** Rejected units per thousand received. */
  rejectRate: number;
  /** Null where the merger of three onboarding paths left no term on file. */
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
 *  so two suppliers in a category are genuinely comparable. */
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
  /* ─── The FOB suppliers — where the import book actually comes from ──
     Three of these carry names the catalogue names (Luen Hing, Vinh Phat,
     and the dedicated plant further down). The rest are FIXTURE NAMES —
     the Tier 1 book runs to the hundreds with no public roster, and
     inventing addresses for real companies would be worse than a
     placeholder that says what it is. */
  S({
    id: "SUP-01",
    name: "Luen Hing Housewares",
    own: false,
    site: "Dongguan",
    country: "China",
    region: "South China",
    categories: ["Home & kitchen · Hardgoods FOB"],
    annualSpend: 46_400_000,
    categoryShare: 32,
    quotedLeadDays: 56,
    leadTimeTrend: "slipping",
    otifPct: 91,
    fillRatePct: 97,
    rejectRate: 2.4,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(82, 74, 88, 71, 70, [
      "2.8% under the Dongguan hardgoods benchmark on FOB cost",
      "91% OTIF · quoted lead time moved 46 → 56 days this quarter",
      "2.4 rejects per thousand units · no open quality claims",
      "One kiln line on the HH book, no qualified backup",
      "Net 60 · no early-payment discount on file",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 14,
    openPoValue: 4_180_000,
    /* PO-only, like the whole import book: no long-term contract exists to
       expire. The `contractExpiry: null` is the fact, not a data gap. */
    note: "The anchor of the home book — the largest hardgoods supplier on the loaded Tier 1 list. Cheapest FOB we hold, and the longest lead time on it.",
  }),
  S({
    id: "SUP-02",
    name: "Vinh Phat Textiles",
    own: false,
    site: "Ho Chi Minh City",
    country: "Vietnam",
    region: "Vietnam",
    categories: ["Home textiles · FOB"],
    annualSpend: 21_800_000,
    categoryShare: 15,
    quotedLeadDays: 58,
    leadTimeTrend: "stable",
    otifPct: 87,
    fillRatePct: 94,
    rejectRate: 3.1,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(76, 68, 79, 78, 62, [
      "At benchmark on terry, 2% over on jacquard borders",
      "87% OTIF · two consolidations missed the Cai Mep cutoff last quarter",
      "3.1 rejects per thousand · one open shade-band claim",
      "Second terry line qualified · tight in peak, because the whole towel book moved here at once",
      "Net 60 · the only import supplier quoting an early-payment discount",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 11,
    openPoValue: 3_240_000,
    note: "The Section 301 diversification lane — where the towel and rug book moved when the China lists landed. Independent, and tight in peak because everyone else moved too.",
  }),
  S({
    id: "SUP-03",
    /* FIXTURE NAME — the co-manufacture base is real, its names are not published. */
    name: "Heartland Snack Co-Man",
    own: false,
    site: "Cedar Rapids",
    country: "United States",
    region: "US Midwest",
    categories: ["Grocery · Dry co-pack"],
    annualSpend: 9_600_000,
    categoryShare: 41,
    quotedLeadDays: 48,
    leadTimeTrend: "improving",
    otifPct: 94,
    fillRatePct: 98,
    rejectRate: 1.8,
    paymentTermsDays: 45,
    reliability: "medium",
    scoreLines: LINES(74, 84, 82, 66, 68, [
      "1.9% over benchmark, closing on volume",
      "94% OTIF · best delivery record on the book",
      "1.8 rejects per thousand · seal-integrity claims closed out",
      "41% of dry co-pack on one roof — the concentration is ours, not theirs",
      "Net 45 · terms renegotiated at the May review",
    ]),
    status: "consolidation-target",
    contractExpiry: null,
    openPos: 6,
    openPoValue: 1_080_000,
    note: "Took the consolidated snack award in May. Watch the concentration, not the supplier.",
  }),
  S({
    id: "SUP-04",
    /* FIXTURE NAME — softlines run across Vietnam, Cambodia, Bangladesh and
       India on the published book. */
    name: "Mekong Apparel",
    own: false,
    site: "Phnom Penh",
    country: "Cambodia",
    region: "Other",
    categories: ["Apparel & softlines"],
    annualSpend: 8_200_000,
    categoryShare: 28,
    quotedLeadDays: 62,
    leadTimeTrend: "stable",
    otifPct: 84,
    fillRatePct: 92,
    rejectRate: 4.2,
    paymentTermsDays: 45,
    reliability: "medium",
    scoreLines: LINES(80, 62, 70, 74, 66, [
      "4.1% under benchmark — the reason the volume moved here",
      "84% OTIF · ocean-only, so every slip is a two-week slip",
      "4.2 rejects per thousand · stitching claims trending down",
      "Two sites, one country — a duty change hits both at once",
      "Net 45 · no terms movement in two years",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 8,
    openPoValue: 1_960_000,
    note: "The softlines book's anchor since the China exit. Not in the West Priority scope — the book still has to be bought.",
  }),
  S({
    id: "SUP-05",
    /* FIXTURE NAME. */
    name: "Dhaka Basics Apparel",
    own: false,
    site: "Dhaka",
    country: "Bangladesh",
    region: "Other",
    categories: ["Apparel & softlines"],
    annualSpend: 6_800_000,
    categoryShare: 23,
    quotedLeadDays: 68,
    leadTimeTrend: "slipping",
    otifPct: 79,
    fillRatePct: 90,
    rejectRate: 5.6,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(84, 54, 61, 58, 40, [
      "6% under benchmark — cheapest basics in the book",
      "79% OTIF · the worst delivery record we still buy from",
      "5.6 rejects per thousand · two open seam claims",
      "One site, one port, monsoon season on both",
      "No payment term on file — onboarded outside the system",
    ]),
    status: "dual-source-candidate",
    contractExpiry: null,
    openPos: 4,
    openPoValue: 740_000,
    note: "Cheap and fragile. The terms gap is a data problem before it is a commercial one.",
  }),

  /* ─── Owned & dedicated — the internal nodes ─────────────────────────
     Cedar Mills is the one dedicated plant on the loaded book. The three
     rows after it are the sourcing arm's own origin nodes — the Yantian
     and Cai Mep consolidation hubs that turn factory cargo into LA/Long
     Beach containers, and the legacy Hong Kong trading desk they are
     replacing. They book through the forwarder's system rather than the
     OMS, so what they actually carry is one of the genuinely open
     questions, and their rows say so rather than resolving it. */
  S({
    id: "SUP-06",
    name: "Cedar Mills Co-Pack",
    own: true,
    site: "River Falls, Wisconsin",
    country: "United States",
    region: "US Midwest",
    categories: ["Grocery · Co-manufacture"],
    annualSpend: 5_400_000,
    categoryShare: 100,
    quotedLeadDays: 35,
    leadTimeTrend: "stable",
    otifPct: 95,
    fillRatePct: 99,
    rejectRate: 1.2,
    paymentTermsDays: null,
    reliability: "high",
    scoreLines: LINES(70, 88, 90, 62, 50, [
      "Internal transfer price — the benchmark is a policy, not a market",
      "95% OTIF · the best record on the book, on the shortest leg",
      "1.2 rejects per thousand · SQF recertified this year",
      "One shift running — the second shift is the make-vs-buy play",
      "No commercial terms — a dedicated line has none to have",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 5,
    openPoValue: 820_000,
    note: "The only dedicated lines. Bake, fill and pack for the grocery flagship, one shift — which is exactly why the second-shift play keeps coming up.",
  }),
  S({
    id: "SUP-07",
    /* FIXTURE NAME — the sourcing arm's origin hubs are real in shape, not in name. */
    name: "TSS Yantian Consolidation",
    own: true,
    site: "Yantian, Shenzhen",
    country: "China",
    region: "South China",
    categories: ["Origin consolidation"],
    annualSpend: 4_100_000,
    categoryShare: 3,
    quotedLeadDays: 52,
    leadTimeTrend: "stable",
    otifPct: 90,
    fillRatePct: 96,
    rejectRate: 2.0,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(72, 78, 80, 55, 50, [
      "Transfer-priced — no external benchmark applies",
      "90% OTIF on the Dongguan and Zhongshan cargo it consolidates",
      "2.0 rejects per thousand · damage at the CFS, not at the factory",
      "Utilisation is booked in the forwarder's system, not the OMS — the risk is opacity",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 310_000,
    note: "The Yantian leg behind the Luen Hing book — where Dongguan and Zhongshan cargo becomes an LA/Long Beach container. Runs on the forwarder's system, so reliability is marked low for opacity, not for performance.",
  }),
  S({
    id: "SUP-08",
    /* FIXTURE NAME. */
    name: "TSS Cai Mep Consolidation",
    own: true,
    site: "Cai Mep, Ba Ria–Vung Tau",
    country: "Vietnam",
    region: "Vietnam",
    categories: ["Origin consolidation"],
    annualSpend: 3_400_000,
    categoryShare: 2,
    quotedLeadDays: 52,
    leadTimeTrend: "stable",
    otifPct: 89,
    fillRatePct: 95,
    rejectRate: 2.2,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(72, 76, 78, 55, 50, [
      "Transfer-priced — no external benchmark applies",
      "89% OTIF · two consolidations missed the weekly cutoff last quarter",
      "2.2 rejects per thousand",
      "Same opacity as its Yantian sibling — and a thinner sailing schedule",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 260_000,
    note: "The Vietnam half of the origin-consolidation pair, behind the Vinh Phat book. Same two-systems question as Yantian.",
  }),
  S({
    id: "SUP-09",
    /* FIXTURE NAME. */
    name: "Meridian Trading (HK) Ltd",
    own: true,
    site: "Hong Kong",
    country: "Hong Kong",
    region: "South China",
    categories: ["Origin consolidation"],
    annualSpend: 2_200_000,
    categoryShare: 1,
    quotedLeadDays: 52,
    leadTimeTrend: "stable",
    otifPct: 88,
    fillRatePct: 95,
    rejectRate: 2.1,
    paymentTermsDays: null,
    reliability: "low",
    scoreLines: LINES(70, 74, 78, 52, 50, [
      "Transfer-priced — no external benchmark applies",
      "88% OTIF on the smallest book of the three nodes",
      "2.1 rejects per thousand",
      "Utilisation undisclosed since the sourcing arm took the buy direct to FOB",
      "Internal — no commercial terms",
    ]),
    status: "exit-planned",
    contractExpiry: null,
    openPos: 1,
    openPoValue: 90_000,
    note: "The legacy Hong Kong trading desk the sourcing arm is folding into direct FOB buying. If the consolidation of the consolidators finishes anywhere, it finishes here.",
  }),

  /* ─── Fixtures, packaging and the direct-buy tail ───────────────────── */
  S({
    id: "SUP-10",
    /* FIXTURE NAME — ~37 of the ~91 loaded Tier 1 suppliers make only this. */
    name: "Dongguan Display & Fixture",
    own: false,
    site: "Dongguan",
    country: "China",
    region: "South China",
    categories: ["Store display units"],
    annualSpend: 4_800_000,
    categoryShare: 34,
    quotedLeadDays: 40,
    leadTimeTrend: "stable",
    otifPct: 88,
    fillRatePct: 96,
    rejectRate: 3.4,
    paymentTermsDays: 30,
    reliability: "high",
    scoreLines: LINES(75, 72, 74, 70, 72, [
      "At benchmark on wood-and-acrylic units",
      "88% OTIF · ocean-only and it barely matters at this margin",
      "3.4 rejects per thousand · finish claims, all minor",
      "One of ~37 fixtures factories — the most replaceable spend we hold",
      "Net 30 · the shortest terms on the book",
    ]),
    status: "consolidation-target",
    contractExpiry: "31 Mar 2027",
    openPos: 3,
    openPoValue: 610_000,
    note: "Fixtures sail through Long Beach and skew every free trade dataset merchandise-light. Consolidation candidate, not a risk.",
  }),
  S({
    id: "SUP-11",
    /* FIXTURE NAME. */
    name: "Zhongshan Gift Box & Print",
    own: false,
    site: "Zhongshan",
    country: "China",
    region: "South China",
    categories: ["Gift boxes & cartons"],
    annualSpend: 3_900_000,
    categoryShare: 29,
    quotedLeadDays: 35,
    leadTimeTrend: "improving",
    otifPct: 92,
    fillRatePct: 97,
    rejectRate: 2.6,
    paymentTermsDays: 30,
    reliability: "high",
    scoreLines: LINES(78, 80, 76, 72, 74, [
      "3% under benchmark since the January retool",
      "92% OTIF · improving two quarters running",
      "2.6 rejects per thousand · print-registration claims closed",
      "Second site qualified in Q2",
      "Net 30 · early-payment discount taken monthly",
    ]),
    status: "preferred",
    contractExpiry: "30 Sep 2026",
    openPos: 4,
    openPoValue: 480_000,
    note: "The gift carton every holiday set ships in. Boring in the best way.",
  }),
  S({
    id: "SUP-12",
    /* FIXTURE NAME. */
    name: "Fox Valley Flexibles",
    own: false,
    site: "Appleton, Wisconsin",
    country: "United States",
    region: "US Midwest",
    categories: ["Packaging film · Direct buy"],
    annualSpend: 6_200_000,
    categoryShare: 74,
    quotedLeadDays: 45,
    leadTimeTrend: "stable",
    otifPct: 96,
    fillRatePct: 99,
    rejectRate: 0.4,
    paymentTermsDays: 60,
    reliability: "high",
    scoreLines: LINES(66, 92, 96, 48, 70, [
      "A barrier film costs what the converter says it costs — the resin index is the only benchmark",
      "96% OTIF · the most reliable vendor on the book",
      "0.4 rejects per thousand · effectively zero",
      "74% of barrier film on one converter, and upstream is worse — the co-mans buy from the same place",
      "Net 60 · standard converter terms, non-negotiable",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 3,
    openPoValue: 1_140_000,
    /* The only input vendor Target buys from DIRECTLY — the $15.6M consigned
       packaging inventory is the freshness promise's obligation, not
       production stock. Every other input is the supplier's purchase. */
    note: "The direct film buy behind the freshness promise. Upstream resin concentration mirrors this row, one tier out of reach.",
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
 *  "opportunity" — the label is what tells them whether it is a negotiation, a
 *  customs filing, or a qualification programme. */
export type PlayKind =
  | "consolidation"
  | "dual-source"
  | "tariff"
  | "terms"
  | "freight"
  | "index-clause"
  | "pack-moq"
  | "tail"
  /* The raw-materials feed's four levers, in the operator's own words. */
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
 *  an evidence play has a quote or a ruling behind it. */
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
  /** Spend the play can actually reach — not the category total. */
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
   * opening the field to Asian dye houses". Two problems. It repeated the action
   * button beside it, and it took two wrapped lines of a table to say what the
   * buyer decides on in four words — a single source with a defined scope goes
   * to RFP, and that is the whole sentence. So: the decisive fact, then the
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
   * the row's button reads, so a play whose index has already been reviewed
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
    title: "Section 301 exclusion, HH stoneware",
    kind: "index-hedge",
    stage: "surfaced",
    category: "Home & kitchen (FOB)",
    subCategory: "Stoneware & ceramics",
    country: "US",
    totalSpend: 48_200_000,
    vendorCount: 2,
    region: "South China",
    addressable: 41_800_000,
    savingsLow: 1_600_000,
    savingsHigh: 2_200_000,
    recommended: 1_900_000,
    confidencePct: 94,
    basis: "evidence",
    summary:
      "Chapter 69 taxes stoneware by subheading and the Section 301 overlay rides on top of the base rate · the HH dinnerware entries run under a List 3 line at +25% — $5.25 on a $21 FOB set — while a granted exclusion covers the identical reactive-glaze subheading, and 19 CFR 141.89 already requires the ceramics detail on the invoice to claim it. The stoneware-heavy HH entries are carrying overlay duty the spec never needed.",
    action: "$5.25 of overlay on a $21 set. Rework the HH entries.",
    evidence: [
      { claim: "$48.2M of HH entries carried the List 3 +25% overlay over 12 months — $5.25 a set", source: "Broker entry summaries · CBP ACE" },
      { claim: "19 CFR 141.89 requires ceramics commodity detail on every entry invoice", source: "HTSUS Ch. 69 · filing requirement" },
      { claim: "No GTM system holds the classification logic — it lives in the broker's file", source: "Systems survey · none detected" },
    ],
    risks: [
      "CBP can demand back-duty if past entries were misclassified the other way",
      "Subheading allocation must survive an audit — it sets the overlay base",
    ],
    supplierIds: ["SUP-01"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 94%" },
    ],
  },
  {
    id: "OPP-002",
    title: "Second shift at Cedar Mills",
    kind: "make-vs-buy",
    stage: "surfaced",
    category: "Grocery co-manufacture",
    subCategory: "Dry grocery — bake & pack",
    country: "US",
    totalSpend: 39_100_000,
    vendorCount: 1,
    region: "US Midwest",
    addressable: 39_100_000,
    savingsLow: 2_000_000,
    savingsHigh: 2_900_000,
    recommended: 2_400_000,
    confidencePct: 92,
    basis: "mixed",
    summary:
      "Every snack extension quoted outside carries a co-man margin the dedicated lines were built to capture — $2.48 a pouch against the $2.10 River Falls bakes the granola for · Cedar Mills is the one dedicated plant, it bakes and packs, and it runs one shift. A second shift brings the bar and cluster extensions in-house without touching the outside book.",
    action: "$2.48 outside, $2.10 in-house. Cedar Mills runs one shift — cost the second.",
    evidence: [
      { claim: "100% of the bar extension is quoted at outside co-manufacturers", source: "Legacy WMS · supply plan" },
      { claim: "Cedar Mills second shift idle · bake line utilised 54% on shift one", source: "Cedar Mills · capacity survey" },
      { claim: "Outside quotes stack 18% co-man margin over the dedicated-line cost model — $2.48 against $2.10 a pouch", source: "Should-cost model · FY26" },
    ],
    risks: [
      "A second shift needs a small-town labour market to staff it — hiring is the constraint before capital is",
      "Cedar Mills is also the grocery flagship's dating hub — the shift competes with the bake plan",
    ],
    supplierIds: ["SUP-06", "SUP-03"],
    effortWeeks: 14,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 92%" },
    ],
  },
  {
    id: "OPP-003",
    title: "Section 301 lane shift, HH throws",
    kind: "rfp",
    stage: "surfaced",
    category: "Home & kitchen (FOB)",
    subCategory: "Home textiles — throws",
    country: "Vietnam",
    totalSpend: 31_700_000,
    vendorCount: 1,
    region: "Multi-region",
    addressable: 18_400_000,
    savingsLow: 900_000,
    savingsHigh: 1_400_000,
    recommended: 1_100_000,
    confidencePct: 88,
    basis: "benchmark",
    summary:
      "The HH chunky-knit throw is a textile on a hardgoods lane — knitted in Dongguan, so every unit enters under List 3 at +25% on a $9.40 FOB · Vinh Phat runs the towel and rug book on the same cotton-blend yarn base and quoted the pattern at parity. Shifting the lane takes the overlay to zero on the whole style; the price is a requalification through the partner's 20-day approval clock, which can land either way.",
    action: "$2.35 of duty on a $9.40 throw. RFP the lane to Ho Chi Minh City.",
    evidence: [
      { claim: "HH7108 entered 100% from China at List 3 +25% over 12 months — $2.35 a unit", source: "Broker entry summaries · CBP ACE" },
      { claim: "Vinh Phat quoted the chunky-knit pattern at FOB parity on an OEKO-TEX line", source: "RFI 2026-0142" },
      { claim: "Vietnam origin carries the Chapter 63 base rate and no Section 301 overlay", source: "HTSUS Ch. 63 / Ch. 99" },
    ],
    risks: [
      "A new factory is a new design approval — silence past the partner's 20-day clock counts as a no",
      "Luen Hing loses the line it levels its off-season with — the anchor's stoneware price may move",
    ],
    supplierIds: ["SUP-01", "SUP-02"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 88%" },
    ],
  },
  {
    id: "OPP-004",
    title: "Stoneware clay & glaze, dual award",
    kind: "consolidation",
    stage: "surfaced",
    category: "Inputs (via supplier)",
    subCategory: "Clay bodies & glazes",
    country: "China",
    totalSpend: 22_900_000,
    vendorCount: 4,
    region: "South China",
    addressable: 14_600_000,
    savingsLow: 600_000,
    savingsHigh: 900_000,
    recommended: 740_000,
    confidencePct: 86,
    basis: "mixed",
    summary:
      "Two clay houses held ~43% of the clay-body and glaze supply when the factory last disclosed it, and the disclosure has since gone dark · the clay-and-glaze block is 35–50% of the FOB cost, bought by the factory, not by us. A directed dual award through the factory's BOM is the only leverage that reaches it.",
    action: "43% on two houses, one tier out of reach. Direct the dual award.",
    evidence: [
      { claim: "Clay body & glaze block runs 35–50% of stoneware FOB cost", source: "Teardown cost model · FY25" },
      { claim: "Two houses held ~43% of clay/glaze supply at last disclosure (FY2017)", source: "Supplier disclosure · since removed" },
      { claim: "Factory BOMs name the clay house per pattern", source: "Luen Hing · BOM extracts" },
    ],
    risks: [
      "Target is not the buyer of record — the factory owns the vendor relationship",
      "A directed vendor makes the factory's quality problem ours",
    ],
    supplierIds: ["SUP-01"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 86%" },
    ],
  },
  {
    id: "OPP-005",
    title: "Yarn spec harmonisation",
    kind: "index-hedge",
    stage: "surfaced",
    category: "Inputs (via supplier)",
    subCategory: "Yarn & greige fabric",
    country: "Vietnam",
    totalSpend: 18_400_000,
    vendorCount: 3,
    region: "Vietnam",
    addressable: 12_100_000,
    savingsLow: 500_000,
    savingsHigh: 780_000,
    recommended: 620_000,
    confidencePct: 90,
    basis: "evidence",
    summary:
      "Fibre content is what the textile line moves on — classification and marking both read it, and every entry names the fabric mill · forty-odd towel and rug SKUs run four yarn specs where one would do. Harmonising the spec consolidates the mills' buy and simplifies every entry behind it.",
    action: "Four specs where one fits. Harmonise to 16s ring-spun.",
    evidence: [
      { claim: "4 yarn specs across the terry book · 82% of volume fits one", source: "Style master · spec extract" },
      { claim: "Fabric mill and fibre content are required detail on every textile entry", source: "19 CFR 141.89" },
    ],
    risks: [
      "Pile weight differs by program — the spec follows the GSM, not the wish",
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
    title: "Film second source, direct buy",
    kind: "rfp",
    stage: "surfaced",
    category: "Fixtures & packaging",
    subCategory: "Film & pouches — direct buy",
    country: "US",
    totalSpend: 14_800_000,
    vendorCount: 2,
    region: "US Midwest",
    addressable: 9_200_000,
    savingsLow: 400_000,
    savingsHigh: 700_000,
    recommended: 530_000,
    confidencePct: 75,
    basis: "benchmark",
    summary:
      "One converter held ~74% of the barrier film when the buy was last cut, and the direct buy leans harder on Fox Valley than the co-mans' own purchasing does · the freshness promise makes the film a fixed obligation. A qualified second barrier structure halves the single point of failure without touching the bake plan.",
    action: "74% of the film buy on one converter. Qualify the second structure.",
    evidence: [
      { claim: "Fox Valley holds 74% of the direct barrier-film buy", source: "OMS · packaging spend" },
      { claim: "Two converters quoted the barrier structure at parity in the FY25 RFI", source: "RFI 2025-114" },
      { claim: "Freshness dating on the granola book rides on the barrier spec", source: "Packaging spec · Good & Gather" },
    ],
    risks: [
      "A film swap changes the seal validation SOP on every line at River Falls",
    ],
    supplierIds: ["SUP-12"],
    effortWeeks: 12,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 75%" },
    ],
  },
  {
    id: "OPP-007",
    title: "Granola inclusions, organic parity",
    kind: "rfp",
    stage: "surfaced",
    category: "Grocery co-manufacture",
    subCategory: "Dry grocery — bake & pack",
    country: "US",
    totalSpend: 9_600_000,
    vendorCount: 3,
    region: "US Midwest",
    addressable: 7_100_000,
    savingsLow: 300_000,
    savingsHigh: 520_000,
    recommended: 410_000,
    confidencePct: 82,
    basis: "benchmark",
    summary:
      "The snack book consolidated onto one Cedar Rapids roof in May and the ingredient spec still names two single-certified inclusion houses · two Midwest ingredient houses now match USDA Organic on the same inclusions. Qualifying either one returns the award to competition without moving the volume.",
    action: "Single-sourced ingredient spec. Qualify the second house.",
    evidence: [
      { claim: "41% of dry co-pack spend on one co-man since the May award", source: "OMS · spend cube" },
      { claim: "Two ingredient houses hold USDA Organic parity on the inclusion library", source: "Supplier master · certifications" },
    ],
    risks: [
      "219 of 471 upstream growers are outside the audited organic chain — a new house widens the map before it narrows it",
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
    title: "Gift boxes, LCL to FCL",
    kind: "consolidation",
    stage: "surfaced",
    category: "Fixtures & packaging",
    subCategory: "Gift boxes & cartons",
    country: "China",
    totalSpend: 7_300_000,
    vendorCount: 2,
    region: "South China",
    addressable: 4_300_000,
    savingsLow: 150_000,
    savingsHigh: 280_000,
    recommended: 210_000,
    confidencePct: 79,
    basis: "mixed",
    summary:
      "Packaging sails ahead of the merchandise it wraps, and a third of the Zhongshan volume has been moving LCL since the January retool · a weekly FCL slot out of Yantian clears the CFS delay on both ends and prices below the LCL rate at current volume.",
    action: "38% moving LCL. Book the weekly Yantian FCL.",
    evidence: [
      { claim: "38% of Zhongshan volume moved LCL in the last 12 months", source: "Target Sourcing Services · booking history" },
      { claim: "Weekly Yantian FCL quoted at $2,840 all-in", source: "Forwarder quote · 26-Q3-0912" },
      { claim: "LCL adds 4 days at the CFS on both ends", source: "Broker transit history" },
    ],
    risks: [
      "A weekly slot needs the volume to hold through the pharmacy-exit comps",
    ],
    supplierIds: ["SUP-11"],
    effortWeeks: 8,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 79%" },
    ],
  },
  {
    id: "OPP-105",
    title: "Cai Mep FCL consolidation, replenishment",
    kind: "freight",
    stage: "accepted",
    category: "Textiles & softlines (FOB)",
    region: "Vietnam",
    addressable: 6_800_000,
    savingsLow: 700_000,
    savingsHigh: 1_100_000,
    recommended: 820_000,
    confidencePct: 81,
    basis: "mixed",
    summary:
      "Vinh Phat's towel and rug replenishment leaves Ho Chi Minh City as LCL and air top-ups — $0.75–2.25 a unit on a $3.80 FOB towel, and that is right for a reset date, not for steady carry-over demand · consolidating the flat half of the book onto a weekly FCL out of Cai Mep holds the calendar and returns the premium. The reset waves stay on air, which is the whole point of having both programs.",
    action: "Resets fly, carry-over sails. Book the weekly Cai Mep FCL.",
    evidence: [
      { claim: "LCL and air top-ups run $0.75–2.25 a unit on a $3.80 FOB towel — 20–60% of first cost", source: "Freight cost model" },
      { claim: "TSS AIR and TSS OCEAN run as standing parallel programs out of HCMC", source: "US customs manifests" },
      { claim: "Carry-over towel and rug SKUs show flat weekly demand across two sets", source: "OMS · demand history" },
    ],
    risks: [
      "An ocean slip on a carry-over style becomes an air recovery — the saving must fund its own insurance",
    ],
    supplierIds: ["SUP-02", "SUP-08"],
    effortWeeks: 8,
    owner: "Marcus Whitfield",
    events: [
      { at: "24 Jul 2026", actor: "Mercer", note: "Surfaced · confidence 81%" },
      { at: "31 Jul 2026", actor: "Marcus Whitfield", note: "Accepted · weekly Cai Mep slot held pending PO change" },
    ],
  },
  {
    id: "OPP-107",
    title: "Supplier terms, net 60 standard",
    kind: "pack-moq",
    stage: "realizing",
    category: "Home & kitchen (FOB)",
    region: "South China",
    addressable: 4_200_000,
    savingsLow: 200_000,
    savingsHigh: 350_000,
    recommended: 240_000,
    confidencePct: 74,
    basis: "evidence",
    summary:
      "The import book runs PO-only with no long-term contracts, and terms were onboarded three different ways · the factories carry the raw-material MOQ risk already, so terms are the one commercial lever that costs them nothing structural. Net 60 as the book standard, discount for earlier.",
    action: "Three onboarding paths, one standard. Paper net 60.",
    evidence: [
      { claim: "Terms range net 30–60 with two records missing entirely", source: "OMS · vendor master" },
      { claim: "PO-only book — no contract renegotiation required to move terms", source: "Sourcing policy" },
    ],
    risks: [
      "The factories fund raw-material MOQs — push terms too far and the FOB price absorbs it",
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
      { id: "m1", label: "Item master updated", status: "completed", date: "22 Apr 2026" },
      { id: "m2", label: "First rounded orders placed", status: "completed", date: "6 May 2026" },
      { id: "m3", label: "Handling saving verified at DC", status: "active", date: "In progress" },
      { id: "m4", label: "Write-off baseline re-cut", status: "pending" },
    ],
    events: [
      { at: "2 Apr 2026", actor: "Mercer", note: "Surfaced · confidence 74%" },
      { at: "14 Apr 2026", actor: "Marcus Whitfield", note: "Committed $240K · owner Marcus Whitfield" },
      { at: "6 May 2026", actor: "Mercer", note: "First rounded orders confirmed on three SKUs" },
    ],
  },
  {
    id: "OPP-108",
    title: "Serveware tail, retire onto Luen Hing",
    kind: "tail",
    stage: "committed",
    category: "Home & kitchen (FOB)",
    region: "South China",
    addressable: 3_900_000,
    savingsLow: 450_000,
    savingsHigh: 600_000,
    recommended: 480_000,
    confidencePct: 69,
    basis: "mixed",
    summary:
      "The HH serveware tail — boards, trays, bud vases — is bought from a dozen sub-scale Dongguan roofs at $6.80–9.20 FOB a board while Luen Hing runs the same acacia and ceramic lines at scale · retiring the tail onto the anchor's lines replaces twelve vendor files with one PO calendar and takes the tail patterns down to the anchor's price.",
    action: "Twelve tail vendors, one anchor. Migrate the serveware tail.",
    evidence: [
      { claim: "Serveware tail bought from 12 suppliers across 28 SKUs last year", source: "OMS · PO history" },
      { claim: "Luen Hing quoted the tail patterns at −6% on the consolidated volume", source: "RFQ 2026-0198" },
    ],
    risks: [
      "Three tail vendors hold exclusivity on a spec finish — the scope has to buy it out or carve them out",
    ],
    supplierIds: ["SUP-01"],
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
      { id: "m1", label: "Catalogue agreed", status: "completed", date: "18 Jul 2026" },
      { id: "m2", label: "First 12 SKUs migrated", status: "active", date: "In progress" },
      { id: "m3", label: "Remaining 16 migrated", status: "pending" },
      { id: "m4", label: "Legacy tail vendors deactivated", status: "pending" },
    ],
    drift: {
      flagged: true,
      note: "Q3 landed $44K against a $60K ramp — three tail vendors hold exclusivity on a spec finish and are still shipping direct.",
    },
    events: [
      { at: "10 Jun 2026", actor: "Mercer", note: "Surfaced · confidence 69%" },
      { at: "2 Jul 2026", actor: "Marcus Whitfield", note: "Committed $480K" },
      { at: "5 Aug 2026", actor: "Mercer", note: "Drift flagged · Q3 realization 27% behind ramp" },
    ],
  },
  {
    id: "OPP-109",
    title: "Snack co-man consolidation, Cedar Rapids award",
    kind: "consolidation",
    stage: "realizing",
    category: "Grocery co-manufacture",
    region: "US Midwest",
    addressable: 5_200_000,
    savingsLow: 320_000,
    savingsHigh: 520_000,
    recommended: 390_000,
    confidencePct: 77,
    basis: "evidence",
    summary:
      "Four snack co-manufacturers, top holder at 29% · one award consolidates the book onto the best delivery record on the roster and funds the organic requalification from the volume step.",
    action: "Four roofs to one. Consolidate the snack award.",
    evidence: [
      { claim: "Four suppliers, top holder at 29% of the category", source: "OMS · spend cube FY26" },
      { claim: "Cedar Rapids quoted −4% from the consolidated tier", source: "RFQ 2026-0311" },
    ],
    risks: [
      "Concentration replaces fragmentation — the dual-source play inherits the risk",
    ],
    supplierIds: ["SUP-03"],
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
      { id: "m1", label: "Cedar Rapids capacity confirmed", status: "completed", date: "28 May 2026" },
      { id: "m2", label: "First transferred SKUs shipped", status: "completed", date: "1 Jul 2026" },
      { id: "m3", label: "Last legacy PO placed", status: "active", date: "Due 31 Aug 2026" },
      { id: "m4", label: "Legacy ingredient spec retired", status: "pending" },
    ],
    events: [
      { at: "4 May 2026", actor: "Mercer", note: "Surfaced · confidence 77%" },
      { at: "19 May 2026", actor: "Marcus Whitfield", note: "Committed $390K" },
      { at: "1 Jul 2026", actor: "Mercer", note: "First transferred SKUs shipped on schedule" },
    ],
  },
  {
    id: "OPP-110",
    title: "Fixture supplier consolidation",
    kind: "consolidation",
    stage: "realized",
    category: "Fixtures & packaging",
    region: "South China",
    addressable: 1_400_000,
    savingsLow: 110_000,
    savingsHigh: 160_000,
    recommended: 130_000,
    confidencePct: 86,
    basis: "evidence",
    summary:
      "Roughly 37 of the ~91 loaded Tier 1 suppliers make fixtures and packaging — the most fragmented spend on the book for the least differentiated product · the award moved the display volume to two roofs and the saving realized ahead of ramp.",
    action: "37 suppliers make fixtures. Two are enough for displays.",
    evidence: [
      { claim: "41 suppliers across $3.9M · 28 under $60K each", source: "OMS · spend cube FY25" },
    ],
    risks: [
      "Store reset calendars spike the volume — two roofs must absorb the peaks",
    ],
    supplierIds: ["SUP-10"],
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
      { id: "m1", label: "Catalogue agreed", status: "completed", date: "20 Sep 2025" },
      { id: "m2", label: "All four suppliers migrated", status: "completed", date: "14 Nov 2025" },
      { id: "m3", label: "Saving verified by finance", status: "completed", date: "12 Aug 2026" },
    ],
    events: [
      { at: "8 Sep 2025", actor: "Marcus Whitfield", note: "Committed $130K" },
      { at: "12 Aug 2026", actor: "Mercer", note: "Realized $134K · verified with finance, play closed" },
    ],
  },
  {
    id: "OPP-111",
    title: "Towel tail, Vinh Phat consolidation",
    kind: "consolidation",
    stage: "dismissed",
    category: "Textiles & softlines (FOB)",
    region: "Vietnam",
    addressable: 6_100_000,
    savingsLow: 380_000,
    savingsHigh: 560_000,
    recommended: 420_000,
    confidencePct: 58,
    basis: "benchmark",
    summary:
      "Consolidating the towel tail onto Vinh Phat priced 5% under the split book · dismissed because the line it would land on runs at 94% utilisation with an 83% OTIF record — the sweep read price and share and never opened the capacity survey. Capacity, not price, was the question.",
    action: "5% cheaper, no line to run it on. Keep the split — dismissed.",
    evidence: [
      { claim: "Vinh Phat quote −5% vs the split towel book", source: "RFQ 2026-0287" },
      { claim: "Terry line 2 at 94% utilisation in peak · 83% OTIF over the last four quarters", source: "Capacity survey · Jun 2026" },
    ],
    risks: [
      "Price beats capacity only until the first peak — a rolled container at Cai Mep is a missed reset",
    ],
    supplierIds: ["SUP-02"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    dismissReason: "Capacity cannot hold the volume",
    events: [
      { at: "17 Jul 2026", actor: "Mercer", note: "Surfaced · confidence 58%" },
      {
        at: "21 Jul 2026",
        actor: "Marcus Whitfield",
        note: "Dismissed · one line at 94% utilisation and 83% OTIF. Logged for sweep calibration.",
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
 * The value-realization lifecycle, derived from stage — Allison's three-stage
 * track machine ported onto this book's stages.
 *
 *   committed  → signed off, not yet in execution (awaiting go-live)
 *   live       → in execution, on the ramp, RAG-tracked  (stage "realizing")
 *   realized   → ERP-confirmed and closed                (stage "realized")
 *
 * A play only appears on the savings ramp once it is live: projected bars
 * stand alone until the ERP posts actuals, and realized fills in behind them.
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
  /** Category spend Marcus owns. */
  spend: SUPPLIERS.reduce((sum, s) => sum + s.annualSpend, 0),
  /** Tier 1 relationships on the loaded home-and-grocery book, of which the
   *  file above details twelve. The full Tier 1 roster runs to the hundreds. */
  suppliers: 91,
  importShare: 83,
  /** Purchase orders open right now across the book. */
  openPos: SUPPLIERS.reduce((sum, s) => sum + s.openPos, 0),
  openPoValue: SUPPLIERS.reduce((sum, s) => sum + s.openPoValue, 0),
  /** The benchmark band the sweep is measured against. */
  benchmarkLow: 13.2,
  benchmarkHigh: 18.0,
} as const;

/** What a category is called on an axis, where "Soft surface · Commercial
 *  broadloom" has room for about eight characters. The full name stays on the
 *  supplier record; this is only for the chart. */
const AXIS_LABEL: Record<string, string> = {
  "Home & kitchen · Hardgoods FOB": "Hardgoods",
  "Home textiles · FOB": "Textiles",
  "Grocery · Dry co-pack": "Co-pack",
  "Grocery · Co-manufacture": "Grocery",
  "Origin consolidation": "Consol",
  "Apparel & softlines": "Apparel",
  "Store display units": "Displays",
  "Gift boxes & cartons": "Packaging",
  "Packaging film · Direct buy": "Film",
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

/** Suppliers with no payment term on file, by name — the onboarding-era data
 *  gap the terms play has to close before it can be run. External suppliers
 *  only: an internal transfer has no commercial term to be missing. */
export function termsGaps(): Supplier[] {
  return SUPPLIERS.filter((s) => !s.own && s.paymentTermsDays === null);
}

/* ═══════════════════════════════════════════════════════════════
 *  Running a play — the Act workspace
 *
 *  Accepting a play is not doing it. Between "yes, run this" and
 *  "committed $340K" there is a fortnight of work with an order to
 *  it: you cannot benchmark a category before you know what is in
 *  scope, and you cannot commit a figure before anyone has spoken to
 *  the supplier. The tracker is that order, made visible.
 *
 *  Ported from the Allison procurement Act tracker: a step list per
 *  play kind, each step naming what the agent can do for it, and the
 *  first step an upload that GATES the rest — the scope file is the
 *  thing every later figure is computed against, so working ahead of
 *  it produces numbers nobody can stand behind.
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
  shortlist: { cta: "Build the shortlist", helper: "Qualified suppliers, ranked, with why." },
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
    { label: "Confirm scope and any sole-source carve-outs", kind: "upload" },
    { label: "Validate the incumbent — capacity, service and terms", kind: "validate" },
    { label: "Model the consolidated volume and target price", kind: "model" },
    { label: "Draft the consolidation proposal", kind: "draft" },
    { label: "Negotiate, sign and award", kind: "manual" },
  ],
  "dual-source": [
    { label: "Confirm scope, specs and quality requirements", kind: "upload" },
    { label: "Qualify the second mill", kind: "validate" },
    { label: "Draft the qualification plan", kind: "draft" },
    { label: "Run the trial order and validate", kind: "manual" },
    { label: "Ramp, award and capture the saving", kind: "manual" },
  ],
  tariff: [
    { label: "Attach the entry summaries and the ruling", kind: "upload" },
    { label: "Validate the classification against the ruling", kind: "validate" },
    { label: "Draft the protest or reclassification filing", kind: "draft" },
    { label: "File it and track the refund", kind: "manual" },
  ],
  terms: [
    { label: "Pull the current terms across the book", kind: "upload" },
    { label: "Benchmark the terms against the market", kind: "benchmark" },
    { label: "Draft the terms ask, supplier by supplier", kind: "draft" },
    { label: "Run the conversations", kind: "manual" },
    { label: "Agree and capture the working-capital gain", kind: "manual" },
  ],
  freight: [
    { label: "Attach the lane and mode history", kind: "upload" },
    { label: "Model the mode shift and its transit cost", kind: "model" },
    { label: "Shortlist carriers for the lane", kind: "shortlist" },
    { label: "Draft the lane award", kind: "draft" },
    { label: "Award and capture the rate", kind: "manual" },
  ],
  "index-clause": [
    { label: "Attach the contracts and the index history", kind: "upload" },
    { label: "Benchmark the index against realised cost", kind: "benchmark" },
    { label: "Draft the clause and its cap", kind: "draft" },
    { label: "Agree the clause at renewal", kind: "manual" },
  ],
  "pack-moq": [
    { label: "Attach the pack specs and order history", kind: "upload" },
    { label: "Model the pack change against demand", kind: "model" },
    { label: "Draft the pack and MOQ ask", kind: "draft" },
    { label: "Agree it and update the item master", kind: "manual" },
  ],
  tail: [
    { label: "Attach the tail spend extract", kind: "upload" },
    { label: "Shortlist the integrator or the surviving suppliers", kind: "shortlist" },
    { label: "Draft the migration and cut-over plan", kind: "draft" },
    { label: "Migrate the tail and close the accounts", kind: "manual" },
  ],

  /* The raw-materials levers. `PlayKind` gained these three and the record did
     not, so `tasksFor` would have handed back undefined for any play on one of
     them — a tracker with no steps in it. */
  "index-hedge": [
    { label: "Attach the index exposure and the volume it prices", kind: "upload" },
    { label: "Validate the index against what the supplier actually bills", kind: "validate" },
    { label: "Model the hedge — coverage, tenor and the floor", kind: "model" },
    { label: "Draft the clause for legal and treasury", kind: "draft" },
  ],
  "make-vs-buy": [
    { label: "Attach the part list and the current bought-in cost", kind: "upload" },
    { label: "Validate internal capacity and the tooling it would need", kind: "validate" },
    { label: "Model make against buy at volume, landed", kind: "model" },
    { label: "Draft the recommendation with the capital ask", kind: "draft" },
  ],
  rfp: [
    { label: "Attach the specification and the volumes to quote", kind: "upload" },
    { label: "Shortlist the bidders and check they are qualified", kind: "shortlist" },
    { label: "Model the bids on a landed, like-for-like basis", kind: "model" },
    { label: "Draft the award recommendation", kind: "draft" },
    { label: "Award and paper the contract", kind: "manual" },
  ],
};

/** The seeded task list for a play — its playbook, all steps open. */
export function tasksFor(play: Play): PlayTask[] {
  return PLAYBOOKS[play.kind].map((s) => ({ ...s, status: "open" as const }));
}
