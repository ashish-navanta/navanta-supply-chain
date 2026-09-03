/* ═══════════════════════════════════════════════════════════════
 *  Allison Transmission — MRO Supply Chain Personas
 *
 *  The four seats the workshop follows through PO-4471. Content is
 *  grounded in Allison's real indirect operating reality: $109.3M of
 *  MRO spend across 1,824 vendors, Industrial Supplies alone $34.1M
 *  over 1,093 vendors, three plant stores (Indy Central Stores,
 *  Szentgotthárd, Chennai) feeding cribs at Plant 3, Plant 12,
 *  Plant 14 and Speedway, a Fastenal onsite crib inside Plant 12,
 *  OEM sole-source spares on six-week factory leads — and the system
 *  estate (SAP ECC, Maximo, Ariba, the onsite vending feed, carrier
 *  portals, freight audit) that each seat has to read across today.
 * ═══════════════════════════════════════════════════════════════ */

export type PersonaAudience = "internal" | "external";

export interface PersonaMeta {
  age: number;
  location: string;
  role: string;
  device: string;
  experience: string;
}

export interface Persona {
  /** URL slug — /personas/[slug] */
  slug: string;
  /** Badge text in the card's header band. */
  audience: PersonaAudience;
  name: string;
  /** Sub-line under the name, inside the portrait frame. */
  title: string;
  /** Monogram rendered in the portrait tile. */
  initials: string;
  /** The workshop seat this persona occupies. */
  seat: string;
  /** Phases of PO-4471 this seat owns — see the workshop flow. */
  ownsPhases: string[];
  meta: PersonaMeta;
  about: string;
  quote: string;
  goals: string[];
  motivations: string[];
  frustrations: string[];
  painPoints: string[];
  /** Systems this seat reads across today. */
  systems: string[];
}

