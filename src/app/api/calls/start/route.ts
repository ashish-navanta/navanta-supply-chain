import { NextResponse } from "next/server";
import { callingConfig, placeCall, readCall, toE164 } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

/**
 * Ring somebody.
 *
 * The number comes from the environment rather than the request by default.
 * A route that dials whatever a POST body names is an open relay pointed at the
 * phone network, and this one sits in a prototype with no auth in front of it —
 * so an explicit `to` is honoured only when `DEMO_CALL_ALLOW_ANY` says it may
 * be, and the demo's own handset is what it rings otherwise.
 */
export async function POST(request: Request) {
  const config = callingConfig();
  if (!config.ok) {
    return NextResponse.json(
      { error: "Live calling is not configured on this deployment." },
      { status: 501 },
    );
  }

  /* Replay wins over dialling, and is checked before anything else — the whole
     point of it is that no code path below can ring a telephone. The number and
     the date come off the conversation itself rather than being invented, so
     the card captions the recording with the call that is actually on it. */
  if (config.replayConversationId) {
    try {
      const call = await readCall(config, config.replayConversationId);
      const phone = (call?.metadata?.phone_call ?? {}) as Record<string, unknown>;
      const startedAt = call?.metadata?.start_time_unix_secs;
      return NextResponse.json({
        conversationId: config.replayConversationId,
        callSid: null,
        to: typeof phone.external_number === "string" ? phone.external_number : undefined,
        when:
          typeof startedAt === "number"
            ? new Date(startedAt * 1000).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
        replay: true,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Could not read the replay conversation: ${err.message}`
              : "Could not read the replay conversation.",
        },
        { status: 502 },
      );
    }
  }

  let body: { to?: string; variables?: Record<string, string> } = {};
  try {
    body = await request.json();
  } catch {
    /* An empty body is fine — it means "ring the configured number with no
       variables", which is exactly what a smoke test wants to do. */
  }

  const requested = body.to?.trim();
  const allowAny = process.env.DEMO_CALL_ALLOW_ANY === "1";
  const wanted = requested && allowAny ? requested : config.defaultTo;

  if (!wanted) {
    return NextResponse.json(
      { error: "No number to call. Set DEMO_CALL_TO_NUMBER." },
      { status: 400 },
    );
  }

  const to = toE164(wanted);
  if (!to) {
    return NextResponse.json(
      { error: `"${wanted}" is not an E.164 number — it needs a leading + and country code.` },
      { status: 400 },
    );
  }

  try {
    const { conversationId, callSid } = await placeCall(config, to, body.variables ?? {});
    if (!conversationId) {
      /* The call went out but ElevenLabs gave us nothing to follow it by, so the
         card would sit dialling forever. Better to say so. */
      return NextResponse.json(
        { error: "The call was placed but returned no conversation to follow." },
        { status: 502 },
      );
    }
    return NextResponse.json({ conversationId, callSid, to });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The call could not be placed." },
      { status: 502 },
    );
  }
}
