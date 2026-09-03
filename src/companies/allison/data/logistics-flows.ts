/**
 * Tova's runs on the logistics book screens.
 *
 * The queue already gives a load in trouble a task. These are the moves on
 * the four book screens that carried none: the load book, the fleet, the
 * lane economics, and the accessorial spend. The lane board's "Book" button
 * was wired to nothing at all — it books a backhaul now.
 */
import type { AgentTask, FlowArtifact } from "./agent-actions";
import type { Accessorial, BackhaulOffer, Lane, Load, PowerUnit } from "./logistics";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`;
const rate = (n: number) => `$${n.toFixed(2)}`;

/* ── Loads ────────────────────────────────────────────────────────────── */

/**
 * A load's move follows its health: a red load gets re-booked, an amber one
 * gets its appointment moved, a clean one gets its window confirmed.
 */
export function loadTaskFor(l: Load, agent: string): AgentTask {
  /* The health values this app actually uses — see LoadHealth. "late" and
     "at-risk" are not among them, so this was always false and every load got
     the calm branch. */
  const bad =
    l.health === "eta-conflict" || l.health === "window-risk" || l.health === "damaged";
  const label = bad ? "Re-book the load" : l.appointment ? "Confirm the window" : "Book the appointment";

  /* The ETA feeds are the whole argument on a load — they disagree, and the
     reconciliation is what the run is actually for. */
  const spread = l.etas.length > 1;

  const steps = [
    {
      label: "Read the load",
      text:
        `${l.id} · ${l.lane} · ${l.account}. ${l.miles} miles on ${l.carrier}` +
        `${l.unitId ? ` (unit ${l.unitId})` : ""}, currently ${l.stage}.`,
      source: `Load book · ${l.id}`,
    },
    {
      label: spread ? "Reconciled the ETA feeds" : "Read the ETA",
      text: spread
        ? `${l.etas.length} feeds reporting on this load and they do not agree. Taking the one with the most recent ping and the highest confidence as the number to plan against.`
        : `One feed reporting, no conflict to resolve.`,
      source: "Telematics · carrier EDI",
    },
    {
      label: bad ? "Drafted the re-book" : "Drafted the confirmation",
      text: bad
        ? `${l.note}`
        : `A note to the dock at ${l.destination} holding the appointment as booked.`,
      source: `${agent} · draft`,
    },
  ];

  const artifact: FlowArtifact = {
    kind: "ranked",
    title: "ETA feeds · what each says",
    columns: ["Source", "Says", "Confidence"],
    rows: l.etas.slice(0, 4).map((e, i) => ({
      cells: [
        (e as { source?: string }).source ?? `Feed ${i + 1}`,
        String((e as { eta?: string }).eta ?? "—"),
        `${Math.round(((e as { confidence?: number }).confidence ?? 0.8) * 100)}%`,
      ],
      leader: i === 0,
    })),
    footnote: "The top row is the feed being planned against.",
  };

  return {
    id: `${l.id}-load`,
    label,
    ask: `${label} on ${l.id}`,
    intro: `On it. ${l.id} down the ${l.lane} lane.`,
    icon: bad ? "flag" : "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${l.id} — ${label.toLowerCase()}`,
      lines: [
        bad
          ? `The load is outside its window and the account has not been told. Re-booking it is the move that stops a service failure downstream.`
          : `The window holds. The dock has it in writing and nothing else needs pressing.`,
      ],
      tiles: [
        { label: "Miles", value: String(l.miles) },
        { label: "Stage", value: String(l.stage) },
        { label: "Health", value: String(l.health), tone: bad ? "behind" : "good" },
      ],
      artifact,
      prompts: [
        "What does this cost if it lands late?",
        "Is there fleet capacity on this lane?",
        `Which other loads are on ${l.carrier} today?`,
      ],
    },
  };
}

/* ── Fleet ────────────────────────────────────────────────────────────── */

