import { NextResponse } from "next/server";
import { canSendSms, sendSms, twilioConfig } from "@/lib/twilio";
import { toE164 } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

/**
 * Text a confirmation to the number that was just called.
 *
 * The destination is not taken from the request. This route sits on a public
 * URL with no auth in front of it, and one that texts whatever it is sent is a
 * megaphone pointed at the phone network — so it accepts a number only to check
 * it is the one already configured, and refuses anything else.
 */
export async function POST(request: Request) {
  const config = twilioConfig();
  if (!canSendSms(config)) {
    return NextResponse.json(
      { error: "Texting needs TWILIO_SMS_FROM alongside the account credentials." },
      { status: 501 },
    );
  }

  let body: { to?: string; text?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* Falls through to the missing-field answers below. */
  }

  const to = toE164(body.to?.trim() ?? "");
  const text = body.text?.trim();
  if (!to) return NextResponse.json({ error: "No number to text." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });

  const allowed = toE164(process.env.DEMO_CALL_TO_NUMBER ?? "");
  if (allowed && to !== allowed) {
    return NextResponse.json(
      { error: "That number is not the one this deployment is allowed to text." },
      { status: 403 },
    );
  }

  try {
    const sid = await sendSms(config, to, text);
    /* Accepted, not delivered — see `sendSms`. */
    return NextResponse.json({ accepted: true, sid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send the message." },
      { status: 502 },
    );
  }
}
