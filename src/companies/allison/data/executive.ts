/**
 * The measures that only exist at the executive seat.
 *
 * Everything here reads across every position at both centres and across all
 * twelve supplying plants, because that is what makes these figures this seat's
 * rather than a desk's: a planner knows one centre, a buyer knows one category,
 * and none of them can compute a share of the whole.
 *
 * Two rules held throughout. One base per figure, stated next to it — a share of
 * inventory and a share of turnover are only comparable if both are shares of
 * the same book. And nothing authored where it can be derived: the only invented
 * numbers in this file are the gross margin and the plan targets, both named as
 * constants so a reader can see exactly how much of the page is an assumption.
 */
import {
  POSITIONS,
  cartonCost,
  excessOf,
  isLong,
  isShort,
  forecastAccuracy,
  inventoryTurns,
  inventoryValue,
  targetStock,
  ABC_ORDER,
  type Abc,
} from "./planning";
import { SUPPLIERS, money, type Supplier } from "./buying";
import {
  ACCESSORIALS,
  LANES,
  detentionNow,
  fleetUtilisation,
  laneDelta,
  laneHabitCost,
  loadsOnTime,
} from "./logistics";
import { QUEUES, linesFor, parseCalendar } from "./action-center";
import { ORDERS } from "./service";

/* ═══════════════════════════════════════════════════════════════
 *  The assumptions, in one place
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Gross margin, for turning cost into revenue.
 *
 * The planner's book carries cost and only cost: `annualValue` is annual demand
 * × carton cost, which is COGS. There is no selling price anywhere in the model,
 * so revenue cannot be derived — it has to be assumed, and this is the
 * assumption, sitting on its own line rather than buried in an expression.
 *
 * A reader who disagrees with the margin can change one number and every revenue
 * figure on the page moves with it.
 */
export const GROSS_MARGIN = 0.34;

/**
 * Fossil's annual revenue, across every category.
 *
 * A real figure, and the reason it is here: the derived book is watch book
 * only — 396 positions grossing up to about $261M a year — and an executive
 * dashboard showing $161M as "revenue" reads as the company. Fossil turns over
 * more than $6bn across watch, resilient, hardwood, laminate, tile and stone
 * and synthetic turf. Off by a factor of twenty-three is not a rounding.
 *
 * So this anchors the page at company scale and `CATEGORY_MULTIPLE` carries the
 * ratio to every other money figure, which keeps the ratios between them intact:
 * scaling revenue alone would have left working capital at one category's size
 * and made inventory turns nonsense.
 *
 * The rates — forecast accuracy, turns, on-time — are untouched. A rate does not
 * scale with the size of the book it was measured on.
 */
/** Order of magnitude from public filings — net sales have run ~$1.1–1.4B a
 *  year since the smartwatch exit. A precise figure would claim sourcing the
 *  research does not carry, so this is deliberately round. */
export const FOSSIL_ANNUAL_REVENUE = 1_200_000_000;

/**
 * How much of the year has run, for turning an annual figure into year-to-date.
 *
 * Derived from the planner's fixed TODAY rather than the clock, so the dashboard
 * says the same thing on every run — the whole fixture set is deterministic and a
 * live date would be the one thing on the page that moved.
 */
const YTD_FRACTION = 224 / 365; // 12 Aug, the planner's TODAY

/** Where the plan sits, for each measure that has no target in the data. */
const TARGETS = {
  /* Annualised revenue plan, at the margin above. Set against a four-centre
     network — it was 135M when the book was two centres, and left revenue
     reading +94% against plan, which is not a variance, it is a stale plan. */
  revenue: FOSSIL_ANNUAL_REVENUE * 1.03,
  /** Landed-cost budget for the period. */
  cost: 820_000,
  /* Scaled with everything else — see categoryMultiple. */
  forecastAccuracy: 85,
  /* A plan a fashion-accessory business would actually set. The old 10 was
     sized against the broken 17× actual, so the card read +71% and looked
     like a win; against a real turns figure the plan has to be realistic too,
     or the variance is measuring the plan's error rather than the book's.
     Five, which the book beats by a point — leaning the stock out is the
     thing this seat is trying to do, so the tile should be able to show it
     working. */
  inventoryTurns: 5,
} as const;