/** A unit's move: put it under a load, or book the service it is due. */
export function unitTaskFor(u: PowerUnit, agent: string): AgentTask {
  const due = (u.maintenance as { dueInMiles?: number }).dueInMiles;
  const needsService = typeof due === "number" && due < 2000;
  const free = u.status === "available" || !u.loadId;
  const label = needsService ? "Book the service" : free ? "Put it under a load" : "Read the run";

  const steps = [
    {
      label: "Read the unit",
      text:
        `${u.id} · ${u.tractor}, ${u.driver} out of ${u.domicile} (${u.driverYears} years CDL). ` +
        `Currently ${u.status}${u.loadId ? ` under ${u.loadId}` : ""}.`,
      source: `Fleet master · ${u.id}`,
    },
    {
      label: "Read the hours and the shop",
      text:
        `${(u.hos as { drivingLeft?: number }).drivingLeft ?? "—"} driving hours left on the clock, ` +
        `${(u.hos as { cycleLeft?: number }).cycleLeft ?? "—"} on the cycle.` +
        (needsService ? ` Service due in ${due} miles — that is inside a single long run.` : " Service is not near."),
      source: "ELD · maintenance schedule",
    },
    {
      label: needsService ? "Drafted the shop booking" : free ? "Matched it to open work" : "Read the run",
      text: needsService
        ? `A shop slot at ${u.domicile} and a cover plan for the lane it would otherwise run.`
        : free
        ? `${u.loadedMiles} loaded against ${u.emptyMiles} empty this month. The best use of this unit is the lane with the worst backhaul coverage.`
        : `${u.note}`,
      source: `${agent} · dispatch`,
    },
  ];

  return {
    id: `${u.id}-unit`,
    label,
    ask: `${label} on ${u.id}`,
    intro: `On it. Unit ${u.id}, ${u.driver}.`,
    icon: needsService ? "flag" : "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${u.id} — ${label.toLowerCase()}`,
      lines: [
        needsService
          ? `Running it past the interval is how a scheduled service becomes a roadside one. The slot and the cover are drafted together.`
          : free
          ? `The unit is free and the hours are there. Putting it under a load is the difference between a loaded mile and an empty one.`
          : `The unit is working. Nothing needs a move.`,
      ],
      tiles: [
        { label: "Loaded miles", value: String(u.loadedMiles) },
        { label: "Empty miles", value: String(u.emptyMiles), tone: u.emptyMiles > u.loadedMiles * 0.3 ? "behind" : "good" },
        { label: "Status", value: String(u.status) },
      ],
      prompts: [
        "Which lane needs a tractor most?",
        "What is this unit's empty-mile trend?",
        needsService ? "Who covers its lane during service?" : "Can it take a backhaul?",
      ],
    },
  };
}

/* ── Lanes ────────────────────────────────────────────────────────────── */

/**
 * The lane move is the one the economics already argue for: where fleet is
 * cheaper than bought, move volume onto fleet; where it is dearer, re-tender.
 */
