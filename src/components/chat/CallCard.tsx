"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, Pause, Phone, PhoneDisconnect, Play, WarningCircle } from "@phosphor-icons/react";
import type { CallRecording, CallTurn } from "@/data/agent-actions";
import type { LiveCall } from "@/lib/live-call";
import { useLiveCall } from "./useLiveCall";

/**
 * The call the agent placed — first as it happens, then as a recording.
 *
 * "Called Joe" is a claim; this is the evidence. On a chase the whole outcome
 * rests on what was actually asked and what came back — whether the agent put
 * the right question, and whether the answer was a date or a brush-off — and a
 * one-line summary asks the reader to take all of that on trust.
 *
 * It arrives live because a finished transcript dropped in whole reads as a
 * fixture, which it is. Watching the waveform grow and the answers land in
 * order is what makes the two minutes feel like two minutes, and it puts the
 * reader in the call rather than in the minutes of it. When the line ends the
 * card settles into something you can play back.
 *
 * Where a real file is attached the playhead and the clock come off that file,
 * and the transcript highlights the turn being spoken. Where none is, the sweep
 * moves over a fixture and nobody is told a recording exists — the transcript is
 * the substance either way.
 */

/**
 * How long the live call runs on screen.
 *
 * Compressed — a demo cannot sit through two real minutes, and the clock counts
 * the real duration anyway — but paced so each turn can actually be read before
 * the next one lands. Four turns across this is roughly a second and a half
 * apiece, which is about the speed you would follow someone else's call at.
 */
export const CALL_LIVE_MS = 6800;

/**
 * How long a play-back sweep takes.
 *
 * Slower than real time would suggest, and deliberately: the playhead is the
 * only thing moving, so at speed it reads as a progress bar filling rather than
 * as a recording being played. Long enough to watch, short enough to sit
 * through twice.
 */
const PLAYBACK_MS = 10_800;

/** Bars drawn from the name, so a given call always looks like itself. */
function barsFor(seed: string, count = 34): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100003;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) % 2147483648;
    /* Speech, not noise: a floor so no bar collapses, and a lull in the middle
       where the other person is talking. */
    const lull = Math.abs(i - count / 2) < 3 ? 0.45 : 1;
    return (0.28 + ((h >>> 8) % 72) / 100) * lull;
  });
}

/**
 * What the strip says while a real call is running.
 *
 * The difference between a phone ringing and somebody talking is the thing the
 * reader is waiting on, so it gets said rather than implied by a spinner.
 */
function lineState(status: string): string {
  switch (status) {
    case "dialling":
      return "Dialling";
    case "processing":
      return "Wrapping up";
    case "failed":
      return "Call failed";
    default:
      return "On the line";
  }
}

/** "2:14" → seconds, for the clock. */
function toSeconds(stamp: string): number {
  const [m, s] = stamp.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

function stamp(seconds: number): string {
  /* Guarded because a streamed recording can report a non-finite duration, and
     `Math.round(Infinity)` renders as a clock reading "Infinity:NaN". */
  if (!Number.isFinite(seconds)) return "0:00";
  const at = Math.max(0, Math.round(seconds));
  return `${Math.floor(at / 60)}:${String(at % 60).padStart(2, "0")}`;
}

/**
 * Which turn is being spoken at `seconds`.
 *
 * The last turn to have started, which is what a listener hears: between two
 * turns the previous speaker has just finished, so the highlight stays on them
 * across the pause rather than blinking off and back. `-1` where there is
 * nothing to be in time with — no file, or a transcript with no measured
 * offsets — and the transcript then draws exactly as it did before.
 */
function turnAt(turns: CallTurn[], seconds: number | null): number {
  if (seconds === null) return -1;
  let found = -1;
  for (let i = 0; i < turns.length; i += 1) {
    const at = turns[i].at;
    if (at !== undefined && at <= seconds) found = i;
  }
  return found;
}

/** Where the clock stands, against whichever length is authoritative. */
function clockAt(fraction: number, duration: string, realSeconds?: number | null): string {
  return stamp(fraction * (realSeconds ?? toSeconds(duration)));
}

/** Drives a 0→1 sweep whenever `on` is true. One loop, two uses: the live call
 *  and the playback afterwards. */
function useSweep(on: boolean, ms: number, onDone?: () => void) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / ms);
      setP(next);
      if (next < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ms]);
  return [p] as const;
}

