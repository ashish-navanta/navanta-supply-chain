/* ═══════════════════════════════════════════════════════════════
 *  Has the plant actually been told?
 *
 *  A lead time is two facts, and only one of them lives in the
 *  buyer's seat. Mercer can write 40 days to the supplier record on
 *  its own; it cannot tell the maintenance team whose shutdown crew is
 *  booked against the old date. That conversation happens in the
 *  service seat, through Christy, and until it has happened the commit
 *  is only half done.
 *
 *  So this is read, not asserted. The buying row's part is the same
 *  string as the stores requisition's, which is what lets one seat
 *  check the other rather than both claiming the same thing separately
 *  — the queue used to end every lead-time line with "plant informed"
 *  whether or not anyone had been.
 * ═══════════════════════════════════════════════════════════════ */

import { QUEUES, type ActionRow } from "./action-center";
import { orderById } from "./service";
import { PERSONAS } from "@/types/persona";

export interface NoticedOrder {
  ref: string;
  account: string;
  /** A booked shutdown crew is why a slip on a small requisition can outrank a big one. */
  crewBooked: boolean;
  told: boolean;
  /** How it stands in the service seat, in that seat's own words. */
  standing: string;
}

export interface CustomerNotice {
  /** True only when every affected maintenance team has actually been contacted. */
  told: boolean;
  orders: NoticedOrder[];
  /** The teams still owed the conversation. */
  owed: NoticedOrder[];
  /**
   * The teams, named, for copy.
   *
   * One PO carries one part to one stores requisition, so this is a name rather
   * than a count — "Plant 12 Maintenance has not been told" says who to go and
   * find, where "1 team has not been told" makes the reader open the step to
   * learn the only thing they wanted. The join is a guard, not an expectation.
   */
  named: string;
  /** Who owns that conversation — named, because it is a hand-off. */
  by: string;
  agent: string;
}

/**
 * What the service seat says about a buying row's maintenance teams.
 *
 * Returns null when nothing downstream is affected, which is the honest
 * answer for a line no requisition is waiting on.
 */
export function noticeFor(row: ActionRow): CustomerNotice | null {
  /* A stores requisition and the purchase order behind it now share a number —
     SO-4463 is the outbound half of PO-4463 — so the pairing is the reference
     itself. The part fallback stays for requisitions that name the same product
     but were never numbered against a PO. */
  const orders: NoticedOrder[] = QUEUES.csr.rows
    .filter(
      (r) =>
        r.ref.startsWith("SO-") &&
        (r.chainFrom === row.ref ||
          r.ref.slice(3) === row.ref.slice(3) ||
          r.product === row.product),
    )
    .map((r) => {
      /* Drafted is not sent. The whole point of the CSR queue's
         "options-drafted" row is that the message is written and waiting on a
         person, so counting it as told would be the prototype flattering
         itself. */
      const told = r.signal !== "options-drafted";
      return {
        ref: r.ref,
        account: r.party,
        crewBooked: r.refSub.toLowerCase().includes("crew booked"),
        told,
        standing: told
          ? r.state === "settled"
            ? "answered"
            : "options sent, no answer yet"
          : "message drafted, not sent",
      };
    });

  if (!orders.length) return null;
  const owed = orders.filter((o) => !o.told);

  return {
    told: orders.every((o) => o.told),
    orders,
    owed,
    named: (owed.length ? owed : orders).map((o) => o.account).join(" and "),
    by: PERSONAS.csr.name,
    agent: PERSONAS.csr.agent,
  };
}

/**
 * The queue line's clause about the plant — true per row, not boilerplate.
 *
 * Only where a promise date actually moves. A crib-transfer quote or a silent
 * PO can share a part with a requisition without changing anything the plant
 * was told, and hanging "1 team not told" off those lines would report a debt
 * that the row does not owe.
 */
export function noticeTail(row: ActionRow): string {
  if (row.signal !== "lead-time-jump" && row.signal !== "capacity") return "";
  const notice = noticeFor(row);
  if (!notice) return "";
  return notice.told ? ` · ${notice.named} informed` : ` · ${notice.named} not told`;
}


