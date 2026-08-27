/**
 * The server's half of the call — credentials, and the two requests that use
 * them.
 *
 * Kept out of `live-call.ts` on purpose: that module ships to the browser, and
 * the API key must never be in a bundle. Nothing here is imported by a client
 * component.
 */

const API = "https://api.elevenlabs.io";

export interface CallingConfig {
  ok: boolean;
  apiKey: string;
  agentId: string;
  phoneNumberId: string;
  /** The number to ring when a row does not name one — the demo's own handset. */
  defaultTo: string;
  /** A specific agent branch, where the workspace uses them. Optional: an
   *  unset branch means the agent's default, which is what most workspaces
   *  have. */
  branchId: string;
  /**
   * A finished call to show instead of placing a new one.
   *
   * For working on the card itself. Everything after the call is placed — the
   * recording, the transcript with its offsets, the summary, the extracted
   * fields — only exists once a real person has been rung, so building the
   * card that displays them used to mean ringing somebody every time. With
   * this set the run reads an existing conversation instead, and no phone
   * rings. It is real data throughout; the only thing being skipped is the
   * dialling.
   */
  replayConversationId: string;
}

/** What the environment has, and whether it is enough to place a call. */
export function callingConfig(): CallingConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? "";
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID ?? "";
  const defaultTo = process.env.DEMO_CALL_TO_NUMBER ?? "";
  const branchId = process.env.ELEVENLABS_BRANCH_ID ?? "";
  const replayConversationId = process.env.DEMO_REPLAY_CONVERSATION_ID ?? "";
  /* Replaying needs only a key to read with — no agent and no number, because
     nothing is being dialled. */
  return {
    ok: !!apiKey && (!!replayConversationId || !!(agentId && phoneNumberId)),
    apiKey,
    agentId,
    phoneNumberId,
    defaultTo,
    branchId,
    replayConversationId,
  };
}

/**
 * E.164, which is the one thing Twilio will not guess at.
 *
 * Spaces, dashes and brackets are how a person writes a number down, and all
 * three are rejected on the wire. A leading `+` is required and cannot be
 * inferred — a bare 10-digit string could belong to any country — so this
 * tidies what it safely can and refuses the rest rather than dialling something
 * it made up.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s()\-.]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(trimmed) ? trimmed : null;
}

/** Place the outbound call. ElevenLabs owns the Twilio leg from here. */
export async function placeCall(
  config: CallingConfig,
  to: string,
  variables: Record<string, string>,
): Promise<{ conversationId: string | null; callSid: string | null }> {
  const res = await fetch(`${API}/v1/convai/twilio/outbound-call`, {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: config.agentId,
      agent_phone_number_id: config.phoneNumberId,
      to_number: to,
      call_recording_enabled: true,
      conversation_initiation_client_data: {
        dynamic_variables: variables,
        ...(config.branchId ? { branch_id: config.branchId } : {}),
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : (body?.message ?? `ElevenLabs refused the call (${res.status}).`),
    );
  }
  return { conversationId: body?.conversation_id ?? null, callSid: body?.callSid ?? null };
}

/** Where the call has got to, with its transcript and — once it is done — the
 *  analysis the outcome card is built from. */
export async function readCall(config: CallingConfig, conversationId: string) {
  const res = await fetch(`${API}/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": config.apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not read the call (${res.status}).`);
  return res.json();
}

/** The recording itself, streamed back through this app so the key stays here.
 *  A `Range` is forwarded where the browser sent one, so seeking works. */
export async function readCallAudio(
  config: CallingConfig,
  conversationId: string,
  range?: string | null,
) {
  return fetch(`${API}/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, {
    headers: {
      "xi-api-key": config.apiKey,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });
}
