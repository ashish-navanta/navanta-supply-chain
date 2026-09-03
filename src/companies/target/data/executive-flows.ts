/**
 * Atlas's cross-tower reads for the executive command center.
 *
 * The executive does not work a queue; every figure on the dashboard drills
 * into the tower that owns it. Atlas is read-only — it explains a number and
 * walks the exposure back to the seat that owns it, then hands off with a
 * Continue link into that tower's own screen. No writes: an executive reads
 * the book, they do not act on a row.
 */
import { BOOK, ledgerPlays, money, rampToDate, realizedToDate } from "./buying";
import { LOGISTICS_BOOK, loadsOnTime } from "./logistics";
import { SERVICE_BOOK, promisesKept } from "./service";
import { planningRollup } from "./planning";
import {
  abcMix,
  inventoryBalance,
  measureLabel,
  measureLine,
  topSuppliers,
  transportScorecard,
} from "./executive";
import { BUYING_ROUTES, LOGISTICS_ROUTES, SERVICE_ROUTES } from "./nav";
import type { AgentTask, FlowArtifact } from "./agent-actions";

/**
 * What Atlas can be asked about on this seat.
 *
 * Four of these are the towers, and four are the sections of the command center.
 * They are not the same question: "planning" is how that desk is doing, while
 * "abc" is why class A holds four fifths of the stock — and both cards on this
 * page used to fire the tower read, so two different Explains produced the same
 * paragraph about fill rate and auto-routing. A button that answers a question
 * nobody asked is worse than no button.
 */
export type ExecTower =
  | "buying"
  | "planning"
  | "service"
  | "logistics"
  | "book"
  /* The command center's own cards. */
  | "abc"
  | "balance"
  | "suppliers"
  | "transport";

/** A 0–1 ratio as a percent. */
const pct = (n: number) => `${Math.round(n * 100)}%`;
/** A value already on a 0–100 scale as a percent. */
const pct100 = (n: number) => `${Math.round(n)}%`;

/**
 * What this seat asks, and which read each question runs.
 *
 * One list, read by two places: the command center draws it as a row of buttons
 * above the measures, and the chat panel draws it as its landing prompts. They
 * were written twice and had already drifted — the panel still offered "How much
 * value have we realized?" and "Which tower needs me first?", which are questions
 * about the four tower cards that page no longer has.
 */
export const EXEC_ASKS: { tower: ExecTower; label: string; measure?: string }[] = [
  /* One question per measure across the top of the page, in the same order.
     They used to be about the three cards further down — where stock is short,
     where spend concentrates — while the five numbers a VP actually gets asked
     about had nothing to press beside them. A row of prompts that answers a
     different question from the one the reader is looking at is a row of
     prompts nobody uses.
     Each answer opens with that measure against its target, read from
     `execMeasures`, and then hands off to the read that explains it — so the
     lower cards are still reachable, just through the number that sent you
     looking for them. */
  { tower: "book", label: "Where is revenue against plan?", measure: "revenue" },
  { tower: "buying", label: "Is landed cost beating plan?", measure: "cost" },
  { tower: "balance", label: "Is working capital inside policy?", measure: "workingCapital" },
  { tower: "planning", label: "Where is forecast accuracy weakest?", measure: "forecastAccuracy" },
  { tower: "abc", label: "What is holding inventory turns back?", measure: "inventoryTurns" },
];

/* ── The figures each tower contributes, computed once per read ─────────── */

function buyingFigures() {
  const ledger = ledgerPlays();
  const committed = ledger.reduce((s, p) => s + p.recommended, 0);
  const realized = ledger.reduce((s, p) => s + realizedToDate(p), 0);
  const expected = ledger.reduce((s, p) => s + rampToDate(p), 0);
  return { spend: BOOK.spend, openPoValue: BOOK.openPoValue, committed, realized, expected };
}

function serviceFigures() {
  const kept = promisesKept();
  return {
    openValue: SERVICE_BOOK.openValue,
    atRisk: SERVICE_BOOK.atRisk,
    claim: SERVICE_BOOK.openClaimValue,
    onTime: kept.pct,
  };
}

