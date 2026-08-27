import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PERSONAS, isPersona } from "@/types/persona";

/**
 * Each seat has its own route now — /buying, /planning, /service, /logistics —
 * so the root sends you to the one the cookie already holds rather than to a
 * generic page that then has to work out which queue you meant.
 *
 * A first visit lands on the executive dashboard, as Dana, VP Supply Chain.
 * It is the one view that spans every tower, so it is the honest place for
 * somebody who has never seen this app to start — the four seats each open on
 * a queue that assumes you already know which desk you are sitting at. It is
 * also first in `PERSONA_ORDER`, and the entry point disagreeing with that
 * order was the odd thing.
 *
 * The cookie still wins where there is one: switching seat is meant to stick,
 * and sending a person back to the dashboard on every visit would undo the
 * switch they just made.
 */
export default async function Home() {
  const persona = (await cookies()).get("navanta_persona")?.value;
  redirect(PERSONAS[isPersona(persona) ? persona : "executive"].route);
}
