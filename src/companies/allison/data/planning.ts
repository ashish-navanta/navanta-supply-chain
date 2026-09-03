/* ═══════════════════════════════════════════════════════════════
 *  Planning — the IRIS model, on Allison's MRO book
 *
 *  Types, thresholds, descriptors and policy tables are taken from
 *  the IRIS project (Documents/AI mode/Navanta/iris): types/planning.ts,
 *  types/sku-policy.ts, data/iris-data.ts and the System Configurations
 *  page. Nothing here is invented where IRIS already had an answer.
 *
 *  Three pages read this: Inventory Planning (the ABC × XYZ matrix over
 *  open exceptions), Product Stocking Policy (per SKU-branch policy
 *  and the exception list), and System Configurations (the segment
 *  table, confidence weights, and the routing grid that decides what
 *  a person ever sees).
 *
 *  Deterministic throughout — a demo that shifts between rehearsal
 *  and stage is worse than no demo.
 * ═══════════════════════════════════════════════════════════════ */

import {
  QUEUES,
  safetyDaysFor,
  type ActionRow,
  type Classification,
} from "./action-center";
import { DC_NAMES, SKUS } from "./catalogue";

/* ─── Classification ──────────────────────────────────────────── */

export type Abc = "A" | "B" | "C";
export type Xyz = "X" | "Y" | "Z";
/* One declaration, in the module both seats already depend on. */
export type { Classification } from "./action-center";

export type Severity = "critical" | "elevated" | "healthy";

export const ABC_ORDER: Abc[] = ["A", "B", "C"];
export const XYZ_ORDER: Xyz[] = ["X", "Y", "Z"];

/** Row descriptors, verbatim from IRIS ABC_ROW_META. */
export const ABC_ROW_META: Record<Abc, { label: string; sub: string }> = {
  A: { label: "A", sub: "Top 80% Spend" },
  B: { label: "B", sub: "Next 15% Spend" },
  C: { label: "C", sub: "Bottom 5% Spend" },
};

/** Column descriptors, verbatim from IRIS XYZ_COL_META. */
export const XYZ_COL_META: Record<Xyz, { label: string; sub: string }> = {
  X: { label: "X", sub: "Smooth · low CV²" },
  Y: { label: "Y", sub: "erratic" },
  Z: { label: "Z", sub: "lumpy · Intermittent" },
};

/* ─── Demand pattern ──────────────────────────────────────────── */

export type DemandPattern = "smooth" | "intermittent" | "erratic" | "lumpy";

export const DEMAND_PATTERN_LABEL: Record<DemandPattern, string> = {
  smooth: "Smooth",
  intermittent: "Intermittent",
  erratic: "Erratic",
  lumpy: "Lumpy",
};

/** Syntetos–Boylan, at the standard ADI = 1.32 and CV² = 0.49. */
export function demandPattern(adi: number, cv2: number): DemandPattern {
  const intermittent = adi >= 1.32;
  const variable = cv2 >= 0.49;
  if (!intermittent && !variable) return "smooth";
  if (intermittent && !variable) return "intermittent";
  if (!intermittent && variable) return "erratic";
  return "lumpy";
}

/** XYZ from CV², at the thresholds the confidence model uses. */
export function xyzForCv2(cv2: number): Xyz {
  if (cv2 <= 0.5) return "X";
  if (cv2 <= 1) return "Y";
  return "Z";
}

/* ─── Stocking policy ─────────────────────────────────────────── */

export type StockingPolicy = "periodic" | "min-max" | "order-to-demand" | "kit" | "stock-1";

export const STOCKING_POLICY_META: Record<StockingPolicy, { label: string; description: string }> = {
  periodic: { label: "Periodic", description: "Reviewed on a fixed cycle · smooth, regular demand" },
  "min-max": { label: "Min/Max", description: "Trigger-to-min, fill-to-max · lumpy / intermittent" },
  "order-to-demand": {
    label: "Order to Demand",
    description: "Ordered against actual demand as it arises",
  },
  kit: { label: "Kit", description: "Managed as part of a kit / assembly, not standalone" },
  "stock-1": {
    label: "Stock 1 Quantity",
    description: "Hold a single unit · slow, high-value, or critical spare",
  },
};

export const STOCKING_POLICY_ORDER: StockingPolicy[] = [
  "periodic",
  "min-max",
  "order-to-demand",
  "kit",
  "stock-1",
];

/** Kit and Order to Demand stay reserved for curated and overridden rows. */
export function policyForXyz(xyz: Xyz): StockingPolicy {
  if (xyz === "X") return "periodic";
  if (xyz === "Y") return "min-max";
  return "stock-1";
}

/* ─── The segment table ───────────────────────────────────────── */

export interface SegmentPolicy {
  seg: Classification;
  policy: StockingPolicy;
  /** Structural-parameter recompute cadence in days. */
  reviewDays: number;
  /** Target service level, whole percent. */
  sl: number;
  /** Overstock τ multiplier; null where it does not apply. */
  tau: number | null;
}

/**
 * IRIS's nine segments, verbatim.
 *
 * Every segment is Periodic review with CZ carved out as the one Min/Max
 * exception — a continuous reorder-point policy with no fixed cadence, so its
 * review shows "—". reviewDays follows the XYZ tier alone, because how often
 * the parameters are re-derived is a question about how fast demand moves, not
 * about how much the line is worth.
 */
