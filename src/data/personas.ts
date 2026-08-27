/* ═══════════════════════════════════════════════════════════════
 *  Target — Supply Chain Personas
 *
 *  The four seats the workshop follows through PO-4471. Content is
 *  grounded in the retailer's real operating shape: ~43,000 owned-
 *  brand SKUs against 3,800 styles, a network of ~50 distribution
 *  facilities (RDCs, food DCs and flow centers), ~2,700 store
 *  deliveries a day, a dedicated fleet, a Vietnam-heavy import
 *  diversification program alongside domestic co-manufacture out of
 *  River Falls, WI — and the system estate (legacy WMS, order
 *  management, DC appointment book, Carrier milestone, Freight audit)
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
    title: "Commodity Manager · Home & Kitchen",
    initials: "MW",
    seat: "Commit → Make/Buy",
    ownsPhases: ["01", "02", "03"],
    meta: {
      age: 41,
      location: "Minneapolis, MN",
      role: "Buyer / Commodity Manager",
      device: "Desktop + Mobile",
      experience: "14 yrs sourcing & category",
    },
    about:
      "Marcus owns the home & kitchen book — stoneware, serveware and textiles — bought FOB Asia through Target Sourcing Services, split between a Dongguan hardgoods program and the Vietnam textile lane the tariff lists created. They carry roughly 180 supplier relationships and spend most of the week chasing acknowledgements and revised dates by email, rather than working the commercial terms they were hired for.",
    quote:
      "I find out a container slipped when the promise date passes — three weeks after the factory knew. By then I'm not negotiating, I'm apologising.",
    goals: [
      "Get a revised ship date from the factory before the promise date passes, not after",
      "Keep the China-to-Vietnam sourcing mix balanced as Section 301 lines move",
      "Qualify a second factory per SKU family so one rejected batch isn't a missed set date",
      "Spend the week on commercial negotiation, not chasing PO acknowledgements",
    ],
    motivations: [
      "Protect the committed set dates on the programs that carry the quarter",
      "Be the one who tells planning about a slip — not the one who hears it from them",
      "Make landed-cost calls on current duty numbers, not last quarter's rate card",
      "Build supplier scorecards that actually change who wins the next award",
    ],
    frustrations: [
      "A PO can sit unacknowledged for days with nothing flagging the silence",
      "Forwarder signals, PO promise dates and the factory's own email all disagree",
      "An expedite quote takes a day to assemble across freight, duty and production",
      "Supplier performance gets reconstructed by hand at review time, from memory",
    ],
    painPoints: [
      "Learns about the slip from the missed date, not the signal three weeks earlier",
      "No costed view of what an expedite is worth against the orders it protects",
      "Tariff reclassification lands as a finance surprise, after the container sails",
      "Switching factories means rebuilding lead times, MOQs and specs under pressure",
    ],
    systems: ["OMS (order management)", "Vendor portal", "Forwarder feed", "DC appointment book", "Freight audit"],
  },

  /* ─── 2 · Position → Promise ────────────────────────────────── */
  {
    slug: "deployment-planner",
    audience: "internal",
    name: "Priya Raghunathan",
    title: "Deployment Planner · Owned-Brand Network",
    initials: "PR",
    seat: "Position → Promise",
    ownsPhases: ["03", "04"],
    meta: {
      age: 34,
      location: "Minneapolis, MN",
      role: "Inventory / Deployment Planner",
      device: "Dual-monitor Desktop",
      experience: "9 yrs supply planning",
    },
    about:
      "Priya positions owned-brand inventory across ~50 distribution facilities — deciding what sits where, what transfers, and what gets re-promised when inbound goes short. They are accountable for roughly 43,000 SKUs against 3,800 styles, and can realistically reach a few hundred positions in a week.",
    quote:
      "I can only work the few hundred positions I can reach. The other forty thousand are hoping I picked the right ones.",
    goals: [
      "Know which nodes go short, and by when, the moment inbound slips",
      "Cover a shortfall by transfer before it becomes an expedite or a missed promise",
      "Hold colourway and date-code integrity when substituting across nodes",
      "Set policy once and have it execute, instead of touching each position by hand",
    ],
    motivations: [
      "Fill rate that holds without parking working capital in all 50 facilities",
      "Trust that a threshold she sets is genuinely being applied overnight",
      "Move from firefighting the reachable few to governing the whole network",
      "Be able to explain a stockout with a reason, not an apology",
    ],
    frustrations: [
      "The legacy planning system publishes the plan of record; the exceptions live in a workbook rebuilt weekly",
      "Coverage risk arrives as a number, without the orders and accounts behind it",
      "Substitution options hide colourway and date code until each one is opened",
      "Every “what if we transfer instead” question means another manual pull",
    ],
    painPoints: [
      "No single view joining an inbound slip to node coverage and the open order book",
      "Options aren't costed — transfer vs expedite vs re-promise is a call made blind",
      "Aging and excess surface only once the quarter has closed",
      "Overrides never feed back, so the same bad recommendation returns next week",
    ],
    systems: ["Demand planning (legacy)", "OMS (order management)", "Legacy WMS", "Databricks"],
  },

  /* ─── 3 · Order → Fulfilled ─────────────────────────────────── */
  {
    slug: "customer-service-rep",
    audience: "internal",
    name: "Daniela Ortiz",
    title: "Customer Service Rep · Store & Account Service",
    initials: "DO",
    seat: "Order → Fulfilled",
    ownsPhases: ["03", "07", "08"],
    meta: {
      age: 29,
      location: "Minneapolis, MN",
      role: "Customer Service Representative",
      device: "Desktop + Headset",
      experience: "6 yrs customer service",
    },
    about:
      "Daniela handles store and account service — order status, delays, substitutions and claims. They work the order-management system as the system of record with a legacy WMS tab and a carrier site open alongside, and spend most of every call researching what is true before they can say anything useful.",
    quote:
      "By the time a account calls me, they already know something's wrong. I'm three systems behind the conversation.",
    goals: [
      "Tell the account about a delay before the account calls to ask",
      "Answer “where is my order” without opening three systems",
      "Resolve a damage claim from evidence already held, in a single pass",
      "Offer a substitution with the program price already held",
    ],
    motivations: [
      "Be the person accounts trust with a bad set date, not just a good one",
      "Stop being a research desk and start advising on the tradeoff",
      "Close claims fairly and fast enough that the account reorders",
      "Protect the relationships that never show up on a revenue report",
    ],
    frustrations: [
      "Order status, delivery status and the carrier's status rarely agree",
      "Every proactive email is written from scratch — so proactive rarely happens",
      "Claims are rebuilt from argument: photos in email, receipt in the WMS, spec elsewhere",
      "Nothing flags which exposed order has a reset crew booked for Monday morning",
    ],
    painPoints: [
      "Learns about the delay from the account, on the account's terms",
      "No ranking of exposed orders — revenue, commitment and set date live in her head",
      "A claim can sit for weeks waiting on root cause from the factory",
      "“Delivered complete” hides damage nobody has looked at yet",
    ],
    systems: ["OMS (order management)", "Legacy WMS", "DC appointment book", "Email / Phone"],
  },

  /* ─── 4 · Transport → Delivered ─────────────────────────────── */
  {
    slug: "logistics-coordinator",
    audience: "internal",
    name: "Terrence Boyd",
    title: "Logistics Coordinator · Dedicated Fleet & Outbound",
    initials: "TB",
    seat: "Transport → Delivered",
    ownsPhases: ["04", "05", "06"],
    meta: {
      age: 46,
      location: "Woodland, CA",
      role: "Logistics Coordinator / Dispatch",
      device: "Desktop + Mobile + Yard Tablet",
      experience: "18 yrs transport & dispatch",
    },
    about:
      "Terrence coordinates outbound loads across the dedicated fleet and purchased carriers out of the Woodland RDC, against a network running roughly 2,700 store deliveries a day. They arbitrate between eight systems that each hold one piece of the truth, and none of which agree on an ETA.",
    quote:
      "DC appointment book says delivered. The WMS says delivered. Ten units are crushed under the wrap and every system is perfectly happy.",
    goals: [
      "One ETA per load, with a confidence — instead of three that disagree",
      "Decide fleet versus purchased on landed cost rather than habit",
      "Catch damage before the customer does, not after the invoice goes out",
      "Cut empty miles by seeing backhaul options inside the booking window",
    ],
    motivations: [
      "Keep the promise the service rep already made to the account",
      "Run the dedicated fleet like an asset, not a fallback",
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
      "Legacy WMS",
      "TMS / dispatch",
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