function logisticsFigures() {
  const ot = loadsOnTime();
  return {
    inFlight: LOGISTICS_BOOK.inFlightValue,
    onTime: ot.pct,
    fleet: LOGISTICS_BOOK.fleetUtilisation,
    habit: LOGISTICS_BOOK.habitCost,
    detention: LOGISTICS_BOOK.accruingSpend,
    backhaul: LOGISTICS_BOOK.backhaulRevenue,
  };
}

function planningFigures() {
  const r = planningRollup();
  return { fill: r.fillRate, atRisk: r.dollarsAtRisk, autoRate: r.autoRate, exceptions: r.exceptions };
}

/* ── The two figures that only exist at this seat ────────────────────────── */

/**
 * Recoverable cost: money going out of the door this month that a decision could
 * keep in it.
 *
 * This was called cost-to-serve and summed four things, one of which was
 * planning's $3.4M of stock exposure. Adding that to $881 of detention produced
 * a figure that looked like the headline and meant nothing: exposure is capital
 * standing behind stock, detention is cash spent, and a sum of the two is not a
 * quantity anybody can be held to. It also collided with the logistics seat's
 * own `costToServe`, which is accessorials per account — a third thing again
 * wearing the same name.
 *
 * So it is three components on one base — spent or conceded, in the current
 * month, recoverable by somebody's decision — and exposure moved out to
 * `valueAtRisk` where it is labelled as what it is.
 */
export function recoverableCost(): number {
  return recoverableBridge().reduce((sum, slice) => sum + slice.value, 0);
}

/**
 * The same money, attributed to the tower that owns the decision behind it.
 *
 * A total is the wrong shape for this seat. An executive who reads "$29K" cannot
 * do anything with it; one who reads "$29K, and 86% of it is unsettled claims"
 * knows which desk to walk into. So the split is the fact and the total is
 * summed back from it — the two cannot disagree, even when a component is added.
 *
 * Every slice is already somebody's number on their own screen. Nothing here is
 * new money.
 */
export function recoverableBridge(): {
  tower: Exclude<ExecTower, "book">;
  label: string;
  /** Where the figure is reported, in the words of the seat that owns it. */
  source: string;
  value: number;
  href: string;
}[] {
  const l = logisticsFigures();
  const slices: ReturnType<typeof recoverableBridge> = [
    {
      tower: "service",
      label: "Open claims",
      source: "Filed and not settled, at adjudicated value",
      value: serviceFigures().claim,
      href: SERVICE_ROUTES.claims,
    },
    {
      tower: "logistics",
      label: "Cost of habit",
      source: "Lanes routed by precedent rather than by rate",
      value: l.habit,
      href: LOGISTICS_ROUTES.lanes,
    },
    {
      tower: "logistics",
      label: "Detention accruing",
      source: "Trailers past their free time, right now",
      value: l.detention,
      href: LOGISTICS_ROUTES.lanes,
    },
  ];
  return slices.sort((a, b) => b.value - a.value);
}

/**
 * Capital standing behind stock that is not where it should be.
 *
 * Planning's own figure, carried up unchanged and kept apart from recoverable
 * cost because it is not cost — it is value that converts to margin or to a
 * write-down depending on what happens next, and on the dated grocery book the
 * write-down has a date printed on it — which is why it belongs at the seat
 * that decides what happens next.
 */
export function valueAtRisk(): number {
  return planningFigures().atRisk;
}

/* ── The reads, one per tower plus the whole-book overview ──────────────── */

interface TowerRead {
  title: string;
  intro: string;
  steps: AgentTask["steps"];
  lines: string[];
  tiles: NonNullable<AgentTask["outcome"]["tiles"]>;
  artifact?: FlowArtifact;
  continueLink: { label: string; href: string };
  prompts: string[];
}