export const SEGMENT_POLICY: SegmentPolicy[] = [
  { seg: "AX", policy: "periodic", reviewDays: 7, sl: 98, tau: 1.1 },
  { seg: "AY", policy: "periodic", reviewDays: 14, sl: 96, tau: 1.3 },
  { seg: "AZ", policy: "periodic", reviewDays: 28, sl: 95, tau: null },
  { seg: "BX", policy: "periodic", reviewDays: 7, sl: 98, tau: 1.1 },
  { seg: "BY", policy: "periodic", reviewDays: 14, sl: 92, tau: null },
  { seg: "BZ", policy: "periodic", reviewDays: 28, sl: 90, tau: null },
  { seg: "CX", policy: "periodic", reviewDays: 7, sl: 90, tau: 1.1 },
  { seg: "CY", policy: "periodic", reviewDays: 14, sl: 90, tau: null },
  { seg: "CZ", policy: "min-max", reviewDays: 28, sl: 85, tau: null },
];

export function segmentPolicy(c: Classification): SegmentPolicy {
  return SEGMENT_POLICY.find((s) => s.seg === c)!;
}

/** Descriptors used by the System page's τ and routing grids. */
export const SEG_ABC_MEANING: Record<Abc, string> = {
  A: "Top 20%",
  B: "Next 30%",
  C: "Tail 50%",
};
export const SEG_XYZ_MEANING: Record<Xyz, string> = {
  X: "Smooth",
  Y: "Erratic",
  Z: "Lumpy",
};

/** segmentMeaning("AX") → "Top 20% · Smooth". */
export function segmentMeaning(seg: string): string {
  return `${SEG_ABC_MEANING[seg[0] as Abc] ?? seg[0]} · ${SEG_XYZ_MEANING[seg[1] as Xyz] ?? seg[1]}`;
}

/* ─── Confidence & routing ────────────────────────────────────── */

export type RoutingMode = "auto" | "manual";

/**
 * The gate. Not a single threshold — IRIS routes on confidence against risk,
 * so a low-risk line with a shaky forecast can still be settled while a
 * high-risk one with a good forecast is not.
 */
export const ROUTING_GRID = {
  colHeaders: ["High risk", "Med risk", "Low risk"],
  rowHeaders: ["High confidence", "Med confidence", "Low confidence"],
  initial: [
    ["auto", "auto", "auto"],
    ["auto", "manual", "manual"],
    ["manual", "manual", "manual"],
  ] as RoutingMode[][],
};

export interface ConfidenceWeight {
  name: string;
  desc: string;
  pct: number;
}

/** The five factors behind a confidence score, verbatim. */
export const CONFIDENCE_WEIGHTS: ConfidenceWeight[] = [
  {
    name: "Forecast accuracy",
    desc: "Out-of-sample rolling forecast accuracy from the model that produces the forecasts; higher accuracy → higher score.",
    pct: 30,
  },
  {
    name: "Data sufficiency",
    desc: "History length (70%) + non-zero demand density (30%), each scaled 0–100.",
    pct: 15,
  },
  {
    name: "Demand & segment stability",
    desc: "X (CV²≤0.5)→75–100 · Y→50–75 · Z (CV²>1)→0–50; optional segment-flip penalty.",
    pct: 15,
  },
  {
    name: "Lead-time & supplier reliability",
    desc: "Lead-time variability (σL relative to L) plus supplier quality (OTIF / fill-on-PO).",
    pct: 15,
  },
  {
    name: "Plan robustness",
    desc: "Probability the inventory position survives lead-time demand, with an overstock penalty.",
    pct: 25,
  },
];

/**
 * Which row of the routing grid a score falls in.
 *
 * The cut-points moved with the distribution. IRIS scores this book between 90
 * and 98 — a policy engine that is only half sure of its own recommendation is
 * not one a planner would run — and against the old 0.8/0.6 boundaries that put
 * every position in the top band, which routes every row to auto and empties
 * the review queue the page exists to hold.
 *
 * So the bands are cut where the scores actually are. The GRID itself is
 * untouched: high confidence on any risk still auto-routes, and low confidence
 * never does. What changed is where "high" begins, because the scores did.
 */
export function confidenceBand(c: number): 0 | 1 | 2 {
  return c >= 0.96 ? 0 : c >= 0.93 ? 1 : 2;
}
export function riskBand(sev: Severity): 0 | 1 | 2 {
  return sev === "critical" ? 0 : sev === "elevated" ? 1 : 2;
}
export function routeFor(confidence: number, sev: Severity): RoutingMode {
  return ROUTING_GRID.initial[confidenceBand(confidence)][riskBand(sev)];
}

/* ─── Fixtures ────────────────────────────────────────────────── */

/** Deterministic pseudo-random in [0,1) from a string. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * List price per unit, by style — the MRO unit economics the book runs on.
 *
 * A 6205 bearing is a $9 part and a 55-gallon coolant drum is a $1,180 one, and
 * an MRO book that priced them off one distribution would value a drum of
 * excess like a bearing of excess. So the style sets the price and the variant
 * moves it: an SKF 6205 and a house-brand 6205 are the same dimension table at
 * a different number, which is the whole of the cross-reference argument.
 */
const UNIT_PRICE: Record<string, number> = {
  AL5605: 9.4, // 6205-2RS bearing
  AL7108: 1180, // 55-gal coolant concentrate
  AL2980: 38, // 1/2in carbide end mill
  AL3192: 86, // hydraulic filter element
  AL4735: 7.9, // nitrile gloves, per box
  AL3843: 58, // absorbent pads, per bale
  AL3184: 24, // B68 V-belt
  AL9204: 215, // Allen-Bradley 100-C23 contactor
};

/**
 * What one unit of a given SKU costs at the distributor's price, wherever it
 * is standing.
 *
 * Hashed on the SKU alone. It used to be hashed on sku@branch, which made the
 * same 6205 cost $7 at Indy Central and $12 at Szentgotthárd — invisible while
 * nothing printed a unit price, and nonsense the moment the overstock table
 * started valuing excess.
 *
 * ±15% around the style's list price by maker or grade, which is where the
 * spread between an OEM-branded part and its cross-reference actually sits.
 */
