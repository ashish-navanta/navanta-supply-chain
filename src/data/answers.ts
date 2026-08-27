/**
 * What the agent says when somebody presses a follow-up chip.
 *
 * Every run ends with two or three "worth asking next" prompts, and until now
 * they only dropped their text into the composer — where typing anything landed
 * on "I have not been taught to answer this yet". A suggestion the product
 * cannot honour is worse than no suggestion, and offering seventy-three of them
 * is seventy-three small promises broken.
 *
 * So each one has an answer, and every answer is derived. Nothing here is a
 * canned paragraph with a number typed into it: if the fixture changes, these
 * change with it, and a figure that appears both here and on a screen comes from
 * the same function in both places.
 *
 * Anything not registered keeps the old, honest fallback. That is deliberate —
 * the registry should be a list of questions the product can genuinely answer,
 * not a net that catches everything with a plausible-sounding sentence.
 */
import {
  BOOK,
  PLAYS,
  SUPPLIERS,
  ledgerPlays,
  money,
  rampToDate,
  realizedToDate,
} from "@/data/buying";
import {
  BACKHAULS,
  FLEET,
  LANES,
  LOGISTICS_BOOK,
  accruingNow,
  atRiskLoads,
  availableUnits,
  detentionNow,
  fleetUtilisation,
  formatUsdExact,
  inFlightLoads,
  laneDelta,
  laneHabitCost,
  lanesToRebalance,
  loadsOnTime,
  onWatch,
  openBackhauls,
  plural,
  unitsOnWatch,
  utilisation,
} from "@/data/logistics";
import {
  CLAIMS,
  DEALERS,
  SERVICE_BOOK,
  atRiskOrders,
  hasEtaConflict,
  inFlight,
  openClaims,
  promisesKept,
} from "@/data/service";
import {
  EXCEPTIONS,
  POSITIONS,
  cartonCost,
  excessOf,
  isLong,
  isShort,
  planningRollup,
} from "@/data/planning";
import { CATALOGUE } from "@/data/catalogue";
import {
  abcMix,
  avoidableFreightShare,
  inventoryBalance,
  measureLine,
  topSuppliers,
  transportScorecard,
} from "@/data/executive";

/** A percentage on a 0–1 ratio. */
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The answers, keyed by the exact prompt text.
 *
 * Keyed on the string rather than an id because that is what a chip carries and
 * what a reader may also type — and it keeps the prompt and its answer legible
 * side by side, so a prompt reworded without its answer is obvious in review
 * rather than silently falling through to the fallback.
 */
