/* ═══════════════════════════════════════════════════════════════
 *  What the agent offers before you have asked anything
 *
 *  The panel's empty state used to offer one fixed set of four chips
 *  — track an order, open a claim, promise dates, recent activity —
 *  on every page of every seat. On the buyer's opportunity feed that
 *  is four questions about somebody else's job.
 *
 *  So the chips are authored per seat AND per page. A prompt also
 *  declares what kind of answer it is, because the panel used to reply
 *  to every chip with an email draft: right for "chase the supplier",
 *  nonsense for "why is the play drifting".
 * ═══════════════════════════════════════════════════════════════ */

import { EXEC_ASKS } from "./executive-flows";
import {
  ArrowBendUpRight,
  Briefcase,
  CalendarCheck,
  ChartLineUp,
  ClipboardText,
  ClockCounterClockwise,
  Compass,
  CurrencyDollar,
  Gauge,
  MapPinLine,
  Note,
  Package,
  PhoneCall,
  Question,
  Scales,
  ShieldCheck,
  Stack,
  Storefront,
  Swap,
  Target,
  TrendDown,
  Truck,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import type { Persona } from "@/types/persona";
import { BOOK, PLAYS, feedPlays, ledgerPlays, money, realizedToDate } from "./buying";
import {
  CLAIMS,
  DEALERS,
  ORDERS,
  SERVICE_BOOK,
  atRiskOrders,
  claimsNeedingAction,
  formatUsd,
  hasEtaConflict,
  inFlight,
  openClaims,
} from "./service";
import { QUEUES } from "./action-center";
import { EXCEPTIONS, planningRollup } from "./planning";
import { FLEET, LOADS, LOAD_AT_RISK } from "./logistics";

/**
 * What pressing the chip does.
 *
 * `draft` writes a message for the person to send — the panel's original
 * behaviour. `read` answers a question, so it gets a titled list instead of a
 * composer. `claim` hands off to the in-panel claim flow.
 */
export type PromptKind = "draft" | "read" | "claim";

/** One line of a read answer: a short left-hand label and the fact. */
export interface AnswerRow {
  label: string;
  text: string;
}

export interface ChatPrompt {
  label: string;
  icon: Icon;
  kind: PromptKind;
  /** Required on `read` prompts — what the agent actually says back. */
  answer?: {
    /** The one-line summary, in the agent's voice. */
    note: string;
    rows: AnswerRow[];
  };
}

export interface PagePrompts {
  /** The line above the chips, naming what this page is about. */
  intro: string;
  prompts: ChatPrompt[];
}

/** The label that starts the claim flow. One name wherever it is reached from. */
export const OPEN_A_CLAIM = "Open a claim";

/* ─── Shared prompts ─────────────────────────────────────────────────────── */

const RECENT_ACTIVITY: ChatPrompt = {
  label: "Recent activity",
  icon: ClockCounterClockwise,
  kind: "read",
  answer: {
    note: "Everything I have done on this seat in the last two days.",
    rows: [
      { label: "Today 09:12", text: "Swept the book overnight and re-scored every open line" },
      { label: "Today 07:40", text: "Chased two counterparties that had gone quiet" },
      { label: "Yesterday 16:20", text: "Re-planned around an inbound slip and told the affected customers" },
      { label: "Yesterday 11:05", text: "Adjudicated a claim from the order and the delivery receipt" },
    ],
  },
};

const CLAIM_PROMPT: ChatPrompt = { label: OPEN_A_CLAIM, icon: Note, kind: "claim" };

/* ─── The buying desk ────────────────────────────────────────────────────── */

const buyerQueue = () => QUEUES.buyer.rows.filter((r) => r.state === "decide").length;

const BUYING: Record<string, PagePrompts> = {
  "/buying": {
    intro: "Your book this morning. Ask me:",
    prompts: [
      {
        label: "Today's brief",
        icon: Compass,
        kind: "read",
        answer: {
          note: `${money(BOOK.spend)} of category spend, and three things worth your morning.`,
          rows: [
            { label: "First", text: `${buyerQueue()} purchase orders need a decision — all three are lead-time moves` },
            { label: "Second", text: `${feedPlays().length} plays surfaced overnight, the two largest resting on paper we already hold` },
            { label: "Third", text: "One committed play is behind its ramp and needs a look before month end" },
          ],
        },
      },
      {
        label: "Biggest exposure",
        icon: CurrencyDollar,
        kind: "read",
        answer: {
          note: `${money(BOOK.openPoValue)} is on order across ${BOOK.openPos} purchase orders.`,
          rows: [
            { label: "Concentration", text: "The top two categories carry over half the book" },
            { label: "Single source", text: "Reactive-glaze stoneware sits on one supplier across $9.4M of annual demand" },
            { label: "Country risk", text: "$5.2M still enters from China at 25% Section 301" },
          ],
        },
      },
      {
        label: "Where to start",
        icon: Target,
        kind: "read",
        answer: {
          note: "In order, and why.",
          rows: [
            { label: "1", text: "PO-4463 — capped for three months, and the biggest single exposure open" },
            { label: "2", text: "PO-4471 — customers already told, so this is a signature not a conversation" },
            { label: "3", text: "OPP-101 — the tier was quoted and never taken up; it costs a week of your time" },
          ],
        },
      },
      RECENT_ACTIVITY,
    ],
  },

  "/buying/action-center": {
    intro: `${buyerQueue()} purchase orders need a decision. Ask me:`,
    prompts: [
      { label: "Chase a supplier", icon: PhoneCall, kind: "draft" },
      {
        label: "Lead time impact",
        icon: Gauge,
        kind: "read",
        answer: {
          note: "What the +10 days actually costs, downstream of you.",
          rows: [
            { label: "Planning", text: "Six SKUs fall short of cover — safety stock has to rise on all of them" },
            { label: "Service", text: "Four account orders move, two of them against booked crews" },
            { label: "Money", text: "No unit-cost change; the cost is the re-promise and the expedites it triggers" },
          ],
        },
      },
      { label: "Draft an update", icon: Note, kind: "draft" },
      RECENT_ACTIVITY,
    ],
  },

  "/buying/opportunities": {
    intro: `Last night's sweep found ${feedPlays().length} plays. Ask me:`,
    prompts: [
      {
        label: "Explain a play",
        icon: Briefcase,
        kind: "read",
        answer: {
          note: "The hardgoods consolidation, since it is the largest.",
          rows: [
            { label: "What", text: "Three suppliers carry the whole book; the tail styles hold $9.9M across sub-scale lines" },
            { label: "Why now", text: "Luen Hing Housewares and Vinh Phat Textiles both published volume tiers this year that we never took up" },
            { label: "Evidence", text: "Ariba quote 2025-0418 at −4.1% from 6,000 units, and a June capacity survey" },
            { label: "Risk", text: "Cedar Mills Co-Pack holds the recipe spec on two styles — requalification is six weeks" },
          ],
        },
      },
      {
        label: "Run which first",
        icon: Target,
        kind: "read",
        answer: {
          note: "Ranked by money per week of your effort, not by headline size.",
          rows: [
            { label: "1", text: "Hardgoods consolidation — $2.4M over ten weeks, and the paper exists" },
            { label: "2", text: "Cai Mep FCL consolidation — $820K over eight, and it is a PO change not a negotiation" },
            { label: "3", text: "Section 301 lane shift — $1.25M but sixteen weeks and a requalification that can land either way" },
          ],
        },
      },
      {
        label: "Check a benchmark",
        icon: Scales,
        kind: "read",
        answer: {
          note: `The category is measured against a ${BOOK.benchmarkLow}–${BOOK.benchmarkHigh}% band.`,
          rows: [
            { label: "Source", text: "Navanta resilient-import benchmark, refreshed quarterly" },
            { label: "Where we sit", text: "3.1% under on Luen Hing Housewares, 4% over on Cedar Mills Co-Pack — the price of the domestic lane" },
            { label: "Caveat", text: "A benchmark-only play is a hypothesis; look for the ones with a quote behind them" },
          ],
        },
      },
      {
        label: "Why dismissed",
        icon: TrendDown,
        kind: "read",
        answer: {
          note: "One play has been dismissed, and the reason is worth keeping.",
          rows: [
            { label: "Play", text: "OPP-111 — consolidate the towel tail onto Vinh Phat Textiles" },
            { label: "Reason", text: "One line at 94% utilisation with an 83% OTIF record; capacity will not hold the volume" },
            { label: "What it teaches", text: "The sweep read price and share and never opened the capacity survey" },
          ],
        },
      },
    ],
  },

  "/buying/suppliers": {
    intro: `${BOOK.suppliers} relationships, twelve detailed here. Ask me:`,
    prompts: [
      {
        label: "Who is slipping",
        icon: TrendDown,
        kind: "read",
        answer: {
          note: "Four suppliers have moved their quoted lead time out this quarter.",
          rows: [
            { label: "Luen Hing Housewares", text: "45 → 55 days · 91% OTIF · the anchor of the import book" },
            { label: "Vinh Phat Textiles", text: "Out to 50 days · two containers rolled at Cai Mep" },
            { label: "Cedar Mills Co-Pack", text: "Out to 42 days · 78% OTIF, the weakest record we hold" },
            { label: "Luen Hing Housewares", text: "Glaze kilns capped for three months — capacity, not price, so reschedule rather than renegotiate" },
          ],
        },
      },
      {
        label: "Score breakdown",
        icon: Gauge,
        kind: "read",
        answer: {
          note: "Every supplier is scored on the same five weighted criteria.",
          rows: [
            { label: "Landed cost", text: "30% — against the category benchmark, not against each other" },
            { label: "Delivery", text: "25% — OTIF plus the direction the quoted lead time is moving" },
            { label: "Quality", text: "20% — rejects per thousand units and open claims" },
            { label: "Resilience", text: "15% — lines, shifts and whether a qualified backup exists" },
            { label: "Terms", text: "10% — payment terms and any early-payment discount" },
          ],
        },
      },
      {
        label: "Terms gaps",
        icon: Warning,
        kind: "read",
        answer: {
          note: "One external supplier has no payment term on file at all.",
          rows: [
            { label: "Luen Hing Housewares", text: "$6.1M a year, onboarded through the legacy path, no term recorded" },
            { label: "Why it matters", text: "It blocks the Net 60 harmonisation play until a term is established" },
            { label: "Fix", text: "Establish the current term in writing before opening the round" },
          ],
        },
      },
      { label: "Chase a supplier", icon: PhoneCall, kind: "draft" },
    ],
  },

  "/buying/value": {
    intro: `${money(ledgerPlays().reduce((s, p) => s + p.recommended, 0))} committed across ${ledgerPlays().length} plays. Ask me:`,
    prompts: [
      {
        label: "Why the drift",
        icon: Warning,
        kind: "read",
        answer: {
          note: `${PLAYS.filter((p) => p.drift?.flagged).length} play is behind the ramp it committed to.`,
          rows: [
            { label: "Play", text: "OPP-108 — retire the serveware tail onto Luen Hing Housewares" },
            { label: "Gap", text: "Q3 landed $44K against a $60K ramp, 27% behind" },
            { label: "Cause", text: "Three tail vendors hold exclusivity on a spec finish and are still shipping direct" },
            { label: "Fix", text: "Either buy out the exclusivity or carve those three out of the play's scope" },
          ],
        },
      },
      {
        label: "Ramp vs actual",
        icon: ChartLineUp,
        kind: "read",
        answer: {
          note: `${money(ledgerPlays().reduce((s, p) => s + realizedToDate(p), 0))} has landed so far.`,
          rows: [
            { label: "On ramp", text: "OPP-107 and OPP-109 are both at or ahead of plan" },
            { label: "Behind", text: "OPP-108 is short, and the shortfall is scope rather than execution" },
            { label: "Closed", text: "OPP-110 realized $134K against $130K committed and is verified with finance" },
          ],
        },
      },
      {
        label: "Verify a saving",
        icon: ShieldCheck,
        kind: "read",
        answer: {
          note: "A play only closes when finance agrees the number.",
          rows: [
            { label: "Step 1", text: "Realized value is read from the invoices, not from the contract" },
            { label: "Step 2", text: "The baseline is re-cut so a price move elsewhere cannot be claimed as the saving" },
            { label: "Step 3", text: "Finance signs, the play closes, and the figure stops accruing" },
          ],
        },
      },
      RECENT_ACTIVITY,
    ],
  },
};

/* ─── The service desk ───────────────────────────────────────────────────── */

const SERVICE: Record<string, PagePrompts> = {
  "/service": {
    intro: "Your accounts this morning. Ask me:",
    prompts: [
      {
        label: "Today's brief",
        icon: Compass,
        kind: "read",
        answer: {
          note: `${inFlight().length} orders still coming for ${formatUsd(SERVICE_BOOK.openValue)}, and three things worth your morning.`,
          rows: [
            { label: "First", text: `${atRiskOrders().filter((o) => o.crewBooked).length} at-risk orders have a crew already booked — those break something real` },
            { label: "Second", text: `${SERVICE_BOOK.etaConflicts} shipments have systems disagreeing, and the account can see the wrong date` },
            { label: "Third", text: `${claimsNeedingAction().length} claims are adjudicated and waiting on your signature` },
          ],
        },
      },
      {
        label: "Orders at risk",
        icon: Warning,
        kind: "read",
        answer: {
          note: `${atRiskOrders().length} orders are delayed, backordered, or too close to an floor-set date.`,
          rows: atRiskOrders()
            .slice(0, 4)
            .map((o) => ({
              label: o.id,
              text: `${o.account} · ${formatUsd(o.value)}${o.crewBooked && o.installOn ? ` · crew booked ${o.installOn}` : ""}`,
            })),
        },
      },
      CLAIM_PROMPT,
      RECENT_ACTIVITY,
    ],
  },

  "/service/action-center": {
    intro: `${QUEUES.csr.rows.filter((r) => r.state === "decide").length} lines need you. Ask me:`,
    prompts: [
      { label: "Draft an update", icon: Note, kind: "draft" },
      { label: "Offer alternates", icon: Swap, kind: "draft" },
      CLAIM_PROMPT,
      RECENT_ACTIVITY,
    ],
  },

  "/service/orders": {
    intro: `${ORDERS.length} orders on the book. Ask me:`,
    prompts: [
      {
        label: "Track an order",
        icon: Truck,
        kind: "read",
        answer: {
          note: "Give me an order number, or start with the ones a account is most likely to ring about.",
          rows: inFlight()
            .filter(hasEtaConflict)
            .concat(atRiskOrders().filter((o) => o.stage !== "delivered"))
            .slice(0, 4)
            .map((o) => ({ label: o.id, text: `${o.account} · ${o.lane}` })),
        },
      },
      {
        label: "Promise dates",
        icon: CalendarCheck,
        kind: "read",
        answer: {
          note: "Which promises have moved, and by how much.",
          rows: ORDERS.filter((o) => o.currentEta !== o.promisedOn)
            .slice(0, 4)
            .map((o) => ({
              label: o.id,
              text: `${o.promisedOn} → ${o.currentEta} · ${o.account}`,
            })),
        },
      },
      CLAIM_PROMPT,
      {
        label: "Trusted ETA",
        icon: MapPinLine,
        kind: "read",
        answer: {
          note: "When the systems disagree, the most recently updated one wins.",
          rows: [
            { label: "DC appointment book", text: "Transit level, updates on scan events — trust it once a shipment has moved" },
            { label: "Legacy WMS", text: "Allocation and pick level — trust it before the load is tendered" },
            { label: "Order management", text: "Holds the original promise, and is the date on the account's portal" },
            { label: "So", text: "The account is usually looking at the one date nobody has updated" },
          ],
        },
      },
      {
        label: "Why it slipped",
        icon: Question,
        kind: "read",
        answer: {
          note: "The two conflicts have different causes.",
          rows: [
            { label: "SO-4436", text: "Rolled at the Salt Lake terminal, three days added — a carrier event" },
            { label: "SO-4488", text: "Nashville is at zero days cover, so the allocation was never firm" },
            { label: "Difference", text: "One is transit and recoverable; the other is supply and is not" },
          ],
        },
      },
      { label: "Warn the account", icon: Note, kind: "draft" },
      RECENT_ACTIVITY,
    ],
  },

  "/service/claims": {
    intro: `${CLAIMS.length} claims, ${claimsNeedingAction().length} waiting on your signature. Ask me:`,
    prompts: [
      CLAIM_PROMPT,
      {
        label: "Claim status",
        icon: ClipboardText,
        kind: "read",
        answer: {
          note: `${openClaims().length} claims are open for ${formatUsd(SERVICE_BOOK.openClaimValue)}.`,
          rows: openClaims()
            .slice(0, 4)
            .map((c) => ({
              label: c.id,
              text: `${c.account} · ${c.adjudicated === null ? "not yet adjudicated" : `${formatUsd(c.adjudicated)} adjudicated`}`,
            })),
        },
      },
      {
        label: "Policy caps",
        icon: ShieldCheck,
        kind: "read",
        answer: {
          note: "The cap is what you can release alone, not what the claim is worth.",
          rows: [
            { label: "Inside the cap", text: "One signature releases the credit and corrects the invoice" },
            { label: "Over the cap", text: "The claim can still be filed and adjudicated; approval needs a second signature" },
            { label: "Open right now", text: `${CLAIMS.filter((c) => (c.adjudicated ?? c.requested) > c.policyCap).length} claims sit over their cap` },
          ],
        },
      },
      {
        label: "Batch pattern",
        icon: Stack,
        kind: "read",
        answer: {
          note: "Claims clustering on one lot are a supplier conversation, not a account one.",
          rows: [
            { label: "B-2419", text: "Three claims across two accounts — transit damage and a manufacturing defect" },
            { label: "Read it as", text: "Gulf Coast's 6.8 claims per hundred is mostly this lot, not the account" },
            { label: "Next", text: "Hand the lot to the buying desk rather than reworking the account's scorecard" },
          ],
        },
      },
    ],
  },

  "/service/accounts": {
    intro: `${DEALERS.length} accounts. Ask me:`,
    prompts: [
      {
        label: "Account health",
        icon: Storefront,
        kind: "read",
        answer: {
          note: "Revenue and service, which do not rank the same way.",
          rows: [
            { label: "Best served", text: "Piedmont at 95% on time — and still four claims this quarter" },
            { label: "Worst served", text: "Lowcountry at 79%, because their orders land on the thinnest cover" },
            { label: "Biggest", text: "Lone Star at $4.1M, and the cleanest claim record on the book" },
          ],
        },
      },
      {
        label: "Claim history",
        icon: ClipboardText,
        kind: "read",
        answer: {
          note: "Claim rate is a lagging read on our lots, not a character reference.",
          rows: [
            { label: "Highest", text: "Gulf Coast at 6.8 per hundred — three of those trace to batch B-2419" },
            { label: "Lowest", text: "Lone Star at 0.8, on a builder programme where lots stay continuous" },
            { label: "Watch", text: "Cascade at 5.2, and both open claims are against the carrier not the supplier" },
          ],
        },
      },
      {
        label: "Who answers",
        icon: PhoneCall,
        kind: "read",
        answer: {
          note: "The channel that actually gets a reply, per account.",
          rows: [
            { label: "Phone first", text: "Gulf Coast and Peachtree — Tony and Carla rarely open email" },
            { label: "Email first", text: "Blue Ridge and Summit — same-day replies, and a written trail" },
            { label: "Why it matters", text: "A chase on the wrong channel reads as no chase at all" },
          ],
        },
      },
      CLAIM_PROMPT,
    ],
  },
};

/* ─── Planning and logistics ─────────────────────────────────────────────── */

const PLANNING: PagePrompts = {
  intro: `${QUEUES.planner.rows.filter((r) => r.state === "decide").length} SKUs are short of cover. Ask me:`,
  prompts: [
    {
      label: "Cover the gap",
      icon: Package,
      kind: "read",
      answer: {
        note: "Three ways to close a shortfall, cheapest first.",
        rows: [
          { label: "Transfer", text: "Move cover from a node that has it — no purchase, days of lead time" },
          { label: "Expedite", text: "Pull the inbound forward — costs freight, keeps the promise" },
          { label: "Re-promise", text: "Move the date — free, and somebody downstream pays for it" },
        ],
      },
    },
    {
      label: "Safety stock",
      icon: Gauge,
      kind: "read",
      answer: {
        note: "The level is a function of the lead time, which just moved.",
        rows: [
          { label: "Why now", text: "The supplier lead time went out 10 days for the next three months" },
          { label: "Effect", text: "Every SKU on that source needs more cover to hold the same service level" },
          { label: "Constraint", text: "Levels step in MOQ multiples — a figure the plant cannot ship is no figure" },
        ],
      },
    },
    {
      label: "Transfer options",
      icon: Swap,
      kind: "read",
      answer: {
        note: "What a transfer costs and what it risks.",
        rows: [
          { label: "Cost", text: "Inter-node freight only, against a full expedite" },
          { label: "Risk", text: "Finish and batch have to match, or the receiving node cannot sell it as the same SKU" },
          { label: "Speed", text: "Two to four days inside the network, against weeks on an inbound" },
        ],
      },
    },
    RECENT_ACTIVITY,
  ],
};

const LOGISTICS: PagePrompts = {
  intro: `${QUEUES.logistics.rows.filter((r) => r.state === "decide").length} loads need you. Ask me:`,
  prompts: [
    {
      label: "Reconcile ETAs",
      icon: MapPinLine,
      kind: "read",
      answer: {
        note: "Three systems answer at three different levels, which is why they disagree.",
        rows: [
          { label: "DC appointment book", text: "Shipment level — the best answer once a load is moving" },
          { label: "Carrier milestone", text: "Trailer level — right when the trailer and the shipment have parted company" },
          { label: "Telematics", text: "Tractor level — closest to the truth, furthest from the order" },
          { label: "So", text: "Pick the level that matches the question, then say so on the call" },
        ],
      },
    },
    {
      label: "Dedicated vs bought",
      icon: Truck,
      kind: "read",
      answer: {
        note: "Own truck against purchased, on real cost rather than habit.",
        rows: [
          { label: "Own truck", text: "Driver hours, fuel and the backhaul it gives up" },
          { label: "Purchased", text: "Lane rate, plus detention and accessorials that surface at audit" },
          { label: "Rule", text: "The fleet wins where a backhaul exists; hired wins on a one-way spike" },
        ],
      },
    },
    {
      label: "Recovery options",
      icon: ArrowBendUpRight,
      kind: "read",
      answer: {
        note: "When a load is going wrong, what is actually available.",
        rows: [
          { label: "Re-route", text: "Costs miles, keeps the date" },
          { label: "Split the load", text: "Gets the booked portion there, leaves a second delivery to schedule" },
          { label: "Warn early", text: "Free, and the only option that stops the customer finding out from the driver" },
        ],
      },
    },
    { label: "Warn the customer", icon: Note, kind: "draft" },
  ],
};

/* ─── Lookup ─────────────────────────────────────────────────────────────── */

/**
 * Every page, flat, across all four seats.
 *
 * Keyed on the route alone rather than on persona + route. The route already
 * names the seat — `/service/orders` can only be the service desk — and asking
 * for the persona meant the server, which has to guess it, served the buyer's
 * chips on every service page until the cookie landed on the client.
 */

/* Iris's wider seat. Each page answers a different question, so each gets its
   own chips — the queue's "cover the gap" is the wrong offer on a page about
   how the book is classified. */


const PLANNING_POLICY: PagePrompts = {
  intro: `${EXCEPTIONS.length} exceptions open. Ask me:`,
  prompts: [
    {
      label: "How a level is sized",
      icon: Gauge,
      kind: "read",
      answer: {
        note: "Five steps, and every row on this page can be unfolded into them.",
        rows: [
          { label: "1 · Classify", text: "ABC by turnover, XYZ by coefficient of variation" },
          { label: "2 · Service", text: "The nine-box cell sets the target, which sets z" },
          { label: "3 · Risk", text: "σ over the lead time — √ is why a longer wait costs less buffer than you expect" },
        ],
      },
    },
    {
      label: "What Iris settled",
      icon: Package,
      kind: "read",
      answer: {
        note: "The split is a threshold, not a judgement.",
        rows: [
          { label: "Settled", text: `${planningRollup().auto} under the 20% deviation threshold, written and logged` },
          { label: "Held", text: `${planningRollup().manual} above it, or already in your queue` },
          { label: "Change it", text: "Configuration owns that threshold, and this page follows it" },
        ],
      },
    },
    {
      label: "Reorder point",
      icon: ChartLineUp,
      kind: "read",
      answer: {
        note: "A different figure from safety stock, and a common place to lose a week.",
        rows: [
          { label: "What it is", text: "Demand over the lead time, plus the safety stock" },
          { label: "Why it moves", text: "Raise the buffer without it and the order never triggers in time" },
          { label: "Always higher", text: "It contains safety stock, so it can never sit below it" },
        ],
      },
    },
    RECENT_ACTIVITY,
  ],
};

const PLANNING_CONFIG: PagePrompts = {
  intro: "The rules behind every recommendation on this seat. Ask me:",
  prompts: [
    {
      label: "What reaches me",
      icon: Gauge,
      kind: "read",
      answer: {
        note: "Four gates, and a line has to clear all of them to be settled without you.",
        rows: [
          { label: "Deviation", text: "Under 20% and Iris writes it" },
          { label: "Value", text: "Over $50K always reaches a person, however small the change" },
          { label: "Lead time", text: "A moved lead time is a commercial fact — always escalated" },
        ],
      },
    },
    {
      label: "What Iris may not do",
      icon: Package,
      kind: "read",
      answer: {
        note: "Deliberate limits, not missing features.",
        rows: [
          { label: "Plant lines", text: "Propose only — Iris cannot schedule production" },
          { label: "Purchase orders", text: "Propose only — raising one belongs to the buying seat" },
          { label: "Transfers", text: "Enabled, inside the network, on a matching batch" },
        ],
      },
    },
    {
      label: "Signal quality",
      icon: ChartLineUp,
      kind: "read",
      answer: {
        note: "What Iris needs before it will trust a number.",
        rows: [
          { label: "History", text: "13 weeks minimum, or the SKU is planned min/max instead" },
          { label: "Window", text: "90 days rolling for σ and the coefficient of variation" },
          { label: "Outliers", text: "±3σ trimmed, so one freak week does not resize a buffer" },
        ],
      },
    },
    RECENT_ACTIVITY,
  ],
};


/* ── The book pages that had no prompts of their own ──────────────────────
 *
 * Each of these fell back to its seat's queue page by prefix, so a reader on
 * the lane book was offered four questions about loads. A suggestion that
 * does not fit the page in front of you is worse than none: it teaches the
 * reader the chips are decoration. These are the questions each book can
 * actually answer.
 */

const LOADS_PAGE: PagePrompts = {
  intro: `${LOADS.filter((l) => LOAD_AT_RISK.has(l.health)).length} loads are outside their window. Ask me:`,
  prompts: [
    { label: "Which loads slip today?", icon: Warning, kind: "read" },
    { label: "Why do the ETA feeds disagree?", icon: MapPinLine, kind: "read" },
    { label: "What does a late load cost?", icon: CurrencyDollar, kind: "read" },
    RECENT_ACTIVITY,
  ],
};

const FLEET_PAGE: PagePrompts = {
  intro: `${FLEET.length} power units on the book. Ask me:`,
  prompts: [
    { label: "Which units can take work?", icon: Truck, kind: "read" },
    { label: "Who is close to their hours?", icon: ClockCounterClockwise, kind: "read" },
    { label: "What is due for service?", icon: Warning, kind: "read" },
    RECENT_ACTIVITY,
  ],
};

const LANES_PAGE: PagePrompts = {
  intro: "8 lanes with both rates on them. Ask me:",
  prompts: [
    { label: "Where is fleet cheaper?", icon: Scales, kind: "read" },
    { label: "What is the cost of habit?", icon: CurrencyDollar, kind: "read" },
    { label: "Which backhauls expire first?", icon: ClockCounterClockwise, kind: "read" },
    RECENT_ACTIVITY,
  ],
};

const SPEND_PAGE: PagePrompts = {
  intro: "Detention clocks are running now. Ask me:",
  prompts: [
    { label: "What is accruing right now?", icon: ClockCounterClockwise, kind: "read" },
    { label: "Which docks are chronically slow?", icon: Warning, kind: "read" },
    { label: "What can we bill back?", icon: CurrencyDollar, kind: "read" },
    RECENT_ACTIVITY,
  ],
};

const CATALOGUE_PAGE: PagePrompts = {
  intro: "The whole book of what Target sells. Ask me:",
  prompts: [
    { label: "Where is this SKU exposed?", icon: Package, kind: "read" },
    { label: "Which styles are slow movers?", icon: TrendDown, kind: "read" },
    { label: "Compare colourways on a style", icon: Swap, kind: "read" },
    RECENT_ACTIVITY,
  ],
};

/* Glyphs for the shared list, by the read each question runs — the labels come
   from EXEC_ASKS so the panel and the page cannot say different things. */
const EXEC_ASK_ICON: Record<string, ChatPrompt["icon"]> = {
  book: Compass,
  balance: Warning,
  abc: ChartLineUp,
  suppliers: Storefront,
  transport: Truck,
};

const EXECUTIVE_PAGE: PagePrompts = {
  intro: "The month across the whole book. Ask me:",
  /* The same five the command center puts above its measures. They were written
     out again here and had drifted: the panel was still offering questions about
     four tower cards the page no longer has. */
  prompts: [
    ...EXEC_ASKS.map((q) => ({
      label: q.label,
      icon: EXEC_ASK_ICON[q.tower] ?? Compass,
      kind: "read" as const,
    })),
    RECENT_ACTIVITY,
  ],
};

const PAGES: Record<string, PagePrompts> = {
  ...BUYING,
  ...SERVICE,
  "/executive": EXECUTIVE_PAGE,
  "/planning": PLANNING,
  "/planning/parts": PLANNING_POLICY,
  "/planning/products": CATALOGUE_PAGE,
  "/planning/system": PLANNING_CONFIG,
  "/logistics": LOGISTICS,
  "/logistics/loads": LOADS_PAGE,
  "/logistics/fleet": FLEET_PAGE,
  "/logistics/lanes": LANES_PAGE,
  "/logistics/spend": SPEND_PAGE,
};

/** Where a seat lands, for the case where the path matches nothing. */
const HOME: Record<Persona, string> = {
  buyer: "/buying/action-center",
  csr: "/service/action-center",
  planner: "/planning",
  logistics: "/logistics",
  executive: "/executive",
};

/** Prompts for the page you are on. Longest route first, so `/service/orders`
 *  is not swallowed by `/service`. */
export function promptsForPage(persona: Persona, pathname: string): PagePrompts {
  const key = Object.keys(PAGES)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));
  /* The persona is only the tie-breaker for a path no seat owns — which is the
     brief moment before the seat guard redirects. */
  return PAGES[key ?? HOME[persona]];
}

/**
 * The chips when the panel was opened from a queue row rather than the rail.
 * Unchanged and deliberately page-independent: you have just pressed "Contact
 * supplier" on one silent PO, and what the page behind it is about no longer
 * matters.
 */
export const SUBJECT_PROMPTS: ChatPrompt[] = [
  // Kept short: the panel is 380px and the chips sit two to a row, so anything
  // longer than ~16 characters truncates.
  { label: "Request a date", icon: CalendarCheck, kind: "draft" },
  { label: "Delay reason", icon: Question, kind: "draft" },
  { label: "Escalate a level", icon: ArrowBendUpRight, kind: "draft" },
  RECENT_ACTIVITY,
];

/** Every prompt any seat can offer, for the panel's label → prompt lookup. */
export function findPrompt(label: string): ChatPrompt | undefined {
  const all = [...Object.values(PAGES).flatMap((p) => p.prompts), ...SUBJECT_PROMPTS];
  return all.find((p) => p.label === label);
}