export function cartonCost(sku: string): number {
  const base = UNIT_PRICE[sku.split("-")[0]] ?? 40;
  const price = base * (0.85 + hash01(`cost|${sku}`) * 0.3);
  return price >= 100 ? Math.round(price) : Math.round(price * 100) / 100;
}

/* The plant stores, from the catalogue rather than a list of their own. The
   fixtures used to name twelve invented cribs — "Plant 7 Crib B", "Line 40
   Satellite" — which is not a scope anybody can hold in their head and was
   inventing buildings besides. See DC_NAMES. */
const BRANCHES = DC_NAMES;

/** How many plant stores the book is spread across. */
export const BRANCH_COUNT = BRANCHES.length;

const VENDORS = [
  "Cline Tool & Service Co",
  "Cline Tool & Service Co",
  "Kirby Risk Supply Co",
  "Kirby Risk Supply Co",
  "Cline Tool & Service Co",
  "Cline Tool & Service Co",
];

/** One SKU × branch position, with its policy and demand measures. */
export interface SkuPolicyRow {
  /** Stable key: sku@branch. */
  key: string;
  sku: string;
  description: string;
  branch: string;
  vendor: string;
  /** Average Demand Interval — mean periods between demands. */
  adi: number;
  /** Squared coefficient of variation of demand size. */
  cv2: number;
  classification: Classification;
  /** IRIS-determined from the demand pattern. */
  systemPolicy: StockingPolicy;
  /** In force today; equals systemPolicy unless overridden. */
  currentPolicy: StockingPolicy;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
  reason?: string;
  onHand: number;
  incoming: number;
  demandMean: number;
  leadTimeDays: number;
  safetyStock: number;
  annualValue: number;
  /** Order fill rate achieved on this position, 0–1. */
  fillRate: number;
  /** Exposure carried where the position is short or long. */
  dollarsAtRisk: number;
  severity: Severity;
  /** IRIS confidence in its recommendation, 0–1. */
  confidence: number;
  /** Set where this position is one of the action-centre rows. */
  rowId?: string;
}

/**
 * The Pareto cut, by cumulative value rather than by position count.
 *
 * This used to cut the value-ranked list at 20% and 50% of its LENGTH, which
 * makes A the top fifth of rows — not the rows carrying the top 80% of value.
 * The distinction is the whole of ABC. Measured, that gave A 21% of positions
 * carrying 39% of turnover, B 29% carrying 35%, and C 49% carrying 26%: three
 * classes each holding about a third, which is a classification that classifies
 * nothing. And `ABC_ROW_META` was meanwhile telling the reader A was the "Top
 * 80% Revenue", which it was not.
 *
 * Walking the cumulative share instead is the textbook definition and the one
 * the label already claimed: A up to 80%, B to 95%, C the tail.
 */
function abcForCumulative(cumulativeShare: number): Abc {
  return cumulativeShare <= 0.8 ? "A" : cumulativeShare <= 0.95 ? "B" : "C";
}

/* ─── Severity, as a planner names it ─────────────────────────────
 * The model carries `critical | elevated | healthy`, which is what the
 * matrix and the routing grid are built on and what they should stay
 * built on. What a planner says out loud is Critical, High and Med —
 * three tiers, and the third is not "fine", it is the band that is
 * still inside policy and heading the wrong way.
 * ─────────────────────────────────────────────────────────────── */

export type Tier = "critical" | "high" | "med";

export const TIER_LABEL: Record<Tier, string> = {
  critical: "Critical",
  high: "High",
  med: "Med",
};

/**
 * How much attention a position is asking for.
 *
 * The two exception severities map straight across. Med is derived: a position
 * the model calls healthy but which is carrying exposure or missing its fill
 * rate — inside policy, and worth a planner's eye before it is not. Positions
 * that are genuinely clean return null and no chip claims them.
 */
export function tierOf(p: SkuPolicyRow): Tier | null {
  if (p.severity === "critical") return "critical";
  if (p.severity === "elevated") return "high";
  return p.dollarsAtRisk > 0 || p.fillRate < 0.98 ? "med" : null;
}

/**
 * A matrix cell's severity, from the share of it that is in exception.
 *
 * See the note at the call site: presence alone reddened every box in the grid.
 */
function severityForCell(total: number, critical: number, elevated: number): Severity {
  if (!total) return "healthy";
  if (critical / total >= 0.2) return "critical";
  if ((critical + elevated) / total >= 0.3) return "elevated";
  return "healthy";
}

function severityFor(fillRate: number, dollarsAtRisk: number): Severity {
  if (fillRate < 0.9 && dollarsAtRisk > 60_000) return "critical";
  if (fillRate < 0.95 || dollarsAtRisk > 25_000) return "elevated";
  return "healthy";
}

/**
 * The queue rows, mapped into the book.
 *
 * Read off the action centre rather than restated, so a planner who counts the
 * queued positions in a matrix cell gets the number that is in their queue.
 */
