import { NextResponse } from "next/server";
import { callingConfig } from "@/lib/elevenlabs";
import { canSendSms, twilioConfig } from "@/lib/twilio";

export const dynamic = "force-dynamic";

/**
 * Whether this deployment can actually ring anybody.
 *
 * A boolean, and never the keys behind it. The panel has to know before it
 * choreographs a run — a live call takes as long as it takes and the outcome
 * waits on it, where the fixture is paced on a timer — and the alternative was
 * a NEXT_PUBLIC flag that could disagree with whether the keys were really
 * there.
 */
export async function GET() {
  const config = callingConfig();
  /* Whether the card may offer an End call button. Reported rather than
     assumed: the button must not exist unless pressing it genuinely puts the
     phone down.
     `replay` is reported for one reason: on a deployed environment nobody can
     read the variables, and a site with replay left on looks identical to one
     that is simply refusing to dial. The only other way to tell them apart is
     to POST to /api/calls/start and see whether a telephone rings, which is not
     a diagnostic anybody should have to run. Still a boolean; the conversation
     id it came from stays here. */
  const twilio = twilioConfig();
  return NextResponse.json({
    enabled: config.ok,
    canHangUp: twilio.ok,
    canText: canSendSms(twilio),
    replay: !!config.replayConversationId,
  });
}
