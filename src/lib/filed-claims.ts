"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ActionRow } from "@/data/action-center";

/**
 * Claims filed in this session, and the queue row each one becomes.
 *
 * The wizard could take a claim from a delivery to a filed reference and then
 * left the reader on a card in the chat with no line anywhere. The Claims tab
 * still showed the two it was built with, so the honest reading of the screen
 * was that nothing had been filed — the panel said one thing and the queue
 * beside it said another.
 *
 * Session-scoped and in memory, like `actioned`: this is a prototype, and a
 * claim that survived a reload would be a fixture pretending to be a database.
 * What it has to survive is the reader's attention, which lasts about as long
 * as the animation below.
 */

/** How long a new row keeps its arriving highlight. Long enough to catch the
 *  eye of somebody still reading the chat panel when it lands, short enough
 *  that it is over before they look away. */
export const ARRIVE_MS = 2600;

interface Entry {
  row: ActionRow;
  /** When it landed, so the highlight can expire on its own. */
  at: number;
}

const filed = new Map<string, Entry>();
const listeners = new Set<() => void>();

/* A stable snapshot: `useSyncExternalStore` compares by identity, so the array
   is rebuilt only when something actually changed. Returning a fresh one every
   read is an infinite render. */
let snapshot: readonly ActionRow[] = [];
let arriving: ReadonlySet<string> = new Set();

function publish() {
  /* Newest first. A claim filed thirty seconds ago is the one being looked
     for, and the queue's own sort can take it from there. */
  const entries = [...filed.values()].sort((a, b) => b.at - a.at);
  snapshot = entries.map((e) => e.row);
  arriving = new Set(entries.filter((e) => Date.now() - e.at < ARRIVE_MS).map((e) => e.row.id));
  for (const fn of listeners) fn();
}

/** Put a filed claim on the queue. */
export function fileClaim(row: ActionRow): void {
  filed.set(row.id, { row, at: Date.now() });
  publish();
  /* One more publish when the highlight expires, so the row settles to its
     normal state without the table having to poll for it. */
  setTimeout(publish, ARRIVE_MS + 50);
}

export function resetFiledClaims(): void {
  filed.clear();
  publish();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const EMPTY: readonly ActionRow[] = [];
function getSnapshot(): readonly ActionRow[] {
  return snapshot;
}
/* Nothing is filed on the server, and returning the live snapshot from here
   would hydrate a row the server never rendered. */
function getServerSnapshot(): readonly ActionRow[] {
  return EMPTY;
}

export function useFiledClaims(): {
  rows: readonly ActionRow[];
  /** True while the row is still landing, for the arriving highlight. */
  isArriving: (id: string) => boolean;
} {
  const rows = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => ({ rows, isArriving: (id: string) => arriving.has(id) }), [rows]);
}