function seeded(): SkuPolicyRow[] {
  return QUEUES.planner.rows
    .filter((r) => r.cover)
    .map((r: ActionRow) => {
      const c = r.cover!;
      /* The letters the queue row was written with, not a fresh guess. These
         rows are authored — a planner exception exists because somebody decided
         this SKU at this branch is an AZ problem — and hashing a replacement
         class over the top both discarded that and forced every seeded row into
         A, which is what had two hand-written critical rows sitting in AX, the
         cell that is supposed to be the calmest in the book. */
      const classification = c.classification;
      const xyz = classification[1] as Xyz;

      /* The scatter follows the letter rather than the other way round, so a Z
         row plots where a Z row belongs. Within the band it still varies by row,
         so the cloud does not come out in three straight lines. */
      const cv2 =
        xyz === "X"
          ? 0.2 + hash01(`cv2-${r.id}`) * 0.28
          : xyz === "Y"
            ? 0.55 + hash01(`cv2-${r.id}`) * 0.4
            : 1.05 + hash01(`cv2-${r.id}`) * 0.5;
      const adi = 1 + hash01(`adi-${r.id}`) * 1.1;
      const fillRate = 0.78 + hash01(`fr-${r.id}`) * 0.14;
      return {
        key: `${r.refSub.replace(/^SKU\s*/, "")}@${r.party}`,
        sku: r.refSub.replace(/^SKU\s*/, ""),
        description: r.ref,
        branch: r.party,
        vendor: c.supplier,
        adi: Math.round(adi * 100) / 100,
        cv2: Math.round(cv2 * 100) / 100,
        classification,
        systemPolicy: policyForXyz(xyz),
        currentPolicy: policyForXyz(xyz),
        overridden: false,
        onHand: Number(r.qtyValue) || 0,
        incoming: Math.round(c.safetyNeeded * 0.5),
        demandMean: c.dailyDemand,
        leadTimeDays: c.leadDays,
        safetyStock: c.safetyNow,
        /* Demand × cost, like every other row. It used to be the at-risk figure
           × 4.2, which is not a turnover — it made the unit price implied by
           these rows five times the generated ones, and `unitCost` reads them
           both. */
        annualValue: Math.round(c.dailyDemand * 365 * cartonCost(r.refSub.replace(/^SKU\s*/, ""))),
        fillRate,
        dollarsAtRisk: r.value,
        severity: severityFor(fillRate, r.value),
        confidence: 0.9 + hash01(`cf-${r.id}`) * 0.084,
        rowId: r.id,
      };
    });
}

/** Everything else IRIS holds a policy for. */
function generated(): SkuPolicyRow[] {
  const out: SkuPolicyRow[] = [];
  /* Per VARIANT, not per style. A position is a material at a stores — that
     is what the key has always said and what the planner orders against — and
     generating one row per style meant eight distinct numbers standing in for
     a hundred and five. It also kept the book populated when the twelve
     invented cribs folded down to three real stores: eight styles across three
     stores is twenty-four positions, which is not a book. */
  for (const product of SKUS) {
    const style = product.style.name;
    for (const branch of BRANCHES) {
      const id = `${product.sku}@${branch}`;
      const cv2 = 0.18 + hash01(`cv|${id}`) * 1.35;
      const adi = 1 + hash01(`adi|${id}`) * 1.2;
      const xyz = xyzForCv2(cv2);
      const demand = 0.6 + hash01(`d|${id}`) * 11;
      const unit = cartonCost(product.sku);
      const lead = 24 + Math.round(hash01(`l|${id}`) * 20);
      /* Placeholders. Both the buffer and the stock on hand depend on the ABC
         class, which is not assigned until the whole book is ranked on turnover
         below — see `rateRisk`, which sets them for real. */
      /* How often a position goes wrong is a property of its demand, not of the
         dice. An X line is smooth and forecastable, so a planner keeps it served;
         a Z line is lumpy and intermittent, and no amount of attention makes an
         order nobody could predict arrive on time.
         This used to be one flat threshold for every class, which made the
         nine-box say the opposite of what it exists to say: AX — the most
         valuable AND the most predictable, the cell a planner has under control —
         came out as troubled as AZ. Risk concentrates where consequence meets
         unpredictability, and the grid should show that on sight. */
      /* Risk is not decided here. It depends on the ABC letter, and that is
         assigned by ranking the whole book on turnover further down — deciding it
         now would mean guessing the rank from an absolute cut-off, which is
         exactly the mismatch that had smooth high-value lines coming out as
         troubled as lumpy ones. These are placeholders; `rateRisk` overwrites
         them once the letter is real. */
      const fillRate = 0;
      const atRisk = 0;
      /* A tenth carry a planner's override — the exception list. */
      const flipped = hash01(`ovr|${id}`) > 0.9;
      out.push({
        key: id,
        sku: product.sku,
        description: style,
        branch,
        vendor: VENDORS[Math.floor(hash01(`v|${id}`) * VENDORS.length)],
        adi: Math.round(adi * 100) / 100,
        cv2: Math.round(cv2 * 100) / 100,
        classification: `C${xyz}` as Classification,
        systemPolicy: policyForXyz(xyz),
        currentPolicy: flipped ? "order-to-demand" : policyForXyz(xyz),
        overridden: flipped,
        ...(flipped
          ? {
              overriddenBy: "Priya Raghavan",
              overriddenAt: "2026-07-28",
              reason: "Held to demand while the Plant 12 crib consolidation beds in",
            }
          : {}),
        onHand: 0,
        incoming: Math.round(demand * hash01(`in|${id}`) * 12),
        demandMean: Math.round(demand * 10) / 10,
        leadTimeDays: lead,
        safetyStock: 0,
        annualValue: Math.round(demand * 365 * unit),
        fillRate,
        dollarsAtRisk: atRisk,
        severity: severityFor(fillRate, atRisk),
        confidence: 0.9 + hash01(`cf|${id}`) * 0.084,
      });
    }
  }
  return out;
}

/**
 * Every SKU × branch position.
 *
 * ABC is assigned by ranking the whole book on turnover — a class handed out
 * row by row is just a label. Seeded queue rows keep their A, which they earned
 * on exposure.
 */