export function laneTaskFor(l: Lane, agent: string): AgentTask {
  const fleetCheaper = l.fleetCostPerMile < l.purchasedRatePerMile;
  const gap = Math.abs(l.fleetCostPerMile - l.purchasedRatePerMile);
  const annualMiles = l.miles * l.loadsThisMonth * 12;
  const prize = Math.round(gap * annualMiles);
  const label = fleetCheaper ? "Shift onto fleet" : "Re-tender the lane";

  const steps = [
    {
      label: "Read the lane",
      text:
        `${l.origin} → ${l.destination} · ${l.miles} miles. ${l.loadsThisMonth} loads and ` +
        `${l.palletsThisMonth} units this month, ${l.fleetShare}% of it on our own iron.`,
      source: `Lane book · ${l.id}`,
    },
    {
      label: "Priced fleet against bought",
      text:
        `Fleet all-in at ${rate(l.fleetCostPerMile)} a mile including the empty return, against a ` +
        `${rate(l.purchasedRatePerMile)} benchmark for bought capacity. ` +
        (fleetCheaper
          ? `We are cheaper by ${rate(gap)} and still running ${100 - l.fleetShare}% bought.`
          : `Bought is cheaper by ${rate(gap)} and we are still running ${l.fleetShare}% on fleet.`),
      source: "Freight audit benchmark · fleet cost model",
    },
    {
      label: "Sized the cost of habit",
      text: `Carried across ${annualMiles.toLocaleString()} annual miles, running the wrong one costs about ${usd(prize)} a year. Backhaul coverage is ${l.backhaulCoverage}%.`,
      source: `${agent} · lane model`,
    },
  ];

  return {
    id: `${l.id}-lane`,
    label,
    ask: `${label} on ${l.origin} → ${l.destination}`,
    intro: `On it. ${l.origin} → ${l.destination}.`,
    icon: "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${l.id} — worth about ${usd(prize)} a year`,
      lines: [
        fleetCheaper
          ? `Fleet is the cheaper run on this lane and we are still buying most of it. Moving the volume is the whole prize.`
          : `Bought capacity beats our own cost here. Re-tendering is cheaper than running more of it on fleet.`,
      ],
      tiles: [
        { label: "Fleet $/mi", value: rate(l.fleetCostPerMile), tone: fleetCheaper ? "good" : "behind" },
        { label: "Bought $/mi", value: rate(l.purchasedRatePerMile), tone: fleetCheaper ? "behind" : "good" },
        { label: "Cost of habit", value: `${usd(prize)}/yr`, tone: "behind" },
      ],
      artifact: {
        kind: "compare",
        title: `${l.origin} → ${l.destination} · per mile`,
        aLabel: "Bought",
        bLabel: "Fleet",
        rows: [
          {
            label: "Cost per mile, all-in",
            a: rate(l.purchasedRatePerMile),
            b: rate(l.fleetCostPerMile),
            delta: `${fleetCheaper ? "−" : "+"}${rate(gap)}`,
            tone: fleetCheaper ? "good" : "behind",
          },
          { label: "Ran on fleet", a: `${100 - l.fleetShare}%`, b: `${l.fleetShare}%` },
          { label: "Backhaul covered", a: "—", b: `${l.backhaulCoverage}%`, tone: l.backhaulCoverage >= 60 ? "good" : "behind" },
        ],
      },
      prompts: [
        "Which units could cover this lane?",
        "What is the backhaul gap worth?",
        fleetCheaper ? "How fast can we shift the volume?" : "Who else bids this lane?",
      ],
    },
  };
}

