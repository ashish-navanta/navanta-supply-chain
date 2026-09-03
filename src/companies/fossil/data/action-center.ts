/* ═══════════════════════════════════════════════════════════════
 *  Fossil — exception queues
 *
 *  The order the workshop follows: 2,880 units of a licensed
 *  chronograph against a committed floor-set date, hit by a
 *  GEOPOLITICAL LEAD-TIME INCREASE — the Dongguan assembler's lead
 *  time jumps 10 days for the next three months — and arriving with
 *  TWO CARTONS CRUSHED in the consolidation.
 *
 *  Queues are cut on the exception engine, not on who holds the ball:
 *
 *    1 · Detected   the agent has done its part; this needs a person
 *    2 · Decide     reason and revised date captured; choose the move
 *    3 · Monitoring committed; watch it hold
 *
 *  Each seat has its own named agent — Mercer (buying), Iris
 *  (planning), Christy (service), Tova (logistics) — and the advisory
 *  line is written from that agent's point of view.
 * ═══════════════════════════════════════════════════════════════ */

import { PERSONAS, type Persona } from "@/types/persona";
import { noticeTail } from "./customer-notice";
import { skuLabel, styleByNumber } from "./catalogue";

/**
 * What the seat owes on a row. One list, sectioned by this — not tabs, because
 * a queue answers one question ("what needs me") and making you click between
 * three answers to it was navigation for its own sake.
 */
export type State = "decide" | "waiting" | "settled";

/** How a state reads to the person. Single-sourced so the queue's tab counts
 *  and the modals' detail panels can't drift apart. */
export const STATE_LABEL: Record<State, string> = {
  decide: "Needs a decision",
  waiting: "Waiting on the counterparty",
  settled: "Settled",
};

export type Signal =
  | "lead-time-jump"
  | "silent-po"
  | "capacity"
  | "replan"
  | "safety-stock"
  | "pr-limit"
  | "options-drafted"
  | "awaiting-customer"
  | "alternate-accepted"
  | "dealer-counter"
  | "damage"
  | "eta-conflict"
  | "carrier-choice"
  | "pickup-window"
  | "recovery"
  | "backhaul"
  | "overstock"
  | "aging"
  | "second-source-quote"
  | "lead-time-accepted"
  | "lead-time-overridden"
  | "rebalanced"
  | "alternate-shipped"
  | "dispatched"
  | "delivered-clean"
  | "settled";

/**
 * The coarse taxonomy shown in the Cause column and the filter. Deliberately
 * short: the detailed `Signal` above says exactly what happened and drives the
 * advisory copy, while `Cause` says what KIND of problem it is so you can
 * filter one event across seats — the same Supply constraint appears on the
 * buyer's PO, the planner's coverage gap and the service rep's order.
 */
export type Cause =
  | "supply"
  | "shortfall"
  | "excess"
  | "awaiting"
  | "cost"
  | "status"
  | "damage";

/* The vocabulary a planner or a logistics coordinator already uses, rather
   than a description of the row invented here. "Cost or policy" and "Status
   conflict" in particular were ours, not theirs: the first is a cost variance,
   the second is an in-transit exception, and both are terms a Fossil reader can
   act on without translating. E&O is the standard pairing for excess, and a
   shortfall is always a shortfall of cover at a node. */
export const CAUSE_LABEL: Record<Cause, string> = {
  supply: "Supply constraint",
  shortfall: "Coverage shortfall",
  excess: "Excess & obsolete",
  awaiting: "Awaiting confirmation",
  cost: "Cost variance",
  status: "In-transit exception",
  damage: "Damage & claims",
};

/**
 * The same cause worn as a status.
 *
 * A summary card names a category — "Coverage shortfall" answers "what kind of
 * problem do I have four of". A status cell names the state one line is in, and
 * there the qualifier is already established by the columns either side of it:
 * the row says days of cover and a safety-stock insight, so "Coverage" is a word
 * the reader pays for twice. Kept beside `CAUSE_LABEL` and complete rather than
 * a partial override, so the pair can be read at a glance and neither can
 * quietly lose an entry.
 */
export const CAUSE_STATUS: Record<Cause, string> = {
  supply: "Supply constraint",
  shortfall: "Shortfall",
  excess: "Excess stock",
  awaiting: "Awaiting reply",
  cost: "Cost variance",
  status: "In-transit exception",
  damage: "Damage claim",
};

/** Every signal rolls up to exactly one cause, so the two can't drift apart.
 *  A settled row keeps the cause of the thing that started it — that is what
 *  makes the thread followable after the decision is taken. */
export const SIGNAL_CAUSE: Record<Signal, Cause> = {
  "lead-time-jump": "supply",
  capacity: "supply",
  "options-drafted": "supply",
  "alternate-accepted": "supply",
  "dealer-counter": "supply",
  "lead-time-accepted": "supply",
  "lead-time-overridden": "supply",
  replan: "shortfall",
  "safety-stock": "shortfall",
  overstock: "excess",
  aging: "excess",
  "silent-po": "awaiting",
  "awaiting-customer": "awaiting",
  "second-source-quote": "awaiting",
  "pr-limit": "cost",
  "carrier-choice": "cost",
  backhaul: "cost",
  "eta-conflict": "status",
  "pickup-window": "status",
  recovery: "status",
  rebalanced: "excess",
  "alternate-shipped": "supply",
  dispatched: "status",
  "delivered-clean": "status",
  damage: "damage",
  settled: "damage",
};

export function causeOf(signal: Signal): Cause {
  return SIGNAL_CAUSE[signal];
}

/** Human label for the detailed signal — kept for search and tooling. */
/**
 * How many days a supplier moved the lead time out by in this story. Declared
 * here, above the rows, because `R` reads it while building each row's advisory
 * line — and exported so the modal's recommendation, the PO panel and the queue
 * copy all derive the shift from one number instead of each guessing.
 */
export const SLIP_DAYS = 10;

export interface InsightCtx {
  /** The reference upstream of this line, where naming it explains the row. */
  upstream?: string;
  state?: State;
  /** Days of lead-time increase, delay, or cover remaining. */
  days?: number;
  /** Months the new lead time applies for. */
  months?: number;
  /** Units — units short, damaged, over target. */
  units?: number;
  /** A specific SKU the line turns on — the substitute being proposed. */
  sku?: string;
  /** Dollar figure — exposure, saving, credit. */
  amount?: number;
  /** Counterparty name. */
  party?: string;
  /** Node, port or place. */
  place?: string;
  /** A formatted date. */
  date?: string;
  /** A second date, where a row carries two — options sent Monday, but the
   *  account can only hold to the 25th. One `date` would have to mean both. */
  holdTo?: string;
  /** Disagreeing ETA sources. */
  sources?: number;
  /** Orders or requisitions affected. */
  count?: number;
  /** Counterparty is Fossil-operated. */
  own?: boolean;
  /** The lead time before and after the supplier's request, in days. */
  leadFrom?: number;
  leadTo?: number;
}

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * The advisory line for a row, written as the seat's agent. Deterministic — a
 * pure function of cause plus a small numeric context, so the copy stays
 * reviewable.
 *
 * House style: what the agent already did, then what is left for the person,
 * separated by "·". The agent has usually acted before the row appears — the
 * line's job is to say what remains a human decision.
 */
/* ─── Dates, relative ─────────────────────────────────────────────────────
   A committed date only means something next to today: "23 Aug" is a fact,
   "in 11 days" is the reason to act on it now or not. */

/**
 * The demo's today, fixed.
 *
 * Not `new Date()`, deliberately. Every figure in this file is deterministic so
 * the story holds whenever it is shown — a real clock would make "in 11 days"
 * read differently in each rehearsal and go negative the week after, quietly
 * turning a queue of live decisions into a queue of missed ones.
 */
export const TODAY = "12 Aug";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Days before the first of each month, common year — the fixtures span Jul–Sep. */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** "23 Aug" → day of year. Null for anything that is not a calendar date.
 *  Exported for the executive book, which measures order-to-delivery across two
 *  of these strings — one calendar in the app, not a second one that could
 *  disagree with it about how many days August has. */
export function parseCalendar(value: string): number | null {
  const m = /^(\d{1,2}) ([A-Za-z]{3})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase());
  if (month < 0) return null;
  return MONTH_START[month] + Number(m[1]);
}

/** Day of year → "23 Aug". The inverse, so one calendar does both directions. */
function toCalendar(day: number): string {
  let month = 11;
  while (month > 0 && MONTH_START[month] >= day) month--;
  return `${day - MONTH_START[month]} ${MONTHS[month]}`;
}

const TODAY_DOY = parseCalendar(TODAY);

/**
 * The delivery window on LD-70398.
 *
 * It lives here, next to the row it belongs to, because three places say it and
 * one of them cannot be edited: the recording on that row states "between 8:00
 * and 11:00 AM" out loud. So the queue line, the follow-up prompt and the run's
 * own copy all read it from here — a window typed a second time somewhere else
 * is a window that will eventually disagree with the audio, and the audio is the
 * only version a reader can check.
 *
 * It was 2pm before the call was recorded, which is why `date` on that row is
 * built from `start` rather than carrying its own clock time.
 */
export const DELIVERY_WINDOW = { start: "08:00", end: "11:00", short: "8–11am" };

/** A trailing clock time, split off: "29 Aug 14:00" → "29 Aug" + "14:00". */
function splitClock(value: string): { date: string; time?: string } {
  const m = /^(.*?)\s+(\d{1,2}:\d{2})$/.exec(value.trim());
  return m ? { date: m[1], time: m[2] } : { date: value.trim() };
}

const RELATIVE_WORD: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 };

