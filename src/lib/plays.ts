/* ═══════════════════════════════════════════════════════════════
 *  What the buyer has actually done with each play
 *
 *  `PLAYS` is a fixture: a play's stage is written into the module
 *  and never moves. So "Commit" raised a toast and the row sat
 *  exactly where it was — the one thing the reader was watching for
 *  did not happen, which teaches them the button is decoration.
 *
 *  This holds the decisions on top of the fixture. Accepting moves a
 *  play from Feed into Act; committing moves it from Act into
 *  Committed and starts its ramp; dismissing takes it out. The
 *  tracker's steps live here too, because working a step is a
 *  decision like any other and belongs in the same place.
 *
 *  In memory, like `actioned.ts` and for the same reason: the demo is
 *  walked through more than once, and a reload has to put every play
 *  back where it started.
 * ═══════════════════════════════════════════════════════════════ */

import { useMemo, useSyncExternalStore } from "react";
import {
  PLAYS,
  tasksFor,
  type Play,
  type PlayStage,
  type PlayTask,
  type RampPoint,
} from "@/data/buying";

const EVENT = "shaw:plays-change";

/** The RAG level a buyer can force on a live play — Allison's `demoRisk`.
 *  In-memory only; a real read comes from the ERP once connected. */
export type PlayRisk = "on-track" | "behind" | "at-risk";

/** What the buyer has changed about one play. */
interface Decision {
  stage?: PlayStage;
  /** How far through the lever chain — see Play.flowStep. */
  flowStep?: number;
  tasks?: PlayTask[];
  /** The rate they committed, where it differs from the recommendation. */
  committedRate?: number;
  /** Why, when they overrode the rate. */
  rateReason?: string;
  dismissReason?: string;
  committedOn?: string;
  /** Overridden ramp — set when a play goes live (realized cleared until ERP)
   *  or when the ERP is connected (realized filled from projected). */
  ramp?: RampPoint[];
  /** The forced RAG level on a live play. Demo-only. */
  risk?: PlayRisk;
  /** Green-flash-then-move, the same beat the queue uses. */
  settling?: boolean;
}

const decisions = new Map<string, Decision>();
let snapshot: ReadonlyMap<string, Decision> = new Map();
const EMPTY: ReadonlyMap<string, Decision> = new Map();

