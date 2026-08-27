/**
 * The real call, behind the fixture.
 *
 * Every call card in this app has been a fixture — a transcript written into
 * `agent-actions.ts` and an MP3 under /public. This module is the seam where a
 * real one takes its place: Tova dials an actual number through ElevenLabs,
 * which owns the Twilio leg, and the card reads its turns off the wire instead
 * of off a script.
 *
 * The fixture stays. Where the keys are absent the app runs exactly as it did
 * before, because a demo that needs credentials to open is a demo that fails in
 * the room it was built for.
 */

/** Where a live call has got to. ElevenLabs' own vocabulary, narrowed to what
 *  the card actually draws differently. */
export type LiveStatus = "dialling" | "live" | "processing" | "done" | "failed";

/** One side of a live call. Same shape as `CallTurn`, so the card does not need
 *  to know which kind it is holding. */
export interface LiveTurn {
  speaker: string;
  text: string;
  /** Seconds into the call, taken off the wire rather than estimated. */
  at?: number;
}

/** What a confirmed outcome row looks like — matches `outcome.confirmed`. */
export interface ConfirmedRow {
  label: string;
  detail: string;
  /** A thing achieved, or a thing refused. A decline must not carry the tick
   *  that means settled. */
  tone?: "ok" | "warn";
}

/** The whole of what the client knows about a call in flight. */
export interface LiveCall {
  status: LiveStatus;
  conversationId?: string;
  turns: LiveTurn[];
  /** The call's own length, once it has one. */
  durationSecs?: number;
  /** What the agent's post-call analysis extracted, turned into outcome rows. */
  confirmed?: ConfirmedRow[];
  /**
   * Whether the customer actually took the window.
   *
   * Kept separate from `confirmed` because it decides more than what the rows
   * say: a call where the answer was no must not settle the queue line. The
   * first real call this app placed was a no — the fixture would have reported
   * "Window confirmed · 8–11am" over a recording of the customer asking for
   * something else. `undefined` where the analysis could not tell.
   */
  agreed?: boolean;
  /** The window they asked for instead, in their own words. */
  alternate?: string;
  /**
   * Whether the agent actually got the named person on the phone.
   *
   * Distinct from `agreed`, and the distinction matters more than it looks. A
   * call that reached a screening service and was left holding comes back with
   * `window_confirmed: false` — technically true, nothing was confirmed — which
   * the card then reported as "Greg would not take 8:00 AM–11:00 AM". He had
   * not refused anything; nobody had asked him. Never asked and said no are
   * different facts about a delivery, and only one of them means chase Greg.
   */
  reached?: boolean;
  /** The agent's own account of the call — the insight under the outcome. */
  summary?: string;
  /** Whether the agent judged the call to have achieved what it rang for. */
  successful?: boolean;
  /** Set only when something went wrong enough that the card should say so. */
  error?: string;
  /** The number actually dialled. The fixture carries a made-up one, and a card
   *  captioning a real call with it would be the one lie the card exists to
   *  prevent. */
  number?: string;
  /** When the call happened, where that is not now — a replay is of something
   *  that already took place, and captioning it "Just now" would be a lie the
   *  card is here to prevent. */
  when?: string;
  /** This is a finished call being shown, not one being placed. */
  replay?: boolean;
  /** The app cut the call on its allowance rather than either party hanging
   *  up. The outcome has to say so — a conversation stopped mid-sentence may
   *  not have reached the thing it rang about. */
  autoEnded?: boolean;
  /** What happened to the confirmation text, where one was attempted. Carried
   *  on the result so the outcome card reports the send rather than assuming
   *  it. */
  sms?: { ok: boolean; error?: string };
}

/**
 * What a live call needs to know before it can be placed.
 *
 * Carried on the `CallRecording` itself rather than looked up, so the row that
 * owns the fixture is the row that owns the real thing — the two cannot drift
 * apart into a card about one load dialling about another.
 */