function readFor(tower: ExecTower): TowerRead {
  if (tower === "buying") {
    const b = buyingFigures();
    const pace = b.expected > 0 ? b.realized / b.expected : 1;
    return {
      title: "Buying & value — where the savings sit",
      intro: "On it. The buying tower.",
      steps: [
        {
          label: "Read the category book",
          text: `${money(b.spend)} of category spend under management, ${money(b.openPoValue)} open on POs right now.`,
          source: "Buying · supplier book",
        },
        {
          label: "Weighed committed against realized",
          text: `${money(b.committed)} committed across the live plays, ${money(b.realized)} landed against ${money(b.expected)} the ramp planned by now — ${pct(pace)} of pace.`,
          source: "Atlas · value model",
        },
      ],
      lines: [
        pace >= 0.95
          ? `Value realization is on pace. The committed book is landing as the ramp said it would.`
          : `Realization is behind the ramp — the committed savings are landing slower than planned. The value screen names which plays.`,
      ],
      tiles: [
        { label: "Category spend", value: money(b.spend) },
        { label: "Committed", value: money(b.committed) },
        { label: "Realized", value: money(b.realized), tone: pace >= 0.95 ? "good" : "behind" },
      ],
      artifact: {
        kind: "compare",
        title: "Committed vs realized",
        aLabel: "Committed",
        bLabel: "Realized",
        rows: [
          {
            label: "Live plays",
            a: money(b.committed),
            b: money(b.realized),
            delta: pct(pace),
            tone: pace >= 0.95 ? "good" : "behind",
          },
          { label: "Against ramp", a: money(b.expected), b: money(b.realized), tone: pace >= 0.95 ? "good" : "behind" },
        ],
      },
      continueLink: { label: "Open value realization", href: BUYING_ROUTES.value },
      prompts: ["Which plays are behind ramp?", "What is still to commit?", "Where is the benchmark gap widest?"],
    };
  }

  if (tower === "service") {
    const s = serviceFigures();
    return {
      title: "Service — the revenue on the promise",
      intro: "On it. The service tower.",
      steps: [
        {
          label: "Read the order book",
          text: `${money(s.openValue)} of revenue on orders not yet landed, ${s.atRisk} of them at risk on the date.`,
          source: "Service · order book",
        },
        {
          label: "Read the exposure",
          text: `${pct100(s.onTime)} of promises kept over twelve months, ${money(s.claim)} of open claims against the book.`,
          source: "Atlas · service scorecard",
        },
      ],
      lines: [
        s.onTime >= 90
          ? `Delivery is holding at tier. The revenue at risk is the ${s.atRisk} orders whose date has moved — the order book names them.`
          : `On-time delivery is below where it should be, and ${money(s.openValue)} of revenue rides on the promise. The order book is where the slips are.`,
      ],
      tiles: [
        { label: "Revenue open", value: money(s.openValue) },
        { label: "On time", value: pct100(s.onTime), tone: s.onTime >= 90 ? "good" : "behind" },
        { label: "Open claims", value: money(s.claim), tone: s.claim > 0 ? "behind" : "good" },
      ],
      continueLink: { label: "Open the order book", href: SERVICE_ROUTES.orders },
      prompts: ["Which orders are about to slip?", "What is the claim exposure by account?", "Where is revenue most at risk?"],
    };
  }

  if (tower === "logistics") {
    const l = logisticsFigures();
    return {
      title: "Transport — cost and coverage",
      intro: "On it. The transport tower.",
      steps: [
        {
          label: "Read what is moving",
          text: `${money(l.inFlight)} in flight, ${pct100(l.onTime)} landing on the window, fleet running at ${pct100(l.fleet)} utilisation.`,
          source: "Logistics · load book",
        },
        {
          label: "Read what it is costing",
          text: `${money(l.habit)} a year in the cost of habit — lanes on the dearer of fleet and bought — and ${money(l.detention)} of detention accruing right now. ${money(l.backhaul)} of backhaul revenue on offer against it.`,
          source: "Atlas · lane economics",
        },
      ],
      lines: [
        `The recoverable money is the ${money(l.habit)} of habit plus the ${money(l.detention)} on the clock. The lane book is where the fleet-vs-bought calls get made.`,
      ],
      tiles: [
        { label: "In flight", value: money(l.inFlight) },
        { label: "On time", value: pct100(l.onTime), tone: l.onTime >= 90 ? "good" : "behind" },
        { label: "Cost of habit", value: `${money(l.habit)}/yr`, tone: "behind" },
      ],
      artifact: {
        kind: "ranked",
        title: "Transport spend to recover",
        columns: ["Source", "Amount", "Where"],
        rows: [
          { cells: ["Cost of habit", `${money(l.habit)}/yr`, "Lane book"], leader: true },
          { cells: ["Detention accruing", money(l.detention), "Freight spend"] },
          { cells: ["Backhaul on offer", money(l.backhaul), "Lane board"] },
        ],
        footnote: "Habit and detention are recoverable; backhaul is revenue on the empty legs.",
      },
      continueLink: { label: "Open the lane book", href: LOGISTICS_ROUTES.lanes },
      prompts: ["Which lanes cost the most habit?", "What is accruing at the docks?", "How full is fleet this week?"],
    };
  }

  if (tower === "planning") {
    const p = planningFigures();
    return {
      title: "Planning — the buffer and the exposure",
      intro: "On it. The planning tower.",
      steps: [
        {
          label: "Read the fill and the risk",
          text: `${pct(p.fill)} order fill across the network against ${money(p.atRisk)} of exposure on the exception book.`,
          source: "Planning · stocking policy",
        },
        {
          label: "Read what runs itself",
          text: `${pct(p.autoRate)} of the ${p.exceptions} exceptions route themselves; the rest wait on a planner.`,
          source: "Atlas · policy engine",
        },
      ],
      lines: [
        `${money(p.atRisk)} sits on positions that are short or long. Inventory Planning's nine-box says where it is concentrated.`,
      ],
      tiles: [
        { label: "Fill rate", value: pct(p.fill), tone: p.fill >= 0.95 ? "good" : "behind" },
        { label: "At risk", value: money(p.atRisk), tone: "behind" },
        { label: "Auto-routed", value: pct(p.autoRate), tone: "good" },
      ],
      continueLink: { label: "Open Inventory Planning", href: "/planning/parts" },
      prompts: ["Where is the exposure concentrated?", "Which cells are critical?", "What is holding fill below target?"],
    };
  }

  if (tower === "abc") {
    const mix = abcMix();
    const a = mix[0];
    const heaviest = [...mix].sort(
      (x, y) => y.inventoryShare - y.turnoverShare - (x.inventoryShare - x.turnoverShare),
    )[0];
    const gap = (heaviest.inventoryShare - heaviest.turnoverShare) * 100;
    return {
      title: "Inventory against turnover, by class",
      intro: "On it. Where the stock value sits.",
      steps: [
        {
          label: "Ranked the book by value",
          text: `${a.skus} positions carry ${pct(a.turnoverShare)} of annual turnover and hold ${pct(a.inventoryShare)} of the stock — that is class A, cut at 80% of cumulative value.`,
          source: "Planning · ABC by cumulative value",
        },
        {
          label: "Compared the two shares",
          text:
            Math.abs(gap) < 0.5
              ? "Every class holds about as much stock as it sells. Nothing is standing still and nothing is being run thin."
              : `Class ${heaviest.abc} holds ${gap.toFixed(1)} points more of the stock than of the demand — ${money(Math.round(heaviest.inventory * (gap / 100)))} of capital sitting still.`,
          source: "Atlas · mix read",
        },
      ],
      lines: [
        "Both bars are shares of the same book, which is the only thing that makes them comparable. Turnover is at cost, not at price.",
      ],
      tiles: mix.map((m) => ({
        label: `Class ${m.abc}`,
        value: money(m.inventory),
        tone: m.inventoryShare > m.turnoverShare ? ("behind" as const) : ("good" as const),
      })),
      continueLink: { label: "Open Inventory Planning", href: "/planning/parts" },
      prompts: [
        "Which class is heaviest against its demand?",
        "What would trimming class C release?",
        "How is A cut?",
      ],
    };
  }

  if (tower === "balance") {
    const short = inventoryBalance("stockout");
    const long = inventoryBalance("overstock");
    const worstShort = short[0];
    const worstLong = long[0];
    const shortTotal = short.reduce((sum, b) => sum + b.value, 0);
    const longTotal = long.reduce((sum, b) => sum + b.value, 0);
    return {
      title: "Under-stock and over-stock, by DC",
      intro: "On it. Both directions.",
      steps: [
        {
          label: "Read what is short",
          text: `${money(shortTotal)} of revenue cannot be served from stock on hand. ${worstShort.branch} carries the most of it — ${worstShort.products} positions, ${worstShort.units.toLocaleString("en-US")} units under target.`,
          source: "Planning · positions under target",
        },
        {
          label: "Read what is long",
          text: `${money(longTotal)} of capital sits above target, worst at ${worstLong.branch}. A DC usually appears on both lists: short on what sells and long on what does not.`,
          source: "Planning · positions over target",
        },
      ],
      lines: [
        "Short is revenue that cannot be served; long is capital that cannot be spent — and on the dated grocery book, long stock has a write-off date printed on it. Same arithmetic, opposite consequence.",
      ],
      tiles: [
        { label: "Short", value: money(shortTotal), tone: "behind" },
        { label: "Long", value: money(longTotal), tone: "behind" },
        { label: "Worst DC", value: worstShort.branch },
      ],
      continueLink: { label: "Open Inventory Planning", href: "/planning/parts" },
      prompts: [
        "Which DC should I fix first?",
        "Can we transfer rather than buy?",
        "What is long that we should stop buying?",
      ],
    };
  }

  if (tower === "suppliers") {
    const top = topSuppliers(6);
    const lead = top[0];
    const worst = [...top].sort((x, y) => x.otif - y.otif)[0];
    const concentration = top.slice(0, 3).reduce((sum, v) => sum + v.spendShare, 0);
    return {
      title: "Where the spend sits, and who delivers against it",
      intro: "On it. The supplier book.",
      steps: [
        {
          label: "Read the concentration",
          text: `The three dearest sites hold ${pct(concentration)} of annual spend. ${lead.label} alone is ${money(lead.spend)}.`,
          source: "Buying · supplier book",
        },
        {
          label: "Read fill against on-time",
          text: `${worst.label} is the softest — ${worst.fillRate}% filled complete against ${worst.otif}% on time in full. The gap between those two is volume that arrived complete and arrived late.`,
          source: "Atlas · delivery read",
        },
      ],
      lines: [
        "OTIF is the joint measure, so it can only be the lower of the pair. A wide gap is a lead-time problem; a low fill rate is a capacity one.",
      ],
      tiles: [
        { label: "Top three", value: pct(concentration) },
        { label: "Softest OTIF", value: `${worst.otif}%`, tone: "behind" },
        { label: "Largest site", value: money(lead.spend) },
      ],
      continueLink: { label: "Open the supplier book", href: BUYING_ROUTES.suppliers },
      prompts: [
        "Who is single-sourced?",
        "Which supplier is slipping?",
        "Where is the Section 301 exposure?",
      ],
    };
  }

  if (tower === "transport") {
    const card = transportScorecard();
    const behind = card.filter((m) => !m.ahead);
    const ahead = card.filter((m) => m.ahead);
    return {
      title: "Transport against plan",
      intro: "On it. The freight book.",
      steps: [
        {
          label: "Read cost against plan",
          text:
            ahead.length > 0
              ? `${ahead.map((m) => m.label.toLowerCase()).join(" and ")} ${ahead.length === 1 ? "is" : "are"} inside plan — ${ahead.map((m) => `${m.value} against ${m.plan}`).join(", ")}.`
              : "Nothing on this card is inside plan.",
          source: "Transport · lane and load book",
        },
        {
          label: "Read what it cost to get there",
          text:
            behind.length > 0
              ? `${behind.length} of ${card.length} measures are behind, and they are the service and asset ones: ${behind.map((m) => `${m.label.toLowerCase()} ${m.value} against ${m.plan}`).join("; ")}.`
              : "Every measure is inside plan.",
          source: "Atlas · plan variance",
        },
        {
          label: "Named the trade",
          text:
            ahead.length > 0 && behind.length > 0
              ? "The bill is coming down and the promise is going with it. That is a trade somebody made, not an accident — and it is the one decision on this page that belongs to this seat rather than to a desk."
              : "No trade to name this month.",
          source: "Atlas · priority read",
        },
      ],
      lines: [
        "Every figure here is derived from the lane and load book. The plan column is authored, and is labelled a plan rather than a measurement.",
      ],
      tiles: card.slice(0, 3).map((m) => ({
        label: m.label,
        value: m.value,
        tone: m.ahead ? ("good" as const) : ("behind" as const),
      })),
      continueLink: { label: "Open lanes & rates", href: LOGISTICS_ROUTES.lanes },
      prompts: [
        "Which lane is running the wrong option?",
        "What is the avoidable share?",
        "Why is on-time behind?",
      ],
    };
  }

  /* The whole-book overview. */
  const b = buyingFigures();
  const s = serviceFigures();
  const l = logisticsFigures();
  const p = planningFigures();
  const cts = recoverableCost();
  const risk = valueAtRisk();
  return {
    title: "Where the month stands",
    intro: "On it. The whole book.",
    steps: [
      {
        label: "Read the four towers",
        text: `Buying ${money(b.spend)} under management, service ${money(s.openValue)} of revenue open, transport ${money(l.inFlight)} in flight, planning ${pct(p.fill)} fill.`,
        source: "Atlas · cross-tower read",
      },
      {
        label: "Split cost from exposure",
        text: `${money(cts)} recoverable this month — unsettled claims, lanes routed by habit, trailers accruing detention. Separately, ${money(risk)} of stock exposure standing behind positions under target.`,
        source: "Atlas · recoverable cost",
      },
      {
        label: "Found where to look first",
        text:
          s.onTime < 90
            ? `Service is the softest number — on-time at ${pct100(s.onTime)} puts revenue on the promise. That is the tower to open first.`
            : l.habit > 0
            ? `Transport carries the most recoverable money — ${money(l.habit)} a year in the cost of habit.`
            : `Buying is where the value is — ${money(b.committed)} committed, landing on pace.`,
        source: "Atlas · priority read",
      },
    ],
    lines: [`${money(cts)} recoverable this month against ${money(risk)} of stock exposure. The split below names the desk that owns each slice.`],
    tiles: [
      { label: "Realized savings", value: money(b.realized), tone: "good" },
      { label: "Revenue at risk", value: money(s.openValue), tone: s.onTime >= 90 ? "quiet" : "behind" },
      { label: "Recoverable", value: money(cts), tone: "behind" },
      { label: "Value at risk", value: money(risk), tone: "behind" },
    ],
    continueLink: { label: "Open value realization", href: BUYING_ROUTES.value },
    prompts: [
      "Which tower needs me first?",
      "How much have we realized this quarter?",
      "What is the total cost-to-serve?",
    ],
  };
}

