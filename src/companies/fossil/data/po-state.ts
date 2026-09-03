/* ═══════════════════════════════════════════════════════════════
 *  Where a line actually is, as a shape the tracking card can draw
 *
 *  The queue tells you what is wrong with a purchase order and what
 *  to do about it, and never once says where the order has got to.
 *  "Lead time 30 → 40 days" is a fact about a date; it does not tell
 *  you whether the plant has even acknowledged the thing.
 *
 *  Figma Customer Ops, node 632:13417 — a six-stage stepper with the
 *  exception, the ETA and the money underneath it. One view model so
 *  a buyer's PO and a account's sales order can both feed the same
 *  card rather than growing two of them.
 * ═══════════════════════════════════════════════════════════════ */

import { STAGE_LABEL, ORDER_STAGE_ORDER } from "./service";
import { formatUsd, type ActionRow,
  shiftDate,
} from "./action-center";

export type StageState = "done" | "active" | "pending";

export interface TrackedStage {
  label: string;
  state: StageState;
}

export interface TrackedState {
  /** The reference the card is headed with — PO-4471, SO-4471. */
  ref: string;
  /** The status pill, top right. */
  status: string;
  stages: TrackedStage[];
  /** The line under the stepper — who is carrying it and against what. */
  by: string;
  byRef?: string;
  /** The amber band. Omitted when nothing is wrong. */
  alert?: string;
  etaLabel: string;
  eta: string;
  /** Renders the ETA as a miss rather than a plan. */
  etaLate?: boolean;
  value: string;
  /** What is on it, in one line. */
  contents: string;
}

/**
 * A purchase order runs four stages, and they are Fossil's stages, not the plant's.
 *
 * A PO is INBOUND — it ends in a Fossil distribution centre, not at a customer —
 * so the last stage is a receipt, not a delivery. "Delivered" borrowed the
 * outbound language of a account order and pointed the arrow the wrong way.
 *
 * "In production" went with it. Fossil does not see inside a vendor's plant, so a
 * stage named for the vendor's work claimed visibility this seat does not have.
 * Every stage here is something the buyer can actually observe happening: the
 * order goes out, the vendor acknowledges it, the goods ship, they book in. That
 * is also the shape of the outbound stepper on a account order, which makes the
 * two readable as the two halves of one journey rather than two schemes.
 */
export const PO_STAGES = ["Raised", "Acknowledged", "Shipped", "Received at DC"] as const;

/**
 * Which stage a row has reached.
 *
 * Derived from the signal rather than stored, so a row cannot claim to be in
 * transit while its insight says the supplier has not replied. The signal is
 * already the thing that says what went wrong; where the order is follows from
 * it.
 */
function reachedFor(row: ActionRow): number {
  if (row.state === "settled") return 3;
  /* Every open exception on a purchase order lives at the acknowledgement, and
     that is where the marker belongs.
     A silent PO is obvious: nobody has replied. A moved lead time is the same
     square for a subtler reason — the vendor HAS replied, but with a date the
     buyer has not accepted, so the line is not cleanly on order yet. Putting it
     at "On order" marked a stage the order has not properly reached and left the
     exception sitting a step ahead of the thing that caused it. Committing the
     date is what moves it on, which is exactly what the commit is for. */
  return 1;
}

/** The status pill's words — what the stage means, in the row's own terms. */
function statusFor(row: ActionRow, reached: number): string {
  if (row.state === "settled") return "On schedule";
  if (row.signal === "silent-po") return "Unacknowledged";
  if (row.signal === "lead-time-jump" || row.signal === "capacity") return "Date moved";
  return PO_STAGES[reached];
}

/**
 * The exception band. Only when something is actually wrong — a card that
 * always shows an amber strip teaches the eye to skip it.
 */
function alertFor(row: ActionRow): string | undefined {
  if (row.state === "settled") return undefined;
  switch (row.signal) {
    case "lead-time-jump":
      return `${row.refSub} — the plant has moved the date, and it holds for three months`;
    case "capacity":
      return `${row.refSub} — the line is full, so this cannot simply be expedited`;
    case "silent-po":
      return `${row.refSub} — no acknowledgement, so nothing downstream can be trusted yet`;
    case "second-source-quote":
      return `${row.refSub} — the figure is not back, so the decision cannot be taken`;
    default:
      return undefined;
  }
}

