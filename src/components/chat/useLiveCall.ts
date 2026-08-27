"use client";

import { useEffect, useRef, useState } from "react";
import {
  hangUpCall,
  liveAudioUrl,
  pollLiveCall,
  startLiveCall,
  type LiveCall,
  type LiveCallRequest,
} from "@/lib/live-call";

/**
 * How often to ask where the call has got to.
 *
 * Fast enough that a turn lands while the person is still saying it, slow
 * enough that a two-minute call is eighty requests rather than a thousand. The
 * transcript is the thing being waited on and it arrives a sentence at a time,
 * so polling faster than a sentence buys nothing.
 */
const POLL_MS = 1500;

/**
 * How long to let a call sit unanswered before calling it dead.
 *
 * A call nobody picks up stays `initiated` at the API forever — there are two
 * such records in this workspace already, both zero seconds and zero messages.
 * Without this the card would poll until the tab was closed, showing "Dialling"
 * over a phone that stopped ringing minutes ago. Slightly longer than
 * ElevenLabs' own 60-second ring timeout, so the API gets to fail it first and
 * give the better message.
 */
const RING_TIMEOUT_MS = 90_000;

/** A backstop for a call that connects and then never closes. Twenty minutes is
 *  far past any delivery-window call and well short of forever. */
const MAX_CALL_MS = 20 * 60_000;

/**
 * How long a conversation is allowed to run before the app ends it itself.
 *
 * This call has one thing to settle and the script does it in well under a
 * minute. Past that, either the agent is going round in circles or somebody has
 * put the handset down without hanging up — and both cost real money per minute
 * while nobody is listening. Counted from the moment the far end ANSWERS, not
 * from dialling: ringing is not talking, and a long ring should not eat the
 * conversation's time.
 *
 * Change this one number to give demos a longer leash.
 */
const AUTO_END_SECONDS = 60;

/**
 * How long to wait for the far end to catch up after we hang up.
 *
 * Twilio accepting the hang-up is not the same as ElevenLabs closing the
 * conversation, and for a call nobody answered it never will — an unanswered
 * conversation sits at `initiated` indefinitely. Waiting for a terminal status
 * that is never coming is what made the End call button look broken: it worked,
 * Twilio completed the leg, and the card went on saying "Dialling".
 *
 * So: prefer the real ending, which brings the transcript and the analysis with
 * it, but stop waiting for one after this.
 */
const HANGUP_GRACE_MS = 8_000;

/**
 * The same wait, for a call somebody actually answered.
 *
 * Far longer, because there is something worth waiting for. When a connected
 * call ends, ElevenLabs walks it through `processing` and runs the analysis
 * before marking it `done` — and only `done` carries the recording, the
 * transcript with its offsets, and the extracted fields.
 *
 * Eight seconds was catastrophically short for that. A real call reached an
 * iPhone screening assistant, ran past its minute, was cut automatically, and
 * the card gave up eight seconds later and reported "The call did not connect"
 * — over a conversation that had happened, been recorded, and was still being
 * written up. The evidence existed and the card threw it away.
 */
const HANGUP_ANSWERED_GRACE_MS = 120_000;

/**
 * One dial per request, however many times the card mounts.
 *
 * The per-hook ref below stops React's StrictMode double-invoke. It cannot stop
 * a genuine remount — a crash in a sibling, a parent re-keying, a fast refresh
 * — because a remount builds a new component with new refs. That happened here:
 * one render error in the widget put the card in a mount loop and fired four
 * outbound calls off a single button press. In replay that was four reads; with
 * a real number it is four telephones ringing.
 *
 * So the guard lives at module scope, keyed by what is being asked for. Mounts
 * that arrive while a call is in flight share the one dial. The entry is
 * dropped once the call reaches a terminal state, so pressing the button again
 * later genuinely places a second call — which is a thing somebody may well
 * want, and is quite different from placing it twice by accident.
 */
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof startLiveCall>>>>();

function dialKey(req: LiveCallRequest): string {
  return JSON.stringify([req.agentName, req.contactName, req.variables, req.to ?? ""]);
}

function dialOnce(req: LiveCallRequest) {
  const key = dialKey(req);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const started = startLiveCall(req);
  inFlight.set(key, started);
  /* A dial that never got off the ground must not block the next attempt. */
  started.catch(() => inFlight.delete(key));
  return started;
}

/**
 * A call that stops being a fixture.
 *
 * Places the call on mount, then follows it: dialling, live with turns landing
 * as they are spoken, and finally done — at which point the recording and the
 * agent's analysis are both available and `onEnded` fires so the run can report
 * an outcome it actually has.
 *
 * Returns a flat, already-derived shape rather than the raw conversation. The
 * card should not have to know that "in-progress" and "processing" are both
 * states where the line is no longer open but the analysis has not landed.
 */