/**
 * How well a position is served, once its class is known.
 *
 * Two axes, and the grid should show both on sight. XYZ decides how OFTEN a
 * position goes wrong: an X line is smooth and forecastable — gloves, pads — a
 * Z line is lumpy and intermittent — a breakdown spare — and no amount of
 * attention makes an order nobody could predict arrive on time. ABC decides
 * what it COSTS when it does, because an A line carries the spend.
 *
 * Attention crosses them. A high-value smooth line is the one a planner watches
 * hardest and the easiest to watch, so AX should be the best-served cell in the
 * book. A high-value lumpy line matters most and cooperates least, which is why
 * AZ is where exceptions belong — and why the nine-box was arguing against
 * itself when one flat probability governed all nine.
 */
function rateRisk(row: SkuPolicyRow): void {
  const abc = row.classification[0];
  const xyz = row.classification[1];

  /* ── The buffer, and how much is standing on it ──────────────
     Both wait for the class, and both were wrong before they did.

     The buffer was 2–8 days of demand picked by a hash, while the segment
     policy says an AY line on a 37-day lead earns 13 — so the run's own
     "the buffer is stale against this lead time" note fired on nearly every
     row, and was right. It is now what the policy says it is.

     And on hand was 3–19 days of cover against lead times of 24–44 days,
     which made the whole book structurally short: no position could hold
     more than its lead-time demand, so nothing was ever genuinely in
     excess and the Overstock tab was really a list of "above safety
     stock", which is where a healthy position lives. On hand is now a
     fraction of TARGET — lead-time demand plus the buffer — so most
     positions sit at or under it and a real minority sit over. */
  row.safetyStock = Math.max(
    1,
    Math.round(row.demandMean * safetyDaysFor(row.classification, row.leadTimeDays)),
  );
  const target = targetStock(row);
  /* 0.35–1.5 of target. Skewed low on purpose: a book where half the lines
     are overstocked is not a book anybody is running. */
  row.onHand = Math.max(0, Math.round(target * (0.35 + hash01(`oh|${row.key}`) * 1.15)));
  const base = xyz === "X" ? 0.1 : xyz === "Y" ? 0.3 : 0.55;
  const attention = abc === "A" ? (xyz === "X" ? 0.25 : 1.2) : abc === "B" ? 0.9 : 1;
  const troubled = hash01(`t|${row.key}`) < base * attention;

  /* Most of the book is served properly either way. A page where every line is
     on fire is a page nobody believes. */
  row.fillRate = troubled
    ? 0.8 + hash01(`fr|${row.key}`) * 0.14
    : 0.95 + hash01(`fr|${row.key}`) * 0.049;

  const weight = abc === "A" ? 1 : abc === "B" ? 0.5 : 0.25;
  row.dollarsAtRisk = troubled
    ? Math.round(hash01(`ar|${row.key}`) * 140_000 * weight)
    : 0;
  row.severity = severityFor(row.fillRate, row.dollarsAtRisk);
}

export const POSITIONS: SkuPolicyRow[] = (() => {
  const seeds = seeded();
  const rest = generated();
  const ranked = [...rest].sort((a, b) => b.annualValue - a.annualValue);
  /* Dearest first, accumulating — a row's class is decided by how much value sits
     at or above it, not by where it happens to fall in the list. */
  const totalValue = ranked.reduce((sum, r) => sum + r.annualValue, 0);
  let cumulative = 0;
  ranked.forEach((row) => {
    cumulative += row.annualValue;
    const abc = abcForCumulative(totalValue === 0 ? 1 : cumulative / totalValue);
    row.classification = `${abc}${row.classification[1]}` as Classification;
    /* Now, and only now, is the class real enough to rate the position on. */
    rateRisk(row);
  });
  /* A seeded row wins its sku@branch outright. The grid generates a position for
     every style at every stores, so wherever the planner's queue already holds
     one — SKU AL5605-5605 at Indy Central Stores, say — the grid made a second
     with the same SKU and the same stores. Two rows for one position: a product
     page listed the stores twice with different figures, and React saw two
     children fighting over one key. The queue's own row is the real one; the
     generated twin goes. */
  const claimed = new Set(seeds.map((r) => `${r.sku}@${r.branch}`));
  return [...seeds, ...rest.filter((r) => !claimed.has(`${r.sku}@${r.branch}`))];
})();

/**
 * The other plant stores.
 *
 * Allison runs three in this prototype, so "somewhere else" always has an
 * answer and a long position always has a destination — the first stores that
 * is not this one. Written as a lookup rather than an index flip so a fourth
 * stores is a data change, not a logic change.
 */
export function otherDc(branch: string): string {
  return DC_NAMES.find((n) => n !== branch) ?? branch;
}

/**
 * What a position is supposed to hold.
 *
 * Lead-time demand plus the buffer — the standard target (or maximum) stock, and
 * the reference point both exceptions are measured from: short of it is a
 * shortage, over it is excess. Not the safety stock on its own, which is the
 * floor rather than the target, and comparing against the floor called every
 * healthy position overstocked.
 */
export function targetStock(p: SkuPolicyRow): number {
  return Math.round(p.demandMean * p.leadTimeDays + p.safetyStock);
}

/* ─── The book, in the numbers a VP is asked for ──────────────── */

/**
 * Working capital tied up in stock: every unit on the shelf, at cost.
 *
 * The one figure a plant VP is held to that nobody below them owns — each
 * stores planner sees their own crib, and the total only exists across all of
 * them.
 */
export function inventoryValue(positions = POSITIONS): number {
  return positions.reduce((s, p) => s + p.onHand * cartonCost(p.sku), 0);
}