/* ═══════════════════════════════════════════════════════════════
 *  Revenue and working capital
 * ═══════════════════════════════════════════════════════════════ */

/** Annual cost of goods across the book — the base every value share is taken of. */
export function annualCogs(positions = POSITIONS): number {
  return positions.reduce((sum, p) => sum + p.annualValue, 0);
}

/**
 * Revenue booked so far this year.
 *
 * COGS to date, grossed up by `GROSS_MARGIN`. It is not the order book: the
 * service seat's fourteen orders are the ones needing attention this week, worth
 * $979K, and reading that as the year would be reading a queue as a P&L.
 */
/** The watch book book's own revenue — derived, and the base the multiple is off. */
export function carpetTileRevenue(): number {
  return Math.round((annualCogs() * YTD_FRACTION) / (1 - GROSS_MARGIN));
}

/**
 * How many times the loaded book fits into Fossil's whole one.
 *
 * One assumption, in one place, applied to every money figure so the page stays
 * internally consistent. It is a scale factor rather than a category mix — this
 * prototype holds one category and cannot know how the other six divide.
 */
/**
 * What each category is of the company's revenue.
 *
 * Approximate, from the 10-K category tables — watches have run just under
 * four-fifths of net sales since the smartwatch exit, leathers around an
 * eighth, jewelry the rest. Deliberately round: precise decimals would claim
 * a sourcing the research does not carry.
 *
 * Zero where zero is the fact: fixtures & packaging is spend, not revenue,
 * and smartwatches are exited — an executive reading either at a revenue
 * scale should see the zero and know why.
 */
const CATEGORY_SHARE: Record<string, number> = {
  watches: 0.79,
  "leather-goods": 0.12,
  jewelry: 0.09,
  "fixtures-packaging": 0,
  smartwatches: 0,
};

/**
 * The scale the page is being read at, from the CATEGORY in the top bar.
 *
 * All categories is the whole company — the loaded book times
 * `categoryMultiple`. A named category is the company times that category's
 * revenue share: Watches reads ~$950M a year of a ~$1.2B company, because
 * that is roughly what Fossil's watch category does, and a control that
 * printed the fixture book's own $64M under the label "Watches" would be a
 * scale error wearing a scope's clothes. (An earlier cut did exactly that —
 * the ×1 "loaded book" reading is honest about the fixtures and wrong about
 * the world, and an executive page answers for the world.)
 *
 * This is the executive's ONE control. Brand left the model's controls when
 * the Americas Priority sheet turned out not to plan by it; category is the
 * sheet's own third dimension.
 */
export function scaleFor(categoryId: string): number {
  if (categoryId === "all") return categoryMultiple();
  const share = CATEGORY_SHARE[categoryId];
  return share === undefined ? 0 : categoryMultiple() * share;
}

export function categoryMultiple(): number {
  const loadedAnnual = carpetTileRevenue() / YTD_FRACTION;
  return loadedAnnual === 0 ? 1 : FOSSIL_ANNUAL_REVENUE / loadedAnnual;
}

/** Revenue booked so far this year, across every category. */
export function ytdRevenue(scale = categoryMultiple()): number {
  /* Revenue is the watch book book grossed up, times whatever scale is in
     force — so All categories lands on Fossil's own figure and Carpet tile lands
     on the book that was actually derived. */
  return Math.round((carpetTileRevenue() / YTD_FRACTION) * scale * YTD_FRACTION);
}

/** The capital the stocking policy says should be on the floor. */
export function workingCapitalTarget(positions = POSITIONS): number {
  return Math.round(positions.reduce((sum, p) => sum + targetStock(p) * cartonCost(p.sku), 0));
}

/* ═══════════════════════════════════════════════════════════════
 *  The scorecard
 * ═══════════════════════════════════════════════════════════════ */

export interface ExecMeasure {
  id: "revenue" | "cost" | "workingCapital" | "forecastAccuracy" | "inventoryTurns";
  label: string;
  value: number;
  target: number;
  format: "money" | "pct" | "turns";
  /** Which direction is good — working capital under target is not a miss. */
  better: "higher" | "lower";
  /** The base the figure is computed on, said out loud. */
  basis: string;
  /** True where the target is derived from the data rather than assumed. */
  targetDerived: boolean;
}

