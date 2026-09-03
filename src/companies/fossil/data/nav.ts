import {
  Briefcase,
  ChartLineUp,
  ClipboardText,
  GridFour,
  Factory,
  Gauge,
  House,
  Lightning,
  ListBullets,
  Package,
  PresentationChart,
  Sliders,
  Storefront,
  Truck,
  type Icon,
} from "@phosphor-icons/react";
import { PERSONAS, type Persona } from "@/types/persona";

/**
 * What each seat can reach from the rail.
 *
 * Buying and service are the two deep seats in this prototype: the exception
 * queue is only the part of either job that shouts, and the rail says so by
 * putting the rest of the desk beside it. Planning and logistics still run
 * their queue alone — their own workspaces are the next thing to build, not
 * something to imply here with a nav item that leads nowhere.
 */

export interface NavEntry {
  /** The route. Doubles as the SideNav item key. */
  key: string;
  label: string;
  icon: Icon;
  /**
   * Set on the action center alone, where it carries the count of lines needing
   * a decision. Nothing else on the rail gets one: a badge is a summons, and a
   * supplier book or a realization ledger is somewhere you choose to go. Five
   * badged icons taught the eye to ignore all of them, including the one that
   * meant something.
   */
  badge?: "queue";
}

export interface NavGroup {
  /** Uppercase heading in the expanded panel; a divider on the rail. */
  label?: string;
  entries: NavEntry[];
}

export const BUYING_ROUTES = {
  home: "/buying",
  actionCenter: "/buying/action-center",
  opportunities: "/buying/opportunities",
  suppliers: "/buying/suppliers",
  value: "/buying/value",
} as const;

export const EXECUTIVE_ROUTES = {
  home: "/executive",
} as const;

export const LOGISTICS_ROUTES = {
  actionCenter: "/logistics",
  loads: "/logistics/loads",
  fleet: "/logistics/fleet",
  lanes: "/logistics/lanes",
  spend: "/logistics/spend",
} as const;

export const SERVICE_ROUTES = {
  home: "/service",
  actionCenter: "/service/action-center",
  orders: "/service/orders",
  claims: "/service/claims",
  accounts: "/service/accounts",
} as const;

/** One dealer order, in full. Every SO- reference in this seat lands here. */
export const orderRoute = (id: string) => `${SERVICE_ROUTES.orders}/${id}`;

/** One SKU, in full. Every catalogue reference in the app lands here. */
export const productRoute = (sku: string) => `/planning/products/${encodeURIComponent(sku)}`;

/** One claim, in full. Every CLM- reference in the service seat lands here. */
export const claimRoute = (id: string) => `${SERVICE_ROUTES.claims}/${encodeURIComponent(id)}`;

/** One play, in full — review it, run it, commit it. */
export const playRoute = (id: string) => `${BUYING_ROUTES.opportunities}/${id}`;

/** One purchase order, in full. Every PO- reference in the buying seat lands here. */
export const poRoute = (ref: string) => `${BUYING_ROUTES.actionCenter}/${ref}`;

/**
 * Pages the chat panel floats over rather than docking beside.
 *
 * Both are wide for the same reason: the page is one dense record laid out
 * edge to edge. Inventory Planning's exception list is twelve columns; an order
 * detail is a 12-column grid whose top row wants eight of them for the stepper.
 * Taking 380px out of either costs the reader the right-hand half of what they
 * came to read, so on these the panel starts collapsed and floats when summoned.
 *
 * The trailing slash on the order route is load-bearing — the order BOOK is a
 * normal table and keeps the panel docked beside it; only a single order is wide.
 */
