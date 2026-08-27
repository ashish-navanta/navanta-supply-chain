/**
 * Hanging up.
 *
 * ElevenLabs has no endpoint for ending a call in progress — its `end_call`
 * tool is something the AGENT decides to do, not something a person watching
 * the card can. The only way to actually put the phone down from here is
 * Twilio's own call resource, so that is what this does.
 *
 * Which means credentials. Where they are absent the app does not offer the
 * button at all: a control labelled "End call" that leaves the line open is
 * worse than no control, because the person presses it, believes the call is
 * over, and walks away from a phone that is still ringing somebody.
 */

const TWILIO = "https://api.twilio.com/2010-04-01";

export interface TwilioConfig {
  ok: boolean;
  accountSid: string;
  authToken: string;
  /** The number confirmations are texted from. Absent means no texting. */
  smsFrom: string;
}

export function twilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const smsFrom = process.env.TWILIO_SMS_FROM ?? "";
  return { ok: !!(accountSid && authToken), accountSid, authToken, smsFrom };
}

/** Whether this deployment can text at all. Separate from `ok`: hanging up and
 *  texting are different permissions and one can be configured without the
 *  other. */
export function canSendSms(config: TwilioConfig): boolean {
  return config.ok && !!config.smsFrom;
}

/**
 * Text the confirmation.
 *
 * Twilio accepting the message is not the same as it arriving — a toll-free
 * number whose verification has not passed is accepted here and filtered by the
 * carrier later, silently. So the caller reports what it knows, which is that
 * the message was accepted for delivery, and never that it was read.
 */
export async function sendSms(config: TwilioConfig, to: string, body: string): Promise<string> {
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const res = await fetch(
    `${TWILIO}/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: config.smsFrom, Body: body }),
    },
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Twilio refused the message (${res.status}).`,
    );
  }
  return payload?.sid ?? "";
}

/**
 * Put the phone down.
 *
 * Completing the Twilio call ends the leg at both ends; ElevenLabs then closes
 * the conversation, and the card's own polling sees it reach a terminal state
 * a beat later. Nothing here tells the card the call is over — the call being
 * over does.
 */
export async function hangUp(config: TwilioConfig, callSid: string): Promise<void> {
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const res = await fetch(
    `${TWILIO}/Accounts/${encodeURIComponent(config.accountSid)}/Calls/${encodeURIComponent(callSid)}.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "completed" }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body?.message === "string" ? body.message : `Twilio refused the hang-up (${res.status}).`,
    );
  }
}
