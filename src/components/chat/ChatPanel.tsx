"use client";

import { exceptionByKey } from "@/data/planning";
import { overrideTaskFor } from "@/data/planning-approval";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  CalendarBlank,
  CaretLeft,
  ChartLine,
  Paperclip,
  Prohibit,
  SlidersHorizontal,
  Storefront,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { AiStar, Button, Select } from "@navanta-ai/design-system";
import {
  useChatPanel,
  type ChatSubject,
  type OverrideRequest,
  type WatchRequest,
} from "@/context/ChatPanelContext";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { answerFor } from "@/data/answers";
import { CLAIMS, type ServiceOrder } from "@/data/service";
import { QUEUES, contactFor, type ActionRow } from "@/data/action-center";
import { TODAY, claimFiledReport, claimTypeFor } from "@/lib/claim";
import { formatUsd } from "@/data/service";
import { fileClaim } from "@/lib/filed-claims";
import {
  OPEN_A_CLAIM,
  SUBJECT_PROMPTS,
  findPrompt,
  promptsForPage,
  type ChatPrompt,
} from "@/data/chat-prompts";
import { OutcomeCard, StepList, TaskIntro } from "./TaskRun";
import { AgentBadge } from "@/components/chat/AgentBadge";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { settleRow } from "@/lib/actioned";
import { commitLead } from "@/lib/lead-commit";
import { recordHref } from "@/lib/record-href";
import { isWidePage } from "@/data/nav";
import { CALL_LIVE_MS, CallCard } from "./CallCard";
import {
  clockPhrase,
  liveCallsEnabled,
  textConfirmation,
  type LiveCall,
} from "@/lib/live-call";
import { draftFor } from "./SuggestionModal";
import { MESSAGE_LIVE_MS, MessageCard } from "./MessageCard";
import { PoStateCard } from "./PoStateCard";
import type { AgentTask, MessageDraft } from "@/data/agent-actions";
import {
  DeliveryCard,
  DetailsCard,
  EvidenceCard,
  FiledCard,
  IdentifyCard,
  ReviewCard,
  TypeCard,
  assessmentFor,
  initialClaimState,
  type ClaimFlowState,
  type ClaimStep,
} from "./ClaimFlow";

/* The AI wordmark colour. Not in our token set — the DS hardcodes the same
   #3b0764 inside ChristySuggestions, so this matches the system's own usage. */
const AI_TEXT = "#3B0764";

/* The chips are authored per seat AND per page in `@/data/chat-prompts` — see
   `promptsForPage`. They used to be a single fixed four, which on the buyer's
   opportunity feed asked four questions about somebody else's job. */

/** DS outline Button resized to the design's 38px / 12px-radius chip with a
 *  left-aligned label. The DS merges className through twMerge, so these win
 *  over the variant's own height, radius and padding. */
/* Only the two fields it draws. It took a whole `ChatPrompt`, which meant a
   caller with a label and a glyph — the watchlist reasons — had to invent a
   `kind` the chip never reads. */
function SuggestionChip({
  icon: ChipIcon,
  label,
  onSelect,
}: Pick<ChatPrompt, "icon" | "label"> & { onSelect: () => void }) {
  return (
    <Button
      variant="outline"
      fullWidth
      onClick={onSelect}
      className="h-[38px] justify-start rounded-[12px] pl-4 pr-[18px] text-[13px] font-normal"
      iconLeft={<ChipIcon size={14} />}
    >
      <span className="truncate">{label}</span>
    </Button>
  );
}

/* ── The transcript ──────────────────────────────────────────────────────── */

/** Cards are named rather than embedded so the transcript stays serialisable
 *  and a card can re-render from the flow state it belongs to. */
/**
 * Why a planner holds a position.
 *
 * Offered rather than typed. A free-text reason sounds more expressive and is
 * worse for the thing a watchlist is for: six planners write six sentences for
 * one situation, so the list cannot be counted, filtered or reported on, and by
 * the time anybody reads it back the wording tells them less than a label would.
 * These five are the reasons a deployment planner actually parks a line — three
 * of them are waiting on somebody else, two are the position being wrong for a
 * reason the model cannot see.
 *
 * The last one takes a note, because "something else" without one is the free
 * text problem again with an extra click.
 */
/**
 * Why a planner would hold a different figure from the one policy proposed.
 *
 * Picked, not typed — the same rule the watchlist follows, and for the same
 * reason: this text is what the next planner reads when the position breaches
 * again, so it has to be one of a set somebody can search on rather than five
 * different phrasings of "customer asked".
 */
const OVERRIDE_REASONS = [
  "Account commitment not in the forecast",
  "Supplier minimum order quantity",
  "Holding for a promotion",
  "Lead time longer than the policy assumes",
  "Discontinuing — running the position down",
] as const;

const WATCH_REASONS: { label: string; icon: Icon }[] = [
  { label: "Waiting on a revised forecast", icon: ChartLine },
  { label: "Account is re-speccing this floor", icon: Storefront },
  { label: "Style is being discontinued", icon: Prohibit },
  { label: "Seasonal — expect it to clear", icon: CalendarBlank },
  { label: "Buffer looks wrong, checking the policy", icon: SlidersHorizontal },
];

type MessageBody =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "card"; card: ClaimStep }
  | { kind: "delivery-card" }
  | { kind: "filed-card"; claimId: string; title: string; message: string }
  /* Each task card carries its own task and run number.
     Reading them off a single `task` state was fine while a thread held one
     run, and silently corrupted the transcript the moment a second one could
     follow: every earlier card re-rendered with the NEW task's content, so
     finishing a follow-up rewrote the outcome above it. A card in a transcript
     is a record of what happened, so it holds what happened. */
  | { kind: "task-intro"; task: AgentTask; run: number }
  | { kind: "task-state"; task: AgentTask; run: number }
  | { kind: "task-record"; task: AgentTask; run: number }
  | { kind: "task-research"; task: AgentTask; run: number }
  | { kind: "task-steps"; task: AgentTask; run: number }
  | { kind: "task-outcome"; task: AgentTask; run: number }
  /* The reasons a position can be parked for, as chips. Cleared once one is
     picked — a chip strip left behind in the transcript reads as a question that
     is still open. */
  | { kind: "watch-reasons" }
  | { kind: "override-form"; req: OverrideRequest }
  /* What a suggestion chip produces. Both used to open a modal over the panel;
     the panel IS the place the agent works, so a chip that leaves it to answer
     was sending the reader somewhere to read something the transcript could
     have held — and losing it the moment they closed the dialog. */
  | { kind: "chip-answer"; note: string; rows: { label: string; text: string }[] }
  | { kind: "chip-draft"; draft: MessageDraft };

/* The id rides alongside rather than inside each member: `Omit<Message, "id">`
   over a union keeps only the keys every member shares, which erases `text`. */
type Message = MessageBody & { id: number };

/** How far through the flow each card sits, so a card can tell whether the
 *  conversation has moved past it. */
const STEP_ORDER: ClaimStep[] = ["identify", "type", "details", "evidence", "review", "filed"];

function UserBubble({ text }: { text: string }) {
  return (
    /* Extra room underneath, on top of the transcript's own 12px gap. What
       follows a user bubble is the agent's whole response — an intro, a card, a
       run of steps — and at the same spacing as the steps use between
       themselves, the ask read as the first item of the answer rather than the
       thing being answered. */
    <div className="mb-3 flex justify-end">
      <div
        className="max-w-[85%] rounded-[12px] px-3 py-2"
        style={{ background: "var(--surface-sunken)" }}
      >
        <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
          {text}
        </p>
      </div>
    </div>
  );
}

function AgentBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <AiStar size={14} variant="small" className="mt-0.5 shrink-0" />
      <p className="ds-body flex-1" style={{ color: "var(--ds-text-primary)" }}>
        {text}
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2">
      <AiStar size={14} variant="small" className="shrink-0" />
      <span className="flex items-center gap-1" aria-label="Thinking">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full"
            style={{
              background: "var(--ds-text-placeholder)",
              animation: `chat-typing 1s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/** The next claim id, taken off the end of the fixture set. Deterministic —
 *  a random id would differ between the server and the client. */
function nextClaimId(): string {
  const max = CLAIMS.reduce((acc, c) => {
    const n = Number.parseInt(c.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 2040);
  return `CLM-${max + 1}`;
}

/**
 * The agent's panel — the Figma Customer Ops design (node 2234:426), docked to
 * the right edge of the page.
 *
 * Open on arrival and part of the frame: the agent works alongside the seat
 * rather than being summoned. The X collapses it to an edge tab, which is a
 * different thing from dismissing it — the conversation survives.
 *
 * Filing a claim runs here, as a run of cards in the transcript. That used to be
 * a modal (ClaimWizard); the rules moved to `lib/claim.ts` so both the queue's
 * figures and these cards read the same windows and caps.
 */
/**
 * What a run reports once a real call has been placed.
 *
 * The fixture's outcome is a guess at what the call would get. Where a call
 * actually happened, the ticked rows come from what the agent extracted from
 * the recording instead — that is the entire reason for dialling rather than
 * replaying. Where it did not happen, the card says so: a run that reports a
 * confirmed delivery window because a phone rang out is the one failure the
 * whole card exists to prevent.
 */
/** Who the run rang, for a sentence that names them. */
function contactOf(task: AgentTask): string {
  return task.record?.live?.variables?.contact_first_name ?? "The customer";
}

/**
 * The three figures a confirmed window comes down to.
 *
 * Tiles rather than a sentence, for the same reason the alternate's outcome
 * carries them: this card is opened to find out what the load is now committed
 * to, and a window buried in prose has to be read out of it. `window` is passed
 * because the accepted one is not always the one that was offered.
 */
function windowTiles(
  task: AgentTask,
  window: string,
): NonNullable<AgentTask["outcome"]["tiles"]> {
  const v = task.record?.live?.variables ?? {};
  const order = v.order_id;
  return [
    /* As a clock. The analysis reports what it heard — "twelve PM to three PM"
       — and every other window in this app is written as a time. */
    { label: "Window", value: clockPhrase(window) },
    { label: "Delivery date", value: v.delivery_date ?? "—" },
    {
      label: "Order",
      value: order ?? "—",
      ...(order ? { href: `/service/orders/${order}`, newTab: true } : {}),
    },
  ];
}

/** The window that was put to them, as one string. */
function offeredWindow(task: AgentTask): string {
  const v = task.record?.live?.variables ?? {};
  return [v.window_start, v.window_end].filter(Boolean).join("–") || "the window";
}

function outcomeFor(task: AgentTask, result: LiveCall | null): AgentTask {
  if (!result || !task.record?.live) return task;

  if (result.status === "failed") {
    return {
      ...task,
      outcome: {
        ...task.outcome,
        kind: "open",
        title: "The call did not connect",
        lines: [
          result.error ?? "Tova could not reach the number.",
          "Nothing has been written to the load — the window is still unconfirmed.",
        ],
        confirmed: undefined,
        /* No Undo and no continue-link on a run that did nothing. Both would be
           offering to reverse a write that was never made. */
        action: undefined,
        undo: undefined,
      },
    };
  }

  /* The agent's own account of the call, as the insight under the outcome. It
     is the only line here written from having heard the whole thing rather than
     from one extracted field, so it leads. */
  const lines = result.summary ? [result.summary] : task.outcome.lines;

  /* A call the app cut short is a call that may not have got to the end of what
     it rang about, and the reader has to know the ending was ours rather than
     the customer's. */
  if (result.autoEnded) {
    lines.push("Tova ended the call after a minute — it had run past its allowance.");
  }

  /* Never reached them.
     Checked before the refusal branch, because a call that never got the person
     on the phone has no refusal to report — and the card used to report one
     anyway, off a `window_confirmed: false` that only meant "nothing was
     agreed". A chase and a decline lead to different next moves, so they get
     different cards. */
  if (result.reached === false) {
    const who = task.record?.live?.variables?.contact_first_name ?? "the customer";
    return {
      ...task,
      outcome: {
        ...task.outcome,
        kind: "open",
        title: `Did not reach ${who}`,
        lines: [...lines, `The window has not been put to ${who}. Worth another try.`],
        confirmed: result.confirmed,
        action: undefined,
        undo: undefined,
      },
    };
  }

  /* A no.
     The fixture's title is "Window confirmed · 8–11am", and the first real call
     this app ever placed was a customer declining that window and asking for
     twelve to three. A card claiming the window was confirmed, sitting directly
     above a recording of somebody refusing it, is the exact failure the whole
     card exists to prevent — so a no rewrites the title, keeps the line open,
     and settles nothing. */
  /* Whether the customer was sent anything, said plainly.
     A confirmation that failed to send is worth more to the reader than one
     that succeeded: the successful case is what they already expect, and the
     failed one is a person still holding an unconfirmed window. */
  const smsRow = (): NonNullable<AgentTask["outcome"]["confirmed"]> =>
    !result.sms
      ? []
      : result.sms.ok
        ? [{ label: "Texted the confirmation", detail: `Sent to ${result.number ?? "them"}` }]
        : [
            {
              label: "Confirmation not texted",
              detail: result.sms.error ?? "The message did not send.",
              tone: "warn",
            },
          ];

  /* A time they proposed is still a time agreed.
     `window_confirmed: false` with an alternate window is not a refusal — the
     customer named a slot that works and the load now has one, which is the
     thing the row was asking for. Leaving it open sent the reader back to a
     line that had already been settled on the phone. */
  if (result.agreed === false && result.alternate) {
    const carrier = task.record?.live?.variables?.carrier;
    return {
      ...task,
      outcome: {
        ...task.outcome,
        kind: "settled",
        title: "Window confirmed",
        lines: [
          ...lines,
          `${contactOf(task)} proposed it, and ${carrier ?? "the carrier"} has it.`,
        ],
        confirmed: [...(result.confirmed ?? []), ...smsRow()],
        tiles: windowTiles(task, result.alternate),
      },
    };
  }

  if (result.agreed === false) {
    /* A flat no, with nothing offered in its place. Nothing is written and the
       line stays owed. */
    const outstanding = "The load keeps its old window until this is agreed.";

    return {
      ...task,
      outcome: {
        ...task.outcome,
        kind: "open",
        title: "Window not confirmed",
        lines: [...lines, outstanding],
        confirmed: result.confirmed,
        /* Nothing to undo and nothing to walk into: no write was made. */
        action: undefined,
        undo: undefined,
      },
    };
  }

  /* Analysis that came back empty leaves the fixture's rows alone rather than
     rendering an outcome card with nothing under it — the transcript above is
     still the evidence, and it is on screen. */
  /* A yes.
     Same card as a counter-offer, deliberately: both ended with a window on the
     load, and the only difference is whose window it was. The fixture's title
     carried the offered slot — "Window confirmed · 8–11am" — which put the time
     in the heading on one path and in a tile on the other, so two runs of the
     same job could not be read side by side. */
  if (result.agreed === true) {
    return {
      ...task,
      outcome: {
        ...task.outcome,
        kind: "settled",
        title: "Window confirmed",
        lines,
        confirmed: [...(result.confirmed ?? []), ...smsRow()],
        tiles: windowTiles(task, offeredWindow(task)),
      },
    };
  }

  return {
    ...task,
    outcome: {
      ...task.outcome,
      lines,
      ...(result.confirmed ? { confirmed: result.confirmed } : {}),
    },
  };
}

export function ChatPanel() {
  const {
    open,
    subject,
    animate,
    closeChat,
    openChat,
    registerClaimHandler,
    registerTaskHandler,
    registerWatchHandler,
    registerOverrideHandler,
  } =
    useChatPanel();
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  /* The panel lives in the portal layout, so it re-renders on every route
     change — which is how the chips follow the page you are on. */
  const pathname = usePathname();

  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [claim, setClaim] = useState<ClaimFlowState | null>(null);
  /* A position waiting on a reason before it can be parked. Held here rather
     than in the transcript because the composer needs to know that the next
     thing typed is an answer, not a new question. */
  const [watch, setWatch] = useState<WatchRequest | null>(null);
  /** The agent task currently narrating itself, and how far in it is. */
  /** The run still in flight. Cards from earlier runs render as finished. */
  const [currentRun, setCurrentRun] = useState(0);
  /* Two numbers, not one: how many step rows exist, and which of them is
     briefly highlighted. They were the same value once, and clearing the
     highlight at the end of a run silently emptied the whole container. */
  /**
   * Whether this deployment can place a real call.
   *
   * Asked once, of the server, because only the server knows whether the keys
   * are there. It changes the run's choreography rather than just its content:
   * a fixture call is paced on a timer because its length is known, and a real
   * one cannot be — the outcome has to wait for somebody to hang up.
   */
  const [liveCallsOn, setLiveCallsOn] = useState(false);
  /** Whether the card may offer an End call button — see /api/calls/config. */
  const [canHangUp, setCanHangUp] = useState(false);
  /** Whether a confirmation can be texted once a window is agreed. */
  const canTextRef = useRef(false);
  const liveCallsRef = useRef(false);
  useEffect(() => {
    let alive = true;
    void liveCallsEnabled().then((caps) => {
      if (!alive) return;
      liveCallsRef.current = caps.enabled;
      setLiveCallsOn(caps.enabled);
      setCanHangUp(caps.canHangUp);
      canTextRef.current = caps.canText;
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Text the agreed window to the number that was just called.
   *
   * Only where there is something to confirm — a call that got a no, or never
   * reached anybody, has nothing to put in a message. Returns what happened so
   * the outcome card can report it either way; a failed text that the card
   * stayed quiet about would leave the reader believing a customer had been
   * sent something they had not.
   */
  const confirmWithText = async (
    task: AgentTask,
    result: LiveCall,
  ): Promise<{ ok: boolean; error?: string } | undefined> => {
    if (!canTextRef.current || !result.number) return undefined;
    const agreedWindow =
      result.agreed === true
        ? [task.record?.live?.variables?.window_start, task.record?.live?.variables?.window_end]
            .filter(Boolean)
            .join("–")
        : result.alternate;
    if (!agreedWindow || result.reached === false) return undefined;

    const v = task.record?.live?.variables ?? {};
    const text =
      `Target: delivery for ${v.order_id ?? "your order"} is confirmed for ` +
      `${v.delivery_date ?? "the agreed date"}, ${clockPhrase(agreedWindow)}. ` +
      `Reply to this message if that changes.`;
    return textConfirmation(result.number, text);
  };

  /** The outcome a live run is holding back until the line closes. */
  const pendingOutcome = useRef<((result: LiveCall) => void) | null>(null);

  const [shownSteps, setShownSteps] = useState(0);
  const [landed, setLanded] = useState(-1);
  /* The research half runs before the card, so it needs its own counters — the
     two lists are on screen together once the card lands. */
  const [shownLook, setShownLook] = useState(0);
  const [lookLanded, setLookLanded] = useState(-1);
  /** Whether the run has landed, which is what swaps the card to its after state. */
  const [committed, setCommitted] = useState(false);
  /** The move the finished run sets up, sitting in the composer as a draft. */
  const [pendingNext, setPendingNext] = useState<AgentTask["next"] | null>(null);
  const [draft, setDraft] = useState("");
  /** The composer, so a drafted next step can be handed straight to the cursor. */
  const askRef = useRef<HTMLTextAreaElement>(null);
  /* Suggestion prompts under an outcome fire a window event; the composer
     picks the text up and focuses. Kept out of context so an OutcomeCard
     nested arbitrarily deep does not have to be threaded a callback. */
  useEffect(() => {
    const onSeed = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string") return;
      setDraft(detail);
      window.setTimeout(() => askRef.current?.focus(), 0);
    };
    window.addEventListener("shaw:seed-prompt", onSeed as EventListener);
    return () => window.removeEventListener("shaw:seed-prompt", onSeed as EventListener);
  }, []);
  /** Which suggestion opened the modal, if any. */

  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Which run a card belongs to. Only the newest one is still animating. */
  const runSeq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mint = () => {
    nextId.current += 1;
    return nextId.current;
  };
  const push = (m: MessageBody) => setMessages((prev) => [...prev, { ...m, id: mint() }]);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  /* Closing takes as long as the animation does. Tracked here rather than in the
     provider because it is a rendering concern — the panel is logically closed
     the moment it is asked to be; it is only still on screen. */
  const [exiting, setExiting] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) {
      setExiting(true);
      const t = setTimeout(() => setExiting(false), 240);
      wasOpen.current = open;
      return () => clearTimeout(t);
    }
    wasOpen.current = open;
  }, [open]);

  /** The transcript only mounts once there is something in it. */
  const hasThread = messages.length > 0;

  /* Follow the transcript. Cards are tall enough that a new one below the fold
     reads as nothing having happened.
     Watched rather than keyed on state, because most of the growth here is not
     a new message: step rows appear inside a list that is already mounted, call
     turns land from the card's own timer, and the tracking card swaps to its
     committed state in place. None of that changes `messages`, so an effect on
     it left the panel sitting still while the run carried on below the fold.
     Pinned only while the reader is already at the bottom — yanking someone
     back down mid-sentence because a step landed is worse than not following. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let pinned = true;
    const onScroll = () => {
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
    };
    const stick = () => {
      if (pinned) el.scrollTop = el.scrollHeight;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const watch = new MutationObserver(stick);
    watch.observe(el, { childList: true, subtree: true, characterData: true });
    stick();

    return () => {
      el.removeEventListener("scroll", onScroll);
      watch.disconnect();
    };
  }, [hasThread]);

  /* ── Agent tasks ───────────────────────────────────────────────────────── */

  /**
   * Run a row's action, narrated.
   *
   * Deliberately paced. The work is instant — every figure is already in the
   * fixtures — so without the beats the whole run would appear in one frame and
   * read as a canned block of text rather than as something being done. Each
   * step gets a think, then lands; the toast comes last, after the outcome,
   * because a notification that arrives before the account of the work is the
   * behaviour we are replacing.
   */
  const runTask = (next: AgentTask, continued = false) => {
    runSeq.current += 1;
    const run = runSeq.current;
    clearTimers();
    setClaim(null);
    setWatch(null);
    setCurrentRun(run);
    setShownSteps(0);
    setLanded(-1);
    setShownLook(0);
    setLookLanded(-1);
    setCommitted(false);
    setPendingNext(null);
    pendingOutcome.current = null;
    /* A follow-on keeps the thread: the chase above it is the reason this
       commit has a figure at all, and wiping it would leave the number
       unexplained. */
    if (continued) push({ kind: "user", text: next.ask });
    else setMessages([{ id: mint(), kind: "user", text: next.ask }]);
    setTyping(true);

    const look = next.steps.slice(0, next.actAt);

    after(620, () => {
      setTyping(false);
      push({ kind: "task-intro", task: next, run });
      if (look.length) setTyping(true);
    });

    /* The looking runs unasked, and it has to: the card states a revised date
       and quotes an exception, which is knowledge that only exists once the
       quote has been read. Showing the card first and then claiming to read the
       quote after the button presented the agent's homework as a consequence of
       the decision. */
    let at = 620;
    look.forEach((_, i) => {
      at += i === 0 ? 640 : 560;
      after(at, () => {
        setTyping(false);
        if (i === 0) push({ kind: "task-research", task: next, run });
        setShownLook(i + 1);
        setLookLanded(i);
        if (i < look.length - 1) setTyping(true);
      });
    });

    after(at + 520, () => {
      setLookLanded(-1);
      /* The card, then the work. The press was the consent — it named the exact
         move, down to the figure — so nothing here waits to be asked twice. */
      if (next.state) push({ kind: "task-state", task: next, run });
      act(next, run);
    });
  };

  /**
   * Do the work, narrated, then show the same line again with what changed.
   *
   * Deliberately paced. Every figure is already in the fixtures, so without the
   * beats the whole run would appear in one frame and read as a canned block
   * rather than as something being done. No toast at the end: the outcome and
   * the result card are the report, and a notification repeating them over the
   * top of the panel you are already reading is noise.
   */
  /**
   * The run's conclusion — pushed, written to the record, and settled.
   *
   * Lifted out of the timer it used to live in because a real call does not
   * finish on a schedule. A fixture run still calls this on a beat; a live one
   * calls it when the line closes, with what the call actually got.
   */
  const landOutcome = (next: AgentTask, run: number, result: LiveCall | null) => {
    /* What the run reports. On a live call this is the fixture's outcome with
       the agent's own extracted rows written over it — and where the call never
       connected, it is an admission rather than a result. Nothing is settled on
       a call that did not happen: a queue line marked done because a phone rang
       out is the one failure this whole card exists to prevent. */
    const shown = outcomeFor(next, result);
    /* What settles the queue line. A call that never connected did nothing, and
       a call that got a "no" did something — but not the thing the row is
       waiting for. Neither one is done. */
    /* A counter-offer counts as done — see `outcomeFor`. What does not settle
       is a call that never connected, one that never reached the person, and a
       flat no with no time offered in its place. */
    const settles =
      !result ||
      (result.status !== "failed" &&
        result.reached !== false &&
        (result.agreed !== false || !!result.alternate));

      /* Stop the "thinking" indicator once the outcome has landed — otherwise
         the dots keep ticking after the run finished, which reads as the agent
         still working on something that already reported. */
      setTyping(false);
      push({ kind: "task-outcome", task: shown, run });
      /* No hand-off card here. The record page's trail is already on screen
         beside the panel saying the same four things, and the transcript's job
         is what this desk did — not a second copy of where the shipment goes. */
      /* The queue line this came from is no longer owed. It flashes green in
         the table, leaves the open tab and turns up under Settled — reported
         here rather than by the table watching the transcript, because landing
         the outcome IS the moment it is done, and the words it settles with
         should be the ones the run just wrote. Follow-on runs carry a suffixed
         id that matches no row, so a second run inside the same conversation
         cannot settle a second line. */
      /* The record catches up with the transcript — see AgentTask.onLanded. */
      if (settles) {
        next.onLanded?.();
        settleRow(next.id, {
          status: next.resultState?.status ?? shown.outcome.title,
          insight: shown.outcome.lines[0] ?? shown.outcome.title,
          /* Which list it lands in, where the surface has more than one. */
          ...(next.settleBucket ? { bucket: next.settleBucket } : {}),
        });
      }
      /* And the write itself, published for the seats downstream. Committing a
         lead time is the one decision in this prototype that is meant to be felt
         on another desk: the plant caps its line, the buyer writes the longer term
         to the supplier record, and the date the account is waiting on moves. That
         last step was the story the app told in prose and never showed — the
         account order carried on reading its old date as if nothing had
         happened. */
      if (next.leadCommit && settles) {
        const { poRef, ...commit } = next.leadCommit;
        commitLead(poRef, commit);
      }
      /* Highlight off, rows stay. */
      setLanded(-1);
      /* The card already in the transcript takes the new state rather than a
         second copy being pushed below it. Two near-identical cards a few
         inches apart read as a duplicate, not as a change — the point is that
         this line moved, and a thing that moves should be one thing. */
      if (next.resultState && settles) setCommitted(true);
      /* Filled, not sent. The person reads the outcome and decides — the
         composer is where a suggestion belongs, because it is already the place
         they would have to type it. */
      if (next.next) {
        setPendingNext(next.next);
        setDraft(next.next.draft);

      }
  };

  const act = (next: AgentTask, run: number) => {
    setTyping(true);

    /* One container, pushed once; the rows inside it appear as each step
       lands. Pushing a message per step made four transcript entries out of one
       piece of work. */
    const doing = next.steps.slice(next.actAt);
    let at = 500;
    doing.forEach((step, i) => {
      at += i === 0 ? 700 : 620;
      /* A call runs live inside its own card, so everything after it waits for
         the line to close. Reporting the outcome over the top of a call still
         in progress would have the agent answering before it had asked. */
      const dwell = step.call ? CALL_LIVE_MS : step.message ? MESSAGE_LIVE_MS : 0;
      after(at, () => {
        setTyping(false);
        if (i === 0) push({ kind: "task-steps", task: next, run });
        setShownSteps(i + 1);
        setLanded(i);
        if (i < doing.length - 1) setTyping(true);
      });
      at += dwell;
    });

    at += 700;
    /* The recording lands immediately before the outcome it justifies. Placed at
       the top it separated the question from the answer with five turns of
       somebody else's phone call; here it reads as the evidence line under a
       conclusion, which is what it is.
       And on its own beat, because a LIVE recording is not a document — it is the
       call happening, dialling and then landing a turn at a time. It was being
       pushed in the same tick as the outcome, so the conclusion appeared while the
       line was still ringing: the agent reporting what the account said before the
       account had said it. The step-level calls above already waited; this one had
       been missed. */
    if (next.record) {
      const record = next.record;
      /* A real call, on a row wired for one, in a deployment that can place it.
         All three, or this is the fixture it always was. */
      const dialling = !!record.live && liveCallsRef.current;
      after(at, () => {
        setTyping(false);
        push({ kind: "task-record", task: next, run });
        /* The dots keep ticking while the line is open — the agent genuinely is
           still working, and it is the one place in this run where the wait is
           real rather than staged. */
        if (dialling) setTyping(true);
      });
      if (dialling) {
        /* Nothing after this is scheduled. The outcome is held until the call
           card reports the line closed, because a real call takes as long as it
           takes and a timer would have the agent reporting what the customer
           said before they had said it. */
        pendingOutcome.current = (result) => landOutcome(next, run, result);
        return;
      }
      at += record.past ? 400 : CALL_LIVE_MS + 600;
    }
    after(at, () => landOutcome(next, run, null));
  };

  /* The drafted next step takes the cursor, not a highlight.
     Selecting it was tried and reads wrong: a block of inverted text looks like
     something the person just did, and it puts the sentence a keystroke away
     from being wiped. Left unselected it reads as what it is — a line already
     typed for them, ready to send or to edit. Hangs off the draft landing
     because the input is controlled: touching it beside `setDraft` acts on the
     previous value. */
  useEffect(() => {
    if (!pendingNext) return;
    const el = askRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [pendingNext]);

  /* Height follows content. Measured off scrollHeight rather than counting
     characters, so it stays right through wrapping, pasting and the drafts this
     panel fills in on its own. */
  useLayoutEffect(() => {
    const el = askRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const runTaskRef = useRef(runTask);
  useEffect(() => {
    runTaskRef.current = runTask;
  });
  useEffect(
    () => registerTaskHandler((t) => runTaskRef.current(t)),
    [registerTaskHandler],
  );

  /* ── The watchlist ─────────────────────────────────────────────────────── */

  /**
   * Park a position, once somebody says why.
   *
   * The reason is the whole point. A watchlist that takes rows without one
   * becomes a list of things somebody once hesitated over, and by the time it is
   * read back nobody knows whether the hesitation still applies — which is how a
   * queue quietly turns into a graveyard. So the row does not leave review until
   * the answer is in, and the answer travels with it as the line's insight.
   *
   * Answered in the composer rather than in a card. The box is already where the
   * reader would type, and a one-field form floating above it would be a second
   * place to put the same sentence.
   */
  const runWatch = (req: WatchRequest) => {
    clearTimers();
    setClaim(null);
    setCurrentRun(0);
    setPendingNext(null);
    setWatch(req);
    setMessages([{ id: mint(), kind: "user", text: `Put ${req.label} on my watchlist.` }]);
    setTyping(true);
    after(700, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: `I can park it — it will leave the review queue and sit under Watchlist. Why are you holding it?`,
      });
      push({ kind: "watch-reasons" });
    });
  };

  /* Assigned in an effect, not during render — the compiler rejects a ref
     written in the render body, and the pattern above for tasks is the one to
     follow. */
  /**
   * A reason, chosen.
   *
   * Reads back as the planner's own turn, because it is: they answered the
   * question, and a transcript that shows the agent asking and then nothing
   * before the confirmation loses who decided.
   */
  const pickWatchReason = (reason: string) => {
    if (!watch) return;
    const req = watch;
    setWatch(null);
    /* The strip goes with the answer. */
    setMessages((prev) => prev.filter((m) => m.kind !== "watch-reasons"));
    push({ kind: "user", text: reason });
    setTyping(true);
    after(700, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: `Parked. ${req.label} is on your watchlist and out of the review queue — "${reason}" is on the line, so it will still be there when you come back to it.`,
      });
      settleRow(req.key, { status: "On watchlist", insight: reason, bucket: "watchlist" });
    });
  };

  /**
   * A planner overriding what policy proposed.
   *
   * A card rather than the composer, unlike the watchlist. That rule holds for a
   * one-sentence answer — the box is already where the reader would type — and
   * breaks for two fields: a quantity and a reason typed on one line is a form
   * pretending not to be one, and the parsing would be the panel guessing which
   * half was which.
   */
  const runOverride = (req: OverrideRequest) => {
    clearTimers();
    setClaim(null);
    setCurrentRun(0);
    setPendingNext(null);
    setWatch(null);
    setMessages([{ id: mint(), kind: "user", text: `Override ${req.label}.` }]);
    setTyping(true);
    after(700, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: `Policy says ${req.policy} and proposes ${req.suggestedQty} units. Set the quantity you want and tell me why — the reason goes on the line, and it is what the next planner reads.`,
      });
      push({ kind: "override-form", req });
    });
  };

  /**
   * The override, submitted.
   *
   * Runs the ordinary task machinery from here, so the outcome is the same card
   * an approval produces — it is the same kind of act, a quantity approved and
   * handed on. The form goes with the answer, as the watch strip does.
   */
  const submitOverride = (req: OverrideRequest, qty: number, reason: string) => {
    setMessages((prev) => prev.filter((m) => m.kind !== "override-form"));
    const e = exceptionByKey(req.key);
    if (!e) return;
    runTask(overrideTaskFor(e, qty, reason), true);
  };

  const overrideRef = useRef(runOverride);
  useEffect(() => {
    overrideRef.current = runOverride;
  });
  useEffect(
    () => registerOverrideHandler((r) => overrideRef.current(r)),
    [registerOverrideHandler],
  );

  const watchRef = useRef(runWatch);
  useEffect(() => {
    watchRef.current = runWatch;
  });
  useEffect(
    () => registerWatchHandler((r) => watchRef.current(r)),
    [registerWatchHandler],
  );

    /* ── The claim flow ────────────────────────────────────────────────────── */

  const beginClaim = (order?: ServiceOrder) => {
    clearTimers();
    const state = initialClaimState(order);
    setClaim(state);
    setTyping(true);
    setMessages([
      {
        id: mint(),
        kind: "user",
        text: order ? `File a claim against ${order.id}` : "I need to file a claim",
      },
    ]);
    after(500, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: order
          ? `${order.id} — ${order.account}, delivered ${order.deliveredOn} on ${order.receipt}. What went wrong?`
          : "Let's file a claim. A claim is filed against a receipted delivery, so first — which delivery?",
      });
      if (order) push({ kind: "delivery-card" });
      push({ kind: "card", card: order ? "type" : "identify" });
    });
  };

  /* Hand the flow up so an order row can start it. `beginClaim` is rebuilt every
     render, so the registration points at a ref rather than at the closure —
     otherwise every render would deregister and re-register. */
  const beginClaimRef = useRef(beginClaim);
  useEffect(() => {
    beginClaimRef.current = beginClaim;
  });
  useEffect(
    () => registerClaimHandler((order) => beginClaimRef.current(order)),
    [registerClaimHandler],
  );

  const onDeliveryResolved = (order: ServiceOrder) => {
    setClaim((c) => (c ? { ...c, order, step: "type" } : c));
    setTyping(true);
    after(450, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: `${order.id} — ${order.account}, delivered ${order.deliveredOn} on ${order.receipt}. What went wrong?`,
      });
      push({ kind: "delivery-card" });
      push({ kind: "card", card: "type" });
    });
  };

  const onKindPicked = (kind: ClaimFlowState["kind"]) => {
    if (!kind) return;
    const label = claimTypeFor(kind)?.label ?? kind;
    setClaim((c) => (c ? { ...c, kind, checked: "idle", step: "details" } : c));
    push({ kind: "user", text: label });
    setTyping(true);
    after(450, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: "How many units, and what did the account say? I adjudicate the credit from the order and the receipt — you are not typing a figure.",
      });
      push({ kind: "card", card: "details" });
    });
  };

  const onDetailsDone = () => {
    const type = claim?.kind ? claimTypeFor(claim.kind) : null;
    setClaim((c) => (c ? { ...c, step: "evidence" } : c));
    setTyping(true);
    after(450, () => {
      setTyping(false);
      push({
        kind: "agent",
        text: type?.needsPhotos
          ? `${type.label} needs at least one photograph — the tailgate shot and the unit label are the two that settle it.`
          : "Anything to attach? Photographs are optional for this type.",
      });
      push({ kind: "card", card: "evidence" });
    });
  };

  const onEvidenceDone = () => {
    setClaim((c) => (c ? { ...c, step: "review" } : c));
    setTyping(true);
    after(600, () => {
      setTyping(false);
      push({ kind: "agent", text: "Here is what I make of it. Read it, then submit." });
      push({ kind: "card", card: "review" });
    });
  };

  const onSubmitClaim = () => {
    const state = claim;
    const assessment = state ? assessmentFor(state) : null;
    const type = state?.kind ? claimTypeFor(state.kind) : null;
    if (!state?.order || !type || !assessment) return;

    const units = Number.parseInt(state.units, 10);
    /* Captured here rather than read inside the timer: the guard above narrows
       it, and a closure firing 900ms later does not inherit that. */
    const order = state.order;
    const photos = state.files.length;
    const report = claimFiledReport(order, type, units, assessment, profile.agent);
    const claimId = nextClaimId();

    setClaim((c) => (c ? { ...c, step: "filed" } : c));
    setTyping(true);
    after(900, () => {
      setTyping(false);
      push({ kind: "filed-card", claimId, title: report.title, message: report.message });

      /* And a line on the queue.
         The run ended on a card in the panel while the Claims tab beside it
         still showed the two it was built with — the panel reporting a claim
         filed and the queue reporting none. Every figure here comes off the
         wizard's own state and the same assessment the review card showed, so
         the row cannot say something the person did not just approve. */
      fileClaim({
        id: claimId,
        state: "decide",
        ref: claimId,
        refSub: `${type.label} · filed just now`,
        party: order.account,
        partyOwn: false,
        product: order.style,
        qtyValue: String(units),
        qtyUnit: "units",
        date: order.deliveredOn ?? TODAY,
        status: "Claim filed",
        signal: "damage",
        value: assessment.credit,
        action: "Review claim",
        insight: `${type.label} on ${order.id} · ${formatUsd(assessment.credit)} adjudicated, awaiting review`,
        chainFrom: order.id,
        claim: {
          damagedUnits: units,
          credit: assessment.credit,
          policyCap: assessment.cap,
          photos,
          deliveredOn: order.deliveredOn ?? TODAY,
          receipt: order.receipt ?? "—",
          batch: order.lines[0]?.dyeLot ?? "—",
        },
      });
    });
  };

  const resetChat = () => {
    clearTimers();
    setClaim(null);
    setWatch(null);
    setTyping(false);
    setMessages([]);
    setDraft("");
    setPendingNext(null);
    setShownSteps(0);
    setLanded(-1);
    setCommitted(false);
  };

  /* A transcript belongs to one seat working one page.
     Switching persona left Mercer's buyer run sitting in Christy's panel —
     the wrong agent reporting on a record the new seat cannot even reach —
     and moving between pages left a finished run above a page it had
     nothing to do with. Both are the same bug: the thread outlived its
     subject. Clearing on either change is what makes the panel read as
     "here is this page, for this seat". */
  /* Held in a ref so the effect below depends only on the key it watches —
     `resetChat` is re-created every render and would otherwise fire the
     reset on every one of them. */
  const resetChatRef = useRef(resetChat);
  /* Written in an effect. A ref assigned in the render body is a render-phase
     side effect and the compiler rejects it — the pattern the task and watch
     handlers above already use. */
  useEffect(() => {
    resetChatRef.current = resetChat;
  });

  const threadKey = `${persona}::${pathname}`;
  const lastThreadKey = useRef(threadKey);
  useEffect(() => {
    if (lastThreadKey.current === threadKey) return;
    lastThreadKey.current = threadKey;
    resetChatRef.current();
  }, [threadKey]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");

    /* A reason is picked, not typed — see WATCH_REASONS. Typing while the
       question is open answers it with the nearest chip rather than falling
       through to "I have not been taught to answer this", which would look like
       the agent ignoring a direct reply to its own question. */
    if (watch) {
      const needle = text.toLowerCase();
      const hit =
        WATCH_REASONS.find((r) => r.label.toLowerCase().includes(needle)) ?? WATCH_REASONS[0];
      pickWatchReason(hit.label);
      return;
    }
    /* The drafted next step runs for real rather than falling through to the
       "this prototype only..." line — a suggestion the product cannot honour is
       worse than no suggestion. */
    if (pendingNext && text === pendingNext.draft) {
      const follow = pendingNext.task;
      setPendingNext(null);
      runTask(follow, true);
      return;
    }
    setPendingNext(null);
    push({ kind: "user", text });
    setTyping(true);

    /* A follow-up the agent can actually answer. The prompts under a run are
       "worth asking next", and until this they only prefilled the composer —
       where every one of them landed on "I have not been taught this". Seventy
       suggestions the product could not honour is seventy small promises broken.
       See `answerFor`: the answers are derived, so they cannot drift from the
       screens that show the same figures. */
    const answer = answerFor(text);
    if (answer) {
      after(700, () => {
        setTyping(false);
        push({ kind: "agent", text: answer });
      });
      return;
    }

    after(700, () => {
      setTyping(false);
      push({
        kind: "agent",
        /* Per seat, because what this agent can actually do differs by seat.
           The old line offered to file a claim on every one of them — Iris
           plans stock and has no claims at all, so a planner typing a question
           was told to use a flow that does not exist in their product. */
        text:
          persona === "csr"
            ? `I can take a claim from order to filed — ask me, or press ${OPEN_A_CLAIM.toLowerCase()} above. I have not been taught to answer this one yet.`
            : `I work from the rows in your queue — press an action on one and I will show you the working and what it changed. I have not been taught this particular question yet.`,
      });
    });
  };

  /** A subject line worth opening. The label is the reader's intent, not the
   *  recipient's — "draft an update" in a subject tells a account nothing. */
  const chipSubject = (label: string, ref: string) => {
    switch (label) {
      case "Draft an update":
        return `${ref} — where we are, and what it means for your date`;
      case "Offer alternates":
        return `${ref} — two ways to keep your floor-set date`;
      case "Chase a supplier":
        return `${ref} — we need a date we can plan against`;
      case "Warn the account":
        return `${ref} — heads-up before it becomes a surprise`;
      default:
        return `${ref} — ${label}`;
    }
  };

  /**
   * A suggestion chip, answered in the transcript.
   *
   * `read` chips put their note and rows in as a card. `draft` chips compose the
   * message and show it going out. Either way the answer stays in the thread, so
   * it is still there when the next question is asked — which a modal could
   * never manage.
   */
  const onChipSelect = (label: string) => {
    if (label === OPEN_A_CLAIM) {
      beginClaim();
      return;
    }
    const prompt = findPrompt(label);
    if (!prompt) return;

    clearTimers();
    setClaim(null);
    setMessages([{ id: mint(), kind: "user", text: label }]);
    setTyping(true);

    if (prompt.kind === "draft") {
      /* The counterparty comes from the row the panel was opened on, or the top
         line of the queue when it was opened from the rail — a draft addressed
         to nobody is the one thing this chip must never produce. */
      const top = QUEUES[persona].rows.find((r: ActionRow) => r.state === "decide");
      const row: ChatSubject =
        subject ??
        (top
          ? { ref: top.ref, party: top.party, partyOwn: top.partyOwn }
          : { ref: "the order", party: "the supplier", partyOwn: false });
      const contact = contactFor(row.party, row.partyOwn);
      after(620, () => {
        setTyping(false);
        push({
          kind: "agent",
          text: `Drafted from ${row.ref} and the last two exchanges. Read it before it goes.`,
        });
        push({
          kind: "chip-draft",
          draft: {
            to: `${contact.name} · ${row.party}`,
            address: contact.email,
            subject: chipSubject(label, row.ref),
            when: "Now",
            /* The signature is dropped: the transcript already says who is
               sending it, and a "Thanks, Daniela" block inside a card the reader
               is about to approve is furniture. */
            lines: draftFor(label, row, profile.name)
              .split("\n\n")
              .filter((l: string) => l.trim() !== "" && !l.startsWith("Thanks,") && l !== "Hello,"),
          },
        });
      });
      return;
    }

    after(560, () => {
      setTyping(false);
      if (prompt.answer) {
        push({ kind: "chip-answer", note: prompt.answer.note, rows: prompt.answer.rows });
        return;
      }
      /* A prompt with no authored answer fell through to a chip-answer with an
         empty note and no rows — a card that renders nothing, so the button read
         as broken: the transcript cleared, the question appeared, and then
         silence. Fifteen of the landing prompts were in that state, including
         every one on the executive seat.
         The derived answers already cover them, so the fallback is the same one
         the composer uses. A prompt that reaches neither says so out loud rather
         than showing an empty card. */
      const derived = answerFor(label);
      push(
        derived
          ? { kind: "agent", text: derived }
          : {
              kind: "agent",
              text: `I have not been taught to answer that one yet — press an action on a row and I will show you the working instead.`,
            },
      );
    });
  };

  /* ── Collapsed ─────────────────────────────────────────────────────────── */

  /* The panel is unmounted the instant `open` goes false, which is why it used
     to vanish rather than close. Holding it for the length of its own exit
     animation is the whole trick: `exiting` keeps it on screen, playing
     backwards, and the rail waits its turn. */
  if (!open && !exiting) {
    return (
      <button
        type="button"
        onClick={() => openChat(subject ?? undefined)}
        aria-label={`Open ${profile.agent}`}
        className={`${animate ? "chat-rail-in " : ""}flex shrink-0 flex-col items-center gap-2 py-3 transition-colors hover:bg-[var(--surface-sunken)]`}
        style={{
          width: 32,
          background: "var(--surface-chrome)",
          borderLeft: "1px solid var(--ds-border-default)",
        }}
      >
        <CaretLeft size={12} weight="bold" style={{ color: "var(--text-secondary)" }} />
        <AiStar size={16} variant="small" />
        <span
          style={{
            writingMode: "vertical-rl",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.02em",
            color: AI_TEXT,
          }}
        >
          {profile.agent}
        </span>
      </button>
    );
  }

  const page = promptsForPage(persona, pathname);
  const suggestions = subject ? SUBJECT_PROMPTS : page.prompts;
  /* The follow-up prompts belong above the composer, not inside the outcome
     card — they are "what to ask next", which is a composer affordance. Take
     them from the most recent task-outcome that carries any. */
  const activePrompts: string[] = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "task-outcome" && m.task.outcome.prompts?.length) {
        return m.task.outcome.prompts;
      }
    }
    return [];
  })();
  const started = messages.length > 0;
  const currentStep = claim?.step ?? null;
  /** A card is spent once the flow has moved past the step it belongs to. */
  const isSpent = (card: ClaimStep) =>
    currentStep !== null && STEP_ORDER.indexOf(card) < STEP_ORDER.indexOf(currentStep);

  function renderCard(m: Message) {
    /* Cards from a finished run are history: fully revealed, no highlight, and
       showing whatever state that run ended on. Only the newest run is still
       being animated by the live counters. */
    const live = (m: { run: number }) => m.run === currentRun;

    if (m.kind === "task-intro") {
      return <TaskIntro key={m.id} task={m.task} />;
    }
    if (m.kind === "chip-answer") {
      return (
        <div key={m.id} className="flex flex-col gap-2">
          {m.note && (
            <div className="flex gap-2">
              <AiStar size={14} variant="small" className="mt-0.5 shrink-0" />
              <p className="ds-body flex-1" style={{ color: "var(--ds-text-primary)" }}>
                {m.note}
              </p>
            </div>
          )}
          {m.rows.length > 0 && (
            <div
              className="flex shrink-0 flex-col overflow-hidden rounded-[12px]"
              style={{ border: "1px solid var(--ds-border-default)" }}
            >
              {m.rows.map((r, i) => (
                <div
                  key={`${r.label}-${r.text}`}
                  className="flex flex-col gap-0.5 px-3 py-2.5"
                  style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                >
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {r.label}
                  </span>
                  <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                    {r.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (m.kind === "chip-draft") {
      return (
        <div
          key={m.id}
          className="flex shrink-0 flex-col overflow-hidden rounded-[12px]"
          style={{ border: "1px solid var(--ds-border-default)" }}
        >
          <MessageCard draft={m.draft} />
        </div>
      );
    }
    if (m.kind === "task-record") {
      if (!m.task.record) return null;
      /* A card only dials where the deployment can, and only on the run that is
         currently happening — a recording scrolled back to in the transcript is
         history and must not ring anybody a second time. */
      const dialling = !!m.task.record.live && liveCallsOn && live(m);
      const record = dialling ? m.task.record : { ...m.task.record, live: undefined };
      return (
        <div
          key={m.id}
          className="flex shrink-0 flex-col overflow-hidden rounded-[12px]"
          style={{ border: "1px solid var(--ds-border-default)" }}
        >
          <CallCard
            call={record}
            canHangUp={canHangUp}
            onEnded={
              dialling
                ? (result) => {
                    setTyping(false);
                    const land = pendingOutcome.current;
                    pendingOutcome.current = null;
                    /* The text goes out before the outcome is drawn, so the card
                       can say whether it actually left. Reporting "confirmation
                       texted" and then sending it would be a receipt written
                       ahead of the thing it receipts. */
                    void confirmWithText(m.task, result).then((sms) =>
                      land?.(sms ? { ...result, sms } : result),
                    );
                  }
                : undefined
            }
          />
        </div>
      );
    }
    if (m.kind === "task-state") {
      if (!m.task.state) return null;
      const done = live(m) ? committed : true;
      return (
        /* No buttons. The row's own button already said "Commit 42 days", and
           asking the same question again in the panel would mean the press did
           nothing. This card is here to show which line is being changed and
           where it had got to — context for the narration, not a second gate. */
        <PoStateCard
          key={m.id}
          state={done && m.task.resultState ? m.task.resultState : m.task.state}
          /* The record it is about, not the queue it came from — the card
             names a reference, and that is what the link should open. */
          href={recordHref(m.task.state?.ref ?? "", PERSONAS[persona].route)}
          changed={live(m) && committed && !!m.task.resultState}
        />
      );
    }
    if (m.kind === "task-research") {
      const steps = m.task.steps.slice(0, m.task.actAt);
      return (
        <StepList
          key={m.id}
          steps={steps}
          shown={live(m) ? shownLook : steps.length}
          landed={live(m) ? lookLanded : -1}
        />
      );
    }
    if (m.kind === "task-steps") {
      const steps = m.task.steps.slice(m.task.actAt);
      return (
        <StepList
          key={m.id}
          steps={steps}
          shown={live(m) ? shownSteps : steps.length}
          landed={live(m) ? landed : -1}
        />
      );
    }
    if (m.kind === "task-outcome") {
      return <OutcomeCard key={m.id} task={m.task} />;
    }
    if (m.kind === "override-form") {
      return (
        <OverrideForm
          key={m.id}
          req={m.req}
          onSubmit={(qty, reason) => submitOverride(m.req, qty, reason)}
        />
      );
    }
    if (m.kind === "watch-reasons") {
      /* Full width and stacked, unlike the two-column opening strip: these are
         sentences rather than three-word prompts, and side by side they wrap to
         two lines each and stop being scannable. */
      return (
        <div key={m.id} className="flex w-full flex-col gap-2 pl-6">
          {WATCH_REASONS.map((r) => (
            <SuggestionChip
              key={r.label}
              icon={r.icon}
              label={r.label}
              onSelect={() => pickWatchReason(r.label)}
            />
          ))}
        </div>
      );
    }
    if (m.kind === "delivery-card") {
      return claim?.order ? <DeliveryCard key={m.id} order={claim.order} /> : null;
    }
    if (m.kind === "filed-card") {
      return (
        <FiledCard
          key={m.id}
          claimId={m.claimId}
          title={m.title}
          message={m.message}
          onDone={resetChat}
        />
      );
    }
    if (m.kind !== "card" || !claim) return null;

    const spent = isSpent(m.card);
    switch (m.card) {
      case "identify":
        return <IdentifyCard key={m.id} spent={spent} onResolved={onDeliveryResolved} />;
      case "type":
        return claim.order ? (
          <TypeCard
            key={m.id}
            order={claim.order}
            picked={claim.kind}
            spent={spent}
            onPick={onKindPicked}
          />
        ) : null;
      case "details":
        return claim.order ? (
          <DetailsCard
            key={m.id}
            order={claim.order}
            units={claim.units}
            description={claim.description}
            spent={spent}
            onChangePallets={(v) => setClaim((c) => (c ? { ...c, units: v } : c))}
            onChangeDescription={(v) => setClaim((c) => (c ? { ...c, description: v } : c))}
            onContinue={onDetailsDone}
          />
        ) : null;
      case "evidence":
        return (
          <EvidenceCard
            key={m.id}
            agent={profile.agent}
            needsPhotos={claim.kind ? (claimTypeFor(claim.kind)?.needsPhotos ?? false) : false}
            files={claim.files}
            checked={claim.checked}
            spent={spent}
            onFilesAdded={(added) =>
              setClaim((c) =>
                c
                  ? {
                      ...c,
                      /* DropzoneFile is `{ file, id }` — the component reads name
                         and size off the File itself. */
                      files: [
                        ...c.files,
                        ...added.map((file, i) => ({ file, id: `${file.name}-${c.files.length + i}` })),
                      ],
                    }
                  : c,
              )
            }
            onFileRemove={(id) =>
              setClaim((c) => (c ? { ...c, files: c.files.filter((f) => f.id !== id) } : c))
            }
            onCheck={() =>
              setClaim((c) => (c ? { ...c, checked: c.files.length >= 2 ? "pass" : "warn" } : c))
            }
            onContinue={onEvidenceDone}
          />
        );
      case "review": {
        const assessment = assessmentFor(claim);
        return claim.order && claim.kind && assessment ? (
          <ReviewCard
            key={m.id}
            order={claim.order}
            kind={claim.kind}
            units={Number.parseInt(claim.units, 10)}
            assessment={assessment}
            files={claim.files.length}
            agent={profile.agent}
            spent={spent}
            onSubmit={onSubmitClaim}
          />
        ) : null;
      }
      default:
        return null;
    }
  }

  /* Some pages cannot afford 380px of their width. The exception table on Parts
     Planning carries twelve columns; docking the panel beside it would push half
     of them off screen, so there the panel floats over the page instead. It is
     the same panel — only whether it takes space from the table or sits on top
     of it changes. */
  const overlay = isWidePage(pathname);

  return (
    <div
      /* The entrance classes only where something actually changed — see
         `animate`. On the first paint the panel is simply there, at its width,
         with no slide. */
      className={
        overlay
          ? exiting
            ? "chat-overlay-out"
            : animate
              ? "chat-overlay-in"
              : ""
          : `shrink-0 overflow-hidden ${
              exiting ? "chat-dock-out" : animate ? "chat-dock-in" : ""
            }`
      }
      style={
        overlay
          ? {
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              /* Above the page, so it needs a shadow deep enough to read as
                 floating rather than as a column that lost its border. */
              filter: "drop-shadow(-8px 0 24px rgba(10,24,48,0.14))",
            }
          : undefined
      }
    >
      <aside
        aria-label={`${profile.agent} chat`}
        className={`flex h-full flex-col justify-between${
          overlay ? "" : exiting ? " chat-panel-out" : animate ? " chat-panel-in" : ""
        }`}
        style={{
          width: overlay ? "var(--chat-panel-overlay-w)" : "var(--chat-panel-w)",
          background: "var(--surface-chrome)",
          borderLeft: "1px solid var(--ds-border-default)",
          boxShadow: "0px 1px 2px 0px rgba(10,24,48,0.1)",
        }}
      >
        {/* Header */}
        <div className="flex h-[48px] w-full shrink-0 items-center justify-between px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex items-center gap-1">
              <AiStar size={16} variant="small" />
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5, color: AI_TEXT }}>
                {profile.agent}
              </span>
            </span>
            {/* Named, then labelled. "Iris" alone reads as a colleague, and every
                judgement here is one a person is meant to check. */}
            <AgentBadge />
          </span>
          <span className="flex items-center gap-1">
            {/* What this agent has already done on this seat, without asking for
                it in the composer. The activity trail existed as a chat prompt
                somebody had to know to type; a header button is where a reader
                looks for "what happened before I got here". */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChipSelect("Recent activity")}
              aria-label="Session history"
              title="Session history"
              className="size-7 rounded-[12px]"
            >
              <ClockCounterClockwise size={15} />
            </Button>
            {started && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetChat}
                className="h-7 rounded-[12px] px-2 text-[12px] font-normal"
              >
                New
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              aria-label="Collapse chat"
              className="size-7 rounded-[12px]"
            >
              <X size={14} />
            </Button>
          </span>
        </div>

        {/* Body */}
        <div className="flex min-h-px flex-1 items-stretch px-2 pb-2">
          <div
            className="flex min-w-px flex-1 flex-col justify-end gap-3 overflow-hidden rounded-[16px]"
            style={{
              background: "var(--surface-base)",
              border: "1px solid var(--ds-border-default)",
            }}
          >
            {started ? (
              /* Transcript */
              <div
                ref={scrollRef}
                className="chat-transcript hide-scrollbar flex min-h-px flex-1 flex-col gap-3 overflow-y-auto px-3 pt-3"
              >
                {messages.map((m) => {
                  if (m.kind === "user") return <UserBubble key={m.id} text={m.text} />;
                  if (m.kind === "agent") return <AgentBubble key={m.id} text={m.text} />;
                  return renderCard(m);
                })}
                {typing && <TypingDots />}
              </div>
            ) : (
              /* Empty state */
              <div className="flex min-h-px flex-1 flex-col items-center justify-center gap-6 px-3">
                <div className="flex w-full flex-col gap-1.5">
                  <AiStar size={19} variant="small" />
                  <div
                    className="flex w-full flex-col gap-1"
                    style={{ color: "var(--ds-text-primary)" }}
                  >
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>I&rsquo;m here to help.</p>
                    <p style={{ fontSize: 14, lineHeight: 1.4 }}>
                      {subject
                        ? `Contacting ${subject.party} about ${subject.ref}. Choose something:`
                        : page.intro}
                    </p>
                  </div>
                </div>

                {/* One column. Two put a half-panel of width behind each chip,
                    which truncated every prompt worth reading — "Where is the
                    mon…", "How much value …". These are questions, and a
                    question you cannot finish reading is not one you can pick. */}
                <div className="flex w-full flex-col gap-2">
                  {suggestions.map((s) => (
                    <SuggestionChip key={s.label} {...s} onSelect={() => onChipSelect(s.label)} />
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up prompts, docked just above the composer — the "what
                to ask next" the last run surfaced. Clicking one drops it into
                the composer, ready to send or edit. */}
            {activePrompts.length > 0 && (
              <div
                className="flex w-full shrink-0 flex-wrap items-center gap-2 px-3 pb-1"
                style={{ paddingTop: 2 }}
              >
                <span className="ds-label" style={{ color: "var(--text-muted)" }}>
                  Try:
                </span>
                {activePrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDraft(p);
                      window.setTimeout(() => askRef.current?.focus(), 0);
                    }}
                    className="inline-flex items-center rounded-full px-2.5 py-1"
                    style={{
                      fontSize: 12,
                      color: "var(--color-iris-700)",
                      background: "var(--color-iris-50, #f5f3ff)",
                      border: "1px solid var(--color-iris-200, #e6e1fa)",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <div className="flex w-full shrink-0 flex-col gap-2.5 px-3 py-2">
              <div
                className="chat-composer flex w-full flex-col items-stretch gap-2 rounded-[12px] pb-[13px] pl-[17px] pr-[15px] pt-[13px]"
                style={{
                  background: "var(--surface-base)",
                  filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))",
                }}
              >
                {/* A textarea, not an input, and bare rather than the DS
                    control — the composer card already owns the border, padding
                    and shadow, and an <input> can only ever scroll sideways.
                    What people type here is a sentence about a purchase order,
                    and the drafts this panel writes are longer than the box: at
                    one line "Move the reorder point to 327 units on
                    SKU HH5605-5605" arrives with its head already cut off.
                    Grows with the text and stops at five lines, after which it
                    scrolls rather than eating the transcript. */}
                <textarea
                  ref={askRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    /* Enter sends, shift-enter breaks the line — the textarea
                       would otherwise swallow Enter as a newline. */
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask any question..."
                  aria-label={`Ask ${profile.agent} a question`}
                  className="w-full resize-none border-0 bg-transparent p-0 text-[14px] outline-none placeholder:text-[var(--text-muted)]"
                  style={{ lineHeight: "20px", maxHeight: 100, overflowY: "auto" }}
                />
                <div className="flex w-full items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Attach a file"
                    className="size-6 rounded-[8px]"
                  >
                    <Paperclip size={16} />
                  </Button>
                  <Button
                    variant="primary"
                    size="icon"
                    aria-label="Send"
                    onClick={send}
                    disabled={draft.trim().length === 0}
                    className="size-6 rounded-[8px]"
                    style={{ background: "var(--btn-primary-bg)" }}
                  >
                    <ArrowUp size={16} weight="bold" color="#FFFFFF" />
                  </Button>
                </div>
              </div>
              <p
                className="w-full text-center"
                style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ds-text-placeholder)" }}
              >
                {`${profile.agent} is AI and can make mistakes. Please double-check responses.`}
              </p>
            </div>
          </div>
        </div>
      </aside>


    </div>
  );
}

/**
 * The override form: a quantity and a reason.
 *
 * Prefilled with what policy proposed, because that is the figure being changed
 * and a blank box asks the reader to remember it. Submit stays disabled until a
 * reason is picked — the quantity has a sensible default and the reason does not,
 * and the reason is the half that outlives the decision.
 */
function OverrideForm({
  req,
  onSubmit,
}: {
  req: OverrideRequest;
  onSubmit: (qty: number, reason: string) => void;
}) {
  const [qty, setQty] = useState(String(req.suggestedQty));
  const [reason, setReason] = useState<string>("");
  const parsed = Number.parseInt(qty, 10);
  const validQty = Number.isFinite(parsed) && parsed > 0;

  return (
    <div
      className="flex flex-col gap-3 rounded-[12px] p-3"
      style={{ background: "var(--surface-base)", border: "1px solid var(--color-iris-200)" }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
          Quantity · units
        </span>
        <input
          value={qty}
          onChange={(ev) => setQty(ev.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          aria-label="Override quantity in units"
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid var(--ds-border-default)",
            background: "var(--surface-base)",
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
            color: "var(--ds-text-primary)",
          }}
        />
        {/* The delta, live, so the reader sees the size of what they are doing
            rather than two numbers to subtract. Silent at parity. */}
        {validQty && parsed !== req.suggestedQty && (
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {`${parsed > req.suggestedQty ? "+" : "−"}${Math.abs(parsed - req.suggestedQty)} on the ${req.suggestedQty} policy proposed`}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
          Reason on the record
        </span>
        <Select value={reason} onValueChange={setReason}>
          <Select.Trigger size="sm" aria-label="Reason for the override" className="w-full">
            <Select.Value placeholder="Pick a reason" />
          </Select.Trigger>
          <Select.Content>
            {OVERRIDE_REASONS.map((r) => (
              <Select.Item key={r} value={r}>
                {r}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!validQty || reason === ""}
          onClick={() => onSubmit(parsed, reason)}
        >
          {validQty ? `Override to ${parsed}` : "Override"}
        </Button>
      </div>
    </div>
  );
}