const WIDE_PAGES = [
  /* The command center. Five measures across, a grouped chart, and two tables
     whose columns are the reading — docking cost the supplier table its site
     names and squeezed the five tiles onto three rows. It is also the seat that
     least wants a panel open on arrival: an executive reads the month first and
     asks second, where an operator arrives at a queue with a question already
     formed. */
  EXECUTIVE_ROUTES.home,
  "/planning/parts",
  `${SERVICE_ROUTES.orders}/`,
  `${BUYING_ROUTES.actionCenter}/`,
  /* The whole opportunities branch, feed and detail alike. Only the detail was
     on this list, on the reasoning that a record is dense and a feed is a normal
     table — but the feed is thirteen columns wanting 1,709px, and docked it had
     868px, so it lost Mercer's insight and the action button off the right edge.
     No trailing slash, because both halves want the same treatment and one
     prefix says so. */
  BUYING_ROUTES.opportunities,
  /* A single product, for the same reason as a single order. The record page
     opens on the product's own detail across the full width and carries a
     four-tab position table under it; docking the panel took 380px out of both,
     which pushed the detail's three columns down to two and clipped the last tab
     off the table. The catalogue itself stays docked — it is a normal table, and
     the trailing slash keeps the two apart. */
  "/planning/products/",
];

export function isWidePage(pathname: string): boolean {
  return WIDE_PAGES.some((r) => pathname.startsWith(r));
}

export const NAV: Record<Persona, NavGroup[]> = {
  /* The executive works one screen — the cross-tower command center — and
     drills from its figures into the tower that owns each. The four tower
     shortcuts sit under "Towers"; opening one hands the seat to that tower's
     owner, which the seat guard already does for any cross-seat link. No
     queue badge: the executive reads the book, they do not work a queue. */
  /* One page. A VP does not work a queue — they read the month and then hand
     something to the desk that owns it, and a rail of four tower shortcuts made
     the seat look like a fifth operator with everyone else's pages on it. The
     command center's own "Open the tower" links still drill in, and they hand
     the reader the seat that owns the record rather than keeping them here
     pretending to be its owner. */
  executive: [
    { entries: [{ key: EXECUTIVE_ROUTES.home, label: "Executive dashboard", icon: PresentationChart }] },
  ],
  /* Three bands on every seat, and they answer different questions: where the
     day starts, what you work on, and how the book is doing. A flat list makes
     a report look like a task. */
  buyer: [
    { entries: [{ key: BUYING_ROUTES.home, label: "Command center", icon: House }] },
    {
      label: "Operate",
      entries: [
        {
          key: BUYING_ROUTES.actionCenter,
          label: "Action center",
          icon: Lightning,
          badge: "queue",
        },
        { key: BUYING_ROUTES.opportunities, label: "Opportunities", icon: Briefcase },
      ],
    },
    {
      label: "Understand",
      entries: [
        { key: BUYING_ROUTES.suppliers, label: "Suppliers", icon: Factory },
        { key: BUYING_ROUTES.value, label: "Value realization", icon: ChartLineUp },
      ],
    },
  ],
  /* Grouped the way IRIS groups its own rail: the queue stands alone because it
     is where the day starts, PLANNING holds the two pages that explain what is
     in that queue, and SYSTEM holds the rules that produced both. The division
     is the argument — a flat list of four would imply they are peers, and
     configuration is not a peer of a work queue. */
  planner: [
    {
      entries: [
        {
          key: "/planning",
          label: "Product Stocking Policy",
          icon: Gauge,
          badge: "queue",
        },
      ],
    },
    {
      label: "Planning",
      entries: [
        { key: "/planning/parts", label: "Inventory Planning", icon: ListBullets },
      ],
    },
    {
      label: "System",
      entries: [{ key: "/planning/system", label: "System Configurations", icon: Sliders }],
    },
  ],
  /* No command center on this seat. The CSR opens the day on the queue and works
     outward from it — a landing page ahead of that was a page to click past.
     `PERSONAS.csr.route` already points at the action center, so the seat guard
     sends /service there rather than rendering a page the rail cannot reach. */
  csr: [
    {
      entries: [
        {
          key: SERVICE_ROUTES.actionCenter,
          label: "Action center",
          icon: Lightning,
          badge: "queue",
        },
      ],
    },
    {
      /* The shipment path. One page: the book, and the order behind any
         line in it — where a shipment is and whether it will land are the
         same question, and the reconciled ETA belongs on the order it is
         about rather than on a page of its own. */
      label: "Fulfil",
      entries: [
        { key: SERVICE_ROUTES.orders, label: "Orders", icon: Package },
        /* The book, on the seat that looks things up in it. It sat under
           Planning on the reasoning that the planner owns what Shaw stocks —
           true, and not the same as who reads the catalogue. The planner works
           positions: a SKU at a centre, with a policy and a buffer. It is the
           service rep who is asked "what does that colour look like, and is
           there anything close to it" while a dealer waits on the line, which is
           the question this page answers.
           The other seats still reach it by clicking a SKU. */
        /* A tile, not a cube. The rail carries Package directly above this one
           and two box glyphs in a row are indistinguishable at 20px — and the
           book this page holds is carpet tile, so GridFour is what the product
           actually looks like. Same glyph the carpet tile scope uses, which
           means the category control and the catalogue now agree. */
        { key: "/planning/products", label: "Product catalogue", icon: GridFour },
      ],
    },
    {
      /* Settling money. Kept apart from Fulfil because they are different work:
         one is chasing a truck, the other is arguing about a pallet. */
      label: "Resolve",
      entries: [{ key: SERVICE_ROUTES.claims, label: "Claims", icon: ClipboardText }],
    },
    {
      /* The dealer, on its own band. It sat under Resolve with Claims on the
         reasoning that a claim is a relationship needing attention — true, and
         not the same thing. A claim is an open item with a clock on it; the
         dealer book is the account behind every order and every claim, and it is
         read when nothing is wrong at all. Grouped together the rail said the
         only reason to open a dealer is that they have complained. */
      label: "Accounts",
      entries: [{ key: SERVICE_ROUTES.accounts, label: "Accounts", icon: Storefront }],
    },
  ],
  /* Same three-band shape as the other seats, and the bands answer the seat's
     two halves: MOVE is the load and the iron under it — where a thing is and
     whether anything can pull it — and COST is what the moving is worth, which
     is a different question asked at a different time of day. Splitting them
     keeps a rate ledger from reading as a work queue. */
  logistics: [
    {
      entries: [
        {
          key: LOGISTICS_ROUTES.actionCenter,
          label: "Action center",
          icon: Lightning,
          badge: "queue",
        },
      ],
    },
    {
      label: "Move",
      entries: [
        { key: LOGISTICS_ROUTES.loads, label: "Loads", icon: Package },
        { key: LOGISTICS_ROUTES.fleet, label: "Fleet", icon: Truck },
      ],
    },
    {
      label: "Cost",
      entries: [
        { key: LOGISTICS_ROUTES.lanes, label: "Lanes & rates", icon: Gauge },
        { key: LOGISTICS_ROUTES.spend, label: "Freight spend", icon: ChartLineUp },
      ],
    },
  ],
};