/**
 * The five, with where each one is supposed to be.
 *
 * A number alone is not a decision: 77% says nothing, 77% against 85% says the
 * month is short. Only working capital's target is derived — Σ target stock ×
 * carton cost is the capital the policy itself asks for — and `targetDerived`
 * marks that, so the page can be honest about which comparisons are real.
 */
/**
 * A measure printed the way its own kind wants printing.
 *
 * Lives here rather than beside the tiles because the command center is no
 * longer the only thing that says these numbers out loud — the seat's questions
 * answer with them too, and a chip reading "$3.68B" beside a tile reading
 * "$3682.2M" is the same fact told two ways.
 *
 * Billions get their own unit: four digits before the decimal is a number the
 * reader has to count the places on, and counting places is what a unit exists
 * to prevent. Landed cost is the one money figure below a million and keeps its
 * full precision, because "$0.78M" costs the reader the receipt-level exactness
 * that makes it worth printing.
 */
/**
 * A command-center measure against its target, in one sentence.
 *
 * Read off `execMeasures` and printed with `showMeasure`, which is what the
 * tiles use — so a chip cannot answer "$3682.2M" beside a tile reading
 * "$3.68B", and neither can drift when the fixtures move.
 *
 * "Ahead" and "short" follow the measure's own `better`, because the sign of
 * the gap does not decide which direction is good: landed cost under plan is
 * ahead, and working capital under policy is short.
 */
/** A measure's own label, for a card that was asked about it by name. */
export function measureLabel(id: string): string | null {
  return execMeasures().find((x) => x.id === id)?.label ?? null;
}

export function measureLine(id: string): string {
  const m = execMeasures().find((x) => x.id === id);
  if (!m) return "";
  const gap = measureGap(m);
  const good = m.better === "higher" ? gap >= 0 : gap <= 0;
  /* "a policy figure of" rather than a trailing noun: working capital's target
     is derived from the policy rather than planned, and the sentence has to say
     so without reading as two nouns jammed together. */
  const against = m.targetDerived
    ? `a policy figure of ${showMeasure(m, m.target)}`
    : `${showMeasure(m, m.target)} planned`;
  return `${showMeasure(m, m.value)} against ${against} — ${Math.abs(gap)}% ${good ? "ahead" : "short"}.`;
}

export function showMeasure(m: ExecMeasure, value: number): string {
  if (m.format === "pct") return `${Math.round(value)}%`;
  if (m.format === "turns") return `${value}×`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  return money(value);
}

/** How far a measure sits from its target, as a signed percentage. Positive is
 *  above the target, whatever "better" means for that measure. */
export function measureGap(m: ExecMeasure): number {
  return m.target === 0 ? 0 : Math.round(((m.value - m.target) / m.target) * 100);
}

