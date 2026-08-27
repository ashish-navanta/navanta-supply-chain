/* ═══════════════════════════════════════════════════════════════
 *  Where a reference goes
 *
 *  A purchase order, a account order, a claim and a SKU all have record
 *  pages of their own; a load does not, and still opens its seat's
 *  review sheet. One resolver so a reference lands in
 *  the same place wherever it is printed — the queue's cell, the
 *  agent's state card, a link in an outcome — because a PO- that
 *  opens the record in one place and the queue in another teaches
 *  the reader that the link is a lottery.
 *
 *  Resolved from the reference rather than the seat: the service
 *  queue carries both SO- and PO- lines, and each should land where
 *  it lives rather than where it was read from.
 * ═══════════════════════════════════════════════════════════════ */

import { claimRoute, orderRoute, poRoute, productRoute } from "@/data/nav";
import { claimById, orderById } from "@/data/service";
import { skuRecord } from "@/data/catalogue";
import { QUEUES } from "@/data/action-center";

export function recordHref(ref: string, fallback: string): string {
  if (ref.startsWith("PO-") && QUEUES.buyer.rows.some((r) => r.ref === ref)) return poRoute(ref);
  if (ref.startsWith("SO-") && orderById(ref)) return orderRoute(ref);
  /* A queue row can name a line of a claim — "CLM-2041 · L2" — and the line is
     not a record. The claim it belongs to is, so the reference is trimmed to it
     rather than falling back to the queue. */
  /* A SKU has a page now — the catalogue's, which is the same record whichever
     seat printed the number. */
  if (skuRecord(ref)) return productRoute(ref);
  if (ref.startsWith("CLM-")) {
    const id = ref.split(" ")[0];
    if (claimById(id)) return claimRoute(id);
  }
  return fallback;
}