/** Every entry across a persona's groups, flattened — for active-key matching
 *  and for the top bar's page name. */
export function navEntries(persona: Persona): NavEntry[] {
  return NAV[persona].flatMap((g) => g.entries);
}

/**
 * The entry a path is inside. Longest key first, so `/buying/suppliers` is not
 * swallowed by `/buying`.
 */
export function activeEntry(persona: Persona, pathname: string): NavEntry | undefined {
  return [...navEntries(persona)]
    .sort((a, b) => b.key.length - a.key.length)
    .find((e) => pathname === e.key || pathname.startsWith(`${e.key}/`));
}

/**
 * The seat a path belongs to, whoever is currently sitting in one.
 *
 * Records cross seats constantly — a load names the sales order it carries, a
 * purchase order names the dealer waiting on it, a claim names both — and every
 * one of those links pointed at a route the reader's own rail does not have.
 * The guard refused them and sent the reader home, so the links looked broken
 * when the destination was right and only the seat was wrong.
 *
 * With this the guard can hand the reader the seat that owns the record instead
 * of the door.
 */
export function seatOwning(pathname: string): Persona | undefined {
  /* The most SPECIFIC claim wins, not the first seat that happens to match.
     Every entry matches on prefix, and the planner's action centre is
     "/planning" — so it claimed /planning/products too, and the product
     catalogue kept opening in Priya's chrome after it moved to Daniela's rail.
     Ranking by the length of the matched key gives csr's "/planning/products"
     the route and leaves the planner everything else under /planning. */
  let owner: Persona | undefined;
  let best = -1;
  for (const p of Object.keys(PERSONAS) as Persona[]) {
    const entry = activeEntry(p, pathname);
    if (entry && entry.key.length > best) {
      best = entry.key.length;
      owner = p;
    }
  }
  return owner;
}
