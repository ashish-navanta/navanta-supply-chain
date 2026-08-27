import { NextResponse } from "next/server";
import { hangUp, twilioConfig } from "@/lib/twilio";

export const dynamic = "force-dynamic";

/**
 * End a call that is still running.
 *
 * Takes the Twilio call SID handed back when the call was placed. The card does
 * not mark itself finished on the strength of this returning — it keeps polling
 * and lets the conversation reaching a terminal state be what ends the run,
 * because the call being over is a fact about the phone network rather than
 * about this request succeeding.
 */
export async function POST(request: Request) {
  const config = twilioConfig();
  if (!config.ok) {
    return NextResponse.json(
      { error: "Hanging up needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." },
      { status: 501 },
    );
  }

  let body: { callSid?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* Falls through to the missing-SID answer below. */
  }

  const callSid = body.callSid?.trim();
  if (!callSid) {
    return NextResponse.json({ error: "No call to end." }, { status: 400 });
  }

  try {
    await hangUp(config, callSid);
    return NextResponse.json({ ended: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not end the call." },
      { status: 502 },
    );
  }
}