const ANSWERS: Record<string, () => string> = {
  /* ── Planning ─────────────────────────────────────────────────── */

  "Where is the exposure concentrated?": () => {
    const worst = [...EXCEPTIONS].sort((a, b) => b.dollarsAtRisk - a.dollarsAtRisk)[0];
    const roll = planningRollup();
    return `${money(roll.dollarsAtRisk)} across ${roll.exceptions} exceptions. The largest single one is ${worst.sku} at ${worst.branch} — ${money(worst.dollarsAtRisk)}, ${worst.severity}.`;
  },
  "Which cells are critical?": () => {
    const crit = EXCEPTIONS.filter((e) => e.severity === "critical");
    const cells = [...new Set(crit.map((e) => e.classification))].sort();
    return crit.length === 0
      ? "No cell is critical today."
      : `${crit.length} critical ${plural(crit.length, "position")}, in ${cells.join(", ")}. AZ is the cell to watch — high value, lumpy demand, so a miss is both likely and expensive.`;
  },
  "What is holding fill below target?": () => {
    const roll = planningRollup();
    const short = POSITIONS.filter(isShort).length;
    return `${pct(roll.fillRate)} fill against a ${pct(roll.targetSl)} policy target. ${short} of ${POSITIONS.length} positions sit under target — that gap is the fill rate, and it is mostly lead time rather than demand.`;
  },
  "Which centre should I fix first?": () => {
    const worst = inventoryBalance("stockout")[0];
    return `${worst.branch}. ${worst.products} positions under target, ${worst.units.toLocaleString("en-US")} units short, ${money(worst.value)} of revenue that cannot be served from stock on hand.`;
  },
  "Can we transfer rather than buy?": () => {
    const long = inventoryBalance("overstock");
    const total = long.reduce((s, b) => s + b.value, 0);
    return `Often. ${money(total)} sits above target across the network, so a short position at one centre frequently has a long one at another. A transfer moves stock; a purchase order adds it — and only one of those costs money.`;
  },
  "What is long that we should stop making?": () => {
    const worst = [...POSITIONS]
      .filter(isLong)
      .sort((a, b) => excessOf(b) * cartonCost(b.sku) - excessOf(a) * cartonCost(a.sku))[0];
    return worst
      ? `${worst.sku} at ${worst.branch} is the heaviest — ${excessOf(worst).toLocaleString("en-US")} units over target, ${money(Math.round(excessOf(worst) * cartonCost(worst.sku)))} of capital. Class ${worst.classification}, so demand is unlikely to catch up on its own.`
      : "Nothing is above target.";
  },
  "Which class is heaviest against its demand?": () => {
    const heavy = [...abcMix()].sort(
      (a, b) => b.inventoryShare - b.turnoverShare - (a.inventoryShare - a.turnoverShare),
    )[0];
    const gap = (heavy.inventoryShare - heavy.turnoverShare) * 100;
    return Math.abs(gap) < 0.5
      ? "None of them. Every class holds about as much of the stock as it sells."
      : `Class ${heavy.abc} — ${gap.toFixed(1)} points more of the stock than of the demand, across ${heavy.skus} positions.`;
  },
  "What would trimming class C release?": () => {
    const c = abcMix().find((m) => m.abc === "C");
    return c
      ? `${money(c.inventory)} sits in class C across ${c.skus} positions, and it turns over ${pct(c.turnoverShare)} of the book. Halving it releases roughly ${money(Math.round(c.inventory / 2))} — against the risk of a stockout on a slow mover nobody is watching.`
      : "No class C on this book.";
  },
  "How is A cut?": () => {
    const a = abcMix()[0];
    return `By cumulative value, not by row count. Positions are ranked dearest first and A takes everything up to 80% of turnover — ${a.skus} of ${POSITIONS.length} here, carrying ${pct(a.turnoverShare)}. B runs to 95%, C is the tail.`;
  },
  "Where is this SKU exposed?": () => {
    const worst = [...EXCEPTIONS].sort((a, b) => b.dollarsAtRisk - a.dollarsAtRisk)[0];
    return `Open a SKU and I will read its position at every centre. Across the book the sharpest exposure is ${worst.sku} at ${worst.branch}, ${money(worst.dollarsAtRisk)}.`;
  },
  "Compare colourways on a style": () => {
    const style = CATALOGUE.reduce((a, b) => (b.colourways.length > a.colourways.length ? b : a));
    return `Open a style and I will lay its colourways side by side. ${style.name} is the widest on the book at ${style.colourways.length} — the product page draws them all, and the catalogue's image search ranks them against a photograph.`;
  },
  "Which styles are slow movers?": () => {
    const slow = [...POSITIONS]
      .filter((p) => p.classification[0] === "C")
      .sort((a, b) => excessOf(b) - excessOf(a))
      .slice(0, 3);
    return slow.length
      ? `Class C is the tail — ${slow.map((p) => p.sku).join(", ")} carry the most stock against the least demand.`
      : "Nothing is moving slowly enough to flag.";
  },
  "What is driving demand here?": () => {
    const roll = planningRollup();
    return `Demand is read from the last twelve months and rated on its own variability — the XYZ half of the class. ${roll.exceptions} positions are outside policy right now, and the lumpy ones (Z) are where the forecast misses.`;
  },
  "What would the system do here?": () => {
    const roll = planningRollup();
    return `${pct(roll.autoRate)} of exceptions route themselves — high confidence and low severity go straight through. The rest wait for a planner, which is what this queue is.`;
  },
  "Can another branch cover it instead?": () => {
    const long = inventoryBalance("overstock")[0];
    return `Check the long list first. ${long.branch} holds ${long.units.toLocaleString("en-US")} units above target across ${long.products} positions — if the shortage is one of those, a transfer beats a purchase order on both cost and lead time.`;
  },
  "Rebalance from the longest node?": () => {
    const long = inventoryBalance("overstock")[0];
    return `${long.branch} is the longest — ${money(long.value)} above target. It is the first place to look, though the transfer only helps where the long position is the SKU that is short.`;
  },
  "Why was it cut from the asked figure?": () =>
    "The request is sized to reach target stock, not to fill the shelf: lead-time demand plus safety, less what is on hand and already inbound. Anything above that is capital sitting still.",
  "What happens if we do nothing?": () => {
    const roll = planningRollup();
    return `${money(roll.dollarsAtRisk)} stays exposed and ${roll.critical} critical positions run down to zero on their current cover. Nothing here recovers on its own — lead times are 35 to 56 days.`;
  },

  /* ── Buying ───────────────────────────────────────────────────── */

  "How much value have we realized?": () => {
    const ledger = ledgerPlays();
    const realized = ledger.reduce((s, p) => s + realizedToDate(p), 0);
    const committed = ledger.reduce((s, p) => s + p.recommended, 0);
    const expected = ledger.reduce((s, p) => s + rampToDate(p), 0);
    return `${money(realized)} of ${money(committed)} committed, against ${money(expected)} expected by now — ${realized >= expected ? "on or ahead of ramp" : "behind ramp"}.`;
  },
  "How much have we realized this quarter?": () => ANSWERS["How much value have we realized?"](),
  "Which plays are behind ramp?": () => {
    const behind = ledgerPlays().filter((p) => realizedToDate(p) < rampToDate(p) * 0.95);
    return behind.length === 0
      ? "None. Every committed play is landing on or ahead of its ramp."
      : `${behind.length} of ${ledgerPlays().length}: ${behind.map((p) => p.title).join("; ")}.`;
  },
  "What is still to commit?": () => {
    const open = PLAYS.filter((p) => p.stage === "surfaced" || p.stage === "qualifying");
    const worth = open.reduce((s, p) => s + p.recommended, 0);
    return `${open.length} plays worth ${money(worth)} are surfaced or in qualification. The largest is ${[...open].sort((a, b) => b.recommended - a.recommended)[0]?.title}.`;
  },
  "Where is the benchmark gap widest?": () =>
    `The sweep is measured against a ${BOOK.benchmarkLow}–${BOOK.benchmarkHigh}% band. The widest gaps are where one supplier holds most of a category — concentration is what removes the pressure on price.`,
  "Where is the spend concentrated?": () => {
    const top = topSuppliers(3);
    const share = top.reduce((s, v) => s + v.spendShare, 0);
    return `The three dearest sites hold ${pct(share)} of annual spend. ${top[0].label} alone is ${money(top[0].spend)}.`;
  },
  "Who is single-sourced?": () => {
    const single = SUPPLIERS.filter((v) => v.categoryShare >= 50);
    return single.length === 0
      ? "No supplier holds a majority of its category."
      : `${single.length} ${plural(single.length, "supplier")} hold half or more of their category: ${single.map((v) => `${v.site} (${v.categoryShare}%)`).join(", ")}.`;
  },
  "Which supplier is slipping?": () => {
    const worst = [...topSuppliers(7)].sort((a, b) => a.otif - b.otif)[0];
    return `${worst.label} — ${worst.fillRate}% filled complete against ${worst.otif}% on time in full. That gap is volume arriving complete and arriving late, which is a lead-time problem rather than a capacity one.`;
  },
  "What is the import exposure?": () => {
    const imports = topSuppliers(7).filter((v) => !v.own);
    const share = imports.reduce((s, v) => s + v.spendShare, 0);
    return `${money(imports.reduce((s, v) => s + v.spend, 0))} across ${imports.length} third-party sites — ${pct(share)} of the book, and it is not one supplier: ${[...new Set(imports.map((v) => v.country))].join(" and ")}.`;
  },
  "Is this a rationalisation candidate?": () =>
    `A category is worth rationalising when several suppliers hold small shares of it and none of them is cheap. The supplier book scores all five criteria — cost, delivery, quality, risk and terms — on the same weights, so two suppliers in a category are genuinely comparable.`,
  "How fast can we shift the volume?": () => {
    const slowest = [...SUPPLIERS].sort((a, b) => b.quotedLeadDays - a.quotedLeadDays)[0];
    return `Lead times on this book run to ${slowest.quotedLeadDays} days (${slowest.site}). A qualified second source moves inside that; an unqualified one does not move at all until it is qualified.`;
  },
  "Who signs above the cap?": () =>
    "Anything above the buyer's cap goes to the category manager, and a commitment that changes a supplier's share of a category goes above that again. The cap is on the play, not on the purchase order.",
  "Escalate to the factory?": () => {
    const worst = [...SUPPLIERS].sort((a, b) => a.otifPct - b.otifPct)[0];
    return `Worth it where the date has moved twice. ${worst.site} is the softest on the book at ${worst.otifPct}% OTIF — that is the relationship where an escalation has something to point at.`;
  },

  /* ── Service ──────────────────────────────────────────────────── */

  "Where is revenue most at risk?": () => {
    const worst = [...atRiskOrders()].sort((a, b) => b.value - a.value)[0];
    return worst
      ? `${money(SERVICE_BOOK.openValue)} is open and ${SERVICE_BOOK.atRisk} orders are at risk. The largest is ${worst.id} for ${worst.account} — ${money(worst.value)}${worst.crewBooked ? ", with a crew already booked" : ""}.`
      : "Nothing on the book is at risk today.";
  },
  "Which orders are about to slip?": () => {
    const risky = atRiskOrders();
    return risky.length === 0
      ? "No order is slipping today."
      : `${risky.length}: ${risky.map((o) => `${o.id} (${o.account})`).join(", ")}. A re-promise the account has confirmed is a different situation from one they have not.`;
  },
  "What is the claim exposure by account?": () => {
    const open = openClaims();
    const byDealer = new Map<string, number>();
    for (const c of open) {
      const amount = c.adjudicated ?? c.requested;
      byDealer.set(c.account, (byDealer.get(c.account) ?? 0) + amount);
    }
    const worst = [...byDealer].sort((a, b) => b[1] - a[1])[0];
    return `${money(SERVICE_BOOK.openClaimValue)} across ${open.length} open claims. ${worst?.[0]} carries the most at ${money(worst?.[1] ?? 0)}.`;
  },
  "What is driving the claim rate?": () => {
    const kinds = new Map<string, number>();
    for (const c of CLAIMS) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    const top = [...kinds].sort((a, b) => b[1] - a[1])[0];
    return `${CLAIMS.length} claims on the book, and ${top[1]} of them are ${top[0].replace("-", " ")}. That is a handling question rather than a product one.`;
  },
  "Which orders slipped for this account?": () => {
    const risky = atRiskOrders();
    return risky.length
      ? `Open a account and I will read their book. Across all of them, ${risky.length} orders have moved: ${risky.map((o) => o.id).join(", ")}.`
      : "Nothing has slipped.";
  },
  "Are they a growth candidate?": () => {
    const top = [...DEALERS].sort((a, b) => b.ytdRevenue - a.ytdRevenue)[0];
    return `The accounts worth growing are the ones we serve well already. ${top.name} is the largest at ${money(top.ytdRevenue)} year to date — growth on an account we are missing dates on costs more than it earns.`;
  },
  "Why do the ETA feeds disagree?": () => {
    const conflicts = inFlight().filter(hasEtaConflict).length;
    return `${conflicts} orders carry ETAs that disagree. The carrier reads its own network, the supplier reads its schedule, and Target reads the load — when they diverge the widest spread is the one worth acting on, not the newest.`;
  },
  "Which loads slip today?": () => {
    const risky = atRiskLoads();
    return risky.length
      ? `${risky.length} of ${inFlightLoads().length} in flight: ${risky.slice(0, 4).map((l) => l.id).join(", ")}${risky.length > 4 ? "…" : ""}.`
      : "Nothing is slipping today.";
  },
  "What does this cost if it lands late?": () =>
    `A late load costs the detention on the trailer, the re-delivery if the dock turns it away, and the promise on the order behind it. The first two are ${formatUsdExact(LOGISTICS_BOOK.accruingSpend)} across the book right now; the third is the expensive one.`,
  "What does a late load cost?": () => ANSWERS["What does this cost if it lands late?"](),

  /* ── Logistics ────────────────────────────────────────────────── */

  "What is the cost of habit?": () => {
    const rebalance = lanesToRebalance();
    return `${formatUsdExact(LOGISTICS_BOOK.habitCost * 12)} a year — ${formatUsdExact(LOGISTICS_BOOK.habitCost)} a month across ${plural(rebalance.length, "lane")} where the split is running the dearer option.`;
  },
  "Which lanes cost the most habit?": () => {
    const top = lanesToRebalance().slice(0, 3);
    return top.length
      ? top
          .map(
            (l) =>
              `${l.origin} → ${l.destination}: ${formatUsdExact(laneHabitCost(l) * 12)}/yr, ${l.fleetShare}% on fleet`,
          )
          .join(" · ")
      : "No lane is above the floor.";
  },
  "Which lane is running the wrong option?": () => {
    const worst = lanesToRebalance()[0];
    const delta = laneDelta(worst);
    return `${worst.origin} → ${worst.destination}. ${delta > 0 ? "Own iron" : "Bought capacity"} is ${Math.abs(delta).toFixed(2)}/mile cheaper and only ${delta > 0 ? worst.fleetShare : 100 - worst.fleetShare}% of the loads run that way — ${formatUsdExact(laneHabitCost(worst) * 12)} a year.`;
  },
  "Where is fleet cheaper?": () => {
    const cheaper = LANES.filter((l) => laneDelta(l) > 0);
    return `${cheaper.length} of ${LANES.length} lanes, all-in including the empty return. That last part is what matters — a fleet rate quoted without the empty leg is how a lane looks cheap on own iron and is not.`;
  },
  "What is the avoidable share?": () =>
    `${(avoidableFreightShare() * 100).toFixed(1)}% of the freight bill is a routing choice rather than a rate — ${formatUsdExact(LOGISTICS_BOOK.habitCost)} a month against ${formatUsdExact(LOGISTICS_BOOK.accruingSpend + LOGISTICS_BOOK.habitCost)} of recoverable cost.`,
  "Why is on-time behind?": () => {
    const ot = loadsOnTime();
    const card = transportScorecard();
    const otd = card.find((m) => m.key === "orderToDelivery");
    return `${ot.pct}% on ${ot.total} delivered loads — a thin base, and one exception moves it 25 points. Order to delivery is the steadier read at ${otd?.value} against ${otd?.plan}.`;
  },
  "What is accruing right now?": () => {
    const now = accruingNow();
    return now.length === 0
      ? "Nothing is accruing."
      : `${formatUsdExact(LOGISTICS_BOOK.accruingSpend)} across ${plural(now.length, "trailer")} past their free time. It stops when the trailer moves, not when the invoice arrives.`;
  },
  "What is accruing at the docks?": () => ANSWERS["What is accruing right now?"](),
  "How full is fleet this week?": () =>
    `${Math.round(fleetUtilisation())}% across ${plural(FLEET.length, "power unit")}, with ${availableUnits().length} idle. ${unitsOnWatch().length} are on watch for hours or service.`,
  "Which units can take work?": () => {
    const free = availableUnits();
    return free.length
      ? `${free.length}: ${free.map((u) => `${u.id} (${Math.round(utilisation(u))}% used)`).join(", ")}.`
      : "Every unit is committed.";
  },
  "Which units could cover this lane?": () => ANSWERS["Which units can take work?"](),
  "Who is close to their hours?": () => {
    const watch = unitsOnWatch();
    return watch.length
      ? watch.map((u) => `${u.id}: ${onWatch(u)}`).join(" · ")
      : "Nobody is near their limit.";
  },
  "What is due for service?": () => {
    const watch = unitsOnWatch();
    return watch.length
      ? `${watch.length} on watch — ${watch.map((u) => u.id).join(", ")}. A unit taken out of service needs its lane covered before it goes, not after.`
      : "Nothing is due.";
  },
  "Is there fleet capacity on this lane?": () =>
    `${availableUnits().length} of ${FLEET.length} units are free and the fleet is ${Math.round(fleetUtilisation())}% used. Capacity exists; whether it is cheaper than buying depends on the lane's rate pair.`,
  "Can it take a backhaul?": () => {
    const open = openBackhauls();
    return open.length
      ? `${open.length} of ${BACKHAULS.length} return legs are still inside their window, worth ${formatUsdExact(LOGISTICS_BOOK.backhaulRevenue)}. A backhaul found after dispatch is not a backhaul.`
      : "No return leg is bookable right now.";
  },
  "Any better offer on this leg?": () => ANSWERS["Can it take a backhaul?"](),
  "Which backhauls expire first?": () => {
    const soon = [...openBackhauls()].sort((a, b) => a.expiresInHours - b.expiresInHours).slice(0, 3);
    return soon.length
      ? soon.map((b) => `${b.id}: ${b.expiresInHours}h left, ${formatUsdExact(b.revenue)}`).join(" · ")
      : "Nothing is expiring.";
  },
  "What is the backhaul gap worth?": () => {
    const avg = LANES.reduce((s, l) => s + l.backhaulCoverage, 0) / LANES.length;
    return `Return legs run ${Math.round(avg)}% loaded across the book, and ${formatUsdExact(LOGISTICS_BOOK.backhaulRevenue)} is on offer right now. Every empty return is a leg already paid for.`;
  },
  "What does this do to the lane's backhaul coverage?": () => ANSWERS["What is the backhaul gap worth?"](),
  "Is this dock always slow?": () => {
    const byDealer = new Map<string, number>();
    for (const a of accruingNow()) byDealer.set(a.account, (byDealer.get(a.account) ?? 0) + detentionNow(a));
    const worst = [...byDealer].sort((a, b) => b[1] - a[1])[0];
    return worst
      ? `${worst[0]} is the dearest right now at ${formatUsdExact(worst[1])}. A chronically slow dock is a pricing conversation, not a dispatch one.`
      : "No dock is holding a trailer today.";
  },
  "Which docks are chronically slow?": () => ANSWERS["Is this dock always slow?"](),
  "What can we bill back?": () =>
    `${formatUsdExact(LOGISTICS_BOOK.accruingSpend)} of detention is accruing now. What is billable is what the contract says and what the timestamps prove — the second is why the POD exception matters.`,
  "Can we recover this from the carrier?": () =>
    "Where the POD carries an exception and the claim is filed inside its window, yes. Transit damage closes at 15 days and concealed damage at 30 — the window is the thing that decides it, not the merit.",
  "What is the recovery rate on disputes?": () =>
    `${money(SERVICE_BOOK.openClaimValue)} sits open across ${openClaims().length} claims. The ones that settle fast are the ones with photographs taken at the tailgate.`,
  "Is the driver's clock good for it?": () => {
    const watch = unitsOnWatch();
    return watch.length
      ? `Check before you commit — ${watch.length} ${plural(watch.length, "unit")} are already on watch: ${watch.map((u) => onWatch(u)).join("; ")}.`
      : "No unit is near its hours, so the clock is not the constraint.";
  },
  "Can the driver be re-sequenced?": () =>
    `Where the hours allow it. ${unitsOnWatch().length} units are on watch and ${availableUnits().length} are free — re-sequencing works when the receiving stop can take the change, which is the part dispatch cannot see from here.`,
  "Which lane needs a tractor most?": () => {
    const worst = lanesToRebalance()[0];
    return `${worst.origin} → ${worst.destination} — ${worst.loadsThisMonth} loads this month and only ${worst.fleetShare}% on own iron, against a rate that favours it by ${laneDelta(worst).toFixed(2)}/mile.`;
  },
  "Who covers its lane during service?": () =>
    `${availableUnits().length} units are free. A unit going into service needs its lane covered before it goes — the cover is the decision, the service date is the deadline.`,
  "What is this unit's empty-mile trend?": () => {
    const avg = LANES.reduce((s, l) => s + l.backhaulCoverage, 0) / LANES.length;
    return `Empty miles are the inverse of backhaul coverage, which runs ${Math.round(avg)}% across the book. Per unit, the number to watch is the share of legs that ran loaded both ways.`;
  },
  "Who else bids this lane?": () =>
    "The purchased rate on each lane is the Freight audit benchmark for bought capacity, so it is the market rather than one carrier's quote. Where own iron is dearer than that, the lane is worth tendering.",

  /* ── Cross-book ───────────────────────────────────────────────── */

  "Where is the month exposed?": () => {
    const roll = planningRollup();
    const kept = promisesKept();
    return `${money(roll.dollarsAtRisk)} of stock exposure, ${SERVICE_BOOK.atRisk} orders at risk against ${money(SERVICE_BOOK.openValue)} open, and ${kept.pct}% of promises kept on ${kept.total} delivered. Planning carries the money; service carries the promise.`;
  },
  "Which tower needs me first?": () => {
    const ot = loadsOnTime();
    const roll = planningRollup();
    return ot.pct < 90
      ? `Transport. On-time is ${ot.pct}% and every other measure on that card is inside plan — the bill came down and the promise went with it.`
      : `Planning. ${money(roll.dollarsAtRisk)} is exposed across ${roll.exceptions} positions.`;
  },
  "What can we recover this month?": () =>
    `${formatUsdExact(LOGISTICS_BOOK.accruingSpend + LOGISTICS_BOOK.habitCost)} — unsettled claims, lanes routed by habit and trailers accruing detention. Separately ${money(planningRollup().dollarsAtRisk)} of stock exposure, which is capital rather than cost.`,
  "What is the total cost-to-serve?": () => ANSWERS["What can we recover this month?"](),
  "Where is stock short, and where is it long?": () => {
    const short = inventoryBalance("stockout");
    const long = inventoryBalance("overstock");
    return `${money(short.reduce((s, b) => s + b.value, 0))} short, worst at ${short[0].branch}. ${money(long.reduce((s, b) => s + b.value, 0))} long, worst at ${long[0].branch}. A centre usually appears on both.`;
  },
  "Is the stock where the demand is?": () => ANSWERS["Which class is heaviest against its demand?"](),
  "Is freight beating plan, and at what cost?": () => {
    const card = transportScorecard();
    const ahead = card.filter((m) => m.ahead).length;
    return `${ahead} of ${card.length} measures are inside plan, and they are the cost ones. The rest are service and asset measures — the bill is coming down and the promise is going with it.`;
  },
  "Where does the month stand?": () => ANSWERS["Where is the month exposed?"](),

  /* ── The five measures on the command center ────────────────────────────
     One question per tile, answered with that tile's own figures. The seat's
     questions used to be about the page's three lower cards while the five
     numbers across the top — the ones a VP actually gets asked about — had
     nothing to press. Each of these opens with the measure against its target,
     read from `execMeasures` so the chip and the tile cannot print different
     numbers, and then hands off to the read that explains it. */
  "Where is revenue against plan?": () =>
    `${measureLine("revenue")} ${ANSWERS["Where is revenue most at risk?"]()}`,
  "Is landed cost beating plan?": () =>
    `${measureLine("cost")} ${ANSWERS["What is the avoidable share?"]()}`,
  "Is working capital inside policy?": () =>
    /* Under the policy figure is not a win: the target is what the policy asks
       for, so short of it is stock the plan wanted and has not got. */
    `${measureLine("workingCapital")} ${ANSWERS["Where is stock short, and where is it long?"]()}`,
  "Where is forecast accuracy weakest?": () =>
    `${measureLine("forecastAccuracy")} ${ANSWERS["What is holding fill below target?"]()}`,
  "What is holding inventory turns back?": () =>
    `${measureLine("inventoryTurns")} ${ANSWERS["Which class is heaviest against its demand?"]()}`,
  "Where did the savings land?": () => ANSWERS["How much value have we realized?"](),
  "What is at risk on the order book?": () => ANSWERS["Where is revenue most at risk?"](),
  "What can we recover on freight?": () => ANSWERS["What is the avoidable share?"](),
};

/**
 * The answer to a follow-up, or null where there is not one.
 *
 * Null is the honest outcome and the caller keeps its existing "I have not been
 * taught this" line for it. Matching is exact first, then case-insensitive, so a
 * reader who types the question rather than pressing the chip still lands on it.
 */
export function answerFor(question: string): string | null {
  const exact = ANSWERS[question];
  if (exact) return exact();
  const needle = question.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [key, fn] of Object.entries(ANSWERS)) {
    if (key.toLowerCase() === needle) return fn();
  }
  return null;
}

/** Every question the agent can answer, for tests and for a coverage check. */
export const ANSWERABLE = Object.keys(ANSWERS);
