// Persona system for the Target Action Center — switchable profiles surface a
// different queue, tab set and column layout for each seat in the chain.
//
// Four seats, and each has its own named agent working alongside it. The agent
// names come from the workshop deck: Mercer on the buying desk, Iris in
// planning, Christy in service, Tova in logistics. The agent's name is used
// wherever its work shows up — the insight column, the chat panel, the
// disclaimer — so the person always knows which one is talking to them.

export type Persona = "buyer" | "planner" | "csr" | "logistics" | "executive";

export const PERSONA_ORDER: ReadonlyArray<Persona> = [
  "executive",
  "buyer",
  "planner",
  "csr",
  "logistics",
];

export interface PersonaProfile {
  /** Display name shown in the profile menu and side-nav user block. */
  name: string;
  /** Role caption beneath the name. */
  role: string;
  /** Two-letter initials for the avatar. */
  initials: string;
  /** The stage of the chain this seat owns. */
  seat: string;
  /** The function this seat performs — the page heading, the nav label and the
   *  top-bar title. "Buying", not "Action Center". */
  pageTitle: string;
  /** Where this seat lands. Always its action center — the exception queue is
   *  what the seat opens the day on, and on the buying desk the rest of the
   *  workspace hangs off the rail beside it. Also the fallback the seat guard
   *  sends you to when a route belongs to somebody else. */
  route: string;
  /** The agent working this seat. */
  agent: string;
  /** What the agent is called in the deck — "Buying agent", "Planning agent". */
  agentRole: string;
  /** One line on what the agent does, from the deck. */
  agentDoes: string;
}

export const PERSONAS: Record<Persona, PersonaProfile> = {
  executive: {
    name: "Dana",
    role: "VP, Supply Chain",
    initials: "DL",
    seat: "Across the towers",
    pageTitle: "Executive dashboard",
    /* The one dashboard. Unlike the four seats, the executive does not work a
       queue — the command center is the whole view, and every figure on it
       drills into the tower that owns it. */
    route: "/executive",
    agent: "Atlas",
    agentRole: "Executive agent",
    agentDoes:
      "Reads across all four towers, names where the month stands on cost, value, service and transport, and walks the exposure back to the seat that owns it.",
  },
  buyer: {
    name: "Marcus",
    role: "Buyer / Commodity Manager",
    initials: "MW",
    seat: "Commit → Make/Buy",
    pageTitle: "Buying",
    /* The queue, not the command center — the buyer arrives to work exceptions.
       (Mirrors BUYING_ROUTES.actionCenter, which cannot be imported here
       without a cycle: nav.ts reads Persona from this file.) */
    route: "/buying/action-center",
    agent: "Mercer",
    agentRole: "Buying agent",
    agentDoes:
      "Catches the vendor's lead-time change, informs the customer, and updates the vendor's lead time for the next three months so every order plans against it.",
  },
  planner: {
    name: "Priya",
    role: "Deployment Planner",
    initials: "PR",
    seat: "Position → Promise",
    pageTitle: "Planning",
    route: "/planning",
    agent: "Iris",
    agentRole: "Planning agent",
    agentDoes:
      "Sees the new lead time, raises safety stock to cover it, replans coverage across the network and raises the purchase requisitions — before anyone builds a spreadsheet.",
  },
  csr: {
    name: "Daniela",
    role: "Customer Service Rep",
    initials: "DO",
    seat: "Order → Fulfilled",
    pageTitle: "Service",
    /* The queue, not the command center — same rule as buying. */
    route: "/service/action-center",
    agent: "Christy",
    agentRole: "Service agent",
    agentDoes:
      "Tells the customer about the delay, offers an alternate product or the option to wait, and settles the claim if units arrive damaged.",
  },
  logistics: {
    name: "Terrence",
    role: "Logistics Coordinator",
    initials: "TB",
    seat: "Transport → Delivered",
    pageTitle: "Logistics",
    route: "/logistics",
    agent: "Tova",
    agentRole: "Logistics coordinator",
    agentDoes:
      "Chooses own-truck vs hired carrier on real cost, reconciles one trusted arrival time from the three systems, and warns the customer early if it slips.",
  },
};

export function isPersona(value: string | null | undefined): value is Persona {
  return (
    value === "buyer" ||
    value === "planner" ||
    value === "csr" ||
    value === "logistics" ||
    value === "executive"
  );
}