/** Build the Atlas task for a tower's "Explain" action. */
export function execTaskFor(
  tower: ExecTower,
  agent: string,
  /** The question actually pressed, and the measure it was about.
   *  Without these the run reported the tower's own read regardless of what was
   *  asked — press "Where is revenue against plan?" and the transcript said
   *  "Explain where the month stands", which is a different question answered
   *  without acknowledging the first. */
  asked?: { label?: string; measure?: string },
): AgentTask {
  const r = readFor(tower);
  /* The measure leads, then the read that explains it. A question named after a
     number should answer with that number before it answers with anything
     else. */
  const opening = asked?.measure ? measureLine(asked.measure) : "";
  return {
    id: `exec-${tower}`,
    label: "Explain",
    ask: asked?.label ?? `Explain ${r.title.toLowerCase()}`,
    intro: r.intro,
    icon: "commit",
    actAt: r.steps.length,
    steps: r.steps,
    outcome: {
      kind: "settled",
      /* Named after the measure where one was asked about, so the card is not
         headed "Where the month stands" over an answer about revenue. The read
         underneath is still the tower's; the heading just says which number
         sent the reader to it. */
      title: `${agent} — ${(asked?.measure && measureLabel(asked.measure)) ?? r.title}`,
      lines: opening ? [opening, ...r.lines] : r.lines,
      tiles: r.tiles,
      artifact: r.artifact,
      continueLink: r.continueLink,
      prompts: r.prompts,
    },
  };
}