export function useLiveCall(
  req: LiveCallRequest | undefined,
  onEnded?: (call: LiveCall) => void,
  /** Whether this deployment can actually hang up. Without it the automatic
   *  cut-off cannot fire, because there is nothing to cut with. */
  canHangUp?: boolean,
) {
  const [call, setCall] = useState<LiveCall>({ status: "dialling", turns: [] });
  /** Seconds since we dialled, for the clock while the line is open. The API
   *  only reports a duration once the call is over. */
  /** Talk time — seconds since the far end picked up. Zero while it rings,
   *  which is what a phone shows. */
  const [elapsed, setElapsed] = useState(0);
  /** Whether this app ended the call rather than either party doing so. */
  const [autoEnded, setAutoEnded] = useState(false);
  /** The Twilio leg, which is the only handle there is on a call in progress. */
  const [callSid, setCallSid] = useState<string | undefined>();
  /** A hang-up in flight, so the button can say it is working. */
  const [ending, setEnding] = useState(false);

  /** `onEnded` must fire once, not once per poll after the call lands. */
  const reported = useRef(false);
  /** When the far end picked up, or null while it is still ringing. */
  const connectedAtRef = useRef<number | null>(null);
  /** The automatic cut-off fires once. */
  const autoEndedRef = useRef(false);
  /** When we asked Twilio to hang up, if we have. */
  const hungUpAtRef = useRef<number | null>(null);
  /** Latest callback without making it an effect dependency, which would
   *  re-run the whole call on every parent render. */
  const endedRef = useRef(onEnded);
  /* Kept current in an effect rather than assigned during render — a ref
     written while rendering is a mutation React has not been told about. */
  useEffect(() => {
    endedRef.current = onEnded;
  });

  useEffect(() => {
    if (!req) return;

    /* No per-instance "have I dialled" guard here, deliberately.
       One used to live here to survive StrictMode's mount → cleanup → mount,
       and it did the opposite: the second run saw the flag set and returned
       before starting the poll loop, while the first run's cleanup had already
       stopped it. The call went out and nothing ever followed it — the card sat
       on "Dialling" through a real conversation and never reported an outcome.
       Duplicate dialling is now prevented where it actually belongs, in the
       module-level `inFlight` map, which a remount cannot reset. This effect is
       free to run as many times as React likes; each run polls, and they all
       share the one call. */
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    /* Two clocks, measuring different things. `started` is for the no-answer
       timeout, which is about how long it has been ringing. The one on screen
       counts the conversation, and does not begin until there is one. */
    const ticker = setInterval(() => {
      if (!live) return;
      const at = connectedAtRef.current;
      setElapsed(at ? Math.round((Date.now() - at) / 1000) : 0);
    }, 500);

    const follow = async (conversationId: string) => {
      if (!live) return;
      const next = await pollLiveCall(conversationId, req);
      if (!live) return;

      /* Ended by the clock rather than by the far end. Reported as a failure
         because that is what it is — nothing was confirmed and nothing should
         be written to the load on the strength of it. */
      const waited = Date.now() - started;
      /* Hung up, and the far end has had long enough to agree.
         Which "long enough" applies depends on whether anybody answered: a call
         that never connected has nothing coming and should stop quickly, while
         one that did is still being processed into a recording worth waiting
         for. */
      const hungUp = hungUpAtRef.current;
      const answered = connectedAtRef.current !== null;
      const grace = answered ? HANGUP_ANSWERED_GRACE_MS : HANGUP_GRACE_MS;
      const abandoned = !!hungUp && Date.now() - hungUp > grace;
      const stalled =
        abandoned ||
        (next.status === "dialling" && waited > RING_TIMEOUT_MS) ||
        waited > MAX_CALL_MS;
      if (stalled) {
        inFlight.delete(dialKey(req));
        const dead: LiveCall = {
          ...next,
          status: "failed",
          error: abandoned
            ? next.status === "dialling"
              ? /* Both facts, because either alone misleads: the call was cut
                   from here, AND it was cut while still ringing. */
                `Call ended from here — ${req.contactName} had not picked up.`
              : /* Answered, cut, and still not written up two minutes later.
                   Says where the recording went rather than pretending there
                   was never a call. */
                "Call ended from here — the recording is still being processed."
            : next.status === "dialling"
              ? /* Named, because "nobody answered" is a fact about the network
                   and this is a fact about a person the reader is chasing. */
                `${req.contactName} did not pick up the call.`
              : "The call never closed — giving up on it.",
        };
        setCall(dead);
        if (!reported.current) {
          reported.current = true;
          endedRef.current?.(dead);
        }
        return;
      }

      /* The dialled number is known from the moment the call was placed and is
         not repeated on every poll — carry it forward rather than letting the
         card fall back to the fixture's made-up one halfway through. */
      /* Answered. From here the clock on the card means something. */
      if (next.status === "live" && connectedAtRef.current === null) {
        connectedAtRef.current = Date.now();
      }

      setCall((prev) => ({
        ...next,
        number: next.number ?? prev.number,
        when: next.when ?? prev.when,
        replay: next.replay ?? prev.replay,
      }));

      /* `done` means the analysis has run, which is the only point at which the
         outcome rows exist. `failed` ends the wait too — a run that sits
         dialling forever because nobody picked up is worse than one that says
         so. */
      if (next.status === "done" || next.status === "failed") {
        inFlight.delete(dialKey(req));
        if (!reported.current) {
          reported.current = true;
          endedRef.current?.({ ...next, autoEnded: autoEndedRef.current });
        }
        return;
      }
      timer = setTimeout(() => void follow(conversationId), POLL_MS);
    };

    void (async () => {
      try {
        const { conversationId, callSid: sid, to, when, replay } = await dialOnce(req);
        if (!live) return;
        setCallSid(sid);
        setCall({ status: "dialling", conversationId, turns: [], number: to, when, replay });
        timer = setTimeout(() => void follow(conversationId), POLL_MS);
      } catch (err) {
        if (!live) return;
        const failed: LiveCall = {
          status: "failed",
          turns: [],
          error: err instanceof Error ? err.message : "The call could not be placed.",
        };
        setCall(failed);
        if (!reported.current) {
          reported.current = true;
          endedRef.current?.(failed);
        }
      }
    })();

    return () => {
      live = false;
      clearInterval(ticker);
      if (timer) clearTimeout(timer);
    };
    /* Once, on mount. `req` is rebuilt every render by the caller and is not a
       meaningful dependency — re-running this because an object identity
       changed would place a second call. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The line is no longer open. `processing` is included deliberately: the
     person has hung up, and a card still drawing a live waveform while the
     analysis runs would be claiming somebody is still talking. */
  const ended = call.status === "done" || call.status === "failed" || call.status === "processing";

  /**
   * Put the phone down.
   *
   * Deliberately does not mark the call ended. Twilio completing the leg is a
   * request that the call stop; the card goes on polling and lets the
   * conversation actually reaching a terminal state be what ends the run. A
   * card that declared the call over the instant the button was pressed would
   * be reporting an intention as an outcome.
   */
  const end = async () => {
    if (!callSid || ending) return;
    setEnding(true);
    try {
      await hangUpCall(callSid);
      /* Stays `ending` from here until the run actually finishes. Resetting it
         when the request came back — which it did, in about 300ms — flipped the
         button from "Ending…" back to "End call" while the line was still
         closing, and read as a press that did nothing. */
      hungUpAtRef.current = Date.now();
    } catch (err) {
      setEnding(false);
      setCall((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Could not end the call.",
      }));
    }
  };

  /**
   * End it ourselves once the conversation has run past its allowance.
   *
   * Watches the same clock the card draws, so what fires is what the reader can
   * see coming. It calls the same `end` a person would press — there is one way
   * to hang up a call in this app, and an automatic cut that took a different
   * path would be a second implementation to keep in step with the first.
   *
   * Silent where hanging up is not configured: without Twilio credentials there
   * is no way to act on the decision, and a timer that notices the call is long
   * and can do nothing about it is not worth running.
   */
  useEffect(() => {
    if (!canHangUp || !callSid || autoEndedRef.current) return;
    if (call.status !== "live" || elapsed < AUTO_END_SECONDS) return;
    autoEndedRef.current = true;
    setAutoEnded(true);
    void end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, call.status, canHangUp, callSid]);

  return {
    /** Whether this hook is driving anything at all. */
    active: !!req,
    /** The call was cut by the clock rather than by either party. */
    autoEnded,
    /** How long a conversation is allowed to run, for the card to say so. */
    autoEndSeconds: AUTO_END_SECONDS,
    /** Present only on a real call that is still running. */
    canEnd: !!callSid && !ended,
    ending,
    end,
    status: call.status,
    turns: call.turns,
    elapsed,
    ended,
    /** Only once the analysis has landed — a failed call has nothing to play. */
    audioSrc: call.status === "done" && call.conversationId ? liveAudioUrl(call.conversationId) : undefined,
    durationSecs: call.durationSecs,
    confirmed: call.confirmed,
    agreed: call.agreed,
    alternate: call.alternate,
    summary: call.summary,
    number: call.number,
    when: call.when,
    replay: !!call.replay,
    error: call.error,
  };
}
