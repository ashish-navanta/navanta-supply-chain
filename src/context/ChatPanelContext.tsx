"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ServiceOrder } from "@/data/service";
import type { AgentTask } from "@/data/agent-actions";
import { isWidePage } from "@/data/nav";

/** What the panel was opened about, when it was opened from a queue row. */
export interface ChatSubject {
  /** Row reference — "PO-4515". */
  ref: string;
  /** Counterparty being contacted — "Vinh Phat Textiles". */
  party: string;
  /** True when the counterparty is Target-operated. */
  partyOwn: boolean;
}

/** What the panel does when a screen asks it to file a claim. */
type ClaimHandler = (order?: ServiceOrder) => void;

/** What the panel does when a row asks the agent to run its action. */
type TaskHandler = (task: AgentTask) => void;

/**
 * A position somebody wants to park, and why they will be asked.
 *
 * Not an `AgentTask`: a task is work the agent does and reports on, and this is
 * the opposite shape — the agent has nothing to find out, it needs one thing
 * FROM the person before anything can be recorded. Modelling it as a task with
 * an empty step list would be pretending to work.
 */
export interface WatchRequest {
  /** The row's key, so the queue knows which line left. */
  key: string;
  /** What to call it in the transcript — "5T478-78519 at Woodland RDC". */
  label: string;
}

/** What the panel does when a row asks to go on the watchlist. */
type WatchHandler = (req: WatchRequest) => void;

/**
 * A planner overriding what the policy proposed.
 *
 * Two fields rather than one, which is why this does not reuse the watchlist's
 * pattern of answering in the composer: a watch needs a reason, and a sentence
 * belongs where the reader already types. An override needs a quantity AND a
 * reason, and two answers in one line is a form pretending not to be one.
 */
export interface OverrideRequest {
  key: string;
  label: string;
  /** Pre-filled, because the policy's own figure is the thing being changed. */
  suggestedQty: number;
  /** What the policy says, for the question the card asks. */
  policy: string;
}

type OverrideHandler = (req: OverrideRequest) => void;

interface ChatPanelValue {
  open: boolean;
  /** Whether the panel should slide when it next appears — false on the first
   *  paint, true once the reader has moved it. See the state that carries it. */
  animate: boolean;
  /** Null when opened from the top bar rather than a row. */
  subject: ChatSubject | null;
  openChat: (subject?: ChatSubject) => void;
  closeChat: () => void;
  /** Open the panel and start filing a claim, optionally against a known order. */
  startClaim: ClaimHandler;
  /** The panel supplies the flow. Returns its own deregistration. */
  registerClaimHandler: (fn: ClaimHandler) => () => void;
  /** Open the panel and have the agent run a row's action there. */
  startTask: TaskHandler;
  registerTaskHandler: (fn: TaskHandler) => () => void;
  /** Open the panel and ask why this position is being parked. */
  startWatch: WatchHandler;
  registerWatchHandler: (fn: WatchHandler) => () => void;
  /** Open the panel and ask for a quantity and a reason. */
  startOverride: OverrideHandler;
  registerOverrideHandler: (fn: OverrideHandler) => () => void;
}