/**
 * How much of Allison's MRO inventory these stores positions actually represent.
 *
 * About a third, and the missing two-thirds are not a modelling gap — they are
 * the parts of the storeroom balance this app does not hold positions for:
 *
 *   · INSURANCE SPARES. Spindles, drives and controls bought once against a
 *     six-week OEM lead and held for years — capital spares on the fixed-asset
 *     register, not a min/max position.
 *   · POINT OF USE. Vending machines and line-side bins carry their own stock
 *     under the integrated-supply contract, none of it a stores position.
 *   · ON ORDER. An OEM sole-source spare is committed at the requisition and
 *     sits on an open PO for six weeks, so a block of owned stock is always in
 *     the OEM's factory rather than on a shelf.
 *   · The categories whose book is not loaded here at all.
 *
 * This matters because turns is a BALANCE-SHEET ratio and the positions are an
 * EXCEPTION book — deliberately lean, since the demo is about materials short
 * of cover. Dividing a year of issues by only the thin part of the inventory
 * returned 17× — stock turning every three weeks, which no MRO storeroom does
 * and which read as a triumph (+71% vs plan) rather than as the arithmetic
 * error it was.
 */
const DC_SHARE_OF_INVENTORY = 0.35;

/**
 * Inventory turns: a year of issues at cost, over the stock held to serve them.
 *
 * The textbook ratio — annual issues ÷ average inventory — taken against total
 * inventory rather than against the stores slice alone. `annualValue` is
 * already demand × 365 × cost, so the numerator is the book's own turnover and
 * nothing here is a second definition of either side.
 *
 * Lands near 6× for the loaded book. Worth knowing that a real MRO storeroom
 * turns lower still — a crib holding insurance spares against a shutdown
 * calendar runs closer to 1–2× — so this is the optimistic end of plausible
 * rather than a figure read off the CMMS.
 */
export function inventoryTurns(positions = POSITIONS): number {
  const held = inventoryValue(positions) / DC_SHARE_OF_INVENTORY;
  if (held <= 0) return 0;
  const cogs = positions.reduce((s, p) => s + p.annualValue, 0);
  return Math.round((cogs / held) * 10) / 10;
}

/**
 * Forecast accuracy across the book, weighted by what each line is worth.
 *
 * Straight from the attribution the deck shows — the first of
 * CONFIDENCE_WEIGHTS' five factors, which is CV²-derived per position. Weighted
 * by turnover because a VP is not asking how the average SKU forecasts; they are
 * asking how the money forecasts.
 */
export function forecastAccuracy(positions = POSITIONS): number {
  const total = positions.reduce((s, p) => s + p.annualValue, 0);
  if (total <= 0) return 0;
  const weighted = positions.reduce((s, p) => {
    const score = Math.max(0, Math.min(100, 100 - p.cv2 * 26));
    return s + score * p.annualValue;
  }, 0);
  return Math.round(weighted / total);
}

/* ─── Reading a long position ─────────────────────────────────────
 * Overstock is a different question from a shortage and it is measured
 * differently. A shortage asks "how many days until I run out, against
 * how many days to get more" — cover against lead time. A surplus asks
 * "how much is standing here that should not be, how long will it take
 * to burn, and what is that costing" — excess, weeks of supply, and the
 * capital sitting in it.
 *
 * Weeks rather than days, because a surplus is measured in the horizon
 * it will take to clear and 78 days reads as a number where 11 weeks
 * reads as a season. Weeks of supply is the standard term for it.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Which side of policy a position falls on.
 *
 * Both measured against target — lead-time demand plus the buffer — because that
 * is the level the policy asks for. Short counts what is TRAVELLING as well as
 * what is here: a line with 20 on hand and 200 arriving inside the lead time is
 * not short, and calling it short would have IRIS request stock twice.
 */
export function isShort(p: SkuPolicyRow): boolean {
  return p.onHand + p.incoming < targetStock(p);
}

export function isLong(p: SkuPolicyRow): boolean {
  return p.onHand > targetStock(p);
}

/** Units above target — what should not be here. */
export function excessOf(p: SkuPolicyRow): number {
  return Math.max(0, p.onHand - targetStock(p));
}

/** Weeks of supply: everything on hand, at the current run rate. */
export function weeksOfSupply(p: SkuPolicyRow): number {
  return Math.round(p.onHand / Math.max(0.1, p.demandMean) / 7);
}

/**
 * Weeks of supply above target — the excess, expressed as coverage.
 *
 * The industry's own framing: sixty days on hand against twenty days of
 * required coverage is forty days of excess. "Clear in" was a coined heading
 * for the same figure.
 */
export function excessWos(p: SkuPolicyRow): number {
  return Math.round(excessOf(p) / Math.max(0.1, p.demandMean) / 7);
}

/**
 * What one unit costs.
 *
 * One place, keyed on the SKU — see `cartonCost`. Reading it back out of
 * annualValue worked while every row was generated the same way, and broke on
 * the seeded ones, whose turnover was authored from a different figure.
 */
export function unitCost(p: SkuPolicyRow): number {
  return cartonCost(p.sku);
}

/**
 * The capital standing in the surplus.
 *
 * Not `dollarsAtRisk`, which is the wrong measure on a long position: nothing
 * is at risk of being missed, the money is simply not working. This is the
 * excess-and-obsolete figure a planner is judged on.
 */
export function excessValue(p: SkuPolicyRow): number {
  return Math.round(excessOf(p) * unitCost(p));
}

/* ─── Exceptions ──────────────────────────────────────────────── */

