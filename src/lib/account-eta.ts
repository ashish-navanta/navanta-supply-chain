"use client";

import { QUEUES, daysFromToday, shiftDate } from "@/data/action-center";
import { DC_TO_DEALER_DAYS, orderById } from "@/data/service";
import { leadCommitOf } from "@/lib/lead-commit";

/* ─── What a commit upstream does to a account's date ──────────────
 * The last link in the chain the four seats exist to demonstrate. A
 * purchase order lands at a Target RDC; the goods then have to travel the
 * order's own lane to the account. So the account's date is the PO's
 * receipt date plus that leg, and moving the receipt moves the
 * delivery with it.
 * ─────────────────────────────────────────────────────────────── */

/* The leg itself lives with the orders, where the base derivation uses it too —
   see `dealerEtaFor`. One number for one journey. */
export { DC_TO_DEALER_DAYS } from "@/data/service";

/**
 * The purchase order a account order is actually waiting on.
 *
 * The service queue's own tie, not a shared number — see `dealerEtaFor` for why
 * the number alone is not enough. An order shipping out of DC stock owes nothing
 * to whatever is inbound under the same digits.
 */
export function upstreamPoOf(orderId: string): string | null {
  if (!orderId.startsWith("SO-")) return null;
  const held = QUEUES.csr.rows.find((r) => r.ref === orderId)?.chainFrom;
  return held?.startsWith("PO-") && QUEUES.buyer.rows.some((b) => b.ref === held) ? held : null;
}

/**
 * When the account can actually have it, given what the buyer has committed.
 *
 * Null until a commit exists — before that the order's own `currentEta` is the
 * best anybody has, and substituting a derived date for it would be the app
 * inventing a promise nobody made.
 */
export function dealerEtaAfterCommit(orderId: string): { date: string; poRef: string } | null {
  const poRef = upstreamPoOf(orderId);
  const commit = leadCommitOf(poRef);
  if (!poRef || !commit) return null;
  const order = orderById(orderId);
  /* Delivered is history, not a forecast. */
  if (order?.stage === "delivered") return null;
  const date = shiftDate(commit.landsOn, DC_TO_DEALER_DAYS);
  /* Later of the two, never earlier — the same rule `dealerEtaFor` applies, and
     for the same reason: a buyer who negotiates the slip DOWN has bought slack,
     not permission to arrive before the account's crew. */
  const a = daysFromToday(date);
  const b = order ? daysFromToday(order.currentEta) : null;
  if (a !== null && b !== null && a <= b) return null;
  return { date, poRef };
}