/** Build the card's view model from a queue row. */
export function poStateFor(row: ActionRow, contactName?: string): TrackedState {
  const reached = reachedFor(row);
  const moved = row.signal === "lead-time-jump" || row.signal === "capacity";

  return {
    ref: row.ref,
    status: statusFor(row, reached),
    /* Received at the DC is an arrival, not a state of progress — see the note
       on the outbound run. */
    stages: PO_STAGES.map((label, i) => ({
      label,
      state:
        i < reached || (i === reached && i === PO_STAGES.length - 1)
          ? "done"
          : i === reached
            ? "active"
            : "pending",
    })),
    by: row.party,
    byRef: contactName,
    alert: alertFor(row),
    /* Named for what the date is, which changes with the row: a moved date is a
       revision, an unacknowledged one is still only a request. */
    etaLabel: moved ? "Revised" : row.state === "settled" ? "Committed" : "Promised",
    eta: row.date,
    etaLate: moved,
    value: formatUsd(row.value),
    contents: `${row.qtyValue} ${row.qtyUnit} · ${row.product}`,
  };
}

/**
 * The same order once the agent has acted.
 *
 * Every one of these tasks asks somebody a question, so the stage does not
 * move — what changes is that the line is now waiting on a named person rather
 * than sitting untouched. Showing the card again with that swapped in is the
 * clearest way to say what the work actually achieved, and the honest way to
 * say what it did not.
 */
export function poStateAfter(
  row: ActionRow,
  contact: { name: string; respondsIn: string; prefers: "call" | "email" },
): TrackedState {
  const before = poStateFor(row, contact.name);
  const channel = contact.prefers === "call" ? "Called" : "Wrote to";
  return {
    ...before,
    status: "Awaiting reply",
    alert: `${channel} ${contact.name} — ${contact.respondsIn.toLowerCase()}. Nothing on the order has changed yet.`,
  };
}

/**
 * The same order once a lead time has been committed.
 *
 * This is the one task that actually writes something, so it is the one whose
 * "after" card may drop the amber band: the date has stopped being a surprise
 * from the supplier and become the figure the business plans against. The stage
 * does not move — writing a lead time does not put the order into production —
 * which is exactly why the status and the exception have to carry the change.
 */
export function poStateCommitted(row: ActionRow, days: number, owed?: string): TrackedState {
  const before = poStateFor(row);
  return {
    ...before,
    /* The stages do NOT advance. Writing a date to the record does not put the
       goods on a truck — the line is still waiting on the vendor's despatch, and
       a stepper that stepped forward on a commit would be reporting movement
       nobody made. What changes is the exception: the marker stops being an error
       and the date under it is now one the buyer stands behind. */
    status: "Lead time updated",
    /* The band clears only when the commit is whole. A lead time written to the
       record while the account still holds the old promise is not resolved, and
       dropping the amber there would be the card saying so. */
    alert: owed,
    etaLabel: "Committed",
    etaLate: false,
    /* Party and term as the card's own two fields rather than one long string:
       in a 380px panel a joined line truncates mid-sentence and the term — the
       part that just changed — is the half that gets cut. */
    by: row.party,
    byRef: `${days}-day lead time`,
  };
}


/* ─── Sales orders ────────────────────────────────────────────────
 * The service seat tracks the other half of the same journey. A
 * account order does not get "acknowledged" or go "into production" —
 * it is placed, allocated against stock, shipped, and delivered. Four
 * stages again, and the two the CSR can actually act on are the
 * middle two, which is where every row in that queue sits.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Outbound: it leaves a Fossil DC and ends at the account.
 *
 * Read from the order model's own labels rather than written again here. They
 * had drifted — the queue said "Allocated" where the order page said "In
 * process", about the same shipment on two screens — and a second list of stage
 * names is a second thing to remember to change.
 */
export const SO_STAGES = ORDER_STAGE_ORDER.map((k) => STAGE_LABEL[k]);