/**
 * Day of year for anything the fixtures write in a date field.
 *
 * The loads were written as "Today 14:00" and "Tomorrow 09:00" — readable, and
 * invisible to every date function in this file, which took them for
 * non-dates. So they had no relative line under them and sorted as unknowns.
 * Resolving the words here fixes the cell and the sort at once, rather than in
 * each place that reads a date.
 */
function dayOfYear(value: string): number | null {
  const { date } = splitClock(value);
  const word = RELATIVE_WORD[date.toLowerCase()];
  if (word !== undefined) return TODAY_DOY === null ? null : TODAY_DOY + word;
  return parseCalendar(date);
}

/**
 * The same moment as a calendar date, whatever it was written as.
 *
 * The date belongs on top and how far off it is underneath: "13 Aug" is the
 * fact a reader plans against, "tomorrow" is why they are looking now. Written
 * the other way round, the row said "Tomorrow 09:00" and left them counting
 * forward from a today they had to assume.
 *
 * The clock time is dropped. A queue is read at the scale of days — which of
 * these is late, which lands this week — and 09:00 against 14:20 answers a
 * question nobody was asking while making two adjacent rows look different when
 * they are both simply tomorrow. The appointment time still lives where it
 * matters, on the load's own record.
 */
/**
 * The calendar date N days from today.
 *
 * `absoluteDate` resolves what the fixtures WRITE — "29 Aug", "Tomorrow 09:00" —
 * and a lead time is neither. The demand deck needs "when would this land if it
 * were placed now", which is arithmetic on today rather than a parse.
 */
export function datePlus(days: number): string {
  return TODAY_DOY === null ? TODAY : toCalendar(TODAY_DOY + days);
}

export function absoluteDate(value: string): string {
  const day = dayOfYear(value);
  return day === null ? value : toCalendar(day);
}

/** Whole days from today. Negative is in the past. Null when undatable. */
export function daysFromToday(value: string): number | null {
  const then = dayOfYear(value);
  const now = dayOfYear(TODAY);
  return then === null || now === null ? null : then - now;
}

/** "19 Aug" + 10 → "29 Aug". Same calendar the rest of this file uses. */
export function shiftDate(value: string, days: number): string {
  const start = dayOfYear(value);
  return start === null ? value : toCalendar(start + days);
}