export interface LiveCallRequest {
  /** Overrides the configured demo number. Absent on every row today. */
  to?: string;
  /** Fills `{{placeholders}}` in the agent's prompt and first message. */
  variables: Record<string, string>;
  /** Who the agent is, and who it asked for — used to label transcript turns,
   *  which come back off the wire as bare "agent" and "user". */
  agentName: string;
  contactName: string;
}

/* ── The wire ────────────────────────────────────────────────────────────── */

/** What this deployment can do. Server-checked; the answer is two booleans and
 *  never the keys behind them. */
export async function liveCallsEnabled(): Promise<{
  enabled: boolean;
  canHangUp: boolean;
  canText: boolean;
}> {
  const off = { enabled: false, canHangUp: false, canText: false };
  try {
    const res = await fetch("/api/calls/config");
    if (!res.ok) return off;
    const body: { enabled?: boolean; canHangUp?: boolean; canText?: boolean } = await res.json();
    return {
      enabled: !!body.enabled,
      canHangUp: !!body.canHangUp,
      canText: !!body.canText,
    };
  } catch {
    return off;
  }
}

/**
 * Text the confirmed window to the number that was called.
 *
 * Returns the failure rather than throwing, because the card has to report it:
 * a run that quietly swallowed a failed text would tell the reader a
 * confirmation had gone out when nothing had.
 */
export async function textConfirmation(
  to: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/calls/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, text }),
    });
    const body: { error?: string } = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: body.error ?? "The text did not send." };
  } catch {
    return { ok: false, error: "The text did not send." };
  }
}

/** Put the phone down on a call still in progress. */
export async function hangUpCall(callSid: string): Promise<void> {
  const res = await fetch("/api/calls/hangup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callSid }),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not end the call.");
  }
}

/** Place the call. Returns the conversation to poll, or throws with something
 *  worth showing a person. */
export async function startLiveCall(
  req: LiveCallRequest,
): Promise<{
  conversationId: string;
  callSid?: string;
  to?: string;
  when?: string;
  replay?: boolean;
}> {
  const res = await fetch("/api/calls/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: req.to, variables: req.variables }),
  });
  const body: {
    conversationId?: string;
    callSid?: string | null;
    to?: string;
    when?: string;
    replay?: boolean;
    error?: string;
  } = await res.json();
  if (!res.ok || !body.conversationId) {
    throw new Error(body.error ?? "The call could not be placed.");
  }
  return {
    conversationId: body.conversationId,
    callSid: body.callSid ?? undefined,
    to: body.to,
    when: body.when,
    replay: body.replay,
  };
}

/** Read where the call has got to. One poll. */
export async function pollLiveCall(
  conversationId: string,
  req: LiveCallRequest,
): Promise<LiveCall> {
  const res = await fetch(`/api/calls/${encodeURIComponent(conversationId)}`);
  const body = await res.json();
  if (!res.ok) {
    return { status: "failed", conversationId, turns: [], error: body?.error ?? "Lost the call." };
  }
  return readConversation(body, req, conversationId);
}

/** Where the recording lives once there is one to play. */
export function liveAudioUrl(conversationId: string): string {
  return `/api/calls/${encodeURIComponent(conversationId)}?audio=1`;
}

/* ── Reading what came back ──────────────────────────────────────────────── */

/** ElevenLabs' status words, narrowed to ours. */
function statusOf(raw: unknown): LiveStatus {
  switch (raw) {
    case "initiated":
      return "dialling";
    case "in-progress":
      return "live";
    case "processing":
      return "processing";
    case "done":
      return "done";
    case "failed":
      return "failed";
    default:
      /* An unknown status is not a failure — a new word from the API should
         leave the card dialling rather than reporting the call dead. */
      return "dialling";
  }
}

interface RawTranscriptItem {
  role?: string;
  message?: string | null;
  time_in_call_secs?: number;
}

