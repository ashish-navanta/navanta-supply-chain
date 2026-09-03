/* ═══════════════════════════════════════════════════════════════
 *  What the agent will do with a line, if you let it
 *
 *  Every queue row already ends its insight with an imperative —
 *  "push for a firmer date", "chase the supplier". Until now that was
 *  dead text: it told you to do something and gave you nothing to
 *  press. This file turns each of those tails into a task the agent
 *  can run, and the row's second button runs it.
 *
 *  The label here and the tail in `insightText` are deliberately the
 *  same words. The sentence names the action; the button performs it.
 *
 *  A task narrates rather than just committing. The old one-press
 *  Approve wrote the figure and raised a toast, which told you the
 *  outcome and nothing about the work — so a person could not tell a
 *  considered decision from a rubber stamp. These run in the chat
 *  panel: what was read, what was weighed, what was sent, then the
 *  outcome, then the toast.
 * ═══════════════════════════════════════════════════════════════ */

import {
  DELIVERY_WINDOW,
  SLIP_DAYS,
  contactFor,
  formatUsd,
  linesFor,
  shiftDate,
  reorderPoint,
  type ActionRow,
} from "./action-center";
import {
  poStateAfter,
  poStateCommitted,
  poStateFor,
  soStateFor,
  soStateRepromised,
  type TrackedState,
} from "./po-state";
import { noticeFor, upstreamFor } from "./customer-notice";
import { orderById } from "./service";
import type { LiveCallRequest } from "@/lib/live-call";

/* ── Saying it out loud ───────────────────────────────────────────────────
   Everything handed to a voice agent is read aloud, so it has to be written
   the way a person says it rather than the way the fixtures store it. These
   two convert; they are used only for the live call's variables, never for
   anything drawn on screen, where the app's own date and clock formats win. */

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
function ordinal(n: number): string {
  const teen = n % 100;
  if (teen >= 11 && teen <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const MONTHS: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April",
  May: "May", Jun: "June", Jul: "July", Aug: "August",
  Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/** "6 Sep" → "September 6th". Left alone where it does not parse, because a
 *  date read out verbatim is better than one mangled by a guess. */
function spokenDate(value: string): string {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})/.exec(value.trim());
  if (!m) return value;
  const month = MONTHS[m[2]];
  return month ? `${month} ${ordinal(Number(m[1]))}` : value;
}

/** "08:00" → "8:00 AM". A 24-hour clock is read back as "oh eight hundred",
 *  which is not how anybody confirms a delivery window. */