export function execMeasures(scale = categoryMultiple()): ExecMeasure[] {
  const at = (n: number) => Math.round(n * scale);
  return [
    {
      id: "revenue",
      label: "YTD revenue",
      value: ytdRevenue(scale),
      target: Math.round(((TARGETS.revenue / categoryMultiple()) * scale) * YTD_FRACTION),
      format: "money",
      better: "higher",
      basis:
        scale === 1
          ? "The watch book book, at cost, grossed up"
          : `All categories · watch book is ${money(carpetTileRevenue())} of it`,
      targetDerived: false,
    },
    {
      id: "cost",
      label: "Landed cost",
      value: at(landedCost()),
      target: at(TARGETS.cost),
      format: "money",
      better: "lower",
      basis: `${landedCartons()} units received this period`,
      targetDerived: false,
    },
    {
      id: "workingCapital",
      label: "Working capital",
      value: at(inventoryValue()),
      target: at(workingCapitalTarget()),
      format: "money",
      /* Under the policy target is not a win here — it is the short position the
         planner is chasing. Higher is better up to the target, and the page shows
         the gap rather than a colour. */
      better: "higher",
      basis: "Stock on hand at both centres, at cost",
      targetDerived: true,
    },
    {
      id: "forecastAccuracy",
      label: "Forecast accuracy",
      value: forecastAccuracy(),
      target: TARGETS.forecastAccuracy,
      format: "pct",
      better: "higher",
      basis: "Weighted by turnover",
      targetDerived: false,
    },
    {
      id: "inventoryTurns",
      label: "Inventory turns",
      value: inventoryTurns(),
      target: TARGETS.inventoryTurns,
      format: "turns",
      better: "higher",
      basis: "Annual demand over stock held",
      targetDerived: false,
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════
 *  Landed cost — the units that actually arrived
 * ═══════════════════════════════════════════════════════════════ */

/** The buyer's rows that have landed, as lines. */
function receivedLines() {
  return QUEUES.buyer.rows.filter((r) => r.state === "settled").flatMap((r) => linesFor(r));
}

/**
 * What the units that landed this period cost.
 *
 * The buyer's queue carries the state, and `settled` means received — so this is
 * goods actually on the floor, not the $1.4M still on order. It is the narrowest
 * figure on the page and the only one tied to individual receipts.
 */
export function landedCost(): number {
  return receivedLines().reduce((sum, l) => sum + l.value, 0);
}

/** Cartons behind that cost, so the figure carries its own base. */
export function landedCartons(): number {
  return receivedLines().reduce((sum, l) => sum + l.qty, 0);
}

/* ═══════════════════════════════════════════════════════════════
 *  Where the value sits — by class, and by item
 * ═══════════════════════════════════════════════════════════════ */

export interface AbcSlice {
  abc: Abc;
  skus: number;
  /** Stock on hand at cost, and its share of the book. */
  inventory: number;
  inventoryShare: number;
  /** Annual demand at cost, and its share. */
  turnover: number;
  turnoverShare: number;
}

/**
 * Inventory against turnover, by class.
 *
 * The comparison is the point, not either bar. A class holding a larger share of
 * the stock than of the demand is capital sitting still; the reverse is a class
 * being run thin. Both shares are taken of the same book, which is the only way
 * the two bars mean anything side by side.
 *
 * Turnover is at cost, not at price — `annualValue` is demand × carton cost. It
 * is called turnover here rather than revenue for that reason: grossing it up per
 * class would apply one blended margin to eight product families and invent a mix
 * the model does not carry.
 */
export function abcMix(positions = POSITIONS): AbcSlice[] {
  const invTotal = positions.reduce((s, p) => s + p.onHand * cartonCost(p.sku), 0);
  const turnTotal = annualCogs(positions);
  return ABC_ORDER.map((abc) => {
    const rows = positions.filter((p) => p.classification[0] === abc);
    const inventory = rows.reduce((s, p) => s + p.onHand * cartonCost(p.sku), 0);
    const turnover = rows.reduce((s, p) => s + p.annualValue, 0);
    return {
      abc,
      skus: rows.length,
      inventory: Math.round(inventory),
      inventoryShare: invTotal === 0 ? 0 : inventory / invTotal,
      turnover: Math.round(turnover),
      turnoverShare: turnTotal === 0 ? 0 : turnover / turnTotal,
    };
  });
}

export type BalanceMode = "stockout" | "overstock";

export interface BalanceRow {
  branch: string;
  /** Positions in trouble in this direction, not positions held. */
  products: number;
  /** Cartons short of target, or units over it. */
  units: number;
  /** Those units at cost: exposure when short, capital tied up when long. */
  value: number;
}

/**
 * Under-stock and over-stock, by the centre that holds it.
 *
 * One question asked in two directions, which is why it is one table with a
 * toggle rather than two tables. Short and long are not opposites a reader
 * compares side by side — they are two lists with the same shape, and a centre
 * usually appears on both.
 *
 * Counting positions in trouble, not positions held: "7 products" means seven
 * decisions waiting at that centre. And the value is those units at cost in
 * both directions, but it means different things — short is revenue that cannot
 * be served, long is capital that cannot be spent — so the column is renamed by
 * the toggle rather than left as a neutral "value" that flatters both.
 *
 * This replaced a top-items-by-inventory-value list. The list was honest and
 * useless: the dearest eight of 198 positions held 13% of the stock, because the
 * fixture's demand is spread evenly rather than following the power law a real
 * flooring book does. Ranking a flat distribution produces a leaderboard with no
 * leader. Grouping by centre and by direction asks a question the data can
 * actually answer.
 */
export function inventoryBalance(
  mode: BalanceMode,
  scale = categoryMultiple(),
  positions = POSITIONS,
): BalanceRow[] {
  const branches = [...new Set(positions.map((p) => p.branch))];
  return branches
    .map((branch) => {
      const rows = positions.filter((p) => p.branch === branch);
      const hit = rows.filter((p) => (mode === "stockout" ? isShort(p) : isLong(p)));
      const units = hit.reduce(
        (sum, p) =>
          sum +
          (mode === "stockout"
            ? Math.max(0, targetStock(p) - p.onHand - p.incoming)
            : excessOf(p)),
        0,
      );
      const value = hit.reduce(
        (sum, p) =>
          sum +
          (mode === "stockout"
            ? Math.max(0, targetStock(p) - p.onHand - p.incoming) * cartonCost(p.sku)
            : excessOf(p) * cartonCost(p.sku)),
        0,
      );
      /* ALL THREE columns scale together — see `categoryMultiple`.
         The Shaw build scaled the dollars and left the counts "as measured",
         on the argument that multiplying a count invents stock. But a reader
         can divide one column by another, and $41M at risk over 13 products
         and 21,000 units is a row that refutes itself. This page's whole
         premise is that the loaded book stands in for a slice of the company;
         the counts make that claim or the dollars cannot. At Watches scale
         (×1) every figure is the derived book's own, unscaled. */
      return {
        branch,
        products: Math.round(hit.length * scale),
        units: Math.round(units * scale),
        value: Math.round(value * scale),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/* ═══════════════════════════════════════════════════════════════
 *  Who supplies it
 * ═══════════════════════════════════════════════════════════════ */

export interface SupplierRow {
  id: string;
  /** Name and country together, because the names alone do not distinguish them. */
  label: string;
  country: string;
  own: boolean;
  spend: number;
  spendShare: number;
  /** Lines delivered complete, 0–100. */
  fillRate: number;
  /** On time in full — the joint measure, so it can only be ≤ fill rate. */
  otif: number;
}

/**
 * What to call a supplier in one line.
 *
 * The supplier's own name now, which it did not used to be: five records were
 * called "Cline Tool & Service Co" and two of those were in Vietnam, because a commit that
 * renamed Fossil's plants for their towns applied the plant name to the import
 * suppliers as well. This function keyed on `site` to route around that, and the
 * workaround outlived the bug — the names are distinct company names again, and a
 * supplier table should say who the supplier is.
 *
 * Fossil's own plants are the exception, and deliberately: their name IS the town,
 * so the site carries it with its state — "Dallas, TX" rather than "Dallas" —
 * which is how a buyer refers to a plant. The country flag beside it does the rest
 * of the geography.
 */
function siteLabel(v: Supplier): string {
  return v.own ? v.site : v.name;
}

/**
 * The suppliers the spend is concentrated in, with what they deliver against it.
 *
 * Spend and OTIF are the supplier record's own. Fill rate is the record's too —
 * see `fillRatePct` — and the two are deliberately kept apart: OTIF is the joint
 * measure, on time AND in full, so it is always the lower of the pair and the gap
 * between them is a supplier who ships everything but ships it late. One number
 * cannot say that.
 *
 * Rows are named by their site rather than their name — see `siteLabel` for why
 * the name field cannot be used here.
 */
export function topSuppliers(limit = 6): SupplierRow[] {
  const total = SUPPLIERS.reduce((s, v) => s + v.annualSpend, 0);
  return [...SUPPLIERS]
    .sort((a, b) => b.annualSpend - a.annualSpend)
    .slice(0, limit)
    .map((v: Supplier) => ({
      id: v.id,
      label: siteLabel(v),
      country: v.country,
      own: v.own,
      spend: v.annualSpend,
      spendShare: total === 0 ? 0 : v.annualSpend / total,
      fillRate: v.fillRatePct,
      otif: v.otifPct,
    }));
}

/* ═══════════════════════════════════════════════════════════════
 *  How the freight is moved, and whether it is the cheaper way
 * ═══════════════════════════════════════════════════════════════ */

export interface LaneRow {
  id: string;
  /** Origin → destination, which is what a lane is called out loud. */
  route: string;
  miles: number;
  loads: number;
  /** Purchased rate minus fleet cost, per mile. Positive means own iron wins. */
  delta: number;
  cheaper: "fleet" | "bought";
  /** Share of this month's loads on own iron, 0–100. */
  fleetShare: number;
  /** Share running on the dearer option — the part that costs money. */
  wrongShare: number;
  /** A month of that gap, and the year it annualises to. */
  habitMonthly: number;
  habitAnnual: number;
}

/**
 * Every lane with both rates on it, dearest habit first.
 *
 * The one place on this page where the decision has a right answer and is being
 * made the wrong way. Each lane carries an all-in fleet cost and a benchmark
 * purchased rate, so which option is cheaper is arithmetic — and the fleet share
 * says which one is actually being run. Where those disagree, the gap is money,
 * and `laneHabitCost` has already been putting a figure on it on the transport
 * seat's own screen.
 *
 * Both the month and the year are carried. The month is what was measured; the
 * year is what an executive decides against, and doing that multiplication in a
 * component is how the same figure ends up meaning two things on two pages —
 * which is exactly what happened before this existed.
 *
 * Lanes below `HABIT_FLOOR` are kept rather than filtered. On the transport seat
 * the floor is right: a rebalancing worklist that includes a $47 lane trains the
 * reader to skim it. Here the question is whether the network is being run well,
 * and a lane that is already right is part of that answer.
 */
export function laneEconomics(): LaneRow[] {
  return [...LANES]
    .map((l) => {
      const delta = laneDelta(l);
      const monthly = laneHabitCost(l);
      return {
        id: l.id,
        route: `${l.origin} → ${l.destination}`,
        miles: l.miles,
        loads: l.loadsThisMonth,
        delta,
        cheaper: (delta > 0 ? "fleet" : "bought") as "fleet" | "bought",
        fleetShare: l.fleetShare,
        /* The share on the dearer option: purchased where fleet is cheaper, fleet
           where it is not. Same rule laneHabitCost prices, said in words. */
        wrongShare: delta > 0 ? 100 - l.fleetShare : l.fleetShare,
        habitMonthly: monthly,
        habitAnnual: monthly * 12,
      };
    })
    .sort((a, b) => b.habitMonthly - a.habitMonthly);
}

/* ═══════════════════════════════════════════════════════════════
 *  Freight cost against service, over a year
 *
 *  The trade-off this seat owns: is the freight bill coming down
 *  without the delivery promise coming down with it.
 * ═══════════════════════════════════════════════════════════════ */

/** What the lane book costs to run for a month, at the current fleet/bought split. */
export function freightMonthly(scale = categoryMultiple()): {
  linehaul: number;
  accessorials: number;
  loads: number;
  miles: number;
} {
  let linehaul = 0;
  let loads = 0;
  let miles = 0;
  for (const l of LANES) {
    const share = l.fleetShare / 100;
    /* The rate actually being paid, not the cheaper of the two — this is the bill,
       not the opportunity. `laneEconomics` is where the gap between them lives. */
    const blended = share * l.fleetCostPerMile + (1 - share) * l.purchasedRatePerMile;
    linehaul += l.miles * l.loadsThisMonth * blended;
    loads += l.loadsThisMonth;
    miles += l.miles * l.loadsThisMonth;
  }
  /* At company scale, like the rest of the executive book. The lane fixture is
     eight lanes against one category; the freight bill for six more is the same
     ratio, and leaving it unscaled would have put a $100K freight line under a
     $3.7bn revenue line on the same card. */
  const m = scale;
  return {
    linehaul: Math.round(linehaul * m),
    accessorials: Math.round(ACCESSORIALS.reduce((sum, a) => sum + detentionNow(a), 0) * m),
    loads: Math.round(loads * m),
    miles: Math.round(miles * m),
  };
}

/**
 * Freight cost per load — the unit cost this dashboard tracks.
 *
 * Per load, not per unit, and that is a deliberate retreat. The lane fixture's
 * unit counts run 60 to 85 per lane-load and one load in LOADS carries 210,
 * which is five to ten dry vans — so "unit" in this data is not a unit, and a
 * cost-per-unit tile would have printed a figure wrong by several times on a
 * page a VP is meant to trust. A load is unambiguous: the lane book states the
 * loads and the miles, and the rate per mile is on the lane.
 *
 * The unit labelling in the logistics fixture needs fixing on its own terms; it
 * is not this chart's to fix quietly.
 */
export function freightCostPerLoad(): number {
  /* A rate: the scale cancels, so it is read off the unscaled book. */
  const f = freightMonthly(1);
  return Math.round((f.linehaul + f.accessorials) / Math.max(1, f.loads));
}

/**
 * The share of the freight bill that is a routing choice rather than a rate.
 *
 * Standing in for freight-as-percent-of-sales, which this fixture cannot state
 * honestly: the lane book is eight truckload lanes averaging 311 miles, and the
 * revenue is the whole 396-position network, so the ratio between them is not a
 * quantity — it came out at 0.46%, which is arithmetically correct and business
 * nonsense.
 *
 * This is the same question a VP actually asks of that percentage — how much of
 * the freight bill could we not pay — and both halves come off the same eight
 * lanes, so it is a real ratio.
 */
export function avoidableFreightShare(): number {
  const f = freightMonthly(1);
  const bill = f.linehaul + f.accessorials;
  const avoidable = laneEconomics().reduce((sum, l) => sum + l.habitMonthly, 0);
  return bill === 0 ? 0 : avoidable / bill;
}

/* ═══════════════════════════════════════════════════════════════
 *  The transport scorecard
 * ═══════════════════════════════════════════════════════════════ */

/**
 * How long a account waits, ordered to delivered.
 *
 * The one measure on this card that is the customer's experience rather than
 * Fossil's cost, which is why it is here: a freight bill coming down while this
 * number goes up is not efficiency, it is the promise being spent.
 *
 * Measured on delivered orders only — an order still moving has not finished
 * taking however long it is going to take. Four of them, which is why the base
 * is stated.
 */
export function orderToDelivery(): { days: number; orders: number } {
  const done = ORDERS.filter((o) => o.stage === "delivered");
  const spans = done
    .map((o) => {
      const from = parseCalendar(o.orderedOn);
      const to = parseCalendar(o.deliveredOn ?? o.currentEta);
      return from !== null && to !== null ? to - from : null;
    })
    .filter((d): d is number => d !== null && d > 0);
  return {
    days: spans.length === 0 ? 0 : Math.round(spans.reduce((s, d) => s + d, 0) / spans.length),
    orders: spans.length,
  };
}

/**
 * Where the plan sits on each transport measure.
 *
 * Authored, all six, and that is the whole of the invention on this card — every
 * "this month" figure beside them is derived from the lane and load book. They
 * live in one literal so a reader can see the assumption in one place rather
 * than finding it six times inside an expression.
 */
const TRANSPORT_PLAN = {
  costPerLoad: 780,
  costPerMile: 2.52,
  onTime: 95,
  orderToDelivery: 21,
  fleetUtilisation: 88,
  avoidableShare: 2,
} as const;

export interface TransportMeasure {
  key: string;
  /** Phosphor glyph name — the data layer names it, the component imports it. */
  icon: string;
  label: string;
  /** Already formatted — each of these reads in its own unit. */
  value: string;
  plan: string;
  /** Signed variance against plan, formatted, and whether that is good news. */
  variance: string;
  ahead: boolean;
  /** What the figure is computed on. */
  basis: string;
}

/**
 * Six measures against plan.
 *
 * Against plan and not against last month: nothing in these fixtures carries
 * freight history, so a month-on-month column would have been six seeded numbers
 * wearing the authority of a measurement. A plan is honestly an assumption, it
 * is labelled as one, and the variance against it is still the thing a VP reads.
 *
 * Three of the five measures on the reference table are not here, and the reasons
 * are the point. Freight as a percent of sales came out at 0.46% because the
 * numerator is eight truckload lanes and the denominator is a 396-position
 * network — arithmetically correct, not a ratio. Cost per stop is cost per load
 * on this book, where 131 loads serve seven accounts. And cost per unit needs a
 * unit: the lane fixture puts 73 units on a load and one load in LOADS carries
 * 210, which is ten dry vans, so per load and per mile are what can be said.
 */
export type Period = "month" | "quarter" | "year";

/** Months in each period, which is the only thing the toggle actually changes. */
const PERIOD_MONTHS: Record<Period, number> = { month: 1, quarter: 3, year: 12 };
const PERIOD_LABEL: Record<Period, string> = {
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

/** What the column of current figures is called, for the chosen period. */
export function periodLabel(period: Period): string {
  return PERIOD_LABEL[period];
}

export function transportScorecard(
  period: Period = "month",
  scale = categoryMultiple(),
): TransportMeasure[] {
  const months = PERIOD_MONTHS[period];
  const f = freightMonthly(scale);
  const bill = f.linehaul + f.accessorials;
  const perLoad = freightCostPerLoad();
  const perMile = bill / Math.max(1, f.miles);
  const ot = loadsOnTime();
  const otd = orderToDelivery();
  const fleet = fleetUtilisation();
  const avoidable = avoidableFreightShare() * 100;

  const money2 = (n: number) => `$${n.toFixed(2)}`;
  return [
    /* Freight spend leads, and it is the one row the period genuinely moves: a
       quarter costs three months of it. Everything under it is a rate, and a rate
       is the same number whatever window you read it over — the period changes
       what the rate was measured ACROSS, which is why the bases below scale and
       the figures beside them do not. */
    {
      key: "spend",
      icon: "CurrencyDollar",
      label: "Freight spend",
      value: `$${Math.round(bill * months).toLocaleString("en-US")}`,
      plan: `$${(TRANSPORT_PLAN.costPerLoad * f.loads * months).toLocaleString("en-US")}`,
      variance: `$${Math.abs(
        Math.round(bill * months) - TRANSPORT_PLAN.costPerLoad * f.loads * months,
      ).toLocaleString("en-US")}`,
      ahead: bill <= TRANSPORT_PLAN.costPerLoad * f.loads,
      basis: "Linehaul and accessorials",
    },
    {
      key: "costPerLoad",
      icon: "Truck",
      label: "Freight cost per load",
      value: `$${perLoad.toLocaleString("en-US")}`,
      plan: `$${TRANSPORT_PLAN.costPerLoad.toLocaleString("en-US")}`,
      variance: `$${Math.abs(perLoad - TRANSPORT_PLAN.costPerLoad).toLocaleString("en-US")}`,
      ahead: perLoad <= TRANSPORT_PLAN.costPerLoad,
      basis: `${(f.loads * months).toLocaleString("en-US")} loads`,
    },
    {
      key: "costPerMile",
      icon: "Path",
      label: "Cost per truck-mile",
      value: money2(perMile),
      plan: money2(TRANSPORT_PLAN.costPerMile),
      variance: money2(Math.abs(perMile - TRANSPORT_PLAN.costPerMile)),
      ahead: perMile <= TRANSPORT_PLAN.costPerMile,
      basis: `${Math.round((f.miles * months) / 1000)}k miles`,
    },
    {
      key: "onTime",
      icon: "Clock",
      label: "On-time delivery",
      value: `${ot.pct}%`,
      plan: `${TRANSPORT_PLAN.onTime}%`,
      variance: `${Math.abs(ot.pct - TRANSPORT_PLAN.onTime)} pts`,
      ahead: ot.pct >= TRANSPORT_PLAN.onTime,
      basis: `${ot.kept} of ${ot.total} clean PODs`,
    },
    {
      key: "orderToDelivery",
      icon: "CalendarCheck",
      label: "Order to delivery",
      value: `${otd.days} days`,
      plan: `${TRANSPORT_PLAN.orderToDelivery} days`,
      variance: `${Math.abs(otd.days - TRANSPORT_PLAN.orderToDelivery)} days`,
      ahead: otd.days <= TRANSPORT_PLAN.orderToDelivery,
      basis: `${otd.orders} delivered orders`,
    },
    {
      key: "fleetUtilisation",
      icon: "Gauge",
      label: "Fleet utilisation",
      value: `${Math.round(fleet)}%`,
      plan: `${TRANSPORT_PLAN.fleetUtilisation}%`,
      variance: `${Math.abs(Math.round(fleet) - TRANSPORT_PLAN.fleetUtilisation)} pts`,
      ahead: fleet >= TRANSPORT_PLAN.fleetUtilisation,
      basis: "Own units, available hours",
    },
    {
      key: "avoidableShare",
      icon: "ArrowsClockwise",
      label: "Avoidable share of freight",
      value: `${avoidable.toFixed(1)}%`,
      plan: `${TRANSPORT_PLAN.avoidableShare.toFixed(1)}%`,
      variance: `${Math.abs(avoidable - TRANSPORT_PLAN.avoidableShare).toFixed(1)} pts`,
      ahead: avoidable <= TRANSPORT_PLAN.avoidableShare,
      basis: "Routed by habit, not rate",
    },
  ];
}