/* ─── The other end of the same delivery ──────────────────────────
 * A stores requisition and the purchase order behind it are one event
 * seen from two seats. SO-4471 is 120 drums of Spindle Coolant
 * Concentrate for Plant 12; PO-4471 is the same 120 drums from the
 * supplier. When the supplier moves, both seats are looking at that
 * move — and they should be saying the same thing about it.
 * ─────────────────────────────────────────────────────────────── */

/**
 * The buying row a service row is waiting on.
 *
 * Read from the row's own `chainFrom` rather than matched on part. Part
 * matching held only while every seat spelled a product identically, and it
 * did not: the planner's line for this same SKU was filed under "Chemicals ·
 * Plant 12" where the buyer had "Deep Groove Ball Bearing 6205-2RS", so the
 * link silently went missing on exactly the row it mattered most for. A named
 * reference cannot drift.
 *
 * The part match stays as a fallback for rows that predate the explicit link —
 * dropping it would quietly lose pairings rather than fix them.
 */
export function upstreamFor(row: ActionRow): ActionRow | null {
  const open = (b: ActionRow) =>
    (b.signal === "lead-time-jump" || b.signal === "capacity") && b.state !== "settled";

  if (row.chainFrom) {
    const named = QUEUES.buyer.rows.find((b) => b.ref === row.chainFrom);
    if (named && open(named)) return named;
  }
  return QUEUES.buyer.rows.find((b) => b.product === row.product && open(b)) ?? null;
}


/* ─── The order a row is against ──────────────────────────────────
 * A purchase order feeds a stores requisition; a claim is filed
 * against one. Both relationships are already in the data — the shared
 * number on one side, the goods receipt on the other — so neither
 * needs a column of its own in the fixtures.
 * ─────────────────────────────────────────────────────────────── */

/**
 * The order a row is against, and which way its goods are moving.
 *
 * The reference already says the direction and nothing was reading it. A
 * purchase order ends at Indy Central Stores, so a load carrying one is inbound;
 * a stores requisition leaves the stores for a plant dock, so a load carrying
 * one is outbound. On a logistics queue that is not decoration — it is the
 * difference between a distributor truck coming in from Lafayette and a shuttle
 * run a shutdown crew is waiting at the machine for, and the two are worked by
 * different people against different clocks.
 *
 * A purchase order feeds the requisition that shares its number: PO-4463
 * supplies SO-4463. A claim names its goods receipt, and a receipt is named after
 * the order it was raised against — GR-4471-02 is the second receipt on SO-4471
 * — so the claim's order falls out of the reference it already carries.
 *
 * Returns null rather than guessing. A claim can be raised before a receipt
 * exists, and a backhaul leg may carry nothing at all.
 */
export interface LinkedOrder {
  ref: string;
  /** True for a purchase order — goods coming into the plant stores. */
  inbound: boolean;
}

/** A purchase order the buyer's book actually holds. */
function poExists(ref: string): boolean {
  return QUEUES.buyer.rows.some((b) => b.ref === ref);
}

export function linkedOrderOf(row: ActionRow): LinkedOrder | null {
  /* An explicit tie wins, whichever kind it names. */
  if (row.chainFrom?.startsWith("SO-")) return { ref: row.chainFrom, inbound: false };
  if (row.chainFrom?.startsWith("PO-")) return { ref: row.chainFrom, inbound: true };

  /* A stores requisition looks the other way: what a CSR wants beside SO-4471
     is the purchase order the parts are coming in on, because that is where the
     date they are about to promise comes from. Same shared-number convention,
     read upstream instead of down. */
  if (row.ref.startsWith("SO-")) {
    const po = `PO-${row.ref.slice(3)}`;
    if (poExists(po)) return { ref: po, inbound: true };
  }

  const receipt = row.claim?.receipt;
  if (receipt?.startsWith("GR-")) {
    /* A claim is filed against a stores requisition — that is the record it
       argues about, the one the credit is raised on and the plant quotes back.
       The purchase order behind it is two steps away and not the reference
       anybody adjudicating a claim reaches for. */
    const so = `SO-${receipt.slice(3).split("-")[0]}`;
    if (orderById(so)) return { ref: so, inbound: false };
  }

  if (row.ref.startsWith("PO-")) {
    const so = `SO-${row.ref.slice(3)}`;
    if (orderById(so)) return { ref: so, inbound: false };
  }
  return null;
}
