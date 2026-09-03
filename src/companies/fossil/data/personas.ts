/* ═══════════════════════════════════════════════════════════════
 *  Fossil Group — Supply Chain Personas
 *
 *  The four seats the workshop follows through PO-4471. Content is
 *  grounded in Fossil's real operating reality: ~43,000 SKUs against
 *  3,800 styles, 49 distribution nodes, ~2,700 deliveries a day, a
 *  private fleet, a Vietnam-heavy resilient import program alongside
 *  domestic SPC/LVP out of Dallas DC — and the system estate
 *  (SAP APO, SAP ECC, SAP WM, DC appointment book, Carrier milestone, Freight audit)
 *  that each seat has to read across today.
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
    title: "Commodity Manager · Resilient & Hard Surface",
    initials: "MW",
    seat: "Commit → Make/Buy",
    ownsPhases: ["01", "02", "03"],
    meta: {
      age: 41,
      location: "Dallas, TX",
      role: "Buyer / Commodity Manager",
      device: "Desktop + Mobile",
      experience: "14 yrs sourcing & category",
    },
    about:
      "Marcus owns the resilient and hard-surface book — LVT, SPC and laminate — split between domestic output from Dallas DC and a Vietnam-heavy import program. They carry roughly 180 supplier relationships and spend most of the week chasing acknowledgements and revised dates by email, rather than working the commercial terms they were hired for.",
    quote:
      "I find out a container slipped when the promise date passes — three weeks after the plant knew. By then I'm not negotiating, I'm apologising.",
    goals: [
      "Get a revised ship date from the plant before the promise date passes, not after",
      "Keep the Vietnam-to-Dallas DC sourcing mix balanced as tariff lines move",
      "Qualify a second factory per SKU family so one rejected batch isn't a stockout",
      "Spend the week on commercial negotiation, not chasing PO acknowledgements",
    ],
    motivations: [
      "Protect the committed install dates on accounts that carry the quarter",
      "Be the one who tells planning about a slip — not the one who hears it from them",
      "Make landed-cost calls on current numbers, not last quarter's rate card",
      "Build supplier scorecards that actually change who wins the next award",
    ],
    frustrations: [
      "A PO can sit unacknowledged for days with nothing flagging the silence",
      "Forwarder signals, PO promise dates and the plant's own email all disagree",
      "An expedite quote takes a day to assemble across freight, duty and production",
      "Supplier performance gets reconstructed by hand at review time, from memory",
    ],
    painPoints: [
      "Learns about the slip from the missed date, not the signal three weeks earlier",
      "No costed view of what an expedite is worth against the orders it protects",
      "Tariff reclassification lands as a finance surprise, after the container sails",
      "Switching mills means rebuilding lead times, MOQs and specs under pressure",
    ],
    systems: ["SAP ECC", "Ariba", "Forwarder feed", "DC appointment book", "Freight audit"],
  },

  /* ─── 2 · Position → Promise ────────────────────────────────── */
  {
    slug: "deployment-planner",
    audience: "internal",
    name: "Priya Raghunathan",
    title: "Deployment Planner · Soft Surface Network",
    initials: "PR",
    seat: "Position → Promise",
    ownsPhases: ["03", "04"],
    meta: {
      age: 34,
      location: "Dallas, TX",
      role: "Inventory / Deployment Planner",
      device: "Dual-monitor Desktop",
      experience: "9 yrs supply planning",
    },
    about:
      "Priya positions soft-surface inventory across 49 distribution nodes — deciding what sits where, what transfers, and what gets re-promised when inbound goes short. They are accountable for roughly 43,000 SKUs against 3,800 styles, and can realistically reach a few hundred positions in a week.",
    quote:
      "I can only work the few hundred positions I can reach. The other forty thousand are hoping I picked the right ones.",
    goals: [
      "Know which nodes go short, and by when, the moment inbound slips",
      "Cover a shortfall by transfer before it becomes an expedite or a missed promise",
      "Hold finish and batch integrity when substituting across nodes",
      "Set policy once and have it execute, instead of touching each position by hand",
    ],
    motivations: [
      "Fill rate that holds without parking working capital in all 49 nodes",
      "Trust that a threshold she sets is genuinely being applied overnight",
      "Move from firefighting the reachable few to governing the whole network",
      "Be able to explain a stockout with a reason, not an apology",
    ],
    frustrations: [
      "SAP APO publishes the plan of record; the exceptions live in a workbook rebuilt weekly",
      "Coverage risk arrives as a number, without the orders and accounts behind it",
      "Substitution options hide finish and batch until each one is opened",
      "Every “what if we transfer instead” question means another manual pull",
    ],
    painPoints: [
      "No single view joining an inbound slip to node coverage and the open order book",
      "Options aren't costed — transfer vs expedite vs re-promise is a call made blind",
      "Aging and excess surface only once the quarter has closed",
      "Overrides never feed back, so the same bad recommendation returns next week",
    ],
    systems: ["SAP APO", "SAP ECC", "SAP WM", "Databricks"],
  },

  /* ─── 3 · Order → Fulfilled ─────────────────────────────────── */
  {
    slug: "customer-service-rep",
    audience: "internal",
    name: "Daniela Ortiz",
    title: "Customer Service Rep · Residential Account Accounts",
    initials: "DO",
    seat: "Order → Fulfilled",
    ownsPhases: ["03", "07", "08"],
    meta: {
      age: 29,
      location: "Richardson, TX",
      role: "Customer Service Representative",
      device: "Desktop + Headset",
      experience: "6 yrs customer service",
    },
    about:
      "Daniela handles residential account accounts — order status, delays, substitutions and claims. They work SAP ECC as the system of record with a WMS tab and a carrier site open alongside, and spend most of every call researching what is true before they can say anything useful.",
    quote:
      "By the time a account calls me, they already know something's wrong. I'm three systems behind the conversation.",
    goals: [
      "Tell the account about a delay before the account calls to ask",
      "Answer “where is my order” without opening three systems",
      "Resolve a damage claim from evidence already held, in a single pass",
      "Offer a substitution with the contract price already held",
    ],
    motivations: [
      "Be the person accounts trust with a bad floor-set date, not just a good one",
      "Stop being a research desk and start advising on the tradeoff",
      "Close claims fairly and fast enough that the account reorders",
      "Protect the relationships that never show up on a revenue report",
    ],
    frustrations: [
      "Order status, delivery status and the carrier's status rarely agree",
      "Every proactive email is written from scratch — so proactive rarely happens",
      "Claims are rebuilt from argument: photos in email, receipt in WMS, spec elsewhere",
      "Nothing flags which exposed order has a crew booked for Monday morning",
    ],
    painPoints: [
      "Learns about the delay from the account, on the account's terms",
      "No ranking of exposed orders — revenue, commitment and floor-set date live in her head",
      "A claim can sit for weeks waiting on root cause from the plant",
      "“Delivered complete” hides damage nobody has looked at yet",
    ],
    systems: ["SAP ECC", "SAP WM", "DC appointment book", "Email / Phone"],
  },

  /* ─── 4 · Transport → Delivered ─────────────────────────────── */
  {
    slug: "logistics-coordinator",
    audience: "internal",
    name: "Terrence Boyd",
    title: "Logistics Coordinator · Private Fleet & Outbound",
    initials: "TB",
    seat: "Transport → Delivered",
    ownsPhases: ["04", "05", "06"],
    meta: {
      age: 46,
      location: "Dallas, TX",
      role: "Logistics Coordinator / Dispatch",
      device: "Desktop + Mobile + Yard Tablet",
      experience: "18 yrs transport & dispatch",
    },
    about:
      "Terrence coordinates outbound loads across the private fleet and purchased carriers, against a network running roughly 2,700 deliveries a day. They arbitrate between eight systems that each hold one piece of the truth, and none of which agree on an ETA.",
    quote:
      "DC appointment book says delivered. SAP WM says delivered. Ten units are crushed under the wrap and every system is perfectly happy.",
    goals: [
      "One ETA per load, with a confidence — instead of three that disagree",
      "Decide fleet versus purchased on landed cost rather than habit",
      "Catch damage before the customer does, not after the invoice goes out",
      "Cut empty miles by seeing backhaul options inside the booking window",
    ],
    motivations: [
      "Keep the promise the service rep already made to the account",
      "Run the private fleet like an asset, not a fallback",
      "Be the first to know when a delivery is going wrong",
      "Feed true cost to serve back to the people setting prices",
    ],
    frustrations: [
      "DC appointment book answers at shipment level, Carrier milestone at trailer, telematics at tractor",
      "“Where is my truck” calls eat the day that should go to genuine disruption",
      "Recovery options are whatever can be reached by phone in ten minutes",
      "Two legs, two tracking systems, and a blind window in between",
    ],
    painPoints: [
      "Every system reads “complete” while the load sits damaged under the wrap",
      "Fleet capacity, driver hours and maintenance windows live in three places",
      "Lane rates get looked up after the decision, not before it",
      "Detention and accessorials surface at freight audit, weeks after the load",
    ],
    systems: [
      "SAP WM",
      "TMW / TMT",
      "DC appointment book",
      "Carrier milestone",
      "Forwarder feed",
      "Freight audit",
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return personas.find((p) => p.slug === slug);
}