/**
 * The conversation payload, turned into what the card draws.
 *
 * Defensive throughout: this is the one place in the app reading a shape it
 * does not own, and a missing field should cost a turn's timestamp rather than
 * the whole run.
 */
export function readConversation(
  body: Record<string, unknown>,
  req: LiveCallRequest,
  conversationId: string,
): LiveCall {
  const status = statusOf(body.status);

  const rawTurns = Array.isArray(body.transcript) ? (body.transcript as RawTranscriptItem[]) : [];
  const turns: LiveTurn[] = rawTurns
    /* Tool calls and results come back as transcript items with no message.
       They are the agent working, not the agent speaking. */
    .filter((t) => typeof t.message === "string" && t.message.trim().length > 0)
    .map((t) => ({
      speaker: t.role === "agent" ? req.agentName : req.contactName,
      text: (t.message as string).trim(),
      at: typeof t.time_in_call_secs === "number" ? t.time_in_call_secs : undefined,
    }));

  const metadata = (body.metadata ?? {}) as Record<string, unknown>;
  const durationSecs =
    typeof metadata.call_duration_secs === "number" ? metadata.call_duration_secs : undefined;

  const analysis = (body.analysis ?? {}) as Record<string, unknown>;
  const collected = (analysis.data_collection_results ?? {}) as Record<string, unknown>;
  const summary =
    typeof analysis.transcript_summary === "string" && analysis.transcript_summary.trim()
      ? analysis.transcript_summary.trim()
      : undefined;
  const successful =
    analysis.call_successful === "success"
      ? true
      : analysis.call_successful === "failure"
        ? false
        : undefined;

  return {
    status,
    conversationId,
    turns,
    durationSecs,
    successful,
    summary,
    agreed: asBool(collected.window_confirmed),
    alternate: asText(collected.alternate_window),
    reached: asBool(collected.reached_contact),
    confirmed: confirmedFrom(analysis.data_collection_results, req.variables),
  };
}

/**
 * One extracted field, whatever shape it arrived in.
 *
 * The analysis returns a map of objects carrying `value` alongside the model's
 * rationale, but a bare scalar is cheap to tolerate and saves a whole class of
 * "it worked in the dashboard" bug.
 */
function valueOf(entry: unknown): unknown {
  if (entry && typeof entry === "object" && "value" in entry) {
    return (entry as { value: unknown }).value;
  }
  return entry;
}

/**
 * A spoken time window, written as a clock.
 *
 * The analysis returns `alternate_window` in the customer's own words, because
 * that is what it heard — "twelve PM to three PM". Beside a tile reading
 * "September 6th" that is fine; beside a delivery window everywhere else in
 * this app written 08:00–11:00, it reads as a transcription rather than a fact
 * the load now carries.
 *
 * Anything it cannot parse comes back untouched. A window is the thing the
 * driver turns up in, so a half-understood one must never be tidied into a
 * confident wrong answer — better the customer's exact words than a clock time
 * nobody said.
 */
const SPOKEN_HOURS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

export function clockPhrase(text: string): string {
  const word = Object.keys(SPOKEN_HOURS).join("|");
  const re = new RegExp(`\\b(${word}|1[0-2]|[1-9])\\b(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?`, "gi");
  const found: { hour: number; minute: string; meridiem: string | null }[] = [];
  for (const m of text.matchAll(re)) {
    const raw = m[1].toLowerCase();
    const hour = SPOKEN_HOURS[raw] ?? Number(raw);
    if (!hour) continue;
    const meridiem = m[3] ? (m[3][0].toLowerCase() === "a" ? "AM" : "PM") : null;
    found.push({ hour, minute: m[2] ?? "00", meridiem });
  }
  if (found.length !== 2) return text;

  /* "8 to 11 AM" — the first half borrows the meridiem the second one states. */
  const meridiem = found.map((f) => f.meridiem ?? found.find((g) => g.meridiem)?.meridiem ?? null);
  if (meridiem.some((x) => x === null)) return text;

  return found.map((f, i) => `${f.hour}:${f.minute} ${meridiem[i]}`).join(" – ");
}