export function CallCard({
  call,
  onEnded,
  canHangUp,
}: {
  call: CallRecording;
  /** Whether this deployment can actually put the phone down — see
   *  /api/calls/config. The button is withheld rather than shown inert. */
  canHangUp?: boolean;
  /** Fires once a real call has closed and been analysed, so the run that is
   *  waiting on it can report an outcome it actually has. */
  onEnded?: (result: LiveCall) => void;
}) {
  /* The real call, on the one row wired to place one. Inert everywhere else —
     the hook does nothing without a request, so every other card keeps exactly
     the fixture it always had. */
  const live = useLiveCall(call.live, onEnded, canHangUp);

  /* A call the agent placed earlier is history, not an event. It arrives
     already ended, already playable, with its timestamp — watching a recording
     of this morning "connect" would be theatre, and worse, it would suggest the
     person is being asked to sit through something that already happened. Only
     a call placed during this run animates. */
  const [simConnected, setSimConnected] = useState(!!call.past);
  /* A real call is over when the line closes, not when a timer says so. */
  const connected = live.active ? live.ended : simConnected;
  const [playing, setPlaying] = useState(false);
  /**
   * Whether the transcript is showing.
   *
   * Closed on a past call, and closed on a recorded one — which is the change a
   * real recording forces. When the transcript WAS the artifact, revealing it
   * turn by turn was the event worth watching. With audio attached the recording
   * is the artifact and the transcript is the fallback for a reader who would
   * rather not listen, so nine turns unfurling ahead of the decision pushes the
   * outcome off the bottom of the panel to show something they can now hear.
   *
   * Closed on every card now, including a live one. It used to open wherever
   * there was no audio, on the reasoning that the turns landing in order were
   * the only evidence the call happened — but a run puts the call between the
   * work and the outcome, and nine turns unfurling there push the conclusion
   * off the bottom of a 300px panel. The waveform and the clock already say a
   * call is happening; the words are for whoever wants to check them.
   */
  const [open, setOpen] = useState(false);

  /* Where the words and the recording come from. A live card reads both off the
     wire; every other card reads them off the fixture it was built with. */
  const turns = live.active ? live.turns : call.turns;
  const audioSrc = live.active ? live.audioSrc : call.audio;

  /* ── One card, both halves of a call ────────────────────────────────────
     The live state used to be a separate widget that this card handed off to.
     It read as two things happening rather than one call progressing, and the
     control for cutting the line lived on a component the reader never
     associated with the recording it turned into. So the card holds the whole
     arc: on the line, then played back.
     `done` is the only status that leaves a recording behind, so every other
     status on a real call is still "this is happening" as far as the card is
     concerned — including a failure, which is a call that never became one. */
  const openLine = live.active && live.status !== "done";
  const callFailed = openLine && live.status === "failed";
  /* Something to actually play. A call still running has no recording yet, and
     one that fell over never will — so the playhead, the clock against a total,
     and the seekable transcript are all withheld until there is a file. */
  const playable = !openLine && connected;


  /* The simulated dial only runs where there is nothing real to wait on. */
  const [livePos] = useSweep(!live.active && !connected, CALL_LIVE_MS, () => setSimConnected(true));
  const historic = !!call.past;
  /* The sweep keeps its final value once it lands, so the clock still reads the
     full duration after playback — no second copy of the position to hold it. */
  const [sweepPos] = useSweep(playing && !audioSrc, PLAYBACK_MS, () => setPlaying(false));

  /* ── Real audio, where a file is attached ───────────────────────────────
     Two playback paths on purpose. Without a file the sweep is honest: it moves
     a playhead across a fixture and nobody is told a recording exists. With one,
     the position comes from the element's own currentTime — a simulated playhead
     over real audio would drift apart from what the reader is hearing within a
     second or two, and the drift is worse than no playhead at all.
     The live phase stays simulated either way. A browser will not autoplay audio
     without a gesture, and a run that opens silent while the waveform moves is
     worse than one that never claimed to be audible. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPos, setAudioPos] = useState(0);
  const [audioLength, setAudioLength] = useState<number | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing]);

  const playPos = audioSrc ? audioPos : sweepPos;

  /* The turn under the playhead, in seconds off the file itself — the fraction
     times the element's own duration, not the `duration` string, which is a
     rounded label. Live, nothing is highlighted: the turns are already landing
     one at a time and the last one to arrive is the one being said. */
  const spokenAt =
    playable && audioLength && (playing || audioPos > 0) ? audioPos * audioLength : null;
  const speaking = turnAt(turns, spokenAt);

  const bars = barsFor(call.with);
  /* Live, the wave is being written and stops at the moment reached. Played
     back, the whole wave is there and the playhead moves through it. */
  const position = playable ? playPos : livePos;
  const reached = Math.round(position * bars.length);
  /* A real call reveals nothing on a schedule: every turn it has is a turn that
     was actually said, so they all show the moment they arrive. Only the
     simulated dial unfurls its fixture a turn at a time. */
  const turnsShown =
    live.active || connected
      ? turns.length
      : Math.min(turns.length, Math.floor(livePos * turns.length) + 1);

  /* The call's own length wherever there is one — the file's, or the duration
     the API reports for a real call. The `duration` string is a fixture label
     and loses to both. */
  const realLength = audioLength ?? live.durationSecs ?? null;

  return (
    <div className="flex flex-col gap-2.5 px-3 py-2.5">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          /* Only a real length. A chunked response reports Infinity, and the
             API's own `call_duration_secs` is a better answer than that. */
          onLoadedMetadata={(ev) => {
            const d = ev.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setAudioLength(d);
          }}
          onTimeUpdate={(ev) => {
            const el = ev.currentTarget;
            if (Number.isFinite(el.duration) && el.duration > 0) {
              setAudioPos(el.currentTime / el.duration);
            }
          }}
          onEnded={() => setPlaying(false)}
        />
      )}
      {/* Where the line has got to. Only while it is somewhere — a recording
          needs no status, it has a length. */}
      {openLine && (
        <div
          className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5"
          style={{ background: callFailed ? "var(--surface-danger)" : "var(--color-iris-50)" }}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {callFailed ? (
              <WarningCircle size={13} weight="fill" style={{ color: "var(--text-danger)" }} />
            ) : (
              <span
                className="call-rec block rounded-full"
                style={{ width: 8, height: 8, background: "var(--color-iris-700)" }}
              />
            )}
            <span
              className="ds-label truncate"
              style={{
                color: callFailed ? "var(--text-danger)" : "var(--color-iris-700)",
                fontWeight: 500,
              }}
            >
              {live.replay && !callFailed
                ? "Fetching recording"
                : callFailed
                  ? /* The failure wins. The strip read "Ending — over a minute"
                       in danger red over a call that had already stopped, which
                       described the moment before this one. */
                    lineState(live.status)
                  : live.autoEnded
                    ? /* Said plainly, because the reader did not do this and a
                         call ending on its own otherwise looks like a fault. */
                      "Ending — over a minute"
                    : live.ending
                      ? /* The press registered. Without this the strip went on
                           reading "Dialling" over a call that was being hung
                           up. */
                        "Ending"
                      : lineState(live.status)}
            </span>
          </span>
          {!callFailed && (
            <span
              className="ds-label shrink-0"
              style={{ color: "var(--color-iris-700)", fontVariantNumeric: "tabular-nums" }}
            >
              {/* Counting the conversation, not the ringing — it starts when
                  somebody answers, which is what a handset does. */}
              {live.status === "dialling" ? "—" : stamp(live.elapsed)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Phone size={13} weight="fill" className="shrink-0" style={{ color: "var(--color-iris-700)" }} />
          <span className="ds-body-medium truncate" style={{ color: "var(--ds-text-primary)" }}>
            {call.with}
          </span>
        </span>
        <span
          className="ds-label shrink-0"
          style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
          hidden={openLine}
        >
          {/* The file's length wins where there is a file. A card reading
              "0:42" from a fixture string while the element knows it is 42.5s is
              a coincidence; reading it from the element is a fact. */}
          {playable
            ? playing || playPos > 0
              ? `${clockAt(playPos, call.duration, realLength)} / ${stamp(realLength ?? toSeconds(call.duration))}`
              : stamp(realLength ?? toSeconds(call.duration))
            : clockAt(livePos, call.duration, realLength)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {playable ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? `Pause the call with ${call.with}` : `Play the call with ${call.with}`}
            className="flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
            style={{ width: 26, height: 26, background: "var(--color-iris-700)", color: "#fff" }}
          >
            {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
          </button>
        ) : (
          /* On the line. A record dot rather than a disabled play button — there
             is nothing to play yet, and offering the control before it works is
             how a prototype teaches people that its buttons do nothing. */
          <span
            role="status"
            aria-label={
              callFailed ? `Call with ${call.with} ended` : `On a call with ${call.with}`
            }
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              background: callFailed ? "var(--surface-danger)" : "var(--color-iris-50, #F4F3FF)",
            }}
          >
            {/* Breathing only while there is a line to breathe on. A dot still
                pulsing under "Call failed" says the call is running. */}
            <span
              className={callFailed ? "block rounded-full" : "call-rec block rounded-full"}
              style={{
                width: 9,
                height: 9,
                background: callFailed ? "var(--text-danger)" : "var(--color-iris-700)",
              }}
            />
          </span>
        )}
        {/* Geometry, so it stays crisp and needs no asset. */}
        <span className="flex min-w-0 flex-1 items-center" style={{ gap: 2, height: 24 }} aria-hidden="true">
          {bars.map((h, i) => {
            /* An open line has no known length, so the wave breathes rather than
               filling toward an end nobody can know yet. A failed one is still,
               and grey: there is no audio behind it and never will be. */
            const drawn = openLine || playable || i < reached;
            const filled = openLine ? !callFailed : playable ? i < reached : true;
            const moving = openLine && !callFailed;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full${moving ? " call-live-bar" : ""}`}
                style={{
                  height: drawn ? `${Math.round(h * 24)}px` : 2,
                  minWidth: 2,
                  background:
                    drawn && filled ? "var(--color-iris-700)" : "var(--ds-border-default)",
                  transition: "height 160ms ease-out, background 120ms linear",
                  /* Staggered, so the row reads as speech rather than as one
                     object scaling. */
                  animationDelay: moving ? `${(i % 7) * 90}ms` : undefined,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* Put the phone down.
          Drawn only where it will actually work: a live leg to cut, and the
          credentials to cut it with. A control labelled "End call" that leaves
          the line open is worse than no control — the person presses it,
          believes the call is over, and walks away from a phone still ringing
          somebody.
          Outlined rather than filled: it is the only destructive thing on the
          card, and a solid red block beside a live transcript reads as an alarm
          about the call rather than a control for it. */}
      {openLine && !callFailed && canHangUp && live.canEnd && (
        <button
          type="button"
          onClick={live.end}
          disabled={live.ending}
          aria-label={`End the call with ${call.with}`}
          className="flex items-center gap-1.5 self-start rounded-[8px] px-2.5 py-1 transition-colors disabled:opacity-60"
          style={{
            border: "1px solid var(--border-danger)",
            color: "var(--text-danger)",
            background: live.ending ? "var(--surface-danger)" : "transparent",
          }}
        >
          <PhoneDisconnect size={13} weight="fill" className="shrink-0" />
          <span className="ds-label" style={{ fontWeight: 500 }}>
            {/* Present tense: Twilio has been asked to complete the leg and the
                card is waiting for the line to close, which is a beat behind
                the press. */}
            {live.ending ? "Ending…" : "End call"}
          </span>
        </button>
      )}

      {/* The expander wherever the transcript starts closed — a past call, or a
          recorded one. Without it a recording would be the only thing on the
          card, and a reader who cannot play audio right now would have nothing. */}
      {turns.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 self-start"
          style={{ color: "var(--ds-text-secondary)" }}
        >
          <span className="ds-label">
            {open ? "Hide transcript" : `Read transcript · ${turns.length} turns`}
          </span>
          <CaretDown
            size={11}
            weight="bold"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease-out" }}
          />
        </button>
      )}

      <div className="flex flex-col gap-1.5" hidden={!open}>
        {turns.slice(0, turnsShown).map((t, i) => {
          /* Following the audio. Only the current turn is marked, and the rest
             stay at full contrast: dimming what has not been said yet would make
             the transcript unreadable for the reader who opened it precisely
             because they cannot play the audio right now. */
          const now = i === speaking;
          /* Clickable only where there is a file and a measured offset to seek
             to. A turn that looks like a control and lands nowhere is worse than
             a paragraph, so a templated transcript stays a paragraph. */
          const seekable = !!audioSrc && t.at !== undefined && playable;
          const body = (
            <>
              <span style={{ color: "var(--ds-text-primary)", fontWeight: 500 }}>{t.speaker}</span>
              {"  "}
              <span className="call-turn-text">{t.text}</span>
            </>
          );
          const skin = {
            color: now ? "var(--ds-text-primary)" : "var(--ds-text-secondary)",
            /* Bled 6px into the gutter so the words stay on the same left edge as
               every other turn — a highlight that indents the line it marks reads
               as the transcript shifting, not as a playhead. */
            margin: "0 -6px",
            padding: "1px 6px",
            borderRadius: 6,
            background: now ? "var(--color-iris-50, #F4F3FF)" : undefined,
            transition: "background 120ms linear, color 120ms linear",
          } as const;

          if (!seekable) {
            return (
              <p
                key={`${i}-${t.text}`}
                className="ds-body call-turn"
                aria-current={now ? "true" : undefined}
                style={skin}
              >
                {body}
              </p>
            );
          }
          return (
            <button
              key={`${i}-${t.text}`}
              type="button"
              /* Both classes: the turn keeps its landing animation and gains the
                 hover underline. */
              className="ds-body call-turn call-turn-seek cursor-pointer text-left"
              aria-current={now ? "true" : undefined}
              aria-label={`Play from ${t.speaker}: ${t.text}`}
              onClick={() => {
                const el = audioRef.current;
                if (!el) return;
                el.currentTime = t.at ?? 0;
                /* Seeking is a request to hear it, so it plays — a click that
                   moved a playhead in silence would look like nothing happened.
                   The state follows the element rather than being assumed, so a
                   blocked play leaves the button reading Play. */
                setPlaying(true);
              }}
              style={skin}
            >
              {body}
            </button>
          );
        })}
      </div>

      <span
        className="ds-label"
        style={{ color: callFailed ? "var(--text-danger)" : "var(--text-muted)" }}
        role={openLine ? "status" : undefined}
      >
        {/* A call that could not be placed says so, rather than sitting on a
            dead line pretending to ring. The number actually dialled where
            there was a real call, and the fixture's otherwise. */}
        {callFailed
          ? (live.error ?? "The call could not be placed.")
          : openLine
            ? live.replay
              ? "Replaying a finished call — nothing is being dialled"
              : live.status === "dialling"
                ? live.number
                  ? `Ringing ${live.number}`
                  : "Ringing…"
                : (live.number ?? "Connected")
            : playable
              ? `${live.when ?? call.when} · ${live.number ?? call.number}`
              : historic
                ? call.when
                : "On the line…"}
      </span>
    </div>
  );
}