function spokenClock(value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return value;
  const h = Number(m[1]);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** One thing the agent did, and where it did it. */
/** One side of a recorded call — who spoke, and what they said. */
export interface CallTurn {
  speaker: string;
  text: string;
  /**
   * Seconds into the audio where this turn starts, for the playback highlight.
   *
   * Only set where a real file is attached, and measured off that file rather
   * than estimated from the word count: the highlight is a claim about what the
   * reader is hearing right now, and a claim timed by guesswork drifts a turn
   * out by the middle of the call. A templated transcript has no offsets and
   * gets no highlight, which is correct — there is nothing to be in time with.
   */
  at?: number;
}

/**
 * A call the agent placed, kept as a recording.
 *
 * On a chase, the outcome rests entirely on what was asked and what came back.
 * "Called Joe" reports that a call happened; this says whether the right
 * question was put and whether the answer was a date or a brush-off.
 */
export interface CallRecording {
  /** The call already happened. Renders as a recording rather than animating. */
  past?: boolean;
  with: string;
  duration: string;
  /**
   * A real recording under /public, where one exists.
   *
   * Optional, and most calls do not have one — the transcript is the substance
   * and a fixture with no audio is honest about being a fixture. Where a file IS
   * attached, playback uses it rather than sweeping a fake playhead, and the
   * clock reads the file's own length instead of the `duration` string.
   */
  audio?: string;
  when: string;
  number: string;
  turns: CallTurn[];
  /**
   * What this card needs to place a REAL call instead of replaying a fixture.
   *
   * Set on the one row wired for it. The card still needs a deployment that has
   * the keys — the panel strips this back off where there are none — so a
   * checkout with no credentials behaves exactly as it always did rather than
   * showing a card that cannot ring anybody.
   */
  live?: LiveCallRequest;
}

/**
 * The visible artifact the agent produced on a run. Four shapes cover the
 * whole feed-flow vocabulary — a written document (RFP, clause, memo, email),
 * a two-column cost compare, a ranked vendor shortlist, or an index trend.
 */
export type FlowArtifact =
  | {
      kind: "doc";
      /** Small uppercase kicker above the title — "DRAFT · RFP scope". */
      kicker: string;
      title: string;
      /** Optional labelled fields at the top ("To", "Subject"). */
      fields?: { label: string; value: string }[];
      /** Body paragraphs — plain strings, one per paragraph. */
      body: string[];
    }
  | {
      kind: "compare";
      title: string;
      aLabel: string;
      bLabel: string;
      rows: { label: string; a: string; b: string; delta?: string; tone?: "good" | "behind" }[];
    }
  | {
      kind: "ranked";
      title: string;
      columns: string[];
      rows: { cells: string[]; leader?: boolean }[];
      footnote?: string;
    }
  | {
      /* The deck's math waterfall, keyed on its position — the same worked sum
         the deck's tab shows, so the run does not re-derive it a second way. */
      kind: "math";
      positionKey: string;
    }
  | {
      /* The criteria the routing engine applied to a position — the rule, the
         figure this one measured, and which way each comparison went. Keyed on
         the position so the thresholds come from the policy rather than from a
         copy of it made here. See `gatesFor`. */
      kind: "gates";
      positionKey: string;
    }
  | {
      /* The deck's own trajectory chart, keyed on the position it belongs to —
         twelve weeks of demand, eight of forecast, and projected on-hand against
         Order-Up-To / ROP / safety stock. Carried as a key rather than as points
         so the run and the deck cannot draw two different charts of one line. */
      kind: "trajectory";
      positionKey: string;
    }
  | {
      kind: "mini-chart";
      title: string;
      unit: string;
      points: { period: string; value: number }[];
      note?: string;
    };

/** An outbound message, kept as what was actually written. */
export interface MessageDraft {
  to: string;
  address: string;
  subject: string;
  lines: string[];
  when: string;
  /** Choices laid out side by side, where the message is asking for one. */
  options?: { label: string; detail: string }[];
}

export interface AgentStep {
  /** The one-line summary, which is all that shows until it is opened. */
  label: string;
  /** The detail behind it — read on demand, not by default. */
  text: string;
  /** The system or person it touched — the same sourcing discipline the
   *  detail panels use, so a narrated step is checkable. */
  source?: string;
  /** Renders the step as a recording rather than a line of text. */
  call?: CallRecording;
  /** Renders the step as the message itself. */
  message?: MessageDraft;
}

/** Check for a write, phone or paper plane for a message that leaves. */
export type AgentIcon = "commit" | "call" | "email" | "send" | "flag";

export interface AgentTask {
  /** Row id — keys the run so re-pressing restarts cleanly. */
  id: string;
  /**
   * What this run does to the record it came from, once the outcome lands.
   *
   * The panel narrates and the store decides — a run that reports "RFP scoped"
   * and leaves the row sitting in the feed saying "Start RFP" is the transcript
   * and the table disagreeing about what happened. Fired after the outcome, so
   * the reader sees the result before the row moves under them.
   */
  onLanded?: () => void;
  /**
   * Which list the row belongs to once this run lands.
   *
   * Omitted on the three queues that have one destination — Settled — and set
   * on Inventory Planning, where an approval and a watchlist parking both take
   * a position out of review but are not the same answer. See SettledCopy.
   */
  settleBucket?: "approved" | "watchlist";
  /** The verb phrase. Matches the insight's closing clause exactly. */
  label: string;
  /** What the person is taken to have asked for. */
  ask: string;
  /** The agent's opening line, before any work shows. */
  intro: string;
  /** Where the line has got to, drawn as the tracking card the person decides
   *  on. Present only on the seats whose rows are a trackable order. */
  state?: TrackedState;
  /** The same line once the work is done — the "and this is what it led to"
   *  card. Only where there is a `state` to show it against. */
  resultState?: TrackedState;
  /**
   * The write this task makes to a supplier record, where it makes one.
   *
   * Declared rather than inferred. The panel needs to publish the committed lead
   * time so the service seat can move the account's date, and the alternative was
   * for it to guess from the signal and the reference which of a dozen tasks was
   * the one that changed a supplier's terms — a guess that would go wrong the
   * first time another task grew a `resultState`.
   */
  leadCommit?: { poRef: string; days: number; was: number; landsOn: string; overridden?: boolean };
  /** The two buttons on that card. Primary runs the task; secondary declines it
   *  and hands the line back, so the agent never acts unasked. */
  /**
   * What kind of move this is, for the row button's icon.
   *
   * The distinction that matters to someone scanning a queue is whether the
   * agent will *write something* or *talk to a person* — a commit changes the
   * record, a call or a mail leaves the building and waits. A star on every row
   * said only "AI", which every button in this column already is.
   */
  icon: AgentIcon;
  /**
   * The task reaches a person, so the row offers both channels.
   *
   * Only where a channel genuinely changes what happens — a commit writes to a
   * record and has no one to ring, and putting Call and Email on it would be
   * two buttons that do the same thing.
   */
  channels?: boolean;
  /**
   * Where consent falls in `steps`.
   *
   * Everything before this index is the agent finding things out, and it runs
   * unasked — it is what produces the card and justifies what the card proposes.
   * Everything from here changes something in the world and waits for the
   * button. Splitting one ordered account this way keeps the narrative readable
   * in source while letting the run stop in the right place.
   */
  actAt: number;
  /**
   * A call that already happened, and is the reason this row exists.
   *
   * Kept out of `steps` deliberately. The steps are the agent reading systems
   * and writing to them; a account saying "25 Aug, no further" is neither — it
   * is the evidence the whole decision rests on, and burying it as row one of a
   * checklist made it look like something the agent did rather than something a
   * customer said.
   */
  record?: CallRecording;
  steps: AgentStep[];
  /** What it comes to. `settled` when the agent wrote something to a record,
   *  `open` when it asked somebody and is now waiting. */
  outcome: {
    kind: "settled" | "open";
    title: string;
    lines: string[];
    /**
     * The figures the run actually moved, before and after.
     *
     * Prose is good at why and bad at what-changed-to-what: "the reorder point
     * moved with it" is true and leaves the reader with no number. A commit
     * writes two or three fields and the person is accountable for all of them,
     * so they get listed rather than described.
     */
    changes?: { label: string; was: string; now: string }[];
    /**
     * The specific things a run got confirmed, one per line.
     *
     * For runs whose result is a set of particulars rather than a movement: a
     * call places two asks and comes back with two answers, and a paragraph
     * holding both makes the reader parse a sentence to find out whether each
     * one landed. Listed, the shape of the answer is the shape of the ask.
     *
     * Not a replacement for `lines` — what it cannot carry is why any of it
     * matters, which stays prose underneath.
     */
    confirmed?: {
      label: string;
      detail: string;
      /**
       * Whether this row is a thing achieved or a thing refused.
       *
       * Added because a real call came back a no and rendered "Window declined"
       * behind a filled green tick — the mark that means "settled" sitting on
       * the one row that says nothing was. Defaults to `ok`, so every fixture
       * row keeps the tick it was written with.
       */
      tone?: "ok" | "warn";
    }[];
    /**
     * Something the agent noticed and did NOT do.
     *
     * The button named one write, so one write is what happens. Anything else
     * the change implies gets raised here with the reason, and stays a sentence
     * until the person asks for it — an agent that quietly fixes the second
     * thing is an agent whose receipts you have to read in full every time,
     * which defeats the point of a receipt.
     */
    suggestion?: { title: string; body: string };
    /**
     * Optional hand-off link rendered under the outcome card.
     *
     * The panel narrates what the agent did; a run that ends in "moved to Act"
     * or "revived to Feed" needs a way for the person to walk into the place
     * the write landed. A composer draft (`next`) is for messages that leave
     * the building; this is for navigation inside the app — the two do not
     * compete.
     */
    continueLink?: {
      label: string;
      href: string;
      /** Open in a new tab, where the link leads out of the run rather than on
       *  from it — a record to check while the transcript stays put. */
      newTab?: boolean;
    };
    /**
     * Optional inline Undo for the last write.
     *
     * Kept on the outcome card rather than in a floating toast — the toast
     * duplicated the outcome sentence and stole the eye off the receipt it
     * was reporting. The chat is the record of the run; Undo lives beside
     * the record it undoes.
     */
    undo?: { label: string; onUndo: () => void };
    /**
     * A savings ramp to draw under the outcome — the value-realization run
     * shows the specific commit's projected-vs-realized shape as a small chart
     * inside the transcript, so "showing the graph of the commit" happens in
     * the chat rather than in a separate modal.
     */
    ramp?: { period: string; projected: number; realized?: number }[];
    /**
     * Compact figure tiles rendered above the ramp — committed, realized,
     * against-ramp, and the like. Kept alongside the ramp so the numbers and
     * the picture read as one card.
     */
    tiles?: {
      label: string;
      value: string;
      tone?: "good" | "behind" | "quiet";
      /** Makes the tile's value a link. A reference on a receipt is worth
       *  following, and the tile is where the eye already is. */
      href?: string;
      /** Open it in its own tab, so checking the record does not cost the
       *  transcript the reader is checking it against. */
      newTab?: boolean;
    }[];
    /** RAG banner tone for the outcome, where the run is a realization read. */
    rag?: { level: "on-track" | "behind" | "at-risk"; text: string };
    /**
     * A primary CTA rendered alongside the Continue link. Used where the
     * outcome is a read that leads to a next move — Review on a committed
     * play shows the ramp and offers Make live — rather than a page to walk
     * into. Fires an inline callback; the caller wires it to the store.
     */
    action?: { label: string; onAction: () => void };
    /**
     * The visible piece of work the run produced — a doc, a compare table, a
     * ranked list, or a mini chart. Rendered inside the outcome card so a run
     * called "Draft RFP" actually shows the drafted RFP, not just a sentence
     * about it. See `TaskRun.tsx` for the per-kind renderers.
     */
    artifact?: FlowArtifact;
    /**
     * Several artifacts, each in its own card.
     *
     * One `artifact` is right where a run produced one thing — a drafted RFP, a
     * ranked shortlist. A planner's approval produces an argument in three
     * parts: how the number was reached, what it does to the line, and what was
     * actually written. Stacking those inside one card made a scroll; as three
     * cards they read as three answers.
     */
    artifacts?: FlowArtifact[];
    /** Heading for the receipt card. Defaults to "What changed". */
    changesTitle?: string;
    /**
     * Suggested follow-ups the reader can click to seed the composer.
     * Rendered under every AI output as small chips — the same "what else
     * can I ask" shape the empty chat shows. Click fires a window event the
     * ChatPanel picks up and drops into the composer.
     */
    prompts?: string[];
  };
  /**
   * The move this one sets up, dropped into the composer when the run ends.
   *
   * A chase that comes back with a date has not finished anything — it has made
   * the next thing possible. Leaving the person to work that out, and to go
   * find the row again to do it, is where a queue loses the thread. The draft
   * is a draft: it sits in the box until they send it.
   */
  next?: { draft: string; task: AgentTask };
}

/** The lead time the supplier is asking for. Same source the Approve path and
 *  the decision modal read, so the three cannot disagree. */
function askedLead(row: ActionRow): number {
  return Math.max(...linesFor(row).map((l) => l.leadDays));
}

/**
 * The task a row offers, or null when there is nothing left to do.
 *
 * Keyed on signal, like `insightText` — the two are written side by side so
 * the sentence and the button never drift.
 */
/**
 * The commit, as a task in its own right.
 *
 * Lifted out of the switch because two paths reach it: a row that already has
 * a quoted lead time, and a chase that has just come back with one. The second
 * is the whole point of chasing — a date arrives, and the next move is to put
 * it on the record — so it must be the same task, not a second one written to
 * look like it.
 */
/**
 * The second change, as its own task.
 *
 * Deliberately separate from raising the level. The reorder point genuinely has
 * to move — a trigger built on the old safety stock fires too late once the
 * level rises — but "has to" is not "may". Making it a task the person invokes
 * means the write happens with consent and shows up on its own receipt, rather
 * than riding along inside somebody else's press.
 */
function moveReorderPoint(row: ActionRow): AgentTask {
  const cover = row.cover;
  const level = cover?.safetyNeeded ?? 0;
  const ropNow = cover ? reorderPoint(cover) : 0;
  const rop = cover ? reorderPoint(cover, level) : 0;
  return {
    id: `${row.id}-rop`,
    label: `Move the reorder point to ${rop}`,
    ask: `Move the reorder point to ${rop} ${row.qtyUnit} on ${row.refSub}`,
    intro: `On it. The trigger on ${row.refSub}.`,
    icon: "commit",
    actAt: 1,
    steps: [
      {
        label: "Checked what triggers today",
        text: `${ropNow} ${row.qtyUnit} — ${Math.round((cover?.dailyDemand ?? 0) * (cover?.leadDays ?? 0))} of demand across the ${cover?.leadDays ?? 0}-day lead time, plus the old safety stock of ${cover?.safetyNow ?? 0}. The lead-time half is unchanged; only the buffer moved.`,
        source: "SAP APO · reorder policy",
      },
      {
        label: `Wrote ${rop} ${row.qtyUnit} to the policy`,
        text: `The trigger now clears the new level, so replenishment fires with time to rebuild it rather than after the buffer is already spent.`,
        source: "SAP APO · reorder policy",
      },
    ],
    outcome: {
      kind: "settled",
      title: "Reorder point moved",
      lines: [`Replenishment on ${row.refSub} now fires against the level you confirmed.`],
      changes: [
        { label: "Reorder point", was: `${ropNow} ${row.qtyUnit}`, now: `${rop} ${row.qtyUnit}` },
      ],
    },
  };
}

/**
 * The follow-up the re-promise leaves behind.
 *
 * The account has taken the later date, but the ten days themselves are still a
 * live supplier question on the buying seat. Christy cannot negotiate with the
 * factory — that is Mercer's line — so this raises it rather than doing it, and the
 * run ends open because a request is not an answer.
 */
function pushUpstream(row: ActionRow, up: ActionRow): AgentTask {
  const who = contactFor(row.party, row.partyOwn);
  const first = who.name.split(" ")[0];
  const install = shiftDate(row.date, 2);
  return {
    id: `${row.id}-upstream`,
    label: "Ask for an earlier date",
    ask: `Ask the buying desk for an earlier date on ${up.ref}`,
    intro: `On it. ${up.ref} with ${up.party}.`,
    icon: "flag",
    actAt: 2,
    steps: [
      {
        label: "Counted what an earlier date buys",
        text: `${row.party} moved the line ${SLIP_DAYS} days at our cost. Every day the factory pulls back is a day of that cost returned and a client closer to the date they were originally given.`,
        source: "Install calendar · re-book cost",
      },
      {
        label: "Checked whose call it is",
        text: `${up.party} is a buying relationship on ${up.ref}, and pushing a supplier on slot is Mercer's line, not mine. What I can do is make sure the demand side of it is on the record.`,
        source: `Buying queue · ${up.ref}`,
      },
      {
        label: "Raised it with the buying desk",
        text: `Passed over with ${row.ref} attached: one account, ${formatUsd(row.value)}, a crew re-booked at our cost, and a floor-set that goes back to ${install} if the factory can find an earlier slot.`,
        source: `Handed to Mercer · ${up.ref}`,
      },
    ],
    outcome: {
      kind: "open",
      title: "With the buying desk",
      lines: [
        `Nothing changes on ${row.ref} unless the plant moves — ${first} keeps the dates she has been given either way.`,
        `If an earlier slot comes back, the floor-set can be pulled forward and I will tell her before it is booked.`,
      ],
    },
  };
}

/**
 * A figure the buyer set themselves, in place of the one the supplier quoted.
 *
 * The reason is the point of it. An override without one teaches the agent
 * nothing and leaves the next person reading a number nobody can explain — so
 * it rides through into the run's own report rather than being dropped once the
 * write lands.
 */
export interface LeadOverride {
  days: number;
  reason: string;
}

function commitLeadTime(row: ActionRow, override?: LeadOverride): AgentTask {
  const who = contactFor(row.party, row.partyOwn);
  const base = { id: row.id, state: poStateFor(row, who.name) };
      /* Three numbers, and keeping them apart is what makes an override
         readable: what we planned against, what they asked for, and what we
         are actually committing. Collapsing the last two is how a run ends up
         reporting the supplier's figure while writing the buyer's. */
      const quoted = askedLead(row);
      const planned = quoted - SLIP_DAYS;
      const asked = override?.days ?? quoted;
      const overridden = asked !== quoted;
      const internal = row.partyOwn;
      /* The other half of the commit, and the half this seat cannot do. Read
         from the service queue rather than assumed — see customer-notice.ts. */
      const notice = noticeFor(row);
      const owed = notice?.owed ?? [];
      const crewed = owed.filter((o) => o.crewBooked);
      return {
        ...base,
        /* Published for the seats downstream. The date is the promise this
           commit stands behind — `row.date` on a slipped line already IS the
           revised date, and an override shifts it by the days the buyer took
           against the days the plan was built on. */
        leadCommit: {
          poRef: row.ref,
          days: asked,
          was: planned,
          landsOn: overridden ? shiftDate(row.date, asked - quoted) : row.date,
          overridden,
        },
        /* Overrides the shared "awaiting reply" result: this task commits a
           figure rather than asking a question, so the card that follows it has
           to show the write landing, not a wait beginning. */
        resultState: poStateCommitted(
          row,
          asked,
          owed.length
            ? `${notice?.named} not yet told — with ${notice?.by}`
            : undefined,
        ),
        /* Commit, and only commit.
           Telling the account is the service seat's job, not this one's — Mercer
           can write a lead time to the supplier record but has no standing to
           call Peachtree, and a button here promising to notify would claim a
           reach this persona does not have. The gap is not hidden by the short
           label: it is checked before the write, raised with the CSR by name,
           and left open in the outcome. Flagging across a seat boundary is
           within remit; acting across it is not. */
        label: `Commit ${asked} days`,
        ask: `Commit ${asked} days on ${row.ref}`,
        intro: `On it. ${row.ref} with ${row.party}.`,
        /* Three things looked at now: the quote, the blast radius, and whether
           the customer has been told. */
        actAt: 3,
        icon: "commit",
        steps: [
          {
            label: "Read the quote",
            text:
              (internal
                ? `The line is capped for three months, which puts this style at ${quoted} days against the ${planned} we planned on.`
                : `They have moved this line to ${quoted} days, ${SLIP_DAYS} more than the ${planned} we planned against, and they hold it for three months.`) +
              (overridden
                ? ` You are committing ${asked} instead — ${override!.reason.toLowerCase()}.`
                : ""),
            source: internal ? "Plant schedule · capacity survey" : "Supplier feed · quote of record",
          },
          {
            label: "Checked what it moves",
            text: `${row.qtyValue} ${row.qtyUnit} and ${formatUsd(row.value)} on this line alone. Downstream, six SKUs fall short of cover and four account orders shift — two of those have crews booked.`,
            source: "SAP APO · coverage · SAP ECC · open orders",
          },
          /* Deliberately the last thing looked at. Committing a date the
             customer has not been given is how a supply decision becomes a
             service failure two weeks later, so it is checked before the write
             rather than reported after it. */
          {
            label: !notice
              ? "No account is waiting on this"
              : notice.told
                ? `${notice.named} was told`
                : `${notice.named} has not been told`,
            text: notice
              ? notice.orders
                  .map(
                    (o) =>
                      `${o.account} on ${o.ref} — ${o.standing}${o.crewBooked ? ", crew booked" : ""}.`,
                  )
                  .join(" ") +
                (notice.told
                  ? ` The conversation happened in ${notice.by}'s seat, so the date on the record is the date the account has.`
                  : ` ${notice.by} owns that conversation, and until it happens the account is planning against a date we have just changed.`)
              : `No account order is waiting on this line, so there is no customer to tell.`,
            source: `Service queue · ${notice?.agent ?? "Christy"}'s seat`,
          },
          {
            label: `Wrote ${asked} days to the record`,
            text: `Effective for the next three months, so every order raised from here plans against it rather than the old figure.`,
            source: "SAP ECC · supplier master",
          },
          {
            label: "Handed it to planning",
            text: `Iris has the new lead time and is raising safety stock at the nodes where cover falls short.`,
            source: "Handed to Iris · planning",
          },
          /* Only when someone is actually owed the conversation. A step that
             always fires stops being read, and one that fires when nothing is
             outstanding would be reporting work it did not do. */
          ...(owed.length
            ? [
                {
                  label: `Raised it with ${notice?.by ?? "the service desk"}`,
                  text: `${notice?.named} on ${owed.map((o) => o.ref).join(", ")} — passed over with the new date and the reason${crewed.length ? `, flagged because ${crewed.length === 1 ? "a crew is" : `${crewed.length} crews are`} already booked` : ""}. I cannot make that call from this seat.`,
                  source: `Handed to ${notice?.by ?? "service"} · ${notice?.agent ?? "Christy"}'s queue`,
                },
              ]
            : []),
        ],
        outcome: owed.length
          ? {
              /* Open, not settled. The supplier record is right and the account
                 is still wrong, and calling that finished is exactly the kind of
                 half-done commit this check exists to catch. */
              kind: "open",
              /* The button promised to commit and to get the account told, so
                 the report has to answer both halves. Still "open": a notice
                 handed over is not a notice received, and the account is the one
                 who decides whether this is finished. */
              title: `Committed · notice with ${notice?.by}`,
              lines: [
                `${asked} days is on the ${internal ? "plant" : "supplier"} record for the next three months.${overridden ? ` Your figure, not the ${quoted} quoted — ${override!.reason.toLowerCase()}.` : ""}`,
                `${notice?.named} ${owed.length === 1 ? "is" : "are"} still planning against the old promise. ${notice?.by} has it${crewed.length ? `, and ${crewed.length === 1 ? "a crew is" : "crews are"} booked` : ""}.`,
              ],
            }
          : {
              kind: "settled",
              title: overridden ? "Lead time updated · your figure" : "Lead time updated",
              lines: [
                overridden
                  ? `Held for three months at ${asked} days rather than the ${quoted} quoted — ${override!.reason.toLowerCase()}. Planning has it, and the accounts were told before the change landed.`
                  : `Held for three months. Planning has it, and the accounts were told before the change landed.`,
              ],
              changes: [
                { label: "Lead time", was: `${planned} days`, now: `${asked} days` },
                ...(row.committedOn
                  ? [{ label: "Promise date", was: row.committedOn, now: row.date }]
                  : []),
              ],
            },
      };
}

/** How the agent reaches someone. */
export type Channel = "call" | "email";

/**
 * The task a row offers.
 *
 * `channel` overrides what the contact prefers. Both are offered on the row
 * because the preference is a default, not a rule: a account who usually reads
 * email still gets a phone call when their crew is booked for Thursday, and
 * that judgement belongs to the person holding the queue.
 */
export function agentTaskFor(
  row: ActionRow,
  channel?: Channel,
  override?: LeadOverride,
): AgentTask | null {
  if (row.state === "settled") return null;

  const who = contactFor(row.party, row.partyOwn);
  /* A chase is whichever channel this contact actually answers on, so the icon
     matches the step that says "Called Linh Tran" rather than guessing. */
  /* One resolved channel for the whole task, so the step label, the source
     line, the artifact and the icon cannot disagree with each other. */
  const via: Channel = channel ?? who.prefers;
  const chaseIcon: AgentIcon = via === "call" ? "call" : "email";
  const first = who.name.split(" ")[0];
  const reached = via === "call" ? "called" : "wrote to";
  /* Buying rows are purchase orders and have a run to show. The planner's SKUs
     and the logistics loads are different objects, so they get no card rather
     than a stepper invented for them. */
  /* Which rows have a journey worth drawing. Purchase orders and account orders
     both do — they are the same shipment seen from opposite ends. Loads and
     stock levels do not: a safety-stock figure has no stages, and inventing
     some for it would be a card that says nothing. */
  const poTrackable =
    row.signal === "lead-time-jump" ||
    row.signal === "capacity" ||
    row.signal === "silent-po" ||
    row.signal === "second-source-quote";
  const soTrackable =
    row.signal === "options-drafted" ||
    row.signal === "awaiting-customer" ||
    row.signal === "eta-conflict" ||
    row.signal === "damage";

  const base = {
    id: row.id,
    ...(poTrackable
      ? { state: poStateFor(row, who.name), resultState: poStateAfter(row, who) }
      : soTrackable
        ? { state: soStateFor(row, who.name), resultState: poStateAfter(row, who) }
        : {}),
  };

  switch (row.signal) {
    /* ── Buying ─────────────────────────────────────────────────────────── */

    /* The two lead-time cases, and the only two moves this seat has on them.
       Either the supplier has given a new figure, in which case the job is to
       commit it, or they have not, in which case the job is to go and get it.
       Anything else — pushing for a better date, asking a plant for a slot — is
       a negotiation this prototype does not model and should not imply. */
    case "lead-time-jump":
    case "capacity":
      return commitLeadTime(row, override);

    case "silent-po":
      return {
        ...base,
        label: "Chase lead time",
        channels: true,
        ask: `Chase ${row.party} for a lead time on ${row.ref}`,
        intro: `On it. ${row.ref} has no date on it yet.`,
        actAt: 2,
        icon: chaseIcon,
        steps: [
          {
            label: "Counted the silence",
            text: `${row.refSub}, and two chases already sent with no reply. Nothing downstream can be planned until a figure comes back.`,
            source: "Email thread · this order",
          },
          {
            label: "Checked what gets an answer",
            text: `${who.respondsIn}.`,
            source: "Databricks · response history",
          },
          {
            label: `${via === "call" ? "Called" : "Wrote to"} ${first}`,
            text: `${who.name}, ${who.role.toLowerCase()} — asked for the new lead time and a date it holds to, or a clear no.`,
            source: via === "call" ? `${who.phone} · ${who.hours}` : who.email,
            ...(via === "call"
              ? {
                  call: {
                    with: `${who.name} · ${row.party}`,
                    duration: "2:14",
                    when: "Today 09:12",
                    number: who.phone,
                    turns: [
                      {
                        speaker: "Mercer",
                        text: `${row.ref}, ${row.qtyValue} ${row.qtyUnit} of ${row.product}. It was raised ${row.committedOn ?? "last week"} and there is still no acknowledgement. I need a lead time and a date it holds to.`,
                      },
                      {
                        speaker: first,
                        text: `The line was re-cut on Monday. I can hold you at ${askedLead(row)} days from release — that is the earliest I would stand behind.`,
                      },
                      { speaker: "Mercer", text: `And it holds for the quarter?` },
                      {
                        speaker: first,
                        text: `For the quarter, yes. Anything sooner than that would move again and you would be back on this call.`,
                      },
                    ],
                  },
                }
              : {}),
          },
        ],
        outcome: {
          /* Open, not settled: a date spoken on a call is not a date on the
             record, and the gap between those two is exactly what the next step
             closes. */
          kind: "open",
          title: `${first} gave a date`,
          lines: [
            `${askedLead(row)} days from release, held for the quarter — the first firm figure on this line.`,
            `Nothing is on the record until it is committed.`,
          ],
        },
        next: {
          draft: `Commit ${askedLead(row)} days on ${row.ref}`,
          task: commitLeadTime(row),
        },
      };

    case "second-source-quote":
      return {
        ...base,
        label: "Chase quote",
        channels: true,
        ask: `Chase the transfer quote on ${row.ref}`,
        intro: `On it. The quote on ${row.ref} is two days out.`,
        actAt: 1,
        icon: chaseIcon,
        steps: [
          {
            label: "Confirmed what was asked for",
            text: `Confirmed what was asked for — a transfer quote from ${row.party}, requested Monday.`,
            source: "Email thread · this order",
          },
          {
            label: "Chased the figure",
            text: `${reached.charAt(0).toUpperCase() + reached.slice(1)} ${who.name} for the figure and a date it holds to.`,
            source: via === "call" ? who.phone : who.email,
          },
        ],
        outcome: {
          kind: "open",
          title: "Chased",
          lines: [`No decision is possible until the number lands, so the row stays waiting.`],
        },
      };

    /* ── Planning ───────────────────────────────────────────────────────── */

    case "safety-stock": {
      const cover = row.cover;
      const now = cover?.safetyNow ?? 0;
      const moq = cover?.moq ?? 1;
      /* The level the queue line already states, not a rounded cousin of it.
         Rounding up to the MOQ was tried and put 64 in the run against the 62
         on the row — and the MOQ constrains the replenishment ORDER, not the
         target level, so the rounding was wrong as well as inconsistent. */
      const level = cover?.safetyNeeded ?? 0;
      /* Both ends derived, so the pair can never drift from the levels they
         are built out of. */
      const ropNow = cover ? reorderPoint(cover) : 0;
      const rop = cover ? reorderPoint(cover, level) : 0;
      const bridge = cover ? Math.round(cover.safetyNeeded * 0.4) : 0;
      return {
        ...base,
        /* The figure, like the buyer's commit. Changing the level is the action
           — "Find transfer" named the stopgap instead of the fix, and the
           transfer survives below as what holds the node meanwhile — but
           "Change safety stock" only named the lever. This says what pressing
           it writes, and it is the same number the row already shows going
           38 → 62, so the line and the button cannot drift. */
        label: `Confirm ${level} ${row.qtyUnit}`,
        ask: `Confirm ${level} ${row.qtyUnit} on ${row.refSub}`,
        intro: `On it. ${row.refSub} at ${row.party}.`,
        actAt: 3,
        icon: "commit",
        steps: [
          {
            label: "Read the cover here",
            text: `${cover?.coverDays ?? 0} days of cover against a ${cover?.leadDays ?? 0}-day lead time. The level was set when that lead time was ${SLIP_DAYS} days shorter, which is the whole of the gap.`,
            source: "SAP APO · coverage plan",
          },
          {
            label: "Sized the new level",
            text: `${level} ${row.qtyUnit} covers the lead time we have accepted, up from ${now} — the ${level - now} the extra ${SLIP_DAYS} days need. ${cover?.supplier ?? "The plant"} ships in ${moq}-${row.qtyUnit} multiples, so the order that rebuilds it rounds up, not the level itself.`,
            source: "SAP APO · safety-stock model",
          },
          {
            label: "Found cover for the gap",
            text: `Raising the level does not fill a shelf today. Vinh Phat Textiles is ${bridge} ${row.qtyUnit} over target on a matching batch and can release the same day, which holds this node while the new level builds.`,
            source: "SAP WM · on hand by node",
          },
          {
            label: `Raised safety stock to ${level} ${row.qtyUnit}`,
            text: `Written against the SKU at ${row.party}, so every replenishment from here plans to it rather than to the old figure.`,
            source: "SAP APO · safety-stock plan",
          },
        ],
        outcome: {
          kind: "settled",
          title: "Safety stock raised",
          lines: [
            `Sized on the ${cover?.leadDays ?? 0}-day lead time we accepted, and Vinh Phat Textiles covers ${row.party} while the level builds.`,
          ],
          /* Only what this press wrote. The lead time was listed here and did
             not belong: 32 → 42 happened upstream and is the reason the level
             had to move, not something confirming units changed. A receipt
             that includes the cause alongside the effects makes the person
             answerable for a decision they did not take. It stays in the line
             above, as context. */
          changes: [
            { label: "Safety stock", was: `${now} ${row.qtyUnit}`, now: `${level} ${row.qtyUnit}` },
          ],
          suggestion: {
            title: `The reorder point still reads ${ropNow} ${row.qtyUnit}`,
            body: `It was built on the old level, so it now fires ${level - now} ${row.qtyUnit} too late — the new safety stock would sit in the plan and never trigger an order. ${rop} would hold it. I have not touched it; that is a second change and you did not ask for one.`,
          },
        },
        next: {
          draft: `Move the reorder point to ${rop} ${row.qtyUnit} on ${row.refSub}`,
          task: moveReorderPoint(row),
        },
      };
    }

    /* ── Service ────────────────────────────────────────────────────────── */

    case "options-drafted": {
      /* The call already happened. Christy rang Carla overnight, put both
         options to her, and she chose — so this row is not "go and ask", it is
         "she answered, do you accept it". The recording is evidence for the
         decision, not the decision itself. */
      const up = upstreamFor(row);
      const cause = up
        ? `${up.party} have moved this line out ${SLIP_DAYS} days and they are holding it for three months`
        : `the plant has moved this line out ${SLIP_DAYS} days`;
      const newDate = shiftDate(row.date, SLIP_DAYS);
      const install = shiftDate(row.date, 2);
      const newInstall = shiftDate(row.date, SLIP_DAYS + 2);
      return {
        ...base,
        resultState: soStateRepromised(row, who.name, newDate),
        /* Accepting the account's choice is the action. Naming the date rather
           than "accept" means the button says what it writes. */
        label: `Re-promise ${newDate}`,
        ask: `Re-promise ${row.ref} to ${newDate}`,
        intro: `On it. ${row.ref} for ${row.party} — ${first} has already answered.`,
        icon: "commit",
        actAt: 1,
        record: {
            past: true,
            with: `${who.name} · ${row.party}`,
            duration: "3:41",
            when: "Today 09:14",
            number: who.phone,
            turns: [
              {
                speaker: "Christy",
                text: `${first}, it is about ${row.ref}. ${cause[0].toUpperCase()}${cause.slice(1)}, and I would rather you heard it from me with the options already priced than as a slipped date.`,
              },
              {
                speaker: first,
                text: `How bad? We have a floor-set crew booked for ${install} and that date is not easy to move.`,
              },
              {
                speaker: "Christy",
                text: `${SLIP_DAYS} days on the original. So either the alternate style ships now and holds your date at the same contract price on all ${row.qtyValue} ${row.qtyUnit}, or you wait and I re-book the crew at our cost.`,
              },
              {
                speaker: first,
                text: `The client specified this style for the opening — they will not take a substitute. We will wait for the original.`,
              },
              {
                speaker: "Christy",
                text: `Then I will move your promise to ${newDate} and re-book the crew at our cost, and put it in writing so you have it for the client.`,
              },
            ],
          },
        steps: [
          {
            label: "Checked what moves with it",
            text: `The crew is booked for ${install} against a ${row.date} arrival. Moving the promise to ${newDate} pushes the floor-set to ${newInstall}, and the re-book is at our cost because the slip is ours. ${formatUsd(row.value)} on ${row.qtyValue} ${row.qtyUnit}, contract price unchanged.`,
            source: "SAP ECC · install calendar · pricing held",
          },
          {
            label: `Moved the promise to ${newDate}`,
            text: `Written against ${row.ref}, so tracking, the account portal and the floor-set calendar all read the same date rather than three.`,
            source: "SAP ECC · sales order",
          },
          {
            label: "Re-booked the crew",
            text: `${newInstall}, at our cost. Moved rather than cancelled, so ${row.party} keeps the same team.`,
            source: "Install calendar · re-booked",
          },
          {
            label: `Confirmed it to ${first} in writing`,
            text: `She asked for it in writing for the client, so the new dates and the held price went over as a note she can forward.`,
            source: who.email,
            message: {
              to: `${who.name} · ${row.party}`,
              address: who.email,
              subject: `${row.ref} — confirmed, ${newDate}`,
              when: "Today 09:26",
              lines: [
                `${first}, confirming what we agreed so you have it for the client.`,
                `The contract price is unchanged on all ${row.qtyValue} ${row.qtyUnit}, and the crew re-book is at our cost.`,
              ],
              options: [
                {
                  label: "Delivery",
                  detail: `${row.date} → ${newDate}, the original style as specified.`,
                },
                {
                  label: "Install",
                  detail: `${install} → ${newInstall}, same crew, re-booked not cancelled.`,
                },
              ],
            },
          },
        ],
        outcome: {
          kind: "settled",
          title: "Re-promised",
          lines: [
            `${row.party} has the new dates in writing and the same crew. Nothing further is waiting on them.`,
          ],
          changes: [
            { label: "Promise date", was: row.date, now: newDate },
            { label: "Install date", was: install, now: newInstall },
            { label: "Contract price", was: formatUsd(row.value), now: formatUsd(row.value) },
          ],
          suggestion: up
            ? {
                title: `The ${SLIP_DAYS} days are still on ${up.ref}`,
                body: `${first} has taken the later date, but the plant's slip is a buying decision and it is still open on ${up.party}. If Mercer can pull an earlier slot the floor-set moves back toward ${install}. I have not asked — that is the buying desk's call, not mine.`,
              }
            : undefined,
        },
        next: up
          ? {
              draft: `Ask the buying desk for an earlier date on ${up.ref}`,
              task: pushUpstream(row, up),
            }
          : undefined,
      };
    }

    /* The account took the substitute. Nothing needs re-promising — the floor-set
       date survives — so the only thing outstanding is letting a different
       style ship against the order. */
    case "alternate-accepted": {
      /* What the agent put in front of the rep, where the order holds one. */
      const order = orderById(row.ref);
      const proposal = order?.proposed;
      const install = shiftDate(row.date, 2);
      /* When the substitute would land, against the date they already hold. */
      const alternateEta = proposal?.arrivesOn ?? proposal?.date ?? install;
      /* "Stoneware Dinnerware Set 16pc · Terracotta" → "Terracotta". The swap
         is a glaze of the same set, which is what the order's own `said` field
         describes — so the call talks about colour rather than construction.
         Construction is the sourcing lane — import or domestic — and the same
         set in a different glaze comes off the same line at the same origin:
         it had Greg asking after the one thing that is guaranteed identical. */
      const colourway = proposal?.style.split(" · ").slice(-1)[0] ?? "the alternate";
      return {
        ...base,
        /* Named after the thing being decided rather than the person being
           rung. It was labelled with the two writes it makes — the alternate and
           the date — which is the paperwork rather than the move, and it named a
           date the reader could already see was unchanged on the row. */
        label: "Confirm alternate",
        ask: proposal
          ? `Confirm the alternate on ${row.ref} with ${row.party}`
          : `Confirm the alternate on ${row.ref}`,
        /* The account has NOT already answered — that is what this run goes and
           finds out. The old intro described a state from before the call moved
           into the run, and promised the reader a decision that had not been
           taken yet. */
        intro: `On it. ${row.ref} for ${row.party} — ${first} has both options to weigh.`,
        /* A phone, not a tick. The press rings the account and puts two options
           to him; the writes afterwards are consequences of his answer, not the
           move itself. `commit` said this row was a record change, which is
           what it was before the call moved into the run. */
        icon: "call",
        actAt: 1,
        steps: [
          {
            label: "Checked the swap holds",
            text: `Same set, same import lane, same contract price on ${row.qtyValue} ${row.qtyUnit}, and enough on hand to ship the whole order rather than split it. The floor-set on ${install} does not move.`,
            source: "SAP WM · on hand · pricing held",
          },
          {
            /* The call is a step rather than the record above, because here it
               is something the run DOES rather than the evidence it rests on.
               The account had already answered in the old version and this button
               only filed the paperwork; now the press is the call, and the
               writes below it are what the answer authorises. Being a step also
               puts it in the right place — you ring somebody before you write
               the substitution to their order, not after. */
            label: `Put both options to ${first}`,
            text: `Offered ${colourway} at ${alternateEta} against waiting for the original on ${proposal?.date ?? install}. They chose to wait — the floor-set crew is not in until then, and they would rather not brief them on a different glaze.`,
            source: who.phone,
            call: {
              with: `${who.name} · ${row.party}`,
              duration: "0:45",
              /* NO AUDIO, deliberately. The recording on disk is the Shaw
                 build's — it says "Shaw Industries" and "same tile" out loud,
                 and a transcript that disagrees with its own sound is the one
                 failure a recording cannot survive. The card keeps the
                 transcript and drops the player until a Target take is
                 recorded; put the file back and re-measure the turn offsets
                 when it is. */
              when: "Just now",
              number: who.phone,
              turns: [
                { speaker: "Christy", text: `Good morning, am I speaking with ${first}?` },
                { speaker: first, text: `Yes.` },
                {
                  speaker: "Christy",
                  /* Spoken dates, because this is a transcript of speech: the
                     fixtures store "6 Sep" and a person says "September 6th". */
                  text: `Hi ${first}, this is Christy from Target. I'm calling about order ${row.ref}. There are two options. The original order keeps the glaze you specified and delivers ${spokenDate(proposal?.date ?? install)}. Or we have the same set in ${colourway} in stock at ${proposal?.at ?? "the DC"}, which would deliver ${spokenDate(alternateEta)}. Which would you prefer?`,
                },
                { speaker: first, text: `Same set, just the colour?` },
                {
                  speaker: "Christy",
                  text: `Same set, same stoneware, same contract price. The only difference is the glaze.`,
                },
                { speaker: first, text: `We'll wait for the original.` },
                {
                  speaker: "Christy",
                  at: 37.87,
                  text: `Understood, I'll keep the original order on the ${spokenDate(proposal?.date ?? install)} delivery. You'll receive a confirmation email shortly. Thanks ${first}.`,
                },
              ],
            },
          },
          {
            /* Nothing is substituted, so nothing is written to the line. What
               IS written is the answer: the order stops asking, and the reader
               can see why without replaying the call. */
            label: "Confirmed the original on the order",
            text: `${first} has the offer on record and took the wait, so ${row.ref} keeps its style and its ${proposal?.date ?? install} promise. The line is no longer waiting on a decision.`,
            source: "SAP ECC · sales order",
          },
          {
            label: `Released the ${proposal?.units ?? ""} alternate units back`,
            text: `${proposal?.sku ?? "The substitute"} was being held at ${proposal?.at ?? "the DC"} against this order. It goes back to available rather than sitting reserved for a swap nobody took.`,
            source: "SAP WM · allocation",
          },
        ],
        outcome: {
          kind: "settled",
          title: `Waiting confirmed · ${proposal?.date ?? install}`,
          /* One sentence, then the figures.
             The paragraph that stood here restated the promise date, the
             install, the value and the fact that none of them moved — four
             numbers buried in prose, in the card a reader opens to find exactly
             those numbers. The sentence keeps what only prose can say, which is
             what he chose and why it was on offer. */
          lines: [
            proposal
              ? `${first} was offered ${colourway} at ${alternateEta} and chose to wait.`
              : `${row.party} chose to wait.`,
          ],
          tiles: [
            { label: "Promise date", value: proposal?.date ?? install },
            { label: "Order", value: row.ref },
            { label: "Order value", value: formatUsd(row.value) },
          ],
          /* Out to the record, in its own tab: the reader is checking the order
             against what they were just told, and losing the transcript to do
             it means losing the thing they are checking. */
          continueLink: {
            label: "View full order details",
            href: `/service/orders/${row.ref}`,
            newTab: true,
          },
          /* No change table.
             He took the wait, so no style was substituted, no SKU replaced and
             no date moved — and a receipt is for what was written. The table
             used to list a swap that now does not happen; printing it against
             this answer would report the opposite of the call sitting directly
             above it. What was settled is a question, and the sentence says
             so. */
        },
      };
    }

    /* Neither option. They can absorb a shorter slip than the plant is offering,
       which is a fact the buying desk can use — and a part-shipment keeps their
       crew working while the rest catches up. */
    case "dealer-counter": {
      const hold = "25 Aug";
      const partial = Math.round(Number(row.qtyValue) * 0.6);
      const rest = Number(row.qtyValue) - partial;
      return {
        ...base,
        label: "Split the shipment",
        ask: `Split ${row.ref} — ${partial} now, ${rest} to follow`,
        intro: `On it. ${row.ref} for ${row.party} — ${first} came back with a counter.`,
        icon: "commit",
        actAt: 1,
        record: {
            past: true,
            with: `${who.name} · ${row.party}`,
            duration: "4:12",
            when: "Monday 11:05",
            number: who.phone,
            turns: [
              {
                speaker: "Christy",
                text: `${first}, ${row.ref} has moved out to ${row.date}. The alternate can ship now, or you wait for the original.`,
              },
              {
                speaker: first,
                text: `Neither works as you have put it. The spec is the spec, so no substitute — but ${row.date} is past what I can hold the crew for.`,
              },
              { speaker: "Christy", text: `What can you hold to?` },
              {
                speaker: first,
                text: `${hold}, no further. And I would rather start on part of the floor than stand a crew down for a week — send me whatever you can ship now and the rest when it lands.`,
              },
              {
                speaker: "Christy",
                text: `Then I will split it against ${hold} and put your date to the buying desk, because ${hold} is a limit they can negotiate against.`,
              },
            ],
          },
        steps: [
          {
            label: "Checked what can ship now",
            text: `${partial} of ${row.qtyValue} ${row.qtyUnit} are on hand and allocatable today; the remaining ${rest} sit behind the plant's date. Splitting costs one extra freight leg, which is less than standing a crew down.`,
            source: "SAP WM · on hand · freight",
          },
          {
            label: `Split the order — ${partial} now`,
            text: `First leg allocated against ${hold} so the crew can start on schedule, the remaining ${rest} raised as a backorder against the revised date rather than cancelled.`,
            source: "SAP ECC · sales order · split",
          },
          {
            label: "Put the counter to the buying desk",
            text: `${first} can absorb a slip to ${hold} but not beyond, and that is a demand-side limit Mercer can negotiate against rather than a preference. Passed over with ${row.ref} attached.`,
            source: "Handed to Mercer · buying queue",
          },
        ],
        outcome: {
          kind: "open",
          title: "Split, and the counter is upstream",
          lines: [
            `${partial} ${row.qtyUnit} ship against ${hold} so ${row.party} keeps their crew working. The remaining ${rest} go on backorder against ${row.date} rather than being cancelled.`,
            `Whether the rest lands sooner is the plant's answer to give, and Mercer now has the date the account can actually hold to.`,
          ],
          changes: [
            { label: "First leg", was: "—", now: `${partial} ${row.qtyUnit} · ${hold}` },
            { label: "Backorder", was: `${row.qtyValue} ${row.qtyUnit} · ${row.date}`, now: `${rest} ${row.qtyUnit} · ${row.date}` },
          ],
        },
      };
    }

    case "awaiting-customer":
      return {
        ...base,
        label: "Chase account",
        channels: true,
        ask: `Chase ${row.party} on ${row.ref}`,
        intro: `On it. ${row.party} has not come back on ${row.ref}.`,
        actAt: 1,
        icon: chaseIcon,
        steps: [
          {
            label: "Read the thread",
            text: `Options went out and nothing has come back, with the floor-set date closing.`,
            source: "Email thread · this order",
          },
          {
            label: "Chased the account",
            text: `${reached.charAt(0).toUpperCase() + reached.slice(1)} ${who.name} — ${who.respondsIn.toLowerCase()}.`,
            source: via === "call" ? `${who.phone} · ${who.hours}` : who.email,
          },
        ],
        outcome: {
          kind: "open",
          title: "Chased",
          lines: [`Nothing changes on the order until they choose. The row stays open.`],
        },
      };

    case "damage": {
      const claim = row.claim;
      /* Two different lines, two different jobs. Before the credit is
         adjudicated the money is not the question — where the damage came from
         is. After, the credit is one signature and the real work is the lot. */
      const adjudicated = row.action === "Approve credit";
      if (adjudicated) {
        return {
          ...base,
          label: "Question lot",
          ask: `Question batch ${claim?.batch ?? ""} behind ${row.ref}`,
          intro: `On it. This is the third claim against ${claim?.batch ?? "this lot"}.`,
          actAt: 2,
          icon: "flag",
          steps: [
            {
              label: "Pulled every claim on the lot",
              text: `Pulled every claim on ${claim?.batch ?? "the lot"} — three, across two accounts, ${formatUsd((claim?.credit ?? 0) * 3)} between them.`,
              source: "Claims history · by batch",
            },
            {
              label: "Read the root causes",
              text: `Two are transit damage and one is edge swell, which is a manufacturing fault rather than handling.`,
              source: "Root cause · claim records",
            },
            {
              label: "Raised it with the buying desk",
              text: `Raised the lot with the buying desk rather than the account, and asked the plant for the run record.`,
              source: "Handed to Mercer · supplier quality",
            },
          ],
          outcome: {
            kind: "settled",
            title: "It is a lot problem, not a account problem",
            lines: [
              `${row.party}'s claim rate reads badly until you see three of them are this one lot.`,
              `The ${formatUsd(claim?.credit ?? 0)} credit is still yours to release — Review does it in one press.`,
            ],
          },
        };
      }
      return {
        ...base,
        label: "Charge carrier",
        ask: `Recover the ${row.ref} damage from the carrier`,
        intro: `On it. ${row.ref} — ${claim?.damagedUnits ?? 2} units.`,
        actAt: 2,
        icon: "commit",
        steps: [
          {
            label: "Read the root cause",
            text: `Read the root cause: the load shifted under the wrap in transit, not at the plant.`,
            source: `Receipt ${claim?.receipt ?? ""} · tailgate photos`,
          },
          {
            label: "Checked the POD",
            text: `Confirmed the carrier signed for ${row.qtyValue} units complete, so the loss happened on their leg.`,
            source: "DC appointment book · POD",
          },
          {
            label: "Filed the recovery",
            text: `Filed the recovery against the carrier for ${formatUsd(claim?.credit ?? row.value)} and attached the four photographs.`,
            source: "Freight audit · carrier claim",
          },
        ],
        outcome: {
          kind: "settled",
          title: "Filed against the carrier",
          lines: [
            `The account's credit is a separate decision and still yours — this only decides who ultimately pays.`,
            `Carrier claims settle in about three weeks.`,
          ],
        },
      };
    }

    /* ── Logistics ──────────────────────────────────────────────────────── */

    case "eta-conflict":
      return {
        ...base,
        label: "Reconcile ETA",
        ask: `Reconcile the ETA on ${row.ref}`,
        intro: `On it. Three systems, three answers on ${row.ref}.`,
        actAt: 2,
        icon: "commit",
        steps: [
          {
            label: "Checked DC appointment book",
            text: `DC appointment book answers at shipment level and has updated since the load moved.`,
            source: "DC appointment book · scan events",
          },
          {
            label: "Checked Carrier milestone",
            text: `Carrier milestone answers at trailer level and the trailer parted from this shipment at the cross-dock, so it is stale.`,
            source: "Carrier milestone · trailer telemetry",
          },
          {
            label: "Told the customer the window",
            text: `Took DC appointment book's time, and told the customer the window before they had to ask.`,
            source: "Customer notified",
          },
        ],
        outcome: {
          kind: "settled",
          title: "One time, and it is on the record",
          lines: [
            `The reconciled arrival is written to the load and the customer has the window.`,
            `Confirm it in Review if you want it locked against the promise.`,
          ],
        },
      };

    case "carrier-choice":
      return {
        ...base,
        label: "Assign carrier",
        ask: `Assign the load on ${row.ref}`,
        intro: `On it. ${row.ref}, own truck against hired.`,
        actAt: 3,
        icon: "commit",
        steps: [
          {
            label: "Costed the fleet",
            text: `Costed the fleet properly — driver hours, fuel, and the backhaul it gives up.`,
            source: "TMW · driver hours and fuel",
          },
          {
            label: "Costed the hired lane",
            text: `Costed the hired lane including detention and accessorials, which usually surface weeks later at audit.`,
            source: "Freight audit · lane rate and history",
          },
          {
            label: "Own truck wins",
            text: `Own truck wins by ${formatUsd(row.value)} on real cost, and a backhaul exists on the return leg.`,
            source: "Landed cost comparison",
          },
          {
            label: "Assigned the load",
            text: `Put it on ${row.party} and held the return leg so the backhaul does not get sold out from under it.`,
            source: "TMW · dispatch",
          },
        ],
        outcome: {
          kind: "settled",
          title: "Assigned to the fleet",
          lines: [
            `The load is on ${row.party} and the return leg is held for the backhaul.`,
            `Reassign in Review if the driver hours will not take it.`,
          ],
        },
      };

    case "pickup-window": {
      /* The consignee, not the carrier. A delivery window is confirmed with
         whoever has to be standing on the dock — `who` resolves to the fleet on
         this row, and ringing your own driver to ask whether the customer will be
         in is not a call anybody makes. */
      const load = row.chainFrom ? orderById(row.chainFrom) : undefined;
      const site = load ? contactFor(load.account, false) : who;
      const siteFirst = site.name.split(" ")[0];
      const crew = load?.installOn ?? "the floor-set";
      const eta = load ? load.currentEta : row.date;

      /**
       * NO RECORDING, deliberately — for now.
       *
       * The MP3 on disk is the Shaw build's take: it says "Tova from Shaw
       * Industries" and names SO-4390 out loud, and a transcript that disagrees
       * with its own sound is the one failure a recording cannot survive. Every
       * row uses the templated transcript until a Target take is recorded;
       * restore the `row.ref === "LD-70398"` gate and re-measure the turn
       * offsets when it is.
       */
      const recorded = false;

      /**
       * The row wired to place a real call.
       *
       * Deliberately not `recorded`. That flag means "there is an MP3 of this
       * call on disk", and a live call is the opposite of a recording — it is
       * the one that has not happened yet. The two were the same row by
       * coincidence, and tying them together meant deleting the audio would
       * silently stop the phone ringing.
       */
      const dialable = row.ref === "LD-70398";

      /* Verbatim, from the recording. Not templated — the words are fixed because
         the audio is fixed, and the two have to be the same words.
         The offsets are measured off the file, not estimated: ffmpeg's
         silencedetect gives the speech runs, and each turn starts where its run
         does. Re-measure them whenever the audio is replaced — a highlight timed
         against a previous take drifts a turn out by the middle of the call,
         which is worse than no highlight at all. */
      const recordedTurns: CallTurn[] = [
        { speaker: "Tova", text: "Good morning, am I speaking with Greg?" },
        { speaker: "Greg", text: "Yes." },
        {
          speaker: "Tova",
          text: `Hi Greg, this is Tova from Target. I'm calling about order SO-4390, arriving September 6th between 8:00 and 11:00 AM. Does that window work for you?`,
        },
        { speaker: "Greg", text: "That works." },
        {
          speaker: "Tova",
          text: "Great, I'll confirm it with the carrier. You'll receive a confirmation email shortly. Thanks Greg.",
        },
      ];

      /* The generated version, for every other load. Four turns, because on a row
         with no recording behind it the transcript is a fixture and a longer one
         is not a better one. */
      const templatedTurns: CallTurn[] = [
        {
          speaker: "Tova",
          text: `${siteFirst}, it is about ${row.ref} into you on ${eta}. Two things — somebody on the dock to take it, and whether the ${crew} floor-set is still standing.`,
        },
        {
          speaker: siteFirst,
          text: `Floor-set crew is booked for ${crew} and that has not moved. We are on site from seven, so any time after that works.`,
        },
        {
          speaker: "Tova",
          text: `Seven is fine, the driver has the hours for it. One thing I would ask: count the cartons at the tailgate before you sign, and open anything that looks crushed. Damage on arrival is a transit claim I recover from the carrier — once it is signed clean it becomes concealed damage and it sits with you.`,
        },
        {
          speaker: siteFirst,
          text: `Understood. Marco will sign for it and photograph anything that looks wrong before he does.`,
        },
      ];

      return {
        ...base,
        label: "Confirm window",
        /* The load AND the order. A window is confirmed against a load number,
           which is what dispatch and the driver hold — but the person on the
           other end of the phone has a sales order, and the call itself names
           one. A first line carrying only the load asks the reader to look up
           which order it is against. */
        ask: `Confirm the delivery window on ${row.ref}${load ? ` · ${load.id}` : ""}`,
        /* The load, and the customer order riding on it. "LD-70398 is out for
           delivery" is a fact about a truck; the reason anybody is confirming a
           window is the order behind it, and the account on the phone knows their
           order number rather than ours. */
        intro: load
          ? `On it. ${row.ref} is out for delivery — customer order ${load.id}, ${load.account}.`
          : `On it. ${row.ref} is out for delivery.`,
        actAt: 1,
        icon: "call",
        /* Live, not a recording — no `past`. This call is the step: the reader is
           watching the two things they need confirmed being confirmed, someone on
           the dock to take it and the units checked before anybody signs. A
           summary line saying "confirmed with the account" asks them to take both
           on trust, on the one run where the whole value is that somebody asked. */
        record: {
          with: `${site.name} · ${load?.account ?? row.party}`,
          /* The live call, on the row wired for one.
             Every value is read off THIS ROW rather than off the recording. The
             old MP3 says SO-4390 out loud, which is not the order this load
             carries — it chains from SO-4463, and that is what the row, the
             linked-SO link and the order page all say. A real customer being
             told a different order number than the one on their screen is the
             single worst thing this call could do, so the recording no longer
             gets a vote in what gets said. */
          live: dialable
            ? ({
                agentName: "Tova",
                contactName: siteFirst,
                variables: {
                  contact_first_name: siteFirst,
                  order_id: load?.id ?? row.ref,
                  delivery_date: spokenDate(eta),
                  window_start: spokenClock(DELIVERY_WINDOW.start),
                  window_end: spokenClock(DELIVERY_WINDOW.end),
                  carrier: row.party,
                },
              } satisfies LiveCallRequest)
            : undefined,
          /* The recording's own length where there is one. It read 1:44 while the
             audio was imaginary, and a card claiming 1:44 over 42 seconds stops
             agreeing with the thing it times the moment somebody presses play. */
          duration: recorded ? "0:22" : "1:44",
          audio: recorded ? "/audio/delivery-window.mp3" : undefined,
          when: "Just now",
          number: site.phone,
          turns: recorded ? recordedTurns : templatedTurns,
        },
        steps: [
          {
            label: "Checked the driver's hours",
            text: `Confirmed the window against the driver's remaining hours.`,
            source: "Forwarder feed · driver hours",
          },
          {
            /* What was DONE, not what came back.
               This step is built before the call is placed, so it cannot know
               the answer — and it used to claim one: "Confirmed it with Summit
               Surfaces … He took it." The first real call was a customer
               declining the window, which left this line asserting a yes
               directly above a recording of a no and an outcome card saying
               "Window not confirmed". Three parts of one panel disagreeing.
               A step that names the action is true either way. The answer
               belongs to the recording underneath it and the outcome below
               that, both of which know it. */
            label: `Put the window to ${load?.account ?? row.party}`,
            text: recorded
              ? `Called ${site.name} and put the window to him: ${DELIVERY_WINDOW.start}–${DELIVERY_WINDOW.end} on the 6th.`
              : `Called ${site.name} to confirm somebody will be on the dock, checked the ${crew} crew date still stands, and asked them to inspect at the tailgate rather than after the wrap comes off.`,
            source: site.phone,
          },
          /* The carrier and the email are NOT steps, though Tova promises both on
             the call. The recording renders after the step list, so a step for
             what happened afterwards would sit above the call it followed — and
             the outcome is where a run reports what came next anyway. See
             `confirmed` below, which names the address the confirmation went to. */
        ],
        outcome: {
          kind: "settled",
          title: recorded ? `Window confirmed · ${DELIVERY_WINDOW.short}` : "Window confirmed",
          /* The call put two asks; these are the two answers, listed rather than
             folded into a sentence. Both audible on the recording above, and
             nothing beyond it — Greg says someone from seven, and "I'll have
             Marco handle it" to the unit check, not to the signature. The crew
             date stays off this card: it is on the order page, and this call
             never asked about it. */
          confirmed: recorded
            ? [
                {
                  /* Verb first: what the call achieved, with the particular under
                     it, so the list scans as things done rather than sentences
                     about a delivery. */
                  label: "Confirmed the delivery window",
                  detail: `${DELIVERY_WINDOW.start}–${DELIVERY_WINDOW.end} on ${eta}, agreed with ${siteFirst}`,
                },
                {
                  /* Both promises she closes the call with, kept and named. The
                     address rather than "emailed him", because an address is
                     checkable and a verb is not. */
                  label: "Passed it on, as promised",
                  detail: `${row.party} has the window; the confirmation is with ${site.email}`,
                },
              ]
            : [
                {
                  label: "Confirmed availability",
                  detail: `Someone on the dock from 07:00 on ${eta}`,
                },
                { label: "Confirmed the crew date", detail: `${crew}, unmoved` },
                {
                  label: "Informed about the tailgate check on delivery",
                  detail: "Marco, before he signs",
                },
              ],
          /* No prose on the recorded row. The claim rule is what the two ticked
             rows and the audio above them already carry, and the sentence that
             sat here — why a photograph keeps crush damage a carrier claim — was
             explaining a decision the reader can hear being made. On the
             templated row it stays, because there is no recording to hear it in.
             `lines` is not optional on the type and every other flow has one, so
             this is an empty list rather than a signature change; the map below
             draws nothing. */
          lines: recorded
            ? []
            : [
                `Their crew is the same day, so it lines up with nothing spare — another day of slip costs them a crew, not a date. And a tailgate check is what turns a concealed-damage claim into a transit one, which we can recover.`,
              ],
        },
      };
    }

    case "recovery":
      return {
        ...base,
        label: "Cost recovery",
        ask: `Cost the recovery on ${row.ref}`,
        intro: `On it. ${row.ref} is going wrong.`,
        actAt: 2,
        icon: "commit",
        steps: [
          {
            label: "Listed the options",
            text: `Three options: re-route, split the load, or warn early and re-promise.`,
            source: "TMW · available capacity",
          },
          {
            label: "Costed them",
            text: `Re-route costs ${formatUsd(row.value)} in miles and holds the date. Splitting gets the booked portion there and leaves a second delivery to schedule.`,
            source: "Freight audit · lane costs",
          },
          {
            label: "Warned the customer",
            text: `Warned the customer while the options were still open rather than after one was taken.`,
            source: "Customer notified",
          },
        ],
        outcome: {
          kind: "open",
          title: "Costed, not committed",
          lines: [
            `Warning early is the only one of the three that is free, so I did that first.`,
            `Pick the recovery in Review and I will dispatch it.`,
          ],
        },
      };

    case "backhaul":
      return {
        ...base,
        label: "Book space",
        ask: `Book the backhaul on ${row.ref}`,
        intro: `On it. ${row.ref} runs back empty as it stands.`,
        actAt: 2,
        icon: "commit",
        steps: [
          {
            label: "Found a return leg",
            text: `Found a matching return leg inside the booking window.`,
            source: "TMW · backhaul board",
          },
          {
            label: "Checked driver hours",
            text: `Checked driver hours cover the extra leg without a reset.`,
            source: "Forwarder feed · hours of service",
          },
          {
            label: "Booked it",
            text: `Booked it — ${formatUsd(row.value)} of empty miles removed.`,
            source: "TMW · dispatch",
          },
        ],
        outcome: {
          kind: "settled",
          title: "Booked",
          lines: [`The return leg is loaded and the driver's hours cover it.`],
        },
      };

    /* Signals with no agent move: the line either needs a person or is done. */
    default:
      return null;
  }
}