function commit() {
  snapshot = new Map(decisions);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function edit(id: string, patch: Decision) {
  decisions.set(id, { ...decisions.get(id), ...patch });
  commit();
}

/** How long a play holds its green before it moves tab. */
export const SETTLE_MS = 1500;

/** Flash, then move — so the reader sees which row left and why. */
function moveTo(id: string, stage: PlayStage, extra: Decision = {}) {
  edit(id, { ...extra, settling: true });
  window.setTimeout(() => edit(id, { stage, settling: false }), SETTLE_MS);
}

/**
 * Take the play on. It leaves the feed and lands in Act with its playbook
 * seeded — accepting is agreeing to run it, not to its number, which is why the
 * figure is committed later and from the tracker rather than here.
 */
export function acceptPlay(play: Play): void {
  moveTo(play.id, "accepted", { tasks: tasksFor(play) });
}

/**
 * A step of the lever chain has run. The play advances but stays in the feed.
 *
 * Qualifying, not accepted: the buyer has had IRIS review the index or price the
 * make-vs-buy, which is work done ON the play and not yet a commitment to run
 * it. So it stays where a reader can still walk away from it, and the row's
 * button offers the next step rather than the one just finished — a table that
 * re-offers a move the transcript above it has already made is a table nobody
 * trusts.
 *
 * No settle flash: the row is not leaving, and flashing green for something
 * that stays put reads as a completion that did not happen.
 */
export function advanceFlow(play: Play, step: number): void {
  edit(play.id, { flowStep: step, stage: "qualifying" });
}

/** Commit the value. The play leaves Act and starts being tracked. */
export function commitPlay(
  play: Play,
  opts: { rate?: number; reason?: string; on: string } = { on: "12 Aug" },
): void {
  moveTo(play.id, "committed", {
    committedRate: opts.rate,
    rateReason: opts.reason,
    committedOn: opts.on,
  });
}

export function dismissPlay(play: Play, reason: string): void {
  moveTo(play.id, "dismissed", { dismissReason: reason });
}

/**
 * Park it. Not a rejection — a play that is right and early.
 *
 * Kept apart from dismissal because the two mean opposite things about the
 * play's merit, and folding them together loses the only information a parked
 * play carries: that somebody thought it was worth coming back to.
 */
export function parkPlay(play: Play, reason: string): void {
  moveTo(play.id, "parked", { dismissReason: reason });
}

/**
 * Make a committed play live — it moves into execution and starts appearing on
 * the savings ramp. Realized is cleared to `undefined` on every point: a play
 * that just went live has landed nothing yet, and the projected bars stand
 * alone until the ERP posts actuals. Mirrors Allison's `advanceStage`
 * committed → in-execution, where realized fills later.
 */
export function makeLivePlay(play: Play): void {
  const cleared = (play.ramp ?? []).map((r) => ({ ...r, realized: undefined }));
  moveTo(play.id, "realizing", { ramp: cleared });
}

/** Take a live play back to committed — the way out of going live too early. */
export function revertLive(play: Play): void {
  const d = decisions.get(play.id);
  moveTo(play.id, "committed", { ...d, ramp: undefined, risk: undefined });
}

/**
 * Connect the ERP for one live play: the projected figures land as realized for
 * every quarter up to now, and the play settles into Realized once the ramp is
 * fully reported. This is the demo stand-in for the ERP posting actuals.
 */
export function connectErp(play: Play): void {
  const ramp = play.ramp ?? [];
  const filled = ramp.map((r) => ({ ...r, realized: r.projected }));
  edit(play.id, { ramp: filled });
  window.setTimeout(() => moveTo(play.id, "realized", { ramp: filled }), 400);
}

/** Force the RAG level on a live play. Clears with `null`. */
export function setPlayRisk(play: Play, risk: PlayRisk | null): void {
  edit(play.id, { risk: risk ?? undefined });
}

/** Put a committed or dismissed play back in the feed. The way out of a mistake. */
export function reopenPlay(play: Play): void {
  decisions.delete(play.id);
  commit();
}

/** Work a step. Done and skipped both count as fulfilled; open reopens it. */
export function markTask(play: Play, index: number, status: PlayTask["status"]): void {
  const tasks = [...(decisions.get(play.id)?.tasks ?? tasksFor(play))];
  if (!tasks[index]) return;
  tasks[index] = { ...tasks[index], status };
  edit(play.id, { tasks });
}

/** Attach a file to an upload step, which also completes it — the gate. */
export function attachToTask(play: Play, index: number, name: string): void {
  const tasks = [...(decisions.get(play.id)?.tasks ?? tasksFor(play))];
  if (!tasks[index]) return;
  tasks[index] = { ...tasks[index], attachment: name, status: "done" };
  edit(play.id, { tasks });
}

/** Add a step the playbook did not think of. */
export function addTask(play: Play, label: string): void {
  const tasks = [...(decisions.get(play.id)?.tasks ?? tasksFor(play))];
  tasks.push({ label, kind: "manual", status: "open", custom: true });
  edit(play.id, { tasks });
}

export function removeTask(play: Play, index: number): void {
  const tasks = [...(decisions.get(play.id)?.tasks ?? tasksFor(play))];
  tasks.splice(index, 1);
  edit(play.id, { tasks });
}

/** Reset every decision — the way to run the demo again without a reload. */
export function resetPlays(): void {
  if (!decisions.size) return;
  decisions.clear();
  commit();
}

function subscribe(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/**
 * The plays as they now stand, with the buyer's decisions applied.
 *
 * One reader for every surface — the table, the record page, the command
 * center — so a play cannot be in Act on one screen and in the feed on
 * another.
 */
export function usePlays(): {
  plays: Play[];
  byId: (id: string) => Play | undefined;
  tasks: (play: Play) => PlayTask[];
  isSettling: (id: string) => boolean;
  /** The forced RAG level on a play, reactively. */
  riskById: (id: string) => PlayRisk | undefined;
  /** True once every step is done or skipped — what unlocks the commit. */
  fulfilled: (play: Play) => boolean;
} {
  const map = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);

  return useMemo(() => {
    const applied = PLAYS.map((p) => {
      const d = map.get(p.id);
      if (!d) return p;
      return {
        ...p,
        stage: d.stage ?? p.stage,
        /* Named one by one rather than spread, so a `Decision` field that is not
           part of the play — `settling`, `tasks` — cannot leak onto it. Which is
           right, and is also why `flowStep` sat in the store for a while doing
           nothing: the chain advanced, the decision recorded it, and the table
           kept reading the fixture because nobody had listed it here. */
        flowStep: d.flowStep ?? p.flowStep,
        committedOn: d.committedOn ?? p.committedOn,
        dismissReason: d.dismissReason ?? p.dismissReason,
        ramp: d.ramp ?? p.ramp,
      };
    });
    const tasksOf = (play: Play) => map.get(play.id)?.tasks ?? tasksFor(play);
    return {
      plays: applied,
      byId: (id) => applied.find((p) => p.id === id),
      tasks: tasksOf,
      isSettling: (id) => map.get(id)?.settling === true,
      riskById: (id) => map.get(id)?.risk,
      fulfilled: (play) => {
        const t = tasksOf(play);
        return t.length > 0 && t.every((x) => x.status !== "open");
      },
    };
  }, [map]);
}

/** The forced RAG level on a play, where one is set. Read outside React. */
export function riskOf(id: string): PlayRisk | undefined {
  return snapshot.get(id)?.risk;
}

/** The rate the buyer committed, where they set one. */
export function committedRateOf(id: string): { rate?: number; reason?: string } {
  const d = snapshot.get(id);
  return { rate: d?.committedRate, reason: d?.rateReason };
}