/** A field that is meant to be a yes or a no, read tolerantly — the LLM returns
 *  a real boolean on a good day and the string "true" on others. */
function asBool(entry: unknown): boolean | undefined {
  const v = valueOf(entry);
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "confirmed", "y"].includes(s)) return true;
    if (["false", "no", "declined", "n"].includes(s)) return false;
  }
  return undefined;
}

/** A field meant to be text, empty-checked so a blank does not render a row
 *  with nothing after the label. */
function asText(entry: unknown): string | undefined {
  const v = valueOf(entry);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 && s.toLowerCase() !== "null" && s.toLowerCase() !== "none" ? s : undefined;
}

/**
 * The ticked rows under the outcome, built from what the call actually got.
 *
 * This is the whole point of wiring the call up: the card that says "Confirmed
 * the delivery window" should be saying it because a person on a phone said
 * yes, not because a fixture said so. Where the agent extracted nothing —
 * analysis still running, or no data-collection fields configured — this
 * returns undefined and the caller keeps whatever it had.
 */
export function confirmedFrom(
  results: unknown,
  variables: Record<string, string>,
): ConfirmedRow[] | undefined {
  if (!results || typeof results !== "object") return undefined;
  const map = results as Record<string, unknown>;

  const agreed = asBool(map.window_confirmed);
  const alternate = asText(map.alternate_window);
  const reached = asBool(map.reached_contact);
  const rows: ConfirmedRow[] = [];

  const windowLabel = [variables.window_start, variables.window_end].filter(Boolean).join("–");
  const date = variables.delivery_date ?? "";
  const contact = variables.contact_first_name ?? "the customer";

  /* Never got to ask. Everything below this line is about what the customer
     said, and there is no customer in this call — whatever `window_confirmed`
     came back as describes an exchange that did not happen. */
  if (reached === false) {
    return [
      {
        label: `${contact} did not take the call`,
        detail: "Somebody else answered — the window was never put to him.",
        tone: "warn",
      },
    ];
  }

  if (agreed === true) {
    rows.push({
      label: "Confirmed the delivery window",
      detail: [windowLabel, date && `on ${date}`, `agreed with ${contact}`]
        .filter(Boolean)
        .join(" "),
    });
  } else if (agreed === false && alternate) {
    /* A window, just not the one offered. Ticked rather than flagged: the call
       went out to get a time agreed and came back with one, which is what the
       row was waiting for. An alternate can only have come from the person
       himself, so this also tells us he was on the phone. */
    rows.push({
      label: "Confirmed a new window",
      detail: `${contact} asked for ${clockPhrase(alternate)}, and it is on the load`,
    });
  } else if (agreed === false && reached === true) {
    /* A flat no. He was on the phone, took nothing and offered nothing. */
    rows.push({
      label: "Window declined",
      detail: `${contact} would not take ${windowLabel || "the window"}`,
      tone: "warn",
    });
  } else if (agreed === false) {
    /* Nothing agreed, nothing counter-offered, and no way to tell whether he
       was ever on the line — which is every call placed before
       `reached_contact` existed. In practice this is the shape a call takes
       when it reaches a screening service or an answering machine and stops,
       so it says that rather than restating the card's own title back at it:
       "Window not agreed" under "Window not confirmed" told the reader the same
       thing twice and neither time said what happened. */
    rows.push({
      label: `${contact} did not take the call`,
      detail: `${windowLabel || "The window"} was never put to him.`,
      tone: "warn",
    });
  }

  /* An alternate is worth its own row only when it is news — under a decline it
     is already the detail of the row above, and repeating it reads as two
     separate things having happened. */
  if (alternate && agreed !== false) {
    rows.push({ label: "Asked for a different window", detail: alternate, tone: "warn" });
  }

  return rows.length ? rows : undefined;
}