function soReachedFor(row: ActionRow): number {
  if (row.state === "settled") return 3;
  switch (row.signal) {
    /* Nothing has shipped: the account is still choosing what they want. */
    case "options-drafted":
    case "awaiting-customer":
      return 1;
    /* Still at the DC: the carrier has not been chosen, so nothing has left. */
    case "carrier-choice":
      return 1;
    case "eta-conflict":
    case "pickup-window":
    case "recovery":
    case "dispatched":
      return 2;
    /* The outbound leg is done — the empty return is the thing being booked. */
    case "backhaul":
      return 3;
    /* A claim only exists because the goods arrived. */
    case "damage":
      return 3;
    default:
      return 1;
  }
}

function soStatusFor(row: ActionRow, reached: number): string {
  if (row.state === "settled") return "On schedule";
  switch (row.signal) {
    case "options-drafted":
      return "Account answered";
    case "awaiting-customer":
      return "Awaiting account";
    case "eta-conflict":
      return "ETA disputed";
    case "damage":
      return "Damaged on arrival";
    case "carrier-choice":
      return "Carrier to assign";
    case "pickup-window":
      return "Window to confirm";
    case "recovery":
      return "Recovery costed";
    case "backhaul":
      return "Delivered · running back empty";
    case "dispatched":
      return "Dispatched";
    default:
      return SO_STAGES[reached];
  }
}

function soAlertFor(row: ActionRow): string | undefined {
  if (row.state === "settled") return undefined;
  switch (row.signal) {
    case "options-drafted":
      /* The account has chosen; the record has not caught up. That gap is the
         whole reason the row is in front of a person. */
      return `${row.refSub} — the account has chosen to wait, and the promise still reads the old date`;
    case "awaiting-customer":
      return `${row.refSub} — nothing moves until the account picks`;
    case "eta-conflict":
      return `${row.refSub} — the systems disagree, so no date can be promised yet`;
    case "damage":
      return `${row.refSub} — the credit cannot be settled until the cause is agreed`;
    default:
      return undefined;
  }
}

/**
 * A account order as the tracking card draws it.
 *
 * Same shape as the purchase-order view so one card serves both seats — what
 * changes is the vocabulary, because "in production" means nothing to someone
 * whose crew is booked for Thursday.
 */
export function soStateFor(row: ActionRow, contactName?: string): TrackedState {
  const reached = soReachedFor(row);
  return {
    ref: row.ref,
    status: soStatusFor(row, reached),
    /* The last stage, once reached, is DONE — not active. A delivered order is
       delivered: there is nothing in progress at the end of a run. Marking it
       active left the final dot painted as the thing still owed, which on a row
       needing a decision came out red, so a clean delivery read as a failure. */
    stages: SO_STAGES.map((label, i) => ({
      label,
      state:
        i < reached || (i === reached && i === SO_STAGES.length - 1)
          ? "done"
          : i === reached
            ? "active"
            : "pending",
    })),
    by: row.party,
    byRef: contactName,
    alert: soAlertFor(row),
    etaLabel: row.state === "settled" ? "Delivered" : "Promised",
    eta: row.date,
    etaLate: row.signal === "options-drafted" || row.signal === "eta-conflict",
    value: formatUsd(row.value),
    contents: `${row.qtyValue} ${row.qtyUnit} · ${row.product}`,
  };
}


/**
 * The same account order once the new date is on the record.
 *
 * The amber band clears because the thing that was wrong — a promise the plant
 * could not meet — is no longer wrong. The stage does not advance: re-promising
 * does not allocate or ship anything, and pretending otherwise would be the
 * card flattering the work.
 */
export function soStateRepromised(
  row: ActionRow,
  contactName: string,
  newDate: string,
): TrackedState {
  const before = soStateFor(row, contactName);
  return {
    ...before,
    status: "Re-promised",
    alert: undefined,
    etaLabel: "Promised",
    eta: newDate,
    etaLate: false,
    byRef: `${contactName} · confirmed`,
  };
}


/**
 * The stage track for any row that has a journey, whichever kind it is.
 *
 * One lookup so the table's dots and the panel's tracking card are the same
 * derivation — a row cannot read "allocated" in the queue and "shipped" in the
 * card. Null where a row has no journey to draw: a safety-stock level and a
 * truckload have no stages, and inventing four for them would be a progress bar
 * that means nothing.
 */
