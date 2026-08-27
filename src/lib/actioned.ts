/* ═══════════════════════════════════════════════════════════════
 *  Rows the agent has already dealt with
 *
 *  An action centre is a list of things still owed. The moment the
 *  lead time is committed, the line is not owed any more — leaving it
 *  sitting there is how a queue becomes a list nobody trusts, because
 *  the reader has to remember which of the six they already did.
 *
 *  So the row goes. But not instantly: it holds for a beat in green
 *  first. A row that vanishes the moment a card appears in the panel
 *  reads as a glitch — the eye was on the transcript, and the list
 *  quietly got shorter behind it. The green beat is the row saying
 *  "this one, and it's done" before it leaves, which is the difference
 *  between a disappearance and a completion.
 *
 *  In memory, deliberately — not localStorage. This is a prototype
 *  that gets walked through more than once, and a queue that stayed
 *  empty after the first run would leave the next room with nothing to
 *  look at. Module state dies with the page, so a reload is the reset:
 *  the rows leave while you work and every one of them is back on F5.
 * ═══════════════════════════════════════════════════════════════ */

import { useMemo, useSyncExternalStore } from "react";

/** How long the finished row holds its green before it leaves. */
export const SETTLE_MS = 1500;

const EVENT = "shaw:actioned-change";

type Phase = "settling" | "gone";

/** How the line reads once the run has landed — the agent's own words for it. */
export interface SettledCopy {
  status: string;
  insight: string;
  /**
   * Which list the row belongs to now.
   *
   * The buying, service and logistics queues have one destination — Settled —
   * so they leave this alone. Inventory Planning has several: a position can be
   * approved, or parked on a watchlist, and those are different answers that
   * both remove it from the review queue. Naming the bucket beats inferring it
   * from `status`, which is the agent's own prose and will not survive being
   * pattern-matched.
   */
  bucket?: "approved" | "watchlist";
}

interface Entry {
  phase: Phase;
  copy?: SettledCopy;
}

/* One map, one snapshot object rebuilt on every change. `useSyncExternalStore`
   compares snapshots by reference, so it must be a new object per change and
   the same object between them. */
const phases = new Map<string, Entry>();
let snapshot: ReadonlyMap<string, Entry> = new Map();
const EMPTY: ReadonlyMap<string, Entry> = new Map();

function commit() {
  snapshot = new Map(phases);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/**
 * The row's run has landed: flash it, then drop it.
 *
 * Idempotent, because a follow-on run inside the same conversation reports
 * against the same row and should not restart the animation on a row that has
 * already gone.
 */
export function settleRow(id: string, copy?: SettledCopy): void {
  if (phases.has(id)) return;
  phases.set(id, { phase: "settling", copy });
  commit();
  window.setTimeout(() => {
    phases.set(id, { phase: "gone", copy });
    commit();
  }, SETTLE_MS);
}

/** Put every row back, without a reload. */
export function resetActioned(): void {
  if (!phases.size) return;
  phases.clear();
  commit();
}

export function subscribeActioned(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function actionedSnapshot(): ReadonlyMap<string, Entry> {
  return snapshot;
}

/** The server has no opinion — every row is still owed until the client says so. */
export function actionedServerSnapshot(): ReadonlyMap<string, Entry> {
  return EMPTY;
}

/**
 * What a queue should do with each row right now.
 *
 * One hook so every surface that counts rows — the table, the summary cards,
 * the rail badge — is reading the same list. A row that has left the table but
 * is still inside "6 need a decision" is the kind of disagreement the whole
 * prototype is arguing against.
 */
export function useActioned(): {
  /** True while the row is holding its green. */
  isSettling: (id: string) => boolean;
  /**
   * What was decided about a row, once it has left.
   *
   * For the surfaces whose rows are not `ActionRow`s — Inventory Planning's
   * positions are `Exception`s, keyed `sku@branch` — and which therefore cannot
   * use `live()` but need the same answer: is this one still owed?
   */
  decision: (id: string) => SettledCopy | undefined;
  /**
   * Re-states the rows the agent has finished with.
   *
   * Settled, not deleted. The work happened, and a queue that erases what was
   * done cannot answer "what did I decide this morning?" — the line leaves the
   * open tab because it is no longer owed, and turns up under Settled because
   * it is now a record. It carries the agent's own words for what it did rather
   * than the words that described the problem.
   */
  live: <T extends { id: string; state: string; status: string; insight: string }>(
    rows: readonly T[],
  ) => T[];
} {
  const map = useSyncExternalStore(subscribeActioned, actionedSnapshot, actionedServerSnapshot);
  return useMemo(
    () => ({
      isSettling: (id) => map.get(id)?.phase === "settling",
      decision: (id) => (map.get(id)?.phase === "gone" ? map.get(id)?.copy : undefined),
      live: (rows) =>
        map.size
          ? rows.map((r) => {
              const e = map.get(r.id);
              if (e?.phase !== "gone") return r;
              return {
                ...r,
                state: "settled",
                status: e.copy?.status ?? r.status,
                insight: e.copy?.insight ?? r.insight,
              };
            })
          : [...rows],
    }),
    [map],
  );
}