/** A position that needs something doing. Healthy positions are not exceptions. */
export type Exception = SkuPolicyRow & {
  recommendedAction: string;
  reason: string;
  requestedQty: number;
  /**
   * Where the surplus goes, on a long position.
   *
   * Overstock is not a purchase and it is not scrap — it is stock standing in
   * the wrong place, and the answer is the other stores. Carried on the row so
   * the table, the panel and the run all name the same destination.
   */
  transferTo?: string;
};

/**
 * Any position, shaped as a decidable row.
 *
 * `EXCEPTIONS` holds only the positions with something wrong. But both the All
 * Products tab and the product peek need the same three fields on a HEALTHY
 * position too — what would be ordered, what the move is, and why — because a
 * reader looking at a calm line still wants to know what IRIS would say about
 * it. Written once here rather than in each screen, so the two cannot disagree
 * about what a proposal is.
 */
export function asException(p: SkuPolicyRow): Exception {
  const hit = EXCEPTIONS.find((e) => e.key === p.key);
  if (hit) return hit;
  return {
    ...p,
    requestedQty: 0,
    recommendedAction: "No action — within policy",
    reason: "On hand clears the buffer against the accepted lead time.",
  };
}

export const EXCEPTIONS: Exception[] = POSITIONS.filter((p) => p.severity !== "healthy")
  .map((p) => {
    const short = isShort(p);
    /* Enough to reach TARGET, which is the level `isShort` judged it against.
       It was lead-time demand less what is here and coming, which leaves out the
       safety buffer — so a position 67 units under target asked for 1, and the
       run then claimed the request would meet a target it could not reach. */
    const qty = Math.max(1, targetStock(p) - p.onHand - p.incoming);
    const over = Math.max(1, excessOf(p));
    return {
      ...p,
      requestedQty: short ? qty : over,
      /* Two different moves, and they leave by different doors.
         SHORT is a stores requisition: the planner decides what a crib needs
         and buying places it, so "Request 193 from Cline Tool & Service Co"
         rather than "Raise 193 on" — a planner cannot commit Allison to a
         purchase.
         LONG is a transfer. The units already exist and are simply in the
         wrong place, so the move is to the other stores, not out of the
         network. "Move 9 out" said neither where to nor why, and read like a
         write-off. */
      ...(short ? {} : { transferTo: otherDc(p.branch) }),
      recommendedAction: short
        ? `Request ${qty} from ${p.vendor}`
        : `Transfer ${over} to ${otherDc(p.branch)}`,
      reason: short
        ? `Cover is ${Math.round(p.onHand / Math.max(0.1, p.demandMean))} days against a ${p.leadTimeDays}-day lead time.`
        : `On hand exceeds the buffer with ${p.leadTimeDays}-day replenishment still inbound. ${otherDc(p.branch)} can take it without a new order.`,
    };
  })
  .sort((a, b) => b.dollarsAtRisk - a.dollarsAtRisk);

/* ─── The matrix ──────────────────────────────────────────────── */

export type MatrixCell = {
  classification: Classification;
  skuCount: number;
  dollarsAtRisk: number;
  severity: Severity;
  fillRate?: number;
  elevatedCount?: number;
  criticalCount?: number;
  elevatedDollars?: number;
  criticalDollars?: number;
};

/**
 * One cell per classification.
 *
 * A cell's severity is the worst thing in it, not an average — a box holding
 * one critical position among forty healthy ones is a box a planner has to
 * open, and a mean would hide exactly that.
 */
export function matrixCells(positions = POSITIONS): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const abc of ABC_ORDER) {
    for (const xyz of XYZ_ORDER) {
      const c = `${abc}${xyz}` as Classification;
      const rows = positions.filter((p) => p.classification === c);
      const crit = rows.filter((p) => p.severity === "critical");
      const elev = rows.filter((p) => p.severity === "elevated");
      cells.push({
        classification: c,
        skuCount: rows.length,
        dollarsAtRisk: rows.reduce((s, p) => s + p.dollarsAtRisk, 0),
        /* By concentration, not by presence.
           "The worst thing in the cell" turned all nine boxes red: 16 critical
           positions scattered across 151 meant every cell held at least one, and
           a nine-box where every box is an exception cannot do the one thing it
           exists for — show WHERE the exposure sits. 102 of those 151 positions
           are healthy and the matrix was saying none of them were.
           So the tint answers "how much of this cell is in trouble": a fifth
           critical makes it critical, a third in exception makes it elevated. The
           counts stay on the face of the cell, so nothing is hidden — a cell can
           read healthy and still show the two criticals inside it, which is the
           honest version of what the colour used to overstate. */
        severity: severityForCell(rows.length, crit.length, elev.length),
        fillRate: rows.length ? rows.reduce((s, p) => s + p.fillRate, 0) / rows.length : undefined,
        elevatedCount: elev.length,
        criticalCount: crit.length,
        elevatedDollars: elev.reduce((s, p) => s + p.dollarsAtRisk, 0),
        criticalDollars: crit.reduce((s, p) => s + p.dollarsAtRisk, 0),
      });
    }
  }
  return cells;
}

/** IRIS's service tier wording for a fill rate. */
export function fillTierLabel(pct: number): string {
  if (pct >= 97) return "World class";
  if (pct >= 95) return "Top quartile";
  if (pct >= 90) return "Acceptable";
  if (pct >= 85) return "Below average";
  return "Poor";
}

/* ─── Rollups ─────────────────────────────────────────────────── */

