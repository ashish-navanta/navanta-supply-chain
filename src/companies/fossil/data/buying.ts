/* ═══════════════════════════════════════════════════════════════
 *  Fossil — the buying desk beyond the exception queue
 *
 *  Mercer's whole book: the supplier roster, the opportunity feed
 *  and the value ledger. Grounded in the operating reality the
 *  research established — a PO-only assembly book across ~91 Tier 1
 *  factories (29 of the 32 watch factories in China), one owned
 *  plant at Solan, three majority-owned vehicles still in Exhibit
 *  21.1, components bought by the assembler rather than by Fossil,
 *  and a duty regime where classification and valuation are
 *  commercial levers, not compliance chores.
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
  /** True for a Fossil-owned or majority-owned entity — an internal source is
   *  rescheduled, not renegotiated, so the whole page treats the two
   *  differently. Four of these exist, and three are the Exhibit 21.1
   *  question. */
  own: boolean;
  site: string;
  country: string;
  region: "China" | "India" | "Southeast Asia" | "Other" | (string & {});
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
  /* ─── The FOB assemblers — where the watch book actually comes from ──
     Three of these carry names the research names (Qi Guang, Renley, and
     the owned entities further down). The rest are FIXTURE NAMES — the
     published Tier 1 list carries ~91 factories with no city-level detail,
     and inventing addresses for real companies would be worse than a
     placeholder that says what it is. */
  S({
    id: "SUP-01",
    name: "Qi Guang Watch",
    own: false,
    site: "Dongguan",
    country: "China",
    region: "China",
    categories: ["Watches · Quartz FOB"],
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
      "2.8% under the Dongguan quartz benchmark on FOB cost",
      "91% OTIF · quoted lead time moved 46 → 56 days this quarter",
      "2.4 rejects per thousand units · no open quality claims",
      "One casing line on the MK book, no qualified backup",
      "Net 60 · no early-payment discount on file",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 14,
    openPoValue: 4_180_000,
    /* PO-only, like the whole assembly book: no long-term contract exists to
       expire. The `contractExpiry: null` is the fact, not a data gap. */
    note: "The anchor of the watch book — the largest identified assembler on the published Tier 1 list. Cheapest FOB we hold, and the longest lead time on it.",
  }),
  S({
    id: "SUP-02",
    name: "Renley Watch Mfg",
    own: false,
    site: "Hung Hom",
    country: "Hong Kong",
    region: "China",
    categories: ["Watches · Automatic FOB"],
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
      "At benchmark on automatics, 2% over on exhibition casebacks",
      "87% OTIF · two consolidations missed the Wednesday cutoff last quarter",
      "3.1 rejects per thousand · one open crown-alignment claim",
      "Second line free — capacity to take Qi Guang overflow",
      "Net 60 · the only assembler quoting an early-payment discount",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 11,
    openPoValue: 3_240_000,
    note: "The only Hong Kong entry on the watch list — independent, despite sharing a city with Fossil East. The automatics run here.",
  }),
  S({
    id: "SUP-03",
    /* FIXTURE NAME — the jewelry assembly base is real, its names are not published. */
    name: "Sheung Wan Jewellery Works",
    own: false,
    site: "Panyu",
    country: "China",
    region: "China",
    categories: ["Jewelry · Fashion"],
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
      "1.8 rejects per thousand · plating claims closed out",
      "41% of jewelry on one roof — the concentration is ours, not theirs",
      "Net 45 · terms renegotiated at the May review",
    ]),
    status: "consolidation-target",
    contractExpiry: null,
    openPos: 6,
    openPoValue: 1_080_000,
    note: "Took the consolidated jewelry award in May. Watch the concentration, not the supplier.",
  }),
  S({
    id: "SUP-04",
    /* FIXTURE NAME — leather goods run across Cambodia, Bangladesh, Myanmar,
       the Philippines and Guatemala on the published list. */
    name: "Mekong Leather Goods",
    own: false,
    site: "Phnom Penh",
    country: "Cambodia",
    region: "Southeast Asia",
    categories: ["Leather goods"],
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
    note: "The leather book's anchor since the China exit. Not in the Americas Priority scope — the book still has to be bought.",
  }),
  S({
    id: "SUP-05",
    /* FIXTURE NAME. */
    name: "Dhaka Small Leather",
    own: false,
    site: "Dhaka",
    country: "Bangladesh",
    region: "Southeast Asia",
    categories: ["Leather goods"],
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
      "6% under benchmark — cheapest smalls in the book",
      "79% OTIF · the worst delivery record we still buy from",
      "5.6 rejects per thousand · two open edge-paint claims",
      "One site, one port, monsoon season on both",
      "No payment term on file — onboarded outside the system",
    ]),
    status: "dual-source-candidate",
    contractExpiry: null,
    openPos: 4,
    openPoValue: 740_000,
    note: "Cheap and fragile. The terms gap is a data problem before it is a commercial one.",
  }),

  /* ─── Owned & affiliates — Exhibit 21.1 names ────────────────────────
     Fossil India is the one owned plant on the published list. The three
     entities after it are majority-owned assembly vehicles still listed in
     Exhibit 21.1 as of Jan 2026 — whether they are dormant shells or
     assemble off the published list is one of the genuinely open questions,
     and their rows say so rather than resolving it. */
  S({
    id: "SUP-06",
    name: "Fossil India (Solan)",
    own: true,
    site: "Solan district, Himachal Pradesh",
    country: "India",
    region: "India",
    categories: ["Watches · Casing-up"],
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
      "1.2 rejects per thousand · ISO certified this year",
      "One shift running — the second shift is the make-vs-buy play",
      "No commercial terms — an internal transfer has none to have",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 5,
    openPoValue: 820_000,
    note: "The only owned plant. Casing-up and packaging, one shift — which is exactly why the India COO play keeps coming up.",
  }),
  S({
    id: "SUP-07",
    name: "Pulse Time Center",
    own: true,
    site: "Hong Kong",
    country: "Hong Kong",
    region: "China",
    categories: ["Watches · Assembly"],
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
      "90% OTIF on what little moves through it",
      "2.0 rejects per thousand",
      "Majority-owned vehicle, undisclosed utilisation — the risk is opacity",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 310_000,
    note: "Still in Exhibit 21.1; not on the published factory list. Dormant shell or active assembler is an open question — reliability is marked low for that reason, not for performance.",
  }),
  S({
    id: "SUP-08",
    name: "Pulse Time Shenzhen",
    own: true,
    site: "Shenzhen",
    country: "China",
    region: "China",
    categories: ["Watches · Assembly"],
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
      "89% OTIF on a thin book",
      "2.2 rejects per thousand",
      "Same opacity as its Hong Kong sibling",
      "Internal — no commercial terms",
    ]),
    status: "active",
    contractExpiry: null,
    openPos: 2,
    openPoValue: 260_000,
    note: "The mainland half of the Pulse Time pair. Same Exhibit 21.1 question.",
  }),
  S({
    id: "SUP-09",
    name: "FDT Ltd",
    own: true,
    site: "Hong Kong",
    country: "Hong Kong",
    region: "China",
    categories: ["Watches · Assembly"],
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
      "88% OTIF on the smallest book of the three vehicles",
      "2.1 rejects per thousand",
      "Ownership percentage undisclosed since FY2021",
      "Internal — no commercial terms",
    ]),
    status: "exit-planned",
    contractExpiry: null,
    openPos: 1,
    openPoValue: 90_000,
    note: "The third majority-owned vehicle. If the vertical-integration exit finishes anywhere, it finishes here.",
  }),

  /* ─── Fixtures, packaging and the service tail ──────────────────────── */
  S({
    id: "SUP-10",
    /* FIXTURE NAME — ~37 of the ~91 Tier 1 factories make only this. */
    name: "Dongguan Display & Fixture",
    own: false,
    site: "Dongguan",
    country: "China",
    region: "China",
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
    note: "Fixtures sail through Long Beach and skew every free trade dataset watch-light. Consolidation candidate, not a risk.",
  }),
  S({
    id: "SUP-11",
    /* FIXTURE NAME. */
    name: "Zhongshan Tin & Box",
    own: false,
    site: "Zhongshan",
    country: "China",
    region: "China",
    categories: ["Tins & gift boxes"],
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
    note: "The tin every Fossil watch ships in. Boring in the best way.",
  }),
  S({
    id: "SUP-12",
    name: "Citizen Machinery (Miyota)",
    own: false,
    site: "Miyota, Nagano",
    country: "Japan",
    region: "Other",
    categories: ["Service parts · Movements"],
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
      "A movement costs what Miyota says it costs — there is no benchmark",
      "96% OTIF · the most reliable vendor on the book",
      "0.4 rejects per thousand · effectively zero",
      "74% of service movements on one vendor, and production is worse — the assemblers buy from the same place",
      "Net 60 · standard Citizen terms, non-negotiable",
    ]),
    status: "preferred",
    contractExpiry: null,
    openPos: 3,
    openPoValue: 1_140_000,
    /* The only component vendor Fossil buys from DIRECTLY — the $15.6M
       components inventory is the 11-year warranty's parts obligation, not
       production stock. Production movements are the assemblers' purchase. */
    note: "The service-parts buy behind the 11-year warranty. Production movement concentration mirrors this row, one tier out of reach.",
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
    title: "Strap-line reclassification, MK book",
    kind: "index-hedge",
    stage: "surfaced",
    category: "Finished goods (FOB)",
    subCategory: "Watches — cased & packaged",
    country: "US",
    totalSpend: 48_200_000,
    vendorCount: 2,
    region: "China",
    addressable: 41_800_000,
    savingsLow: 1_600_000,
    savingsHigh: 2_200_000,
    recommended: 1_900_000,
    confidencePct: 94,
    basis: "evidence",
    summary:
      "Chapter 91 taxes a watch component by component and only the case, strap and battery ad valorem · the strap line runs 14% on a steel bracelet and 2.8% on leather, and 19 CFR 141.89 already requires the invoice to break the values out. The bracelet-heavy MK entries are carrying strap-line duty the spec never needed.",
    action: "14% vs 2.8% on one line. Reclassify the strap entries.",
    evidence: [
      { claim: "$48.2M of MK entries carried the 14% bracelet strap line over 12 months", source: "Broker entry summaries · CBP ACE" },
      { claim: "19 CFR 141.89 requires component value breakout on every watch invoice", source: "HTSUS Ch. 91 · filing requirement" },
      { claim: "No GTM system holds the classification logic — it lives in the broker's file", source: "Systems survey · none detected" },
    ],
    risks: [
      "CBP can demand back-duty if past entries were misclassified the other way",
      "Component value allocation must survive an audit — it sets the duty base",
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
    title: "Casing-up shift to Solan",
    kind: "make-vs-buy",
    stage: "surfaced",
    category: "Finished goods (FOB)",
    subCategory: "Watches — cased & packaged",
    country: "India",
    totalSpend: 39_100_000,
    vendorCount: 1,
    region: "India",
    addressable: 39_100_000,
    savingsLow: 2_000_000,
    savingsHigh: 2_900_000,
    recommended: 2_400_000,
    confidencePct: 92,
    basis: "mixed",
    summary:
      "Every unit cased in Dongguan enters the US carrying the China overlay on its full value · Solan is the one owned plant, it cases and packages, and it runs one shift. A second shift moves the country of origin on the India-bound and EU-bound book without touching the assembler.",
    action: "Overlay-exposed. Solan runs one shift — cost the casing-up move.",
    evidence: [
      { claim: "100% of MK casing-up sits at one Dongguan assembler", source: "Navision · supply plan HK" },
      { claim: "Solan second shift idle · casing line utilised 54% on shift one", source: "Fossil India · capacity survey" },
      { claim: "Ch. 99 overlays assess on entered value of the whole article — origin is the lever", source: "HTSUS Ch. 99 · overlay structure" },
    ],
    risks: [
      "Substantial-transformation rules decide whether casing-up moves origin — needs a ruling before it needs a plan",
      "Solan is also the India market's service hub — the shift competes with repair",
    ],
    supplierIds: ["SUP-06", "SUP-01"],
    effortWeeks: 14,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 92%" },
    ],
  },
  {
    id: "OPP-003",
    title: "First-sale valuation, Fossil East",
    kind: "rfp",
    stage: "surfaced",
    category: "Finished goods (FOB)",
    subCategory: "Watches — cased & packaged",
    country: "US",
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
      "Fossil East takes title in Hong Kong and appears as shipper of record on the US entries · a first-sale program values duty on the factory invoice rather than the HK resale, and every overlay assessed on entered value shrinks with the base. The structure is already in place — the documentation program is not.",
    action: "Title already passes twice. File first-sale on the factory price.",
    evidence: [
      { claim: "Fossil East Ltd is shipper/exporter of record on 2,053 US shipments", source: "US customs manifests" },
      { claim: "First-sale requires arm's-length factory pricing evidence per entry", source: "CBP first-sale doctrine" },
      { claim: "Overlay duty is ad valorem on entered value — base reduction compounds it", source: "Broker duty model · FY25 entries" },
    ],
    risks: [
      "Related-party pricing between Fossil East and the factories must prove arm's length",
      "Audit exposure runs both ways — the same records reprice old entries",
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
    title: "Case & bracelet dual award",
    kind: "consolidation",
    stage: "surfaced",
    category: "Components (via assembler)",
    subCategory: "Cases & bracelets",
    country: "China",
    totalSpend: 22_900_000,
    vendorCount: 4,
    region: "China",
    addressable: 14_600_000,
    savingsLow: 600_000,
    savingsHigh: 900_000,
    recommended: 740_000,
    confidencePct: 86,
    basis: "mixed",
    summary:
      "Two vendors held ~43% of case and bracelet supply when Fossil last disclosed it, and the disclosure has since gone dark · the case block is 35–50% of BOM, bought by the assembler, not by us. A directed dual award through the assembler's BOM is the only leverage that reaches it.",
    action: "43% on two vendors, one tier out of reach. Direct the dual award.",
    evidence: [
      { claim: "Case & bracelet block runs 35–50% of watch BOM", source: "Teardown cost model · FY25" },
      { claim: "Two vendors held ~43% of case/bracelet supply at last disclosure (FY2017)", source: "10-K · since removed" },
      { claim: "Assembler BOMs name the case vendor per style", source: "Qi Guang · BOM extracts" },
    ],
    risks: [
      "Fossil is not the buyer of record — the assembler owns the vendor relationship",
      "A directed vendor makes the assembler's quality problem ours",
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
    title: "Battery spec harmonisation",
    kind: "index-hedge",
    stage: "surfaced",
    category: "Components (via assembler)",
    subCategory: "Straps & batteries",
    country: "China",
    totalSpend: 18_400_000,
    vendorCount: 3,
    region: "China",
    addressable: 12_100_000,
    savingsLow: 500_000,
    savingsHigh: 780_000,
    recommended: 620_000,
    confidencePct: 90,
    basis: "evidence",
    summary:
      "The battery is one of three ad valorem lines on a watch entry at 5.3%, and 141.89 requires the manufacturer named on every invoice · forty-odd quartz SKUs run four battery specs where one would do. Harmonising the spec consolidates the assemblers' buy and simplifies every entry behind it.",
    action: "Four specs where one fits. Harmonise to SR626SW.",
    evidence: [
      { claim: "4 battery specs across the quartz book · 82% of volume fits one", source: "Style master · spec extract" },
      { claim: "Battery manufacturer is a required invoice field on every watch entry", source: "19 CFR 141.89" },
    ],
    risks: [
      "Movement holders differ by calibre — the spec follows the movement, not the wish",
    ],
    supplierIds: ["SUP-01"],
    effortWeeks: 10,
    owner: "Marcus Whitfield",
    events: [
      { at: "9 Aug 2026", actor: "Mercer", note: "Surfaced from the overnight sweep · confidence 90%" },
    ],
  },
  {
    id: "OPP-006",
    title: "Movement second source, service tail",
    kind: "rfp",
    stage: "surfaced",
    category: "Service parts",
    subCategory: "Movements, hands & dials",
    country: "Japan",
    totalSpend: 14_800_000,
    vendorCount: 2,
    region: "Other",
    addressable: 9_200_000,
    savingsLow: 400_000,
    savingsHigh: 700_000,
    recommended: 530_000,
    confidencePct: 75,
    basis: "benchmark",
    summary:
      "Three vendors supplied ~73–78% of movements when it was last disclosed, and the service buy leans harder on Miyota than production does · the 11-year warranty makes the tail a fixed obligation. A qualified second calibre family halves the single point of failure without touching production.",
    action: "74% of the service buy on one vendor. Qualify the second calibre.",
    evidence: [
      { claim: "Miyota holds 74% of the service movement buy", source: "SAP ECC · service parts spend" },
      { claim: "Three vendors supplied ~73–78% of movements FY2015–17 · disclosure removed", source: "10-K series" },
      { claim: "11-year warranty on movement, hands and dial funds the tail", source: "Warranty policy · Fossil brand" },
    ],
    risks: [
      "A calibre swap in service changes the repair SOP for every door that ships to Dallas",
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
    title: "Jewelry plating, REACH parity",
    kind: "rfp",
    stage: "surfaced",
    category: "Finished goods (FOB)",
    subCategory: "Jewelry",
    country: "China",
    totalSpend: 9_600_000,
    vendorCount: 3,
    region: "China",
    addressable: 7_100_000,
    savingsLow: 300_000,
    savingsHigh: 520_000,
    recommended: 410_000,
    confidencePct: 82,
    basis: "benchmark",
    summary:
      "The jewelry book consolidated onto one Panyu roof in May and the plating spec still names two EU-only chemistries · two Asian houses now match REACH compliance on the same finish. Qualifying either one returns the award to competition without moving the volume.",
    action: "Single-sourced plating spec. Qualify the second house.",
    evidence: [
      { claim: "41% of jewelry spend on one assembler since the May award", source: "SAP ECC · spend cube" },
      { claim: "Two Asian plating houses hold REACH parity on the finish library", source: "Supplier master · certifications" },
    ],
    risks: [
      "219 of 471 smelters in the chain are unassured — a new house widens the map before it narrows it",
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
    subCategory: "Tins & gift boxes",
    country: "China",
    totalSpend: 7_300_000,
    vendorCount: 2,
    region: "China",
    addressable: 4_300_000,
    savingsLow: 150_000,
    savingsHigh: 280_000,
    recommended: 210_000,
    confidencePct: 79,
    basis: "mixed",
    summary:
      "Packaging sails while watches fly, and a third of the Zhongshan volume has been moving LCL since the January retool · a weekly FCL slot out of Yantian clears the CFS delay on both ends and prices below the LCL rate at current volume.",
    action: "38% moving LCL. Book the weekly Yantian FCL.",
    evidence: [
      { claim: "38% of Zhongshan volume moved LCL in the last 12 months", source: "Fossil East · booking history" },
      { claim: "Weekly Yantian FCL quoted at $2,840 all-in", source: "Forwarder quote · 26-Q3-0912" },
      { claim: "LCL adds 4 days at the CFS on both ends", source: "Broker transit history" },
    ],
    risks: [
      "A weekly slot needs the volume to hold through the smartwatch-exit comps",
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
    title: "Air-ocean rebalance, replenishment",
    kind: "freight",
    stage: "accepted",
    category: "Finished goods (FOB)",
    region: "Multi-region",
    addressable: 6_800_000,
    savingsLow: 700_000,
    savingsHigh: 1_100_000,
    recommended: 820_000,
    confidencePct: 81,
    basis: "mixed",
    summary:
      "Watches fly at $0.75–2.25 a unit and that is right for launches — it is not right for steady replenishment of carry-over styles · moving the flat half of the book to ocean holds the calendar and returns the premium. The launch waves stay on air, which is the whole point of having both programs.",
    action: "Launches fly, carry-over sails. Split the standing programs.",
    evidence: [
      { claim: "Air premium runs $0.75–2.25 a unit, 1–4% of wholesale", source: "Freight cost model" },
      { claim: "FOSSIL EAST LTD AIR and OCEAN run as standing parallel programs", source: "US customs manifests" },
      { claim: "Carry-over styles show flat weekly demand across two seasons", source: "SAP ECC · demand history" },
    ],
    risks: [
      "An ocean slip on a carry-over style becomes an air recovery — the saving must fund its own insurance",
    ],
    supplierIds: ["SUP-01", "SUP-02"],
    effortWeeks: 8,
    owner: "Marcus Whitfield",
    events: [
      { at: "24 Jul 2026", actor: "Mercer", note: "Surfaced · confidence 81%" },
      { at: "31 Jul 2026", actor: "Marcus Whitfield", note: "Accepted · forwarder slot held pending PO change" },
    ],
  },
  {
    id: "OPP-107",
    title: "Assembler terms, net 60 standard",
    kind: "pack-moq",
    stage: "realizing",
    category: "Finished goods (FOB)",
    region: "China",
    addressable: 4_200_000,
    savingsLow: 200_000,
    savingsHigh: 350_000,
    recommended: 240_000,
    confidencePct: 74,
    basis: "evidence",
    summary:
      "The assembly book runs PO-only with no long-term contracts, and terms were onboarded three different ways · the factories carry the component MOQ risk already, so terms are the one commercial lever that costs them nothing structural. Net 60 as the book standard, discount for earlier.",
    action: "Three onboarding paths, one standard. Paper net 60.",
    evidence: [
      { claim: "Terms range net 30–60 with two records missing entirely", source: "SAP ECC · vendor master" },
      { claim: "PO-only book — no contract renegotiation required to move terms", source: "Sourcing policy" },
    ],
    risks: [
      "The factories fund component MOQs — push terms too far and the FOB price absorbs it",
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
    title: "Service parts, warranty tail buy",
    kind: "tail",
    stage: "committed",
    category: "Service parts",
    region: "Other",
    addressable: 3_900_000,
    savingsLow: 450_000,
    savingsHigh: 600_000,
    recommended: 480_000,
    confidencePct: 69,
    basis: "mixed",
    summary:
      "The 11-year warranty is a parts obligation with a known shape · consolidating the movement, hands and dial buy onto one annual order against the actuarial tail replaces twelve spot buys and holds the $15.6M component inventory to plan.",
    action: "Twelve spot buys, one tail. Commit the annual order.",
    evidence: [
      { claim: "Service parts bought on 12 spot POs last year", source: "SAP ECC · PO history" },
      { claim: "Warranty tail model sizes 11-year demand by calibre", source: "Service planning · Dallas" },
    ],
    risks: [
      "An annual buy mis-sized against the tail becomes E&O with an 11-year memory",
    ],
    supplierIds: ["SUP-12"],
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
      { id: "m2", label: "First 12 suppliers migrated", status: "active", date: "In progress" },
      { id: "m3", label: "Remaining 16 migrated", status: "pending" },
      { id: "m4", label: "Legacy suppliers deactivated", status: "pending" },
    ],
    drift: {
      flagged: true,
      note: "Q3 landed $44K against a $60K ramp — three exclusivity holders have not migrated and are still ordering direct.",
    },
    events: [
      { at: "10 Jun 2026", actor: "Mercer", note: "Surfaced · confidence 69%" },
      { at: "2 Jul 2026", actor: "Marcus Whitfield", note: "Committed $480K" },
      { at: "5 Aug 2026", actor: "Mercer", note: "Drift flagged · Q3 realization 27% behind ramp" },
    ],
  },
  {
    id: "OPP-109",
    title: "Jewelry consolidation, Panyu award",
    kind: "consolidation",
    stage: "realizing",
    category: "Finished goods (FOB)",
    region: "China",
    addressable: 5_200_000,
    savingsLow: 320_000,
    savingsHigh: 520_000,
    recommended: 390_000,
    confidencePct: 77,
    basis: "evidence",
    summary:
      "Four jewelry assemblers, top holder at 29% · one award consolidates the book onto the best delivery record on the roster and funds the plating requalification from the volume step.",
    action: "Four roofs to one. Consolidate the jewelry award.",
    evidence: [
      { claim: "Four suppliers, top holder at 29% of the category", source: "SAP ECC · spend cube FY26" },
      { claim: "Panyu quoted −4% from the consolidated tier", source: "RFQ 2026-0311" },
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
      { id: "m1", label: "Panyu capacity confirmed", status: "completed", date: "28 May 2026" },
      { id: "m2", label: "First transferred styles shipped", status: "completed", date: "1 Jul 2026" },
      { id: "m3", label: "Last China PO placed", status: "active", date: "Due 31 Aug 2026" },
      { id: "m4", label: "Legacy plating spec retired", status: "pending" },
    ],
    events: [
      { at: "4 May 2026", actor: "Mercer", note: "Surfaced · confidence 77%" },
      { at: "19 May 2026", actor: "Marcus Whitfield", note: "Committed $390K" },
      { at: "1 Jul 2026", actor: "Mercer", note: "First transferred styles shipped on schedule" },
    ],
  },
  {
    id: "OPP-110",
    title: "Fixture supplier consolidation",
    kind: "consolidation",
    stage: "realized",
    category: "Fixtures & packaging",
    region: "China",
    addressable: 1_400_000,
    savingsLow: 110_000,
    savingsHigh: 160_000,
    recommended: 130_000,
    confidencePct: 86,
    basis: "evidence",
    summary:
      "Roughly 37 of the ~91 Tier 1 factories make fixtures and packaging — the most fragmented spend on the book for the least differentiated product · the award moved the display volume to two roofs and the saving realized ahead of ramp.",
    action: "37 factories make fixtures. Two are enough for displays.",
    evidence: [
      { claim: "41 suppliers across $3.9M · 28 under $60K each", source: "SAP ECC · spend cube FY25" },
    ],
    risks: [
      "Store rollout calendars spike the volume — two roofs must absorb the peaks",
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
    title: "Leather goods, single-country award",
    kind: "consolidation",
    stage: "dismissed",
    category: "Finished goods (FOB)",
    region: "Southeast Asia",
    addressable: 6_100_000,
    savingsLow: 380_000,
    savingsHigh: 560_000,
    recommended: 420_000,
    confidencePct: 58,
    basis: "benchmark",
    summary:
      "Consolidating leather goods onto Cambodia priced 5% under the split book · dismissed because the overlay regime moves by country, and a single-origin book turns the next Section 301 list into a single point of failure. The split IS the hedge.",
    action: "5% cheaper, one origin. Keep the split — dismissed.",
    evidence: [
      { claim: "Cambodia quote −5% vs the split book", source: "RFQ 2026-0287" },
      { claim: "Overlays assess by country of origin on full entered value", source: "HTSUS Ch. 99" },
    ],
    risks: [
      "Price beats resilience only until the first overlay lands on the single origin",
    ],
    supplierIds: ["SUP-04", "SUP-05"],
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
  /** Tier 1 relationships on the book, of which the file above details twelve. */
  suppliers: 91,
  importShare: 97,
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
  "Watches · Quartz FOB": "Quartz",
  "Watches · Automatic FOB": "Automatic",
  "Watches · Casing-up": "Casing-up",
  "Watches · Assembly": "Assembly",
  "Jewelry · Fashion": "Jewelry",
  "Leather goods": "Leather",
  "Store display units": "Displays",
  "Tins & gift boxes": "Packaging",
  "Service parts · Movements": "Movements",
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

/** Suppliers with no payment term on file, by name — the merger-era data gap
 *  the terms play has to close before it can be run. External suppliers only:
 *  an internal transfer has no commercial term to be missing. */
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
