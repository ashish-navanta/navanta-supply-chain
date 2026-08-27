"use client";

/* ═══════════════════════════════════════════════════════════════
 *  Lead times the buyer has actually committed
 *
 *  Committing a lead time on PO-4463 is the one decision in this
 *  prototype that is supposed to be felt in another seat. The plant
 *  caps its line, Mercer writes the longer lead time to the supplier
 *  record, and the date Summit Department Stores is waiting on moves — that IS
 *  the story the four seats exist to tell.
 *
 *  It was not being told. The commit settled the buyer's row and drew
 *  its own outcome card, and the account order downstream carried on
 *  reading 29 Aug as if nothing had happened. So the demo's central
 *  claim — one decision, four desks — was the one thing the app could
 *  not show: you had to take it on trust from a paragraph.
 *
 *  This holds the commit itself: which purchase order, how many days,
 *  and the date the goods now book in at the DC. The service seat
 *  reads it to work out when the account's order can actually land.
 *
 *  In memory, like `actioned.ts` and `plays.ts` and for the same
 *  reason: the walkthrough is given more than once, and a reload has
 *  to put every date back where it started.
 * ═══════════════════════════════════════════════════════════════ */

import { useMemo, useSyncExternalStore } from "react";

const EVENT = "shaw:lead-commit-change";

export interface LeadCommit {
  /** The lead time now on the supplier record, in days. */
  days: number;
  /** The lead time it replaced — what the plan had been built on. */
  was: number;
  /** When the goods now book in at the Target RDC. */
  landsOn: string;
  /** True when the buyer took a figure other than the agent's recommendation. */
  overridden?: boolean;
}

const commits = new Map<string, LeadCommit>();
let snapshot: ReadonlyMap<string, LeadCommit> = new Map();
const EMPTY: ReadonlyMap<string, LeadCommit> = new Map();

function publish() {
  snapshot = new Map(commits);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/**
 * Record a committed lead time against its purchase order.
 *
 * Keyed on the PO reference rather than the queue row's id, because the reader
 * downstream has a purchase order number and no idea what `b3` is.
 */
export function commitLead(poRef: string, commit: LeadCommit): void {
  commits.set(poRef, commit);
  publish();
}

/** Put every date back, without a reload. */
export function resetLeadCommits(): void {
  if (!commits.size) return;
  commits.clear();
  publish();
}

/** The commit against a purchase order, outside React. */
export function leadCommitOf(poRef: string | null | undefined): LeadCommit | undefined {
  return poRef ? snapshot.get(poRef) : undefined;
}

function subscribe(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/**
 * What has been committed, for a component that has to re-render when it is.
 *
 * One reader for every surface — the PO page, the account order, the CSR's queue
 * — so a date cannot have moved on one screen and not the next.
 */
export function useLeadCommits(): {
  of: (poRef: string | null | undefined) => LeadCommit | undefined;
  any: boolean;
} {
  const map = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  return useMemo(
    () => ({
      of: (poRef) => (poRef ? map.get(poRef) : undefined),
      any: map.size > 0,
    }),
    [map],
  );
}