export function planningRollup(positions = POSITIONS) {
  const auto = EXCEPTIONS.filter((e) => routeFor(e.confidence, e.severity) === "auto");
  const manual = EXCEPTIONS.filter((e) => routeFor(e.confidence, e.severity) === "manual");
  const fill = positions.reduce((s, p) => s + p.fillRate, 0) / Math.max(1, positions.length);
  const targetSl =
    positions.reduce((s, p) => s + segmentPolicy(p.classification).sl / 100, 0) /
    Math.max(1, positions.length);
  return {
    positions: positions.length,
    /* Distinct variants in whatever slice was passed, not the style count. A
       position is a material at a stores now, and a page scoped to one stores
       should say how many materials IT holds. */
    skus: new Set(positions.map((p) => p.sku)).size,
    branches: BRANCHES.length,
    exceptions: EXCEPTIONS.length,
    critical: EXCEPTIONS.filter((e) => e.severity === "critical").length,
    elevated: EXCEPTIONS.filter((e) => e.severity === "elevated").length,
    auto: auto.length,
    manual: manual.length,
    autoRate: EXCEPTIONS.length ? auto.length / EXCEPTIONS.length : 0,
    dollarsAtRisk: EXCEPTIONS.reduce((s, e) => s + e.dollarsAtRisk, 0),
    fillRate: fill,
    targetSl,
    overridden: positions.filter((p) => p.overridden).length,
  };
}

/* ─── The calculation, shown ──────────────────────────────────── */

export interface TraceStep {
  step: string;
  formula: string;
  inputs: { label: string; value: string }[];
  output: string;
  note?: string;
}

/** Service factor z for a target service level. */
export function zFor(service: number): number {
  if (service >= 0.98) return 2.05;
  if (service >= 0.97) return 1.88;
  if (service >= 0.95) return 1.65;
  if (service >= 0.94) return 1.55;
  if (service >= 0.92) return 1.41;
  if (service >= 0.9) return 1.28;
  return 1.04;
}

/**
 * How IRIS got to a number.
 *
 * A planner asked to accept a level they did not compute needs the formula, the
 * inputs and the intermediate figures, or they are being asked for a signature
 * rather than a decision.
 */
export function traceFor(r: SkuPolicyRow): TraceStep[] {
  const seg = segmentPolicy(r.classification);
  const z = zFor(seg.sl / 100);
  const pattern = demandPattern(r.adi, r.cv2);
  const sigmaD = r.demandMean * Math.sqrt(r.cv2);
  const sigmaLtd = sigmaD * Math.sqrt(r.leadTimeDays);
  const ss = z * sigmaLtd;
  const rop = Math.round(r.demandMean * r.leadTimeDays) + Math.round(ss);
  return [
    {
      step: "Classify the demand",
      formula: "Syntetos–Boylan · ADI ≥ 1.32 · CV² ≥ 0.49",
      inputs: [
        { label: "ADI", value: r.adi.toFixed(2) },
        { label: "CV²", value: r.cv2.toFixed(2) },
      ],
      output: DEMAND_PATTERN_LABEL[pattern],
      note: `${STOCKING_POLICY_META[r.systemPolicy].label} — ${STOCKING_POLICY_META[r.systemPolicy].description}.`,
    },
    {
      step: "Place it in a segment",
      formula: "ABC by spend tier · XYZ from CV²",
      inputs: [
        { label: "Annual spend", value: `$${Math.round(r.annualValue / 1000)}K` },
        { label: "Segment", value: r.classification },
      ],
      output: r.classification,
      note: `${segmentMeaning(r.classification)} — recomputed every ${seg.reviewDays} days.`,
    },
    {
      step: "Take the service level",
      formula: "SL ← segment table · z ← service factor",
      inputs: [
        { label: "Segment", value: r.classification },
        { label: "SL", value: `${seg.sl}%` },
      ],
      output: `z = ${z.toFixed(2)}`,
      note: "The segment sets this, not the SKU — which is why the matrix is where policy is argued.",
    },
    {
      step: "Size the demand risk",
      formula: "σ_LTD = σ_daily × √(lead time) · σ_daily = √(CV²) × mean",
      inputs: [
        { label: "σ daily", value: `${sigmaD.toFixed(1)} /day` },
        { label: "Lead time", value: `${r.leadTimeDays} days` },
      ],
      output: `σ_LTD = ${sigmaLtd.toFixed(1)}`,
      note: "√ is why a longer lead time raises the buffer by less than the delay itself.",
    },
    {
      step: "Safety stock",
      formula: seg.tau ? "SS = z × σ_LTD, capped at τ" : "SS = z × σ_LTD",
      inputs: [
        { label: "z", value: z.toFixed(2) },
        { label: "σ_LTD", value: sigmaLtd.toFixed(1) },
        ...(seg.tau ? [{ label: "τ", value: `${seg.tau}×` }] : []),
      ],
      output: `${Math.round(ss)} units`,
      note: seg.tau
        ? `Standing policy holds ${r.safetyStock}. τ caps this segment at ${Math.round(ss * seg.tau)}.`
        : `Standing policy holds ${r.safetyStock}. No τ cap on this segment.`,
    },
    {
      step: "Reorder point",
      formula: "ROP = demand over the lead time + SS",
      inputs: [
        { label: "Lead-time demand", value: `${Math.round(r.demandMean * r.leadTimeDays)}` },
        { label: "SS", value: `${Math.round(ss)}` },
      ],
      output: `${rop} units`,
      note: "A separate figure from safety stock, and it moves with it.",
    },
  ];
}

/**
 * One exception by its key.
 *
 * The panel needs it: an override arrives as a row key and a quantity, and the
 * task has to be built from the position itself rather than from whatever the
 * caller chose to pass along. Passing the whole Exception through the context
 * would put a data object in a UI handler and let the two drift.
 */
export function exceptionByKey(key: string): Exception | undefined {
  return EXCEPTIONS.find((e) => e.key === key);
}