/** The line under a date — "in 11 days", "today", "3 days ago". */
export function relativeDay(value: string): string {
  const n = daysFromToday(value);
  if (n === null) return "";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function insightText(signal: Signal, ctx: InsightCtx = {}): string {
  switch (signal) {
    case "lead-time-jump":
      /* Names the shift being asked for rather than a bare "+10d": the two
         figures are the decision, and they match what Approve commits because
         both come from the row's own lines. No "4 moves costed" — the decision
         is one number to confirm or override, not a menu. */
      return `Lead time ${ctx.leadFrom ?? 0} → ${ctx.leadTo ?? 0} days for ${ctx.months ?? 3} months`;

    case "silent-po":
      /* No "escalated to you": the line is already in this person's queue, so
         saying it was escalated to them states the obvious. What is useful is
         how long it has been silent, and that there is still no date to commit.
         Factory or supplier makes no difference to the move — the party column
         already says which it is. */
      return `Silent ${ctx.days ?? 3} days · chase lead time`;

    case "capacity":
      /* No second source: re-sourcing is not one of the buyer's options, so
         offering it in the queue line promised a screen that does not exist. */
      return `Capped for ${ctx.months ?? 3} months · lead time ${ctx.leadFrom ?? 0} → ${ctx.leadTo ?? 0} days`;

    case "replan":
      return `Coverage replanned for +${ctx.days ?? 10}d · ${ctx.count ?? 0} requisitions raised`;

    case "safety-stock":
      /* The move, and nothing else. Every clause this used to carry is already a
         column on the row — days on hand, the policy's cover, the lead time that
         moved and the order it moved on — so the line was reading the table back
         to somebody looking at it, and got clipped at two lines for the trouble.
         What no column shows is the number to write. */
      return `Change safety stock ${ctx.count ?? 0} → ${ctx.units ?? 0}`;

    case "pr-limit":
      return `Requisition ${usd(ctx.amount ?? 0)} · over your limit, needs approval`;

    case "options-drafted":
      /* Names the delay the same way the buying line does, because it is the
         same delay — a workshop should be able to read both screens and see one
         event, not two coincidences. Christy has already called and the account
         has answered; what is left is the write. */
      return `Lead time out ${ctx.days ?? 10}d · account chose to wait, re-promise`;

    case "alternate-accepted":
      /* Two moves, one answer: the substitute that saves the floor-set and the date
         to put on the rest. The account has said what they will take; what is left
         is a rep letting both through. Named with the SKU, because "an alternate"
         is a category and MK5605-5799 is a decision. */
      /* What the swap is worth, not what filing it involves.
         "Confirm alternate X and accept 6 Sep as the promise date" named two
         writes and a date the row already shows in its own ETA column — a line
         a reader has to translate before it means anything. The alternate is on
         hand and beats the original by four days, which is the whole reason
         this row exists, so that is the sentence. */
      return ctx.sku
        ? `Confirm alternate ${ctx.sku} to save ${ctx.days ?? 4} days`
        : `Alternate accepted · floor-set date holds, confirm the swap`;

    case "dealer-counter":
      /* A counter is not a refusal — it is a shorter slip the account can absorb,
         and it is worth more to the buying desk than a yes. */
      return `Can hold to ${ctx.holdTo ?? "25 Aug"} only · part now, rest to follow`;

    case "awaiting-customer":
      return `Options sent ${ctx.date ?? "yesterday"} · no answer yet, chase account`;

    case "damage":
      if (ctx.state === "decide" && ctx.units)
        return `${ctx.units ?? 48} units damaged in the consolidation · photos in, charge carrier`;
      return `Claim built from the order and receipt · ${usd(ctx.amount ?? 0)} ready, question lot`;

    case "eta-conflict":
      return `${ctx.sources ?? 3} ETAs differ ${ctx.days ?? 6}h · reconcile ETA`;

    case "carrier-choice":
      return `Intermodal beats team dray by ${usd(ctx.amount ?? 0)} on real cost · assign carrier`;

    case "pickup-window":
      return `Out for delivery at ${ctx.date ?? DELIVERY_WINDOW.short} · confirm window`;

    case "recovery":
      return `Going wrong · customer warned early, cost recovery`;

    case "backhaul":
      return `Co-loading the HK consolidation saves ${usd(ctx.amount ?? 0)} · book space`;

    case "overstock":
      return `${ctx.units ?? 0} over target at ${ctx.place ?? "this node"} · transfer, no PO needed`;

    case "aging":
      return `${ctx.days ?? 180}d on hand · ${usd(ctx.amount ?? 0)} tied up, mark down`;

    case "second-source-quote":
      return `Quote requested ${ctx.date ?? "yesterday"} · ${ctx.days ?? 2}d out, chase quote`;

    /* The two things a settled buyer row can be: the supplier's figure taken as
       quoted, or the buyer's own figure written over it. The old trio — absorbed,
       compressed, re-sourced — described moves the decision no longer offers, so
       the Settled tab was advertising a UI that had been removed. */
    case "lead-time-accepted":
      return `Lead time ${ctx.days ?? 0} days accepted · handed to planning, ${ctx.count ?? 0} requisitions raised`;

    case "lead-time-overridden":
      return `Lead time set to ${ctx.days ?? 0} days · your override, reason logged`;

    case "rebalanced":
      return `Rebalanced · ${ctx.units ?? 0} units moved, cover restored at both nodes`;

    case "alternate-shipped":
      return `Alternate accepted · shipped ${ctx.date ?? "on time"}, floor-set date held`;

    case "dispatched":
      return `Dispatched on the reconciled ETA · customer notified of the window`;

    case "delivered-clean":
      return `Delivered complete · checked on arrival, no exceptions raised`;

    case "settled":
      return `Settled · credit issued, invoice corrected, customer made whole`;

    default:
      return "";
  }
}

/* ─── Row model ──────────────────────────────────────────────── */

/**
 * Coverage facts for a planner row. The planner works SKUs at nodes, never POs:
 * once the buyer accepts a longer lead time, the consequence lands here as a
 * safety-stock level that no longer covers the replenishment window.
 */
/* ─── Stocking policy, derived ────────────────────────────────────
 * Every figure on a planner row used to be authored, and only one of
 * them held up. `coverDays` really was on-hand ÷ daily demand. The
 * rest did not survive being checked:
 *
 *   `safetyNow` was on-hand copied. Its days-of-safety equalled the
 *   days of cover on every row — 6/6, 4/4, 12/12, 44/44 — which is not
 *   a policy, it is the same number twice.
 *
 *   Safety was ordered backwards by class. The AX lines carried the
 *   FEWEST days of buffer (7 and 10) and a CZ line carried 44, while
 *   the comment above `classification` said an AX line earns a buffer
 *   a CZ line does not.
 *
 *   `min` was an expedite floor forty times below its own reorder
 *   point — 7 units against 303 — so it could never trigger.
 *
 *   And nothing said what the cover SHOULD be, which is the number the
 *   row is actually about: 6 days reads as "low" when what it means is
 *   "6 against the 55 this lead time now needs".
 *
 * So it is computed. Author the primitives — demand, the lead time,
 * the class, the pack multiple — and let the policy fall out.
 * ─────────────────────────────────────────────────────────────── */

/**
 * How much buffer a class earns, as a fraction of its replenishment window.
 *
 * Two axes, both in the same direction. Value first: an A line is the revenue
 * and gets protected, a C line does not earn the working capital. Then
 * variability: an X line is predictable enough to run thin, a Z line is not, so
 * it needs cover for the weeks it surprises you.
 *
 * A fraction of the lead time rather than a flat number of days, because that is
 * what makes the buffer move when the lead time does — which is the entire
 * consequence the buyer's commit is supposed to have on this desk. A flat policy
 * would leave the planner with nothing to re-size.
 */
const SAFETY_FACTOR: Record<Classification, number> = {
  AX: 0.28, AY: 0.34, AZ: 0.40,
  BX: 0.22, BY: 0.28, BZ: 0.34,
  CX: 0.16, CY: 0.22, CZ: 0.28,
};

/** Days of buffer this class earns against a given replenishment window. */
export function safetyDaysFor(classification: Classification, leadDays: number): number {
  return Math.round(leadDays * SAFETY_FACTOR[classification]);
}

/** The buffer itself, in the row's unit. */
export function safetyStockFor(
  classification: Classification,
  leadDays: number,
  dailyDemand: number,
): number {
  return Math.round(safetyDaysFor(classification, leadDays) * dailyDemand);
}

/**
 * What the cover has to be: the whole replenishment window plus its buffer.
 *
 * The number the planner is working towards, and the one the queue never showed.
 * Cover of 6 days against a 42-day lead time is not "a bit short" — it is a
 * stock-out five weeks before the replenishment can land.
 */
export function targetCoverDays(cover: SkuCover): number {
  return cover.leadDays + safetyDaysFor(cover.classification, cover.leadDays);
}

/**
 * How long an expedite takes, in days.
 *
 * Air freight out of Asia against sea freight, roughly. It is what makes an
 * expedite floor mean something: below this much stock, waiting for the ship is
 * no longer a choice.
 */
export const EXPEDITE_DAYS = 10;

/**
 * The floor that triggers an expedite.
 *
 * Demand across the expedite window, not an arbitrary handful of units. Below
 * it there is not enough on the shelf to last even the fast option, so the
 * decision stops being "when do I reorder" and becomes "what do I fly".
 */
export function expediteFloor(dailyDemand: number): number {
  return Math.round(dailyDemand * EXPEDITE_DAYS);
}

/**
 * A planner row's whole stocking policy, from its primitives.
 *
 * `safetyNow` is what the policy WAS sized for — the lead time before the factory
 * moved it — and `safetyNeeded` is what the same policy asks for now. The
 * difference between them is the planner's job, and deriving both from one
 * function is what stops it being two authored numbers that happen to differ.
 */
export function coverFor(opts: {
  onHand: number;
  dailyDemand: number;
  leadDays: number;
  wasLeadDays: number;
  moq: number;
  classification: Classification;
  supplier: string;
  incoming: number;
}): SkuCover {
  const { onHand, dailyDemand, leadDays, wasLeadDays, classification } = opts;
  return {
    coverDays: Math.round(onHand / dailyDemand),
    safetyNow: safetyStockFor(classification, wasLeadDays, dailyDemand),
    safetyNeeded: safetyStockFor(classification, leadDays, dailyDemand),
    dailyDemand,
    min: expediteFloor(dailyDemand),
    moq: opts.moq,
    supplier: opts.supplier,
    leadDays,
    wasLeadDays,
    classification,
    incoming: opts.incoming,
  };
}

/**
 * The reorder point: place the order when on-hand falls to here.
 *
 * `demand over the lead time + safety stock`, and derived rather than stored
 * because the two are not the same thing and the difference is easy to lose.
 * Safety stock is a buffer against variability; the reorder point is the
 * trigger, and it has to also cover everything that will be consumed while the
 * replenishment is in transit. The fixture used to carry a hand-written `rop`
 * that sat BELOW safety stock on every planner row — arithmetically impossible,
 * and the first thing a planner would notice. Raising safety stock moves this
 * one-for-one, which is why the run says so.
 */
export function reorderPoint(cover: SkuCover, safety = cover.safetyNow): number {
  return Math.round(cover.dailyDemand * cover.leadDays) + safety;
}

/**
 * ABC × XYZ — value against demand variability.
 *
 * Declared here rather than in `planning.ts` because the queue needs it too and
 * planning already depends on this module; the other direction would be a cycle.
 * One declaration, so the letter on a queue row and the letter in the nine-box
 * cannot come to mean different things.
 */
export type Classification =
  | "AX" | "AY" | "AZ"
  | "BX" | "BY" | "BZ"
  | "CX" | "CY" | "CZ";

export interface SkuCover {
  /** Days of cover the on-hand quantity gives at current demand. */
  coverDays: number;
  /** Safety stock as it stands, in the row's unit. */
  safetyNow: number;
  /** What the accepted lead time requires. */
  safetyNeeded: number;
  /**
   * Units consumed a day at this node, which is what turns a lead time into a
   * quantity. Matches on-hand ÷ days of cover, the two figures the queue
   * already shows, so nothing here can contradict the table.
   */
  dailyDemand: number;
  /**
   * The floor that triggers an expedite. Below safety stock by definition —
   * safety stock is the buffer, this is what is left when the buffer is gone.
   */
  min: number;
  /** The multiple the factory ships in — an override has to land on it. */
  moq: number;
  /** Who supplies it, and the lead time that moved. */
  supplier: string;
  leadDays: number;
  wasLeadDays: number;
  /**
   * The ABC × XYZ class this position carries at this branch.
   *
   * The same axis Inventory Planning classifies on — value against demand
   * variability — because it is what decides how hard the policy should work:
   * an AX line earns a buffer an CZ line does not, and a planner reading the
   * queue is asking that question about every row.
   */
  classification: Classification;
  /** Already on order and inbound, in the row's unit. */
  incoming: number;
}

/**
 * Claim facts for a service row. A damage claim is settled from records Fossil
 * already holds — the order, the delivery receipt, the batch, the photos — so the
 * rep's job is to check the adjudication and release the credit, not to assemble
 * the case.
 */
export interface ClaimFacts {
  /** Units damaged, in the row's unit. */
  damagedUnits: number;
  /** The credit the agent adjudicated, in dollars. */
  credit: number;
  /** What policy allows without a second signature. */
  policyCap: number;
  /** Photographs on file from the tailgate check. */
  photos: number;
  /** When it was delivered, and against which receipt and batch. */
  deliveredOn: string;
  receipt: string;
  batch: string;
}

export interface ActionRow {
  id: string;
  state: State;
  /** Primary reference — PO, style, order, load. */
  ref: string;
  /** Secondary line under the reference. */
  refSub: string;
  /** Counterparty — supplier, factory, node, account, carrier. */
  party: string;
  /** True when the counterparty is Fossil-operated. */
  partyOwn: boolean;
  /** Product / style — searchable, not shown (a PO spans several SKUs). */
  product: string;
  /** Quantity, split so the cell stacks the figure over its unit. */
  qtyValue: string;
  qtyUnit: string;
  date: string;
  /**
   * The date the order was originally committed to, where one exists. Held
   * explicitly rather than derived from `date`: on a decide row `date` carries
   * the REVISED promise and on a waiting row it carries elapsed time, so the
   * queue column had been showing three different things under one heading.
   */
  committedOn?: string;
  /** Descriptive state — searchable; the insight leads with it. */
  status: string;
  /** Exactly what happened. Drives the advisory copy. */
  signal: Signal;
  value: number;
  action: string;
  insight: string;
  /** Present on planner rows — the coverage maths behind the alert. */
  cover?: SkuCover;
  /** Present on service claim rows — the adjudication behind the credit. */
  claim?: ClaimFacts;
  /**
   * The reference this line descends from, where it descends from one.
   *
   * One factory slipping is four people's morning: the buyer commits the date, the
   * planner re-sizes the buffer the longer lead time now needs, the CSR
   * re-promises the account waiting on it, and logistics settles the damage when
   * it finally lands. That is one shipment, and it was only findable here by
   * matching on style — which broke the moment two seats named the same product
   * differently ("Bradshaw Chronograph 43" against "Soft surface ·
   * Commercial"). Named explicitly, the chain is navigable instead of inferred.
   */
  chainFrom?: string;

  /**
   * The row this seat opens on, ahead of whatever the sort would have chosen.
   *
   * A demo is walked, not browsed. The queue's own order — biggest exposure
   * first — is the right default for someone working it, and the wrong one for
   * someone being shown it, because the row that carries the story is rarely the
   * row with the largest number on it. Faking the story row to the top by
   * inflating its value would put a lie in the data to fix a problem in the
   * presentation; this says what it is instead, and the reader can still sort by
   * any column to get the honest ranking back.
   */
  lead?: boolean;
}

/* ─── Line items ─────────────────────────────────────────────────
 * A PO spans several SKUs (which is why the queue has no Product
 * column). The decision modal shows the breakdown so the person can
 * see what the money is made of before choosing a move.
 * ─────────────────────────────────────────────────────────────── */

export interface RowLine {
  sku: string;
  name: string;
  qty: number;
  unit: string;
  /** Lead time against this line, in days — carries the +10d story. */
  leadDays: number;
  value: number;
}

/* ─── One style, one SKU family ────────────────────────────────────
 * The planner's queue and the service order lines already name the
 * SKU behind each style, and they agree with each other. The buyer's
 * line breakdown used to hash its own, so the same Runway was
 * one style number in the planning seat and another in the buying seat —
 * two numbers for one product, which is exactly the disagreement
 * every derived figure in this app exists to avoid.
 *
 * So the base is looked up, and the colourway variants count up from
 * it. The first line of a PO is the style's canonical SKU, which is
 * the one a planner or a CSR would quote back.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Each style in this fixture, on the catalogue product it actually is.
 *
 * The book these rows describe is Fossil's own — the watch book out of Michael Kors,
 * Fossil and Zodiac — so the styles map onto real style
 * numbers and the SKUs become real ordering references: MK5605-5605 is the
 * Bradshaw in Gold, and it says so because the catalogue says so.
 *
 * What this replaces was arithmetic. A made-up base number per style plus an
 * index gave "00318-2205", which meant "the second colourway of Modal" and could
 * not answer which finish, what size the case is, or what movement it carries —
 * so every surface that wanted any of that invented it locally.
 */
const CATALOGUE_STYLE: Record<string, string> = {
  "Bradshaw Chronograph 43": "MK5605",
  "Runway 38": "MK7108",
  "Parker Leather 39": "MK2980",
  "Darci 33": "MK3192",
  "Grant Chronograph 44": "FS4735",
  "Neutra Automatic 44": "ME3184",
  "Jacqueline 36": "ES3843",
  "Super Sea Wolf 53 Compression": "ZO9204",
};

/**
 * The SKU for a style, and the SKUs of its colourway variants.
 *
 * A style not on the list still gets a stable number rather than a blank — the
 * fixtures grow, and a missing key should degrade to a plausible SKU rather
 * than to "undefined-01".
 */
export function skuForStyle(style: string, variant = 0): string {
  const number = CATALOGUE_STYLE[style];
  const product = number ? styleByNumber(number) : undefined;
  if (product) {
    /* Wrapping rather than clamping: a purchase order that splits into more
       lines than the style has colourways should come back round the book, not
       pile every extra line onto the last colour. */
    const c = product.colourways[variant % product.colourways.length];
    return `${product.style}-${c.number}`;
  }
  /* A style the catalogue does not carry still gets a stable reference rather
     than a blank — fixtures grow, and a missing key should degrade to something
     plausible rather than to "undefined-01". */
  let h = 0;
  for (let i = 0; i < style.length; i++) h = (h * 31 + style.charCodeAt(i)) % 100003;
  return `${String(50000 + (h % 9000))}-${String(70000 + ((h * 7) % 9000) + variant)}`;
}

/**
 * Deterministic SKU breakdown of a row: same row, same lines, every render —
 * the same rule as `insightText`, so the demo never shifts under you. Quantity
 * and value split on fixed descending weights and the remainders land on the
 * first line, so the lines always sum exactly to the row.
 */
export function linesFor(row: ActionRow): RowLine[] {
  const seed = [...row.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const total = Math.max(1, parseInt(row.qtyValue, 10) || 1);
  // 2 units can't split five ways: never more lines than units.
  const n = Math.min(3 + (seed % 3), total);

  // The lead time the line currently plans against. Constrained supply rows
  // carry the moved date on every line — that is the whole point of the story.
  const slipped = causeOf(row.signal) === "supply";
  const baseLead = slipped ? 40 : 21;

  const weights = Array.from({ length: n }, (_, i) => n - i);
  const wSum = weights.reduce((a, b) => a + b, 0);

  let qtyLeft = total;
  let valueLeft = row.value;
  return weights.map((w, i) => {
    const last = i === n - 1;
    const qty = last ? qtyLeft : Math.max(1, Math.round((total * w) / wSum));
    const value = last ? valueLeft : Math.round((row.value * w) / wSum);
    qtyLeft -= qty;
    valueLeft -= value;
    /* The line's name comes off the SKU, not from a parallel list of colourway
       words. Those two had already drifted: the number said MK5605-5605, which
       is Road Trip, while the label beside it said Walnut Ember — a made-up
       colourway from a made-up axis, printed against a real reference. One
       lookup, so a line cannot name a colour its own SKU does not have. */
    const sku = skuForStyle(row.product, i);
    return {
      sku,
      name: skuLabel(sku),
      qty,
      unit: row.qtyUnit,
      leadDays: baseLead + ((seed + i * 3) % 3),
      value,
    };
  });
}

const R = (row: Omit<ActionRow, "insight">, ctx: InsightCtx = {}): ActionRow => {
  /* Supply rows carry the lead-time shift in their advisory line. Deriving it
     from `linesFor` — the same source the modal and the Approve button read —
     keeps the queue copy and the committed figure from ever disagreeing. */
  const lead =
    causeOf(row.signal) === "supply"
      ? Math.max(...linesFor(row as ActionRow).map((l) => l.leadDays))
      : undefined;

  /* A planner row's three figures come off its own policy, never from a context
     passed in beside it. Hand-written ones had drifted the moment the policy was
     derived: the queue line read "Safety stock 38 → 62" under a button offering
     76, which is the same number disagreeing with itself one column apart. */
  const policy = row.cover
    ? {
        count: row.cover.safetyNow,
        units: row.cover.safetyNeeded,
        days: row.cover.coverDays,
      }
    : {};

  const built = {
    ...row,
    insight: insightText(row.signal, {
      state: row.state,
      own: row.partyOwn,
      ...policy,
      ...(lead === undefined ? {} : { leadTo: lead, leadFrom: lead - SLIP_DAYS }),
      ...ctx,
    }),
  } as ActionRow;

  /* Lazy, and it has to be: whether the customer was told is read off the
     service seat's own rows, which are declared further down this file and do
     not exist while the buying rows are being built. A getter defers the lookup
     to first read, by which point every queue is initialised. */
  return {
    ...built,
    get insight() {
      return built.insight + noticeTail(built);
    },
  };
};

/* ─── Buying · Mercer ────────────────────────────────────────── */

const BUYER: ActionRow[] = [
  /* Decisions — Mercer has notified and updated; the commercial call is yours */
  R({
    id: "b1", state: "decide", ref: "PO-4471", refSub: "Geopolitical lead-time increase",
    party: "Qi Guang Watch", partyOwn: false,
    product: "Runway 38",
    qtyValue: "2880", qtyUnit: "units", date: "22 Aug", committedOn: "12 Aug",
    status: "Lead time +10d",
    signal: "lead-time-jump", value: 286400, action: "Decide",
  }, { days: 10, months: 3 }),

  R({
    id: "b2", state: "decide", ref: "PO-4488", refSub: "Geopolitical lead-time increase",
    party: "Renley Watch Mfg", partyOwn: false,
    product: "Grant Chronograph 44",
    qtyValue: "2016", qtyUnit: "units", date: "30 Aug", committedOn: "20 Aug",
    status: "Lead time +10d",
    signal: "lead-time-jump", value: 198200, action: "Decide",
  }, { days: 10, months: 3 }),

  R({
    id: "b3", state: "decide", ref: "PO-4463", refSub: "Line capacity capped",
    party: "Qi Guang Watch", partyOwn: false,
    product: "Bradshaw Chronograph 43",
    qtyValue: "4800", qtyUnit: "units", date: "2 Sep", committedOn: "23 Aug",
    status: "Capacity capped",
    signal: "capacity", value: 412000, action: "Decide",
  }, { months: 3, days: 10 }),

  R({
    id: "b5", state: "waiting", ref: "PO-4515", refSub: "Firm date requested",
    party: "Renley Watch Mfg", partyOwn: false,
    product: "Neutra Automatic 44",
    qtyValue: "1152", qtyUnit: "units", date: "3d ago", committedOn: "20 Aug",
    status: "No reply",
    signal: "silent-po", value: 96500, action: "Contact supplier",
  }, { days: 3 }),

  R({
    id: "b6", state: "waiting", ref: "PO-4529", refSub: "Second-source quote requested",
    party: "Qi Guang Watch", partyOwn: false,
    product: "Runway 38",
    qtyValue: "2880", qtyUnit: "units", date: "2d ago", committedOn: "27 Aug",
    status: "Quote pending",
    signal: "second-source-quote", value: 286400, action: "Chase",
  }, { date: "Monday", days: 2 }),

  R({
    id: "b7", state: "waiting", ref: "PO-4547", refSub: "Firm date requested",
    party: "Renley Watch Mfg", partyOwn: false,
    product: "Darci 33",
    qtyValue: "1440", qtyUnit: "units", date: "2d ago", committedOn: "24 Aug",
    status: "No reply",
    signal: "silent-po", value: 118400, action: "Contact factory",
  }, { days: 2 }),

  /* Vendor performance — accepted conditions, and whether they hold */
  R({
    id: "b8", state: "settled", ref: "PO-4402", refSub: "Lead time accepted",
    party: "Qi Guang Watch", partyOwn: false,
    product: "Runway 38",
    qtyValue: "2304", qtyUnit: "units", date: "12 Aug", committedOn: "2 Aug",
    status: "Lead time accepted",
    signal: "lead-time-accepted", value: 229100, action: "Review",
  }, { days: 40, count: 3 }),

  R({
    id: "b9", state: "settled", ref: "PO-4418", refSub: "Lead time accepted",
    party: "Solan", partyOwn: true,
    product: "Super Sea Wolf 53 Compression",
    qtyValue: "1440", qtyUnit: "units", date: "6 Aug", committedOn: "27 Jul",
    status: "Lead time accepted",
    signal: "lead-time-accepted", value: 143200, action: "Review",
  }, { days: 38, count: 2 }),

  R({
    id: "b10", state: "settled", ref: "PO-4377", refSub: "Lead time overridden",
    party: "Qi Guang Watch", partyOwn: false,
    product: "Bradshaw Chronograph 43",
    qtyValue: "4800", qtyUnit: "units", date: "28 Jul", committedOn: "18 Jul",
    status: "Overridden",
    signal: "lead-time-overridden", value: 412000, action: "Review",
  }, { days: 36 }),
];

/**
 * What is on the water for a SKU, read off the buying desk's open orders.
 *
 * The planner's Incoming column was authored and did not match anything: SKU
 * MK5605-5605 showed 24 units while PO-4463 — the same style, the order this
 * whole walkthrough follows — has 67 units of that SKU inbound. Two seats
 * describing the same shipment with different numbers is the failure this app
 * keeps having to undo, and here it also understated the only good news on the
 * row by a factor of three.
 *
 * Settled purchase orders are excluded: a settled buyer row has reached "Received
 * at DC", so its goods are on hand and counting them again as inbound would
 * double the stock.
 */
function incomingFor(sku: string): number {
  return BUYER.filter((b) => b.state !== "settled").reduce(
    (total, b) => total + linesFor(b).filter((l) => l.sku === sku).reduce((n, l) => n + l.qty, 0),
    0,
  );
}

/* ─── Planning · Iris ────────────────────────────────────────── */

const PLANNER: ActionRow[] = [
  /* Every open row is the same exception: the buyer accepted a longer lead time,
     so the replenishment window grew and the safety stock behind these SKUs no
     longer covers it. The planner never sees the PO — only the SKU and the level
     that has to move. */
  R({
    /* The downstream half of PO-4463. The factory's 32 → 42 days is what makes 38
       units of buffer too little: safety stock is a lead time expressed as a
       quantity, so when the lead time moves the buffer has to. */
    id: "p1", state: "decide", ref: "Bradshaw Chronograph 43", refSub: "SKU MK5605-5605",
    party: "Dallas DC", partyOwn: true,
    product: "Bradshaw Chronograph 43",
    qtyValue: "912", qtyUnit: "units", date: "6 days",
    status: "Safety stock short",
    signal: "safety-stock", value: 286400, action: "Review",
    chainFrom: "PO-4463",
    cover: coverFor({
      onHand: 912, dailyDemand: 151, leadDays: 42, wasLeadDays: 32,
      moq: 96, classification: "AZ", supplier: "Qi Guang Watch",
      incoming: incomingFor("MK5605-5605"),
    }),
  }, { upstream: "PO-4463" }),

  R({
    id: "p2", state: "decide", ref: "Runway 38", refSub: "SKU MK7108-7110",
    party: "Dallas DC", partyOwn: true,
    product: "Runway 38",
    qtyValue: "1056", qtyUnit: "units", date: "4 days",
    status: "Safety stock short",
    signal: "safety-stock", value: 198200, action: "Review",
    cover: coverFor({
      onHand: 1056, dailyDemand: 264, leadDays: 40, wasLeadDays: 30,
      moq: 144, classification: "AY", supplier: "Qi Guang Watch",
      incoming: incomingFor("MK7108-7110"),
    }),
  }),

  R({
    id: "p3", state: "decide", ref: "Grant Chronograph 44", refSub: "SKU FS4735-4735",
    party: "Eggstätt DC", partyOwn: true,
    product: "Grant Chronograph 44",
    qtyValue: "0", qtyUnit: "units", date: "0 days",
    status: "Stocked out",
    signal: "safety-stock", value: 164800, action: "Review",
    cover: coverFor({
      onHand: 0, dailyDemand: 120, leadDays: 40, wasLeadDays: 30,
      moq: 144, classification: "AZ", supplier: "Renley Watch Mfg",
      incoming: incomingFor("FS4735-4735"),
    }),
  }),

  R({
    id: "p4", state: "decide", ref: "Neutra Automatic 44", refSub: "SKU ME3184-3184",
    party: "Dallas DC", partyOwn: true,
    product: "Neutra Automatic 44",
    qtyValue: "720", qtyUnit: "units", date: "12 days",
    status: "Safety stock short",
    signal: "safety-stock", value: 96500, action: "Review",
    cover: coverFor({
      onHand: 720, dailyDemand: 60, leadDays: 40, wasLeadDays: 30,
      moq: 96, classification: "BY", supplier: "Renley Watch Mfg",
      incoming: incomingFor("ME3184-3184"),
    }),
  }),

  R({
    id: "p5", state: "decide", ref: "Super Sea Wolf 53 Compression", refSub: "SKU ZO9204-9204",
    party: "Eggstätt DC", partyOwn: true,
    product: "Super Sea Wolf 53 Compression",
    qtyValue: "504", qtyUnit: "units", date: "9 days",
    status: "Safety stock short",
    signal: "safety-stock", value: 74300, action: "Review",
    cover: coverFor({
      onHand: 504, dailyDemand: 55, leadDays: 38, wasLeadDays: 28,
      moq: 72, classification: "BZ", supplier: "Qi Guang Watch",
      incoming: incomingFor("ZO9204-9204"),
    }),
  }),

  R({
    id: "p6", state: "decide", ref: "Jacqueline 36", refSub: "SKU ES3843-3843",
    party: "Dallas DC", partyOwn: true,
    product: "Jacqueline 36",
    qtyValue: "624", qtyUnit: "units", date: "11 days",
    status: "Safety stock short",
    signal: "safety-stock", value: 41800, action: "Review",
    cover: coverFor({
      onHand: 624, dailyDemand: 58, leadDays: 42, wasLeadDays: 32,
      moq: 96, classification: "CY", supplier: "Qi Guang Watch",
      incoming: incomingFor("ES3843-3843"),
    }),
  }),

  R({
    id: "p7", state: "settled", ref: "Bradshaw Chronograph 43", refSub: "SKU MK5605-5799",
    party: "Dallas DC", partyOwn: true,
    product: "Bradshaw Chronograph 43",
    qtyValue: "1152", qtyUnit: "units", date: "44 days",
    status: "Safety stock raised",
    signal: "rebalanced", value: 96700, action: "Review",
    cover: coverFor({
      onHand: 1152, dailyDemand: 26, leadDays: 36, wasLeadDays: 26,
      moq: 96, classification: "CZ", supplier: "Renley Watch Mfg",
      incoming: incomingFor("MK5605-5799"),
    }),
  }, { units: 624 }),
];

/* ─── Service · Christy ──────────────────────────────────────── */

const CSR: ActionRow[] = [
  R({
    /* The account end of PO-4471. Same 120 units, same style, same ten days —
       the buying seat is holding the supplier side of this exact move. */
    id: "c1", state: "decide", ref: "SO-4471", refSub: "Geopolitical lead-time increase · floor-set booked",
    party: "Peachtree Jewelers", partyOwn: false,
    product: "Runway 38",
    qtyValue: "2880", qtyUnit: "units", date: "19 Aug",
    status: "Account answered",
    signal: "options-drafted", value: 142800, action: "Re-promise",
  }, { days: 10 }),

  R({
    id: "c2", state: "decide", ref: "CLM-2041", refSub: "Two cartons crushed · photos in",
    party: "Gulf Coast Jewelers", partyOwn: false,
    product: "Runway 38",
    qtyValue: "48", qtyUnit: "units", date: "8 Aug",
    status: "Claim opened",
    signal: "damage", value: 2380, action: "Review claim",
    claim: {
      damagedUnits: 48, credit: 2380, policyCap: 7000, photos: 4,
      deliveredOn: "8 Aug", receipt: "GR-4471-02", batch: "B-2419",
    },
  }, { units: 48 }),

  R({
    /* Took the alternate rather than the wait — the style was not specified,
       so keeping the floor-set date was worth more than keeping the pattern. */
    id: "c3", state: "decide", ref: "SO-4488", refSub: "Accepted the alternate style",
    party: "Blue Ridge Jewelers", partyOwn: false,
    product: "Grant Chronograph 44",
    qtyValue: "1008", qtyUnit: "units", date: "22 Aug",
    status: "Account answered",
    signal: "alternate-accepted", value: 61200, action: "Confirm alternate",
  }, { date: "yesterday" }),

  R({
    id: "c4", state: "decide", ref: "CLM-2041 · L2", refSub: "Adjudicated from order and receipt",
    party: "Gulf Coast Jewelers", partyOwn: false,
    product: "Runway 38",
    qtyValue: "48", qtyUnit: "units", date: "9 Aug",
    status: "Credit ready",
    signal: "damage", value: 2380, action: "Approve credit",
    claim: {
      damagedUnits: 48, credit: 2380, policyCap: 7000, photos: 4,
      deliveredOn: "9 Aug", receipt: "GR-4471-02", batch: "B-2419",
    },
    // No `units`: this line is past the damage report — the claim is adjudicated
    // and what's left is the credit. Passing units would repeat CLM-2041's line
    // verbatim, and the two rows are adjacent in the queue.
  }, { amount: 4740 }),

  R({
    /* Both halves of a good outcome, on one line: the account has taken the
       revised date in writing AND accepted an alternate for part of the order, so
       18 of the 64 units stop waiting on Solan altogether. What is left for
       this desk is confirming the substitution against the floor-set — the date
       itself is no longer in dispute, which is why the row no longer asks anyone
       to negotiate one. */
    id: "c5", state: "decide", ref: "SO-4463", refSub: "Swap and date drafted · awaiting a rep",
    party: "Summit Department Stores", partyOwn: false,
    product: "Bradshaw Chronograph 43",
    qtyValue: "1536", qtyUnit: "units", date: "6 Sep",
    status: "Swap proposed",
    signal: "alternate-accepted", value: 88400, action: "Confirm alternate",
    chainFrom: "PO-4463",
  }, { sku: "MK5605-5799", units: 288, date: "6 Sep", days: 4 }),

  R({
    /* The alternate came off a different purchase order — that is what taking an
       alternate style means — so there is no PO-4390 and never was. Named
       explicitly rather than left blank: the CSR's question is which inbound
       order this date now depends on, and the answer is Qi Guang Watch's. */
    id: "c6", state: "settled", ref: "SO-4390", refSub: "Alternate accepted",
    chainFrom: "PO-4402",
    party: "Peachtree Jewelers", partyOwn: false,
    product: "Parker Leather 39",
    qtyValue: "2304", qtyUnit: "units", date: "26 Aug",
    status: "Alternate shipped",
    signal: "alternate-shipped", value: 118600, action: "Track",
  }, { date: "26 Aug" }),

  R({
    id: "c7", state: "settled", ref: "CLM-2019", refSub: "Credit issued, invoice corrected",
    party: "Piedmont Jewelers", partyOwn: false,
    product: "Bradshaw Chronograph 43",
    qtyValue: "192", qtyUnit: "units", date: "28 Jul",
    status: "Settled",
    signal: "settled", value: 11046, action: "Review",
    claim: {
      damagedUnits: 192, credit: 11046, policyCap: 25000, photos: 6,
      deliveredOn: "24 Jul", receipt: "GR-4390-01", batch: "B-2388",
    },
  }),
];

/* ─── Logistics · Tova ───────────────────────────────────────── */

const LOGISTICS: ActionRow[] = [
  R({
    /* SO-4390, not SO-4471 — the order record already said so and was being
       contradicted here. Its PRO number is SF-70412, its carrier is Fossil Fleet
       #218 and its lane is Dallas DC → Atlanta: this load, named three
       different ways. Two loads asserting the same order left the queue showing
       one 120-unit sales order being carried twice, at full value both
       times. */
    id: "l1", state: "decide", ref: "LD-70412", refSub: "Dallas DC → Atlanta, GA",
    chainFrom: "SO-4390",
    party: "Dedicated · #218", partyOwn: true,
    product: "Parker Leather 39",
    qtyValue: "2304", qtyUnit: "units", date: "Today 14:20",
    status: "ETA reconciled",
    signal: "eta-conflict", value: 118600, action: "Confirm ETA",
  }, { sources: 3, days: 6 }),

  R({
    /* The one inbound move on the book: Renley Watch Mfg's Color Choice is on the quay at
       Long Beach and has to move inland to Dallas. It is tied to PO-4488 rather
       than to a account order because that is what it is carrying — the column
       reads the reference and says inbound, which is the fact that changes who
       works the row and against what clock. */
    id: "l2", state: "decide", ref: "LD-70455", refSub: "Long Beach → Dallas DC",
    chainFrom: "PO-4488",
    party: "Forwarder · Kuehne+Nagel", partyOwn: false,
    product: "Grant Chronograph 44",
    qtyValue: "2016", qtyUnit: "units", date: "Tomorrow 09:00",
    status: "Carrier choice",
    signal: "carrier-choice", value: 198200, action: "Assign",
  }, { amount: 2400 }),

  R({
    /* The outbound leg of SO-4463 — the order this whole demo follows, from
       Qi Guang Watch's capped line through Iris's stocking policy to Christy's
       re-promise. Every figure on the row is the order's own: 64 units of
       Modal, $88,400, Fossil Fleet down Qi Guang Watch → Salt Lake City, arriving
       on the 6 Sep the account was re-promised. Which is also why the row is
       here: Summit's crew is booked for the day the units land, so there is no
       slack left at all — the delivery appointment is the thing to nail down
       before the date moves again. */
    id: "l3", state: "decide", ref: "LD-70398", refSub: "Dallas DC → Salt Lake City, UT",
    chainFrom: "SO-4463", lead: true,
    party: "Dedicated · #104", partyOwn: true,
    product: "Bradshaw Chronograph 43",
    qtyValue: "1536", qtyUnit: "units", date: `6 Sep ${DELIVERY_WINDOW.start}`,
    status: "Window to confirm",
    signal: "pickup-window", value: 88400, action: "Contact customer",
  }, { date: DELIVERY_WINDOW.short }),

  R({
    /* The end of the same thread: the load that finally carried SO-4463 arrived
       with two units crushed, so what began as a factory's capacity problem
       finishes as a return to book and a credit to raise. */
    id: "l4", state: "decide", ref: "LD-70402", refSub: "Damage on arrival · SO-4463",
    party: "Dedicated · #104", partyOwn: true,
    product: "Bradshaw Chronograph 43",
    qtyValue: "48", qtyUnit: "units", date: "8 Aug",
    status: "Damaged",
    signal: "damage", value: 4740, action: "Open claim",
    chainFrom: "SO-4463",
  }, { units: 48 }),

  R({
    /* Its own order, not SO-4463. Two loads against one sales order — a
       2-unit damage claim and a 72-unit recovery — described a shipment
       that cannot exist: nobody recovers 72 units to replace two crushed
       ones. SO-4436 is already in transit and already at risk with a purchased
       carrier, which is exactly the order a Fossil East air recovery is costed
       against. */
    id: "l5", state: "decide", ref: "LD-70460", refSub: "Recovery costed",
    chainFrom: "SO-4436",
    party: "Fossil East · Air", partyOwn: true,
    product: "Jacqueline 36",
    qtyValue: "2112", qtyUnit: "units", date: "Today 16:00",
    status: "Recovery ready",
    signal: "recovery", value: 104200, action: "Dispatch",
  }, { amount: 2400 }),

  R({
    /* A backhaul is not a floating cost line — it is the return leg of a
       delivery that has just finished. Naming that delivery is what lets the
       row say which trip is about to run empty: SO-4402 signed clean at
       Greensboro this morning, so the tractor is sitting there with 82 units
       of space and a $3,800 lane home unbooked. */
    id: "l6", state: "decide", ref: "LD-70471", refSub: "HKG consolidation → DFW",
    chainFrom: "SO-4402",
    party: "Fossil East · Air", partyOwn: true,
    product: "Runway 38",
    qtyValue: "1968", qtyUnit: "units", date: "Today 11:15",
    status: "Consolidation open",
    signal: "backhaul", value: 97580, action: "Book space",
  }, { amount: 3800 }),

  R({
    id: "l7", state: "settled", ref: "LD-70470", refSub: "Dallas DC → Charlotte, NC",
    chainFrom: "SO-4377",
    party: "Dedicated · #331", partyOwn: true,
    product: "Bradshaw Chronograph 43",
    qtyValue: "2304", qtyUnit: "units", date: "Today 06:40",
    status: "Dispatched",
    signal: "dispatched", value: 74300, action: "Track",
  }),

  R({
    id: "l8", state: "settled", ref: "LD-70350", refSub: "Hong Kong DC → Dallas DC",
    chainFrom: "SO-4547",
    party: "Fossil East · Ocean", partyOwn: true,
    product: "Jacqueline 36",
    qtyValue: "1728", qtyUnit: "units", date: "5 Aug",
    status: "Delivered",
    signal: "delivered-clean", value: 68900, action: "View",
  }),
];

/* ─── Queues ─────────────────────────────────────────────────── */

/**
 * Two tabs, one column set. `open` is the live list — everything still on the
 * seat, whether it needs a decision or is sitting with the counterparty, in one
 * undivided list. `settled` is the record of what was already answered: no
 * cause, because a closed line is described by what was done, not by what went
 * wrong.
 */
export type TabId = "open" | "settled" | "orders" | "claims";

export interface QueueTab {
  id: TabId;
  label: string;
  /** Row states this tab shows. */
  states: State[];
  /**
   * Optional second axis. The service seat splits its work by KIND rather than
   * state — an order conversation and a damage claim are different jobs with
   * different modals — so its tabs filter on this instead.
   */
  kind?: "order" | "claim";
  /**
   * Overrides the queue's reference-column header for this tab. The service
   * seat's one column holds order numbers on one tab and claim numbers on the
   * other, so a single "Order / Claim" heading was wrong on both.
   */
  refLabel?: string;
}

export interface QueueConfig {
  /** Title inside the TableShell — "Buying review". */
  shellTitle: string;
  searchPlaceholder: string;
  emptyText: string;
  refLabel: string;
  partyLabel: string;
  qtyLabel: string;
  dateLabel: string;
  /**
   * What the money on a row is called. Absent where money is not the point —
   * a planner reads a SKU by days of cover, and a dollar figure under it is a
   * number they cannot act on.
   */
  valueLabel?: string;
  tabs: QueueTab[];
  rows: ActionRow[];
}

const PO_COLS = {
  refLabel: "PO number",
  partyLabel: "Factory",
  qtyLabel: "Quantity",
  dateLabel: "Committed date",
  valueLabel: "Exposure",
} as const;

const NODE_COLS = {
  refLabel: "Product SKUs",
  partyLabel: "DC & classification",
  qtyLabel: "On hand",
  dateLabel: "Days of cover",
  /* No value under the SKU. The decision on this seat is a quantity against a
     lead time; exposure is the consequence, and it is already summed in the KPI
     above the table. */
} as const;

const ORDER_COLS = {
  refLabel: "Order / Claim",
  partyLabel: "Account",
  qtyLabel: "Quantity",
  dateLabel: "ETA",
  valueLabel: "Value",
} as const;

const LOAD_COLS = {
  refLabel: "Load",
  partyLabel: "Carrier / Mode",
  qtyLabel: "Quantity",
  dateLabel: "ETA",
  valueLabel: "Load value",
} as const;

export const QUEUES: Record<Persona, QueueConfig> = {
  buyer: {
    shellTitle: "Buying review",
    searchPlaceholder: "Search by PO, supplier or style",
    emptyText: "Nothing needs you right now.",
    ...PO_COLS,
    tabs: [
      {
        id: "open",
        label: "Action center",
        states: ["decide", "waiting"],
      },
      {
        id: "settled",
        label: "Settled",
        states: ["settled"],
      },
    ],
    rows: BUYER,
  },
  planner: {
    shellTitle: "Stocking policy",
    searchPlaceholder: "Search by style, SKU or node",
    emptyText: "Safety stock covers the lead time at every node.",
    ...NODE_COLS,
    tabs: [
      {
        id: "open",
        label: "Action center",
        states: ["decide", "waiting"],
      },
      {
        id: "settled",
        label: "Settled",
        states: ["settled"],
      },
    ],
    rows: PLANNER,
  },
  csr: {
    shellTitle: "Action center",
    searchPlaceholder: "Search by order, claim or account",
    emptyText: "No exposed orders right now.",
    ...ORDER_COLS,
    /* Split by kind, not state: a re-promise conversation and a damage claim are
       two different jobs with two different screens behind them, and the rep works
       one queue or the other rather than sweeping both by how far along they are.
       Settled rows are not listed. An action centre that carries orders needing
       nothing teaches the reader to scan past rows, which is the one habit this
       screen cannot afford — SO-4390 had its alternate accepted and shipped, and
       sitting in the queue it read as four jobs where there were three. The
       settled ones stay on Orders and Claims, which is where a history belongs. */
    tabs: [
      {
        id: "orders",
        label: "Orders",
        states: ["decide", "waiting"],
        kind: "order",
        refLabel: "Order",
      },
      {
        id: "claims",
        label: "Claims",
        states: ["decide", "waiting"],
        kind: "claim",
        refLabel: "Claim",
      },
    ],
    rows: CSR,
  },
  logistics: {
    shellTitle: "Logistics review",
    searchPlaceholder: "Search by load or lane",
    emptyText: "Every load is tracking clean.",
    ...LOAD_COLS,
    tabs: [
      {
        id: "open",
        label: "Action center",
        states: ["decide", "waiting"],
      },
      {
        id: "settled",
        label: "In flight & delivered",
        states: ["settled"],
      },
    ],
    rows: LOGISTICS,
  },
  /* The executive has no queue — they read the towers, they do not work
     exceptions. This stub exists only so the runtime `QUEUES[persona]`
     lookups (the Sidebar badge, the ChatPanel draft fallback) find a valid
     shape with a tab and no rows rather than throwing. The executive rail
     carries no queue badge and never mounts the QueueScreen. */
  executive: {
    shellTitle: "Executive",
    searchPlaceholder: "Search the book",
    emptyText: "Nothing needs you — this seat reads, it does not queue.",
    ...PO_COLS,
    tabs: [{ id: "open", label: "Overview", states: ["decide", "waiting"] }],
    rows: [],
  },
};

/** The agent working a seat — used for the insight column header, the chat
 *  panel and the disclaimer, so the person knows which agent is talking. */
export function agentOf(persona: Persona): string {
  return PERSONAS[persona].agent;
}

/* ─── Counterparty contacts ──────────────────────────────────────
 * Who actually answers the phone at each counterparty. The contact
 * modal shows this next to the drafted email, so "chase" is a real
 * choice between channels rather than a button label.
 * ─────────────────────────────────────────────────────────────── */

export interface PartyContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  /** Where they are and when they answer — the call/email decider. */
  hours: string;
  /** The agent's read on how this counterparty responds. */
  respondsIn: string;
  /** Which channel actually reaches them — what the modal opens on. */
  prefers: "email" | "call";
}

const CONTACTS: Record<string, PartyContact> = {
  /* One contact per factory — and WHOSE person they are follows ownership.
     Qi Guang and Renley are independent assemblers, so the card is their
     production merchandiser: the person who actually answers when a buyer
     chases a line. Solan is Fossil's own plant, so the card is a Fossil
     scheduler on a fossil.com address. The Shaw build had this the other way
     round because Shaw owned its plants; carrying that over would have put
     Fossil employees inside factories Fossil does not own. */
  "Qi Guang Watch": {
    name: "Kenny Cheung", role: "Production merchandiser",
    phone: "+86 769 5550 129", email: "k.cheung@qiguangwatch.com",
    hours: "Dongguan · on site 8am–6pm CST", respondsIn: "Answers WeChat and phone same shift", prefers: "call",
  },
  "Renley Watch Mfg": {
    name: "Priscilla Ng", role: "Production planner",
    phone: "+852 2555 0177", email: "p.ng@renleywatch.com",
    hours: "Hung Hom · on site 9am–5pm HKT", respondsIn: "Answers same shift", prefers: "call",
  },
  "Solan": {
    name: "Arjun Mehta", role: "Factory scheduling manager",
    phone: "+91 1792 555 042", email: "a.mehta@fossil.com",
    hours: "Solan, HP · on site 9am–6pm IST", respondsIn: "Replies to email overnight ET", prefers: "email",
  },
  /* The wholesale accounts — the receiving side of every re-promise and claim. */
  "Peachtree Jewelers": {
    name: "Carla Simmons", role: "Purchasing lead",
    phone: "+1 (404) 555-0163", email: "carla@peachtreejewelers.com",
    hours: "Atlanta, GA · 9am–6pm ET", respondsIn: "Picks up during store hours", prefers: "call",
  },
  "Gulf Coast Jewelers": {
    name: "Tony Bergeron", role: "Owner",
    phone: "+1 (228) 555-0148", email: "tony@gulfcoastjewelers.com",
    hours: "Biloxi, MS · 8am–5pm CT", respondsIn: "Phone first — rarely on email", prefers: "call",
  },
  "Blue Ridge Jewelers": {
    name: "Sarah Combs", role: "Store operations coordinator",
    phone: "+1 (828) 555-0192", email: "sarah@blueridgejewelers.com",
    hours: "Asheville, NC · 9am–5pm ET", respondsIn: "Replies to email same day", prefers: "email",
  },
  "Summit Department Stores": {
    name: "Greg Lawson", role: "Receiving operations manager",
    phone: "+1 (801) 555-0156", email: "glawson@summitdept.com",
    hours: "Salt Lake City, UT · 8am–5pm MT", respondsIn: "Replies to email same day", prefers: "email",
  },
};

/**
 * Three things to say on the phone — drafted like the email, so a call needs no
 * preparation either. Lives here rather than in a modal because the thread's
 * call-notes form shows them while the person takes notes: the prompts and the
 * record of what was said belong on the same surface.
 */
export function talkingPointsFor(row: ActionRow, label: string): string[] {
  switch (label) {
    case "Contact supplier":
    case "Contact factory":
      return [
        `Ask for a firm ship date on ${row.ref} — or a clear "can't meet it", so the volume can move.`,
        "Get the delay reason and their delay code on record.",
        "Ask what it would take to pull any days back — price it, don't assume it.",
      ];
    case "Chase":
      return [
        `The quote was requested Monday — ask for the number today, even indicative.`,
        "Confirm capacity for the full three months, not just this order.",
        "Ask for their landed-cost basis so the compare is like-for-like.",
      ];
    case "Follow up":
      return [
        "Which option are they leaning to — alternate now, or wait for the original?",
        "The floor-set crew books this week; after that the choice narrows on its own.",
        "If they're silent because the site slipped, capture the new floor-set date.",
      ];
    case "Contact terminal":
      return [
        `Where is the container for ${row.ref} right now — yard, gate or rolling?`,
        "What's the realistic clear time, not the scheduled one?",
        "Flag the delivery promise riding on it — ask them to prioritise the release.",
      ];
    case "Contact customer":
      return [
        `Confirm the ${DELIVERY_WINDOW.short} window still works on site.`,
        "Ask them to count the cartons at the tailgate before signing.",
        "If anything looks wrong: photograph it there — the claim settles same-day.",
      ];
    default:
      return [
        `Confirm the state of ${row.ref} and the date it turns on.`,
        "Get the blocking reason on record.",
        "Agree the next checkpoint before hanging up.",
      ];
  }
}


/* ─── Activity history ───────────────────────────────────────────
 * What has happened on this order, oldest first, each entry naming
 * the system or the agent it came from. This replaces a "what
 * changed" panel of static fields: the same facts, but with the
 * sequence and the authorship that make them checkable.
 * ─────────────────────────────────────────────────────────────── */

export interface HistoryEntry {
  when: string;
  what: string;
  /** The system of record, feed, or agent the entry came from. */
  source: string;
  /** True while the entry describes something not yet committed. */
  pending?: boolean;
}

export function historyFor(
  row: ActionRow,
  agent: string,
  proposedLead?: string,
): HistoryEntry[] {
  const cause = causeOf(row.signal);
  const requested = Math.max(...linesFor(row).map((l) => l.leadDays));

  /* A planner row's history starts with the buyer's decision, not a PO — that
     acceptance is what created the exception the planner is looking at. */
  if (row.cover) {
    const c = row.cover;
    const staged = proposedLead !== undefined && Number(proposedLead) !== c.safetyNeeded;
    return [
      {
        when: "3 days ago",
        what: `${c.supplier} moved its lead time out ${c.leadDays - c.wasLeadDays} days`,
        source: "Supplier feed",
      },
      {
        when: "Today 09:40",
        what: `Buying accepted ${c.leadDays} days for the next three months`,
        source: "Buying · Marcus Whitfield",
      },
      {
        when: "Today 09:41",
        what: `Cover recomputed at ${row.party} against the ${c.leadDays}-day window — ${c.coverDays} days on hand`,
        source: `${agent} · OMP, Manhattan`,
      },
      {
        when: "Today 09:41",
        what: `Safety stock of ${c.safetyNow} ${row.qtyUnit} no longer covers the window; ${c.safetyNeeded} required`,
        source: `${agent} · OMP policy`,
      },
      {
        when: "Today 09:42",
        what: `Requisition drafted for the gap, inside your limits and on the pack size of ${c.moq}`,
        source: `${agent} · Oracle Fusion`,
      },
      ...(staged
        ? [
            {
              when: "Now",
              what: `Your figure of ${proposedLead} ${row.qtyUnit} is staged, not yet written to the policy`,
              source: "This session",
              pending: true,
            },
          ]
        : []),
    ];
  }

  const opened: HistoryEntry = {
    when: "5 days ago",
    what: `${row.ref} issued for ${row.qtyValue} ${row.qtyUnit} and sent for acknowledgement`,
    source: "Oracle Fusion",
  };

  const entries: HistoryEntry[] = [opened];

  if (cause === "supply") {
    entries.push(
      {
        when: "3 days ago",
        what:
          row.signal === "capacity"
            ? `${row.party} confirmed tufting capacity is committed through the quarter — ${requested} days for the next three months`
            : `${row.party} moved its lead time out ${SLIP_DAYS} days — ${requested} days for the next three months`,
        source: "Supplier feed · confirmed by email",
      },
      {
        when: "3 days ago",
        what: `Classified as ${CAUSE_LABEL[cause].toLowerCase()} and matched against open orders`,
        source: `${agent} · Oracle Fusion, OMP`,
      },
      {
        when: "2 days ago",
        what: "Three affected customers informed of the revised date and re-promised",
        source: `${agent} · email`,
      },
      {
        when: "Yesterday",
        what: `Asked ${row.party} whether the ${SLIP_DAYS} days is firm for the full three months`,
        source: `${agent} · email`,
      },
      {
        when: "Today 09:20",
        what: "Escalated to the buyer — the commercial response needs a person",
        source: agent,
      },
    );
  } else if (cause === "awaiting") {
    entries.push(
      {
        when: "3 days ago",
        what: `First chase sent to ${row.party} — no acknowledgement`,
        source: `${agent} · email`,
      },
      {
        when: "Today 09:12",
        what: "Second chase sent — still no response",
        source: `${agent} · email`,
      },
      {
        when: "Today 09:20",
        what: "Escalated to the buyer — the promise date is now at risk",
        source: agent,
      },
    );
  } else {
    entries.push(
      {
        when: "2 days ago",
        what: `${row.party} confirmed the position: ${row.status.toLowerCase()}`,
        source: "Supplier feed",
      },
      {
        when: "Today 09:20",
        what: `Raised to the buyer — ${row.status.toLowerCase()}`,
        source: agent,
      },
    );
  }

  if (proposedLead !== undefined && Number(proposedLead) !== requested) {
    entries.push({
      when: "Now",
      what: `Your figure of ${proposedLead} days is staged, not yet written to the supplier record`,
      source: "This session",
      pending: true,
    });
  }

  return entries;
}

/* ─── Email & call thread ────────────────────────────────────────
 * Every exchange the agent read to build its summary — written and
 * spoken. The agent places its own calls, so a transcript summary
 * belongs in the same trail as the mail: a person checking the
 * agent's account should not have to look in two places, and "we
 * called and they said" is often where a figure actually came from.
 * ─────────────────────────────────────────────────────────────── */

export interface ThreadEntry {
  id: string;
  /** Written or spoken. Calls carry `outcome` and a duration. */
  kind: "email" | "call";
  /** True when Fossil sent it or placed it — drives the icon. */
  outbound: boolean;
  from: string;
  to: string;
  when: string;
  subject: string;
  /** The message, or what was said on the call. */
  body: string;
  /** Calls only — how it went, in a few words. */
  outcome?: string;
  /** Calls only. */
  durationMin?: number;
  /** Calls only — true when the agent placed it, false when a person did and
   *  logged the notes by hand. The distinction matters: one has a transcript
   *  behind it, the other has somebody's recollection. */
  automated?: boolean;
  /** Set when the agent drew a figure from this exchange, naming what it took.
   *  This is what makes the thread auditable rather than decorative. */
  citedAs?: string;
  /**
   * What was actually said, turn by turn — automated calls only.
   *
   * The body line above is the agent's summary of the call; this is the call.
   * A summary is where a figure gets softened by whoever wrote it, and the one
   * thing a buyer wants to check before committing three months of lead time is
   * whether the supplier really said that. A person's own call has no turns —
   * they took notes, and pretending otherwise would manufacture a record.
   */
  turns?: { speaker: string; text: string }[];
}

/**
 * The thread behind a row. Deterministic, like `insightText` and `linesFor` —
 * same row, same correspondence — and written from the row's own numbers so the
 * quoted figures always match the summary above.
 */
/** The lead time on the row's lines — the figure the call is actually about. */
function askedLeadFor(row: ActionRow): number {
  return Math.max(...linesFor(row).map((l) => l.leadDays));
}

export function threadFor(row: ActionRow, agent: string): ThreadEntry[] {
  const contact = contactFor(row.party, row.partyOwn);
  const us = row.partyOwn ? "planning@fossil.com" : "sourcing@fossil.com";
  const cause = causeOf(row.signal);

  const opening: ThreadEntry = {
    id: "m1",
    kind: "email",
    outbound: true,
    from: us,
    to: contact.email,
    when: "5 days ago",
    subject: `${row.ref} — acknowledgement requested`,
    body: `Please acknowledge ${row.ref} (${row.qtyValue} ${row.qtyUnit}) against the committed date and confirm the ship week.`,
  };

  if (cause === "supply") {
    const revised = row.signal === "capacity" ? "schedule" : "lead time";
    return [
      opening,
      {
        id: "m2",
        kind: "email",
        outbound: false,
        from: contact.email,
        to: us,
        when: "3 days ago",
        subject: `Re: ${row.ref} — ${revised} revision`,
        body:
          row.signal === "capacity"
            ? `Tufting capacity is committed through the quarter. We can hold ${row.qtyValue} ${row.qtyUnit} but not before the revised date — assume ten days beyond the original for the next three months.`
            : `Regrettably our lead time has moved out by ten days with immediate effect, and we expect that to hold for the next three months. ${row.ref} is affected along with all open orders.`,
        citedAs: "Lead time · +10 days for three months",
      },
      {
        id: "m3",
        kind: "email",
        outbound: true,
        from: `${agent.toLowerCase()}@fossil.com`,
        to: "service@fossil.com",
        when: "2 days ago",
        subject: `${row.ref} — customers notified of the revised date`,
        body: `Affected customers have been told the new date. Three orders re-promised. Nothing is written to the supplier record until the buyer confirms the figure.`,
        citedAs: "Customers informed",
      },
      {
        id: "m4",
        kind: "email",
        outbound: true,
        from: us,
        to: contact.email,
        when: "Yesterday",
        subject: `Re: ${row.ref} — is the ten days firm for the full three months?`,
        body: `Before we plan against it: is the ten days firm for the whole three months, and what would it take to pull any of it back? We would rather price a known delay than absorb a moving one.`,
      },
      {
        id: "m5",
        kind: "call",
        outbound: true,
        from: `${agent} (automated)`,
        to: `${contact.name} · ${contact.phone}`,
        when: "Yesterday 15:20",
        subject: `Called to confirm the ${SLIP_DAYS}-day window`,
        body: `${contact.name} confirmed the ${SLIP_DAYS} days holds for the full three months and would not commit to pulling any back without a volume increase. Said to plan against the revised date.`,
        outcome: "Answered",
        durationMin: 4,
        automated: true,
        turns: [
          { speaker: agent, text: `Calling about ${row.ref}. You have moved the lead time to ${askedLeadFor(row)} days — is that firm for the full three months?` },
          { speaker: contact.name, text: `It is. The line is committed through the quarter, so ${askedLeadFor(row)} is what we can hold to.` },
          { speaker: agent, text: `Is there anything that pulls part of it back? We would rather price a known delay than absorb a moving one.` },
          { speaker: contact.name, text: `Not without a volume increase. Plan against the revised date and we will not miss it.` },
          { speaker: agent, text: `Understood. I will put ${askedLeadFor(row)} days on the record and flag the affected orders.` },
        ],
        citedAs: "Three-month window confirmed verbally",
      },
    ];
  }

  if (cause === "awaiting") {
    return [
      opening,
      {
        id: "m2",
        kind: "email",
        outbound: true,
        from: us,
        to: contact.email,
        when: "3 days ago",
        subject: `${row.ref} — firm date still outstanding`,
        body: `Following up: we still have no acknowledgement on ${row.ref}. Please confirm a firm ship date against the committed floor-set date.`,
        citedAs: "No reply · chased twice",
      },
      {
        id: "m3",
        kind: "call",
        outbound: true,
        from: `${agent} (automated)`,
        to: `${contact.name} · ${contact.phone}`,
        when: "Today 09:12",
        subject: "Called to chase the firm date",
        body: `Rang twice during ${contact.hours.split(" · ")[0]} working hours. No answer on either attempt; voicemail left asking for a firm ship date against ${row.ref}.`,
        outcome: "No answer · voicemail left",
        durationMin: 1,
        automated: true,
        turns: [
          { speaker: "Line", text: "Rang out — no answer on the first attempt." },
          { speaker: "Line", text: "Second attempt, twenty minutes later — voicemail." },
          { speaker: agent, text: `Message left: we need a firm ship date against ${row.ref}. Please call the buying desk today.` },
        ],
        citedAs: "Chased twice, no reply — escalated to the buyer",
      },
    ];
  }

  return [
    opening,
    {
      id: "m2",
      kind: "email",
      outbound: false,
      from: contact.email,
      to: us,
      when: "2 days ago",
      subject: `Re: ${row.ref} — ${row.status.toLowerCase()}`,
      body: `Confirming the position on ${row.ref}: ${row.status.toLowerCase()}. Let us know how you would like to proceed.`,
      citedAs: row.status,
    },
  ];
}

/** Contact for a counterparty, with a deterministic fallback so every row can
 *  open the contact experience even for parties without a curated card. */
export function contactFor(party: string, own: boolean): PartyContact {
  const hit = CONTACTS[party];
  if (hit) return hit;
  const domain = own
    ? "fossil.com"
    : `${party.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`;
  return {
    name: "Front desk", role: own ? "Shift coordinator" : "Customer service",
    phone: "+1 (800) 555-0100", email: `ops@${domain}`,
    hours: "Business hours, local time", respondsIn: "No response history yet",
    prefers: "email",
  };
}

export function formatUsd(n: number): string {
  return usd(n);
}

/**
 * The money in full — $142,800, not $143K.
 *
 * The abbreviation earns its place in a table cell, where the reader is
 * comparing magnitudes down a column and the last three digits are noise. On a
 * record page they are the opposite of noise: the figure is the thing being
 * read, and a rounded one cannot be reconciled against anything.
 */
export function formatUsdFull(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