const ChatPanelContext = createContext<ChatPanelValue | undefined>(undefined);

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  /* Open on arrival. The agent is meant to be alongside the work, not summoned
     to it — so the panel is part of the frame and the X collapses it to an edge
     tab rather than dismissing it for the session. */
  const pathname = usePathname();
  /* Right from the first render, not corrected by an effect afterwards. It used
     to start true everywhere and a mount effect closed it on the wide pages —
     so arriving at Inventory Planning or a product record painted the panel
     open, then collapsed it, which is a flash the reader sees and an entrance
     animation for a panel that was never meant to be there. */
  const [open, setOpen] = useState(() => !isWidePage(pathname));
  /**
   * Whether the panel should play its slide when it next appears.
   *
   * False until somebody moves it. The panel used to animate in on every page
   * load and every route change, because the classes carrying the animation were
   * applied unconditionally on mount — and an animation is a signal that
   * something changed, so playing it when nothing did just makes the page look
   * unsettled while it settles.
   *
   * Set by the handlers a reader can actually trigger, and deliberately NOT by
   * the wide-page effect below: arriving somewhere the panel is meant to be
   * closed is not a change the reader made.
   */
  const [animate, setAnimate] = useState(false);

  /* Except where the page needs its width — Inventory Planning and a single order,
     both of which lay out edge to edge. There the panel starts collapsed and
     floats over the page when summoned. Only on arrival: if the reader opens it
     while they are there, it stays open. */
  const landedWide = useRef<string | null>(isWidePage(pathname) ? pathname : null);
  useEffect(() => {
    const wide = isWidePage(pathname);
    /* Still needed for NAVIGATION into a wide page — the initial state above only
       covers the first paint, and the provider does not remount on a route
       change. */
    if (wide && landedWide.current !== pathname) {
      landedWide.current = pathname;
      setOpen(false);
    }
    if (!wide) landedWide.current = null;
  }, [pathname]);
  const [subject, setSubject] = useState<ChatSubject | null>(null);

  /**
   * The panel's own flow, handed up so a screen can start it.
   *
   * A ref rather than state, and a direct call rather than an intent the panel
   * watches for: the earlier version put the request in state and had the panel
   * react to it in an effect, which meant a claim started during render-commit
   * and needed a nonce to make a second request land at all. Calling the handler
   * from the click keeps it an event, which is what it is.
   */
  const claimHandler = useRef<ClaimHandler | null>(null);
  const taskHandler = useRef<TaskHandler | null>(null);
  const watchHandler = useRef<WatchHandler | null>(null);
  const overrideHandler = useRef<OverrideHandler | null>(null);

  const registerClaimHandler = useCallback((fn: ClaimHandler) => {
    claimHandler.current = fn;
    return () => {
      if (claimHandler.current === fn) claimHandler.current = null;
    };
  }, []);

  const registerTaskHandler = useCallback((fn: TaskHandler) => {
    taskHandler.current = fn;
    return () => {
      if (taskHandler.current === fn) taskHandler.current = null;
    };
  }, []);

  const registerWatchHandler = useCallback((fn: WatchHandler) => {
    watchHandler.current = fn;
    return () => {
      if (watchHandler.current === fn) watchHandler.current = null;
    };
  }, []);

  const registerOverrideHandler = useCallback((fn: OverrideHandler) => {
    overrideHandler.current = fn;
    return () => {
      if (overrideHandler.current === fn) overrideHandler.current = null;
    };
  }, []);

  const openChat = useCallback((next?: ChatSubject) => {
    setSubject(next ?? null);
    setAnimate(true);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setAnimate(true);
    setOpen(false);
  }, []);

  const startClaim = useCallback<ClaimHandler>((order) => {
    setAnimate(true);
    setOpen(true);
    claimHandler.current?.(order);
  }, []);

  const startTask = useCallback<TaskHandler>((task) => {
    /* Opening and running are one event, as with a claim: a row press should
       not have to wait for the panel to notice a piece of state. */
    setAnimate(true);
    setOpen(true);
    setSubject(null);
    taskHandler.current?.(task);
  }, []);

  const startWatch = useCallback<WatchHandler>((req) => {
    setAnimate(true);
    setOpen(true);
    setSubject(null);
    watchHandler.current?.(req);
  }, []);

  const startOverride = useCallback<OverrideHandler>((req) => {
    setAnimate(true);
    setOpen(true);
    setSubject(null);
    overrideHandler.current?.(req);
  }, []);

  const value = useMemo(
    () => ({
      open,
      animate,
      subject,
      openChat,
      closeChat,
      startClaim,
      registerClaimHandler,
      startTask,
      registerTaskHandler,
      startWatch,
      registerWatchHandler,
      startOverride,
      registerOverrideHandler,
    }),
    [
      open,
      animate,
      subject,
      openChat,
      closeChat,
      startClaim,
      registerClaimHandler,
      startTask,
      registerTaskHandler,
      startWatch,
      registerWatchHandler,
      startOverride,
      registerOverrideHandler,
    ],
  );

  return <ChatPanelContext.Provider value={value}>{children}</ChatPanelContext.Provider>;
}

export function useChatPanel(): ChatPanelValue {
  const ctx = useContext(ChatPanelContext);
  if (!ctx) throw new Error("useChatPanel must be used inside a ChatPanelProvider");
  return ctx;
}
