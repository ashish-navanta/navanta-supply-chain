/* ═══════════════════════════════════════════════════════════════
 *  Has the customer actually been told?
 *
 *  A lead time is two facts, and only one of them lives in the
 *  buyer's seat. Mercer can write 40 days to the supplier record on
 *  its own; it cannot tell the store region whose reset crew is booked
 *  against the old date. That conversation happens in the service
 *  seat, through Christy, and until it has happened the commit is
 *  only half done.
 *
 *  So this is read, not asserted. The buying row's style is the same
 *  string as the account order's, which is what lets one seat check
 *  the other rather than both claiming the same thing separately —
 *  the queue used to end every lead-time line with "customer
 *  informed" whether or not anyone had been.
 * ═══════════════════════════════════════════════════════════════ */

import { QUEUES, type ActionRow } from "./action-center";
import { orderById } from "./service";
import { PERSONAS } from "@/types/persona";

export interface NoticedOrder {
  ref: string;
  account: string;
  /** A booked crew is why a slip on a small order can outrank a big one. */
  crewBooked: boolean;
  told: boolean;
  /** How it stands in the service seat, in that seat's own words. */
  standing: string;
}

export interface CustomerNotice {
  /** True only when every affected account has actually been contacted. */
  told: boolean;
  orders: NoticedOrder[];
  /** The accounts still owed the conversation. */
  owed: NoticedOrder[];
  /**
   * The accounts, named, for copy.
   *
   * One PO carries one item to one account order, so this is a name rather than
   * a count — "Eastbay Stores has not been told" says who to go and
   * find, where "1 account has not been told" makes the reader open the step to
   * learn the only thing they wanted. The join is a guard, not an expectation.
   */
  named: string;
  /** Who owns that conversation — named, because it is a hand-off. */
  by: string;
  agent: string;
}

/**
 * What the service seat says about a buying row's accounts.
 *
 * Returns null when nothing downstream is affected, which is the honest
 * answer for a line no account order is waiting on.
 */
export function noticeFor(row: ActionRow): CustomerNotice | null {
  /* An account order and the purchase order behind it now share a number —
     SO-4463 is the outbound half of PO-4463 — so the pairing is the reference
     itself. The product fallback stays for orders that name the same product but
     were never numbered against a PO. */
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
 * The queue line's clause about the customer — true per row, not boilerplate.
 *
 * Only where a promise date actually moves. A transfer quote or a silent PO can
 * share an item with an account order without changing anything the account was
 * told, and hanging "1 account not told" off those lines would report a debt
 * that the row does not owe.
 */
export function noticeTail(row: ActionRow): string {
  if (row.signal !== "lead-time-jump" && row.signal !== "capacity") return "";
  const notice = noticeFor(row);
  if (!notice) return "";
  return notice.told ? ` · ${notice.named} informed` : ` · ${notice.named} not told`;
}


/* ─── The other end of the same shipment ──────────────────────────
 * An account order and the purchase order behind it are one event seen
 * from two seats. SO-4471 is 10,200 Chunky Knit Throw Blankets ·
 * Honey for Eastbay Stores; PO-4471 is the same 10,200 units from Luen
 * Hing in Dongguan. When the supplier moves, both seats are looking at
 * that move — and they should be saying the same thing about it.
 * ─────────────────────────────────────────────────────────────── */

/**
 * The buying row a service row is waiting on.
 *
 * Read from the row's own `chainFrom` rather than matched on product. Product
 * matching held only while every seat spelled an item identically, and it did
 * not: the planner's line for this same SKU was filed under "Home ·
 * Textiles" where the buyer had "Chunky Knit Throw Blanket", so the link
 * silently went missing on exactly the row it mattered most for. A named
 * reference cannot drift.
 *
 * The product match stays as a fallback for rows that predate the explicit link —
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
 * A purchase order feeds an account order; a claim is filed against
 * one. Both relationships are already in the data — the shared
 * number on one side, the goods receipt on the other — so neither
 * needs a column of its own in the fixtures.
 * ─────────────────────────────────────────────────────────────── */

/**
 * The order a row is against, and which way its goods are moving.
 *
 * The reference already says the direction and nothing was reading it. A
 * purchase order ends at a Target RDC, so a load carrying one is inbound; a sales
 * order leaves an RDC for an account, so a load carrying one is outbound. On a
 * logistics queue that is not decoration — it is the difference between a
 * drayage off a vessel at Long Beach and a store delivery a set crew is waiting
 * on, and the two are worked by different people against different clocks.
 *
 * A purchase order feeds the order that shares its number: PO-4463 supplies
 * SO-4463. A claim names its goods receipt, and a receipt is named after the
 * order it was raised against — GR-4471-02 is the second receipt on SO-4471 — so
 * the claim's order falls out of the reference it already carries.
 *
 * Returns null rather than guessing. A claim can be raised before a receipt
 * exists, and a backhaul leg may carry nothing at all.
 */
export interface LinkedOrder {
  ref: string;
  /** True for a purchase order — goods coming into a Target RDC. */
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

  /* An account order looks the other way: what a CSR wants beside SO-4471 is the
     purchase order the goods are coming in on, because that is where the date
     they are about to promise comes from. Same shared-number convention, read
     upstream instead of down. */
  if (row.ref.startsWith("SO-")) {
    const po = `PO-${row.ref.slice(3)}`;
    if (poExists(po)) return { ref: po, inbound: true };
  }

  const receipt = row.claim?.receipt;
  if (receipt?.startsWith("GR-")) {
    /* A claim is filed against a sales order — that is the record it argues
       about, the one the credit is raised on and the account quotes back. The
       purchase order behind it is two steps away and not the reference anybody
       adjudicating a claim reaches for. */
    const so = `SO-${receipt.slice(3).split("-")[0]}`;
    if (orderById(so)) return { ref: so, inbound: false };
  }

  if (row.ref.startsWith("PO-")) {
    const so = `SO-${row.ref.slice(3)}`;
    if (orderById(so)) return { ref: so, inbound: false };
  }
  return null;
}