/** The lane board's Book button — it did nothing at all before this. */
export function backhaulTaskFor(b: BackhaulOffer, agent: string): AgentTask {
  const steps = [
    {
      label: "Read the offer",
      text:
        `${b.shipper} · ${b.pickup} → ${b.deliver}. ${usd(b.revenue)} for ${b.milesOutOfRoute} miles out of route, ` +
        `and the window closes in ${b.expiresInHours} hours.`,
      source: `Backhaul board · ${b.id}`,
    },
    {
      label: "Checked it against the empty return",
      text: b.unitId
        ? `Unit ${b.unitId} runs this leg empty today. Taking the load turns an empty return into ${usd(b.revenue)} against ${b.milesOutOfRoute} extra miles.`
        : `No unit is committed yet — the offer holds for any tractor running the return leg.`,
      source: "Fleet · empty legs",
    },
    {
      label: "Drafted the booking",
      text: `Rate confirmation to ${b.shipper} with the pickup window and our unit's arrival, ready to send.`,
      source: `${agent} · booking`,
    },
  ];

  return {
    id: `${b.id}-backhaul`,
    label: "Book space",
    ask: `Book the ${b.shipper} backhaul`,
    intro: `On it. ${b.shipper}, ${b.pickup} → ${b.deliver}.`,
    icon: "send",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${b.shipper} — booking drafted`,
      lines: [
        `${usd(b.revenue)} against ${b.milesOutOfRoute} miles out of route. The window closes in ${b.expiresInHours} hours, so this is a today decision.`,
      ],
      tiles: [
        { label: "Revenue", value: usd(b.revenue), tone: "good" },
        { label: "Out of route", value: `${b.milesOutOfRoute} mi` },
        { label: "Window", value: `${b.expiresInHours}h`, tone: b.expiresInHours < 12 ? "behind" : "quiet" },
      ],
      artifact: {
        kind: "doc",
        kicker: "DRAFT · rate confirmation",
        title: `${b.shipper} · ${b.pickup} → ${b.deliver}`,
        fields: [
          { label: "Revenue", value: usd(b.revenue) },
          { label: "Out of route", value: `${b.milesOutOfRoute} miles` },
          ...(b.unitId ? [{ label: "Unit", value: b.unitId }] : []),
        ],
        body: [
          `Confirming Fossil will take the ${b.pickup} → ${b.deliver} movement at ${usd(b.revenue)}.`,
          `Our tractor is already returning this direction, so the load costs ${b.milesOutOfRoute} miles out of route and nothing in deadhead.`,
        ],
      },
      prompts: [
        "What does this do to the lane's backhaul coverage?",
        "Is the driver's clock good for it?",
        "Any better offer on this leg?",
      ],
    },
  };
}

/* ── Spend ────────────────────────────────────────────────────────────── */

/** Detention accruing is a clock you can still stop; booked is a bill you dispute. */
export function accessorialTaskFor(a: Accessorial, agent: string): AgentTask {
  const accruing = a.status === "accruing";
  const label = accruing ? "Stop the clock" : a.status === "booked" ? "Dispute the charge" : "Read the dispute";
  const over = (a.elapsedHours ?? 0) - (a.freeHours ?? 0);

  const steps = [
    {
      label: "Read the charge",
      text:
        `${a.id} · ${a.kind} on ${a.loadId} at ${a.account}. ${usd(a.amount)} ${accruing ? "and still running" : a.status}.`,
      source: `Accessorial ledger · ${a.id}`,
    },
    {
      label: "Read the clock",
      text:
        a.freeHours !== undefined
          ? `${a.freeHours} free hours allowed, ${a.elapsedHours} elapsed — ${over > 0 ? `${over} hours over` : "still inside the window"}` +
            (a.ratePerHour ? ` at ${usd(a.ratePerHour)} an hour.` : ".")
          : `No free-time clock on this charge kind.`,
      source: "Dock feed · contract terms",
    },
    {
      label: accruing ? "Drafted the intervention" : "Built the dispute",
      text: accruing
        ? `A call to the ${a.account} dock and a re-sequence for the driver — the two things that stop the meter today.`
        : `${a.note}`,
      source: `${agent} · ${accruing ? "intervention" : "dispute pack"}`,
    },
  ];

  return {
    id: `${a.id}-acc`,
    label,
    ask: `${label} on ${a.id}`,
    intro: `On it. ${a.kind} on ${a.loadId}.`,
    icon: accruing ? "call" : "flag",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${a.id} — ${label.toLowerCase()}`,
      lines: [
        accruing
          ? `The meter is running at ${a.ratePerHour ? usd(a.ratePerHour) : "the contract rate"} an hour. Every hour this waits is money that cannot be disputed back later.`
          : `The charge is booked. The dispute pack is what recovers it, and it is stronger the earlier it goes.`,
      ],
      tiles: [
        { label: "Charge", value: usd(a.amount), tone: "behind" },
        { label: "Free hours", value: String(a.freeHours ?? "—") },
        { label: "Elapsed", value: String(a.elapsedHours ?? "—"), tone: over > 0 ? "behind" : "good" },
      ],
      prompts: [
        `What does ${a.account} cost us in accessorials?`,
        "Is this dock always slow?",
        accruing ? "Can the driver be re-sequenced?" : "What is the recovery rate on disputes?",
      ],
    },
  };
}