export const personas: Persona[] = [
  /* ─── 1 · Commit → Make/Buy ─────────────────────────────────── */
  {
    slug: "buyer-commodity-manager",
    audience: "internal",
    name: "Marcus Whitfield",
    title: "Commodity Manager · Castings, Gears & Driveline Components",
    initials: "MW",
    seat: "Commit → Make/Buy",
    ownsPhases: ["01", "02", "03"],
    meta: {
      age: 41,
      location: "Indianapolis, IN",
      role: "Buyer / Commodity Manager",
      device: "Desktop + Mobile",
      experience: "14 yrs sourcing & category",
    },
    about:
      "Marcus owns the direct-material book that feeds the build — aluminium cases out of Lewisburg, gear blanks and forgings, torque converters, and the TCM and sensor set that goes straight to the line. Roughly $851M of components a year, and about three quarters of it concentrated in forty suppliers, many of them the only qualified source for what they ship. They spend most of the week chasing acknowledgements and revised dates by email rather than working the consolidation plays they were hired to run.",
    quote:
      "A sole-sourced converter slipping two weeks is not a purchasing problem, it is a build slot. I find out when the line calls me, not when the supplier knows.",
    goals: [
      "Get a revised ship date before the build slot is at risk, not after the line calls",
      "Qualify a second source on the converter and the control module so one supplier is not the schedule",
      "Know what a late semi-finished casting costs in machining capacity, in dollars, the same day",
      "Spend the week on the addressable book rather than chasing PO acknowledgements",
    ],
    motivations: [
      "Protect the OEM build slots that carry the quarter's revenue and the take-or-pay commitments",
      "Be the one who tells planning about a slip — not the one who hears it from them",
      "Make premium-freight calls on current numbers, not last quarter's rate card",
      "Build supplier scorecards that actually change who wins the next award",
    ],
    frustrations: [
      "A PO can sit unacknowledged for days with nothing flagging the silence",
      "Supplier portals, PO promise dates and the plant's own schedule all disagree",
      "An expedite quote takes a day to assemble across freight, premium and supplier lead",
      "Supplier performance gets reconstructed by hand at review time, from memory",
    ],
    painPoints: [
      "Learns about the slip from the missed build date, not the signal three weeks earlier",
      "No costed view of what an expedite is worth against the units it protects",
      "Take-or-pay shortfalls land as a finance surprise, after the volume is already missed",
      "Switching a source means an engineering change, a requalification and a PPAP under time pressure",
    ],
    systems: ["SAP ECC", "Ariba", "Supplier portals", "OEM EDI releases", "Freight audit"],
  },

  /* ─── 2 · Position → Promise ────────────────────────────────── */
  {
    slug: "deployment-planner",
    audience: "internal",
    name: "Priya Raghunathan",
    title: "Stores & Reliability Planner · Indy Central Stores",
    initials: "PR",
    seat: "Position → Promise",
    ownsPhases: ["03", "04"],
    meta: {
      age: 34,
      location: "Indianapolis, IN",
      role: "Inventory / Stores Planner",
      device: "Dual-monitor Desktop",
      experience: "9 yrs supply planning",
    },
    about:
      "Priya positions MRO inventory across Indy Central Stores, the plant cribs and the Fastenal onsite location — deciding what sits where, what transfers, and what gets re-promised to a maintenance team when a distributor goes short. They are accountable for roughly 43,000 stocked materials against the PM and shutdown calendar in Maximo, and can realistically reach a few hundred min/max positions in a week.",
    quote:
      "I can only work the few hundred crib positions I can reach. The other forty thousand are hoping I picked the right ones before the summer shutdown.",
    goals: [
      "Know which cribs go short, and by when, the moment a distributor lead time slips",
      "Cover a shortfall by transfer from another store before it becomes an expedite or a missed PM",
      "Hold manufacturer and lot integrity when substituting across cribs — a deviation is not a swap",
      "Set min/max once and have it execute, instead of touching each position by hand",
    ],
    motivations: [
      "Fill rate that holds without parking working capital in every crib on the campus",
      "Trust that a min she sets is genuinely being applied overnight in SAP",
      "Move from firefighting the reachable few to governing the whole stores network",
      "Be able to explain a stockout to a maintenance supervisor with a reason, not an apology",
    ],
    frustrations: [
      "SAP MRP publishes the plan of record; the exceptions live in a workbook rebuilt weekly",
      "Coverage risk arrives as a number, without the work orders and PM jobs behind it",
      "Substitution options hide manufacturer and lot until each one is opened",
      "Every “what if we transfer from Szentgotthárd instead” question means another manual pull",
    ],
    painPoints: [
      "No single view joining a distributor slip to crib coverage and the open work-order book",
      "Options aren't costed — transfer vs expedite vs re-promise is a call made blind",
      "Aging and obsolete spares surface only once the quarter has closed",
      "Overrides never feed back, so the same bad min/max recommendation returns next week",
    ],
    systems: ["SAP ECC · MRP", "Maximo", "Fastenal FAST 360", "Databricks"],
  },

  /* ─── 3 · Order → Fulfilled ─────────────────────────────────── */
  {
    slug: "customer-service-rep",
    audience: "internal",
    name: "Daniela Ortiz",
    title: "Plant Service Desk · Maintenance Teams",
    initials: "DO",
    seat: "Order → Fulfilled",
    ownsPhases: ["03", "07", "08"],
    meta: {
      age: 29,
      location: "Indianapolis, IN",
      role: "Plant Service Desk Representative",
      device: "Desktop + Headset",
      experience: "6 yrs stores & service desk",
    },
    about:
      "Daniela handles the plant maintenance teams — requisition status, delays, substitutions and damage claims for Plant 3, Plant 12, Plant 14 and Speedway. They work SAP ECC as the system of record with a Maximo tab and a carrier portal open alongside, and spend most of every call researching what is true before they can say anything useful.",
    quote:
      "By the time a maintenance supervisor calls me, they already know something's wrong. I'm three systems behind the conversation.",
    goals: [
      "Tell the team about a delay before the team calls to ask",
      "Answer “where is my part” without opening three systems",
      "Resolve a damage claim from evidence already held, in a single pass",
      "Offer a substitute manufacturer with the contract price and the deviation already held",
    ],
    motivations: [
      "Be the person supervisors trust with a bad PM date, not just a good one",
      "Stop being a research desk and start advising on the tradeoff",
      "Close claims fairly and fast enough that the crib keeps ordering through stores",
      "Protect the relationships that never show up on an uptime report",
    ],
    frustrations: [
      "Requisition status, delivery status and the carrier's status rarely agree",
      "Every proactive email is written from scratch — so proactive rarely happens",
      "Claims are rebuilt from argument: photos in email, receipt in SAP, spec in Maximo",
      "Nothing flags which exposed requisition has an outage crew booked for Monday morning",
    ],
    painPoints: [
      "Learns about the delay from the team, on the team's terms",
      "No ranking of exposed requisitions — downtime, commitment and PM date live in her head",
      "A claim can sit for weeks waiting on root cause from the distributor",
      "“Delivered complete” hides damage nobody has looked at yet",
    ],
    systems: ["SAP ECC", "Maximo", "Receiving dock log", "Email / Phone"],
  },

  /* ─── 4 · Transport → Delivered ─────────────────────────────── */
  {
    slug: "logistics-coordinator",
    audience: "internal",
    name: "Terrence Boyd",
    title: "Receiving & Crib Delivery · Indy Central Stores",
    initials: "TB",
    seat: "Transport → Delivered",
    ownsPhases: ["04", "05", "06"],
    meta: {
      age: 46,
      location: "Indianapolis, IN",
      role: "Receiving / Crib Delivery Coordinator",
      device: "Desktop + Mobile + Dock Tablet",
      experience: "18 yrs receiving & dispatch",
    },
    about:
      "Terrence coordinates inbound receiving at Indy Central Stores and the stores trucks that run parts out to the plant cribs, against a campus taking roughly 2,700 line receipts a day from distributor branch trucks, OEM freight and the Kirby Risk Lafayette run. They arbitrate between eight systems that each hold one piece of the truth, and none of which agree on an ETA.",
    quote:
      "The carrier portal says delivered. SAP says received. Two drums are dented and leaking under the wrap and every system is perfectly happy.",
    goals: [
      "One ETA per delivery, with a confidence — instead of three that disagree",
      "Decide stores truck versus hot-shot courier on landed cost rather than habit",
      "Catch damage at the dock before the crib does, not after the invoice goes out",
      "Cut empty return legs by seeing co-load options inside the booking window",
    ],
    motivations: [
      "Keep the promise the service desk already made to the maintenance team",
      "Run the stores trucks like an asset, not a fallback",
      "Be the first to know when a delivery is going wrong",
      "Feed true cost to serve back to the people setting the stocking policy",
    ],
    frustrations: [
      "The carrier portal answers at shipment level, telematics at vehicle, SAP at the receipt",
      "“Where is my part” calls eat the day that should go to genuine disruption",
      "Recovery options are whatever hot-shot can be reached by phone in ten minutes",
      "Two legs, two tracking systems, and a blind window between the branch and the dock",
    ],
    painPoints: [
      "Every system reads “complete” while the pallet sits damaged under the wrap",
      "Truck capacity, driver hours and maintenance windows live in three places",
      "Courier rates get looked up after the decision, not before it",
      "Detention and accessorials surface at freight audit, weeks after the delivery",
    ],
    systems: [
      "SAP ECC · goods receipt",
      "Stores dispatch board",
      "Receiving dock log",
      "Carrier portals",
      "Telematics",
      "Freight audit",
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return personas.find((p) => p.slug === slug);
}
