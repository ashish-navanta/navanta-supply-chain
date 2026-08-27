/* ═══════════════════════════════════════════════════════════════
 *  A step's label, in the tense the moment is in
 *
 *  Every step in the fixtures is written in the past — "Confirmed it
 *  with Summit Department Stores" — because that is what a receipt says. But a
 *  step that has only just started has not been done yet, and the
 *  timeline showing it ticked and past-tense in the same instant it
 *  appears reports work as finished a beat before it is.
 *
 *  So the label is put into the present participle while the step is
 *  the one in flight, and reverts to the fixture's own words the
 *  moment the next one lands.
 *
 *  A lookup rather than a rule, because English will not take the rule:
 *  "Wrote" is not "Wroteing", "Found" is not "Founded", "Drew" is not
 *  "Drewing". The set of verbs the fixtures actually use is finite and
 *  countable — every leading word across every flow file is in the map
 *  below — so each one is stated. Anything unmapped falls through
 *  unchanged, which reads as it does today rather than wrongly: "Own
 *  truck wins" is a finding, not an action, and has no present tense to
 *  be put into.
 * ═══════════════════════════════════════════════════════════════ */

/** Past tense → present participle, for every verb a step label opens with. */
const DOING: Record<string, string> = {
  Assigned: "Assigning",
  Booked: "Booking",
  /* One label picks its verb at run time — `${via === "call" ? "Called" : "Wrote
     to"}` — so both of its outcomes are here. */
  Called: "Calling",
  Chased: "Chasing",
  Checked: "Checking",
  Compared: "Comparing",
  Confirmed: "Confirming",
  Costed: "Costing",
  Counted: "Counting",
  Drafted: "Drafting",
  Drew: "Drawing",
  Filed: "Filing",
  Found: "Finding",
  Handed: "Handing",
  Listed: "Listing",
  Moved: "Moving",
  Named: "Naming",
  Packed: "Packing",
  Placed: "Placing",
  Priced: "Pricing",
  Pulled: "Pulling",
  Put: "Putting",
  Raised: "Raising",
  Ran: "Running",
  Ranked: "Ranking",
  Read: "Reading",
  "Re-booked": "Re-booking",
  "Re-read": "Re-reading",
  Recorded: "Recording",
  Refreshed: "Refreshing",
  Released: "Releasing",
  Scored: "Scoring",
  Sized: "Sizing",
  Split: "Splitting",
  Swept: "Sweeping",
  Told: "Telling",
  Warned: "Warning",
  Weighed: "Weighing",
  Wrote: "Writing",
};

/**
 * The label as it reads while the step is still running.
 *
 * Only the leading verb moves; the rest of the sentence is the fixture's,
 * including any figures it interpolated. Returns the label untouched where the
 * first word is not a verb this knows — an interpolated opening, say — since a
 * guess at the participle is worse than the past tense the reader already sees.
 */
export function stepDoing(label: string): string {
  const space = label.indexOf(" ");
  const first = space === -1 ? label : label.slice(0, space);
  const doing = DOING[first];
  if (!doing) return label;
  return space === -1 ? doing : doing + label.slice(space);
}