export function stagesFor(row: ActionRow): TrackedStage[] | null {
  switch (row.signal) {
    case "lead-time-jump":
    case "capacity":
    case "silent-po":
    case "second-source-quote":
    case "lead-time-accepted":
    case "lead-time-overridden":
      return poStateFor(row).stages;
    /* A account order is outbound whatever fed it. These rows all name the
       purchase order upstream of them, and for a while that reference was being
       read as a direction — which put "Shipped" against a sales order sitting in
       a plant. What supplied an order does not change which way it is going. */
    case "options-drafted":
    case "alternate-accepted":
    case "dealer-counter":
    case "awaiting-customer":
    case "eta-conflict":
    case "damage":
      return soStateFor(row).stages;
    /* The logistics seat's rows are loads, and a load takes the direction of
       what is on it. They used to fall through to null and show the cause name
       in the status column instead — which told the reader what kind of problem
       it was and never where the truck had got to. */
    case "carrier-choice":
    case "pickup-window":
    case "recovery":
    case "backhaul":
    case "dispatched":
      /* An inbound load runs the purchase order's track. A drayage sitting on
         the quay at Savannah is at "Shipped" on its way to "Received at DC";
         calling it "In process" borrowed the outbound vocabulary and pointed the
         arrow the wrong way, which is the mistake the PO stepper exists to
         stop. */
      if (row.chainFrom?.startsWith("PO-")) {
        /* The goods have left the vendor and have not booked in: that is the
           whole of what a load in Tova's queue can be. */
        const reached = row.state === "settled" ? 3 : 2;
        return PO_STAGES.map((label, i) => ({
          label,
          state:
            i < reached || (i === reached && i === PO_STAGES.length - 1)
              ? "done"
              : i === reached
                ? "active"
                : "pending",
        }));
      }
      return soStateFor(row).stages;
    default:
      return null;
  }
}

/** The stage a track is currently on, for the label under the dots. */
export function currentStage(stages: TrackedStage[]): string {
  const active = stages.find((s) => s.state === "active");
  if (active) return active.label;
  return stages[stages.length - 1]?.label ?? "";
}

/**
 * A date against each PO stage that has actually reached it.
 *
 * Derived backwards from the two dates a purchase order really knows — the
 * promise it was raised against and the lead time it planned on — rather than
 * stored per stage. Four stored dates would be four things that can disagree
 * with the promise; deriving them means the stepper and the record are the same
 * arithmetic.
 *
 * Nothing is dated ahead of where the order has got to. A date under a pending
 * stage reads as a fact — "Received at DC · 2 Sep" says it arrived — when it is
 * at best a projection and, on a line whose date has just moved, a projection
 * the buyer has not yet agreed to. The expected date belongs in the agent's
 * band, where it is stated as the decision it is.
 */
export function poDates(row: ActionRow, plannedLeadDays: number): Record<string, string> {
  const reached = reachedFor(row);
  /* The date the record currently holds — the original promise on a line that
     has moved, the live date otherwise. */
  const promised = row.committedOn ?? row.date;
  const raised = shiftDate(promised, -plannedLeadDays);

  const dated: Record<string, string> = {};
  dated[PO_STAGES[0]] = raised;
  /* The day the vendor replied — vendors acknowledge within a couple of days of
     release. It is tempting to put the committed date here instead, since that is
     what the current state turns on, but a bare date under "Acknowledged" reads
     as when it was acknowledged; the committed date is stated as a commitment in
     the agent's band, where it cannot be misread as an event. A silent PO never
     reaches this stage and so shows nothing. */
  if (reached >= 1) dated[PO_STAGES[1]] = shiftDate(raised, 2);
  /* The despatch, once it has happened. An unshipped line carries no date here:
     the date it is DUE is the promise, and that belongs to the agent's band as a
     commitment rather than under a stage as a fact. */
  if (reached >= 2) dated[PO_STAGES[2]] = shiftDate(promised, -4);
  if (reached >= 3) dated[PO_STAGES[3]] = row.date;
  return dated;
}
