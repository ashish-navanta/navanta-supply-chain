/**
 * Christy's runs on the service seat's book screens.
 *
 * The action center already hands the CSR a task per queue row via
 * `agentTaskFor`. These are the same idea for the three book screens that
 * had no agent surface at all: the order book, the claim book, and the
 * account book. Each row gets one move, named for what it actually does, and
 * the run lands an artifact — a re-promise note, an adjudication, a
 * service-recovery letter — rather than a sentence about one.
 */
import type { AgentTask, FlowArtifact } from "@/data/agent-actions";
import type { Account, ServiceClaim, ServiceOrder } from "@/data/service";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

/* ── Orders ───────────────────────────────────────────────────────────── */

/**
 * One order's move, read off its own health.
 *
 *   at-risk / late  → re-promise the date (and say what it does to the crew)
 *   clean           → confirm the delivery window
 *   delivered       → close the file
 */
export function orderTaskFor(o: ServiceOrder, agent: string): AgentTask {
  const slipped = o.currentEta !== o.promisedOn;
  const label = o.deliveredOn
    ? "Close the file"
    : slipped
    ? `Re-promise ${o.currentEta}`
    : "Confirm the window";

  const steps = [
    {
      label: "Read the order",
      text:
        `${o.id} · ${o.account} · ${o.style}. ${o.units} units, ${usd(o.value)}, ` +
        `on ${o.carrier} down the ${o.lane} lane.`,
      source: `SAP ECC · ${o.id}`,
    },
    {
      label: slipped ? "Read what moved" : "Checked the promise still holds",
      text: slipped
        ? `Promised ${o.promisedOn}, the record now believes ${o.currentEta}.` +
          (o.crewBooked && o.installOn
            ? ` A crew is booked for ${o.installOn} and cannot be moved — that is what the slip actually breaks.`
            : " No crew is booked against it, so the slip costs a conversation, not a re-book.")
        : `Promise and current ETA agree at ${o.currentEta}. ${o.etas.length} feeds reporting, none in conflict.`,
      source: `Carrier feed · ${o.proNumber ?? o.carrier}`,
    },
    {
      label: o.deliveredOn ? "Read the receipt" : `Drafted the ${slipped ? "re-promise" : "confirmation"}`,
      text: o.deliveredOn
        ? `Delivered ${o.deliveredOn} against receipt ${o.receipt}. ${
            o.shortPallets ? `${o.shortPallets} units short or damaged — a claim is open against it.` : "Clean delivery, nothing outstanding."
          }`
        : `A note to ${o.account}, in their own dates, ready to send under your name.`,
      source: `${agent} · draft`,
    },
  ];

  const artifact: FlowArtifact = o.deliveredOn
    ? {
        kind: "doc",
        kicker: "RECEIPT · on file",
        title: `${o.id} · delivered ${o.deliveredOn}`,
        fields: [
          { label: "Receipt", value: o.receipt ?? "—" },
          { label: "Account", value: o.account },
          { label: "Units", value: String(o.units) },
        ],
        body: [
          o.shortPallets
            ? `${o.shortPallets} units short or damaged on arrival. A claim is open against this receipt.`
            : `Clean delivery. Nothing outstanding on this order.`,
        ],
      }
    : {
        kind: "doc",
        kicker: slipped ? "DRAFT · re-promise" : "DRAFT · window confirmation",
        title: `${o.id} · ${o.account}`,
        fields: [
          { label: "To", value: o.account },
          { label: "Subject", value: slipped ? `${o.id} · revised delivery date` : `${o.id} · delivery confirmed` },
        ],
        body: slipped
          ? [
              `Your order ${o.id} was promised ${o.promisedOn}. The carrier now has it landing ${o.currentEta}.`,
              o.crewBooked && o.installOn
                ? `We know a crew is booked for ${o.installOn}. Tell us whether to hold the date and split the shipment, or move the floor-set — we will carry the re-book either way.`
                : `Nothing else on the order changes. Let us know if the new date creates a problem at your end.`,
            ]
          : [
              `Your order ${o.id} is on track to land ${o.currentEta}, as promised.`,
              `${o.units} units on ${o.carrier}. We will confirm again the day before delivery.`,
            ],
      };

  return {
    id: `${o.id}-order`,
    label,
    ask: `${label} on ${o.id}`,
    intro: `On it. ${o.id} for ${o.account}.`,
    icon: slipped ? "send" : "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${o.id} — ${label.toLowerCase()}`,
      lines: [
        slipped && !o.deliveredOn
          ? `The note is drafted in the account's own dates. Sending it opens the re-book conversation.`
          : o.deliveredOn
          ? `The file is complete. Nothing is waiting on you.`
          : `The window is confirmed and the account has the date in writing.`,
      ],
      tiles: [
        { label: "Value", value: usd(o.value) },
        { label: "Promised", value: o.promisedOn },
        {
          label: "Now",
          value: o.currentEta,
          tone: slipped ? "behind" : "good",
        },
      ],
      artifact,
      prompts: slipped
        ? [
            "What does the slip cost the account?",
            "Can we split the shipment to hold the floor-set?",
            "Who else is on this carrier this week?",
          ]
        : [
            "Which orders are closest to slipping?",
            "How is this account's on-time rate?",
            "Draft the day-before confirmation",
          ],
    },
  };
}

/* ── Claims ───────────────────────────────────────────────────────────── */

/**
 * A claim's move depends on whether it has a number yet.
 *
 *   un-adjudicated → adjudicate from the order and the receipt
 *   adjudicated    → approve the credit (or flag it over the cap)
 */
export function claimTaskFor(c: ServiceClaim, agent: string): AgentTask {
  const decided = c.adjudicated !== null;
  const credit = c.adjudicated ?? c.requested;
  const overCap = credit > c.policyCap;
  const label = decided ? `Approve ${usd(credit)}` : "Adjudicate";

  const steps = [
    {
      label: "Read the claim",
      text:
        `${c.id} · ${c.account} · ${c.kind}. ${c.units} units against receipt ${c.receipt}, ` +
        `batch ${c.batch}. Opened ${c.openedOn}.`,
      source: `Claim file · ${c.id}`,
    },
    {
      label: "Checked the evidence",
      text:
        `${c.photos} photos on file, receipt ${c.receipt} matched to order ${c.orderId}.` +
        (c.rootCause ? ` Root cause recorded as ${c.rootCause}.` : " Root cause not yet established."),
      source: `Evidence · ${c.orderId}`,
    },
    {
      label: decided ? "Read the adjudication" : "Adjudicated from the record",
      text: decided
        ? `Adjudicated at ${usd(credit)} against ${usd(c.requested)} asked.` +
          (overCap
            ? ` That is over the ${usd(c.policyCap)} policy cap — it needs a second signature.`
            : ` Inside the ${usd(c.policyCap)} policy cap, so your signature closes it.`)
        : `${usd(c.requested)} asked. Priced off the order lines and the receipt, the defensible figure is ${usd(credit)}.`,
      source: `${agent} · adjudication`,
    },
  ];

  return {
    id: `${c.id}-claim`,
    label,
    ask: `${label} on ${c.id}`,
    intro: `On it. ${c.id} from ${c.account}.`,
    icon: "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${c.id} — ${decided ? "ready to approve" : "adjudicated"}`,
      lines: [
        overCap
          ? `${usd(credit)} sits over the ${usd(c.policyCap)} cap. Approving it raises the second signature rather than closing the claim.`
          : `${usd(credit)} is inside policy. Approving it credits the account and closes the file.`,
      ],
      tiles: [
        { label: "Asked", value: usd(c.requested) },
        { label: "Adjudicated", value: usd(credit), tone: credit < c.requested ? "behind" : "good" },
        { label: "Policy cap", value: usd(c.policyCap), tone: overCap ? "behind" : "quiet" },
      ],
      artifact: {
        kind: "compare",
        title: `Asked vs adjudicated · ${c.id}`,
        aLabel: "Asked",
        bLabel: "Adjudicated",
        rows: [
          {
            label: `${c.kind} · ${c.units} units`,
            a: usd(c.requested),
            b: usd(credit),
            delta: credit === c.requested ? "—" : `−${usd(c.requested - credit)}`,
            tone: credit === c.requested ? undefined : "behind",
          },
          {
            label: "Against policy cap",
            a: usd(c.policyCap),
            b: usd(credit),
            delta: overCap ? "over" : "within",
            tone: overCap ? "behind" : "good",
          },
        ],
      },
      prompts: [
        "Why was it cut from the asked figure?",
        `Other claims against batch ${c.batch}?`,
        overCap ? "Who signs above the cap?" : "Can we recover this from the carrier?",
      ],
    },
  };
}

/* ── Accounts ──────────────────────────────────────────────────────────── */

/**
 * The account book had no agent surface at all. The move here is a read of
 * the relationship that ends in a drafted note — the thing a CSR would
 * write after seeing a claim rate climb.
 */
export function dealerTaskFor(d: Account, agent: string): AgentTask {
  const struggling = d.onTimePct < 90 || d.claimRate > 2;
  const label = struggling ? "Draft service recovery" : "Review the account";

  const steps = [
    {
      label: "Read the account",
      text:
        `${d.name} · ${d.city}, ${d.state}. ${d.segment} segment, ${d.tier} tier, with us since ${d.since}. ` +
        `${usd(d.ytdRevenue)} year to date on ${d.paymentTerms}.`,
      source: `Account master · ${d.id}`,
    },
    {
      label: "Read how we serve them",
      text:
        `${d.onTimePct}% delivered on the promise over twelve months, ${d.claimRate} claims per hundred orders.` +
        (struggling
          ? " Both sit outside where this tier should be — the account is being served worse than it is worth."
          : " Both hold where this tier should be."),
      source: "Service scorecard · 12 months",
    },
    {
      label: struggling ? "Drafted the recovery note" : "Summarised the account",
      text: struggling
        ? `A note that names the misses, says what we are changing, and asks for the meeting — signed by you, not by support.`
        : `${d.note}`,
      source: `${agent} · ${struggling ? "recovery draft" : "account read"}`,
    },
  ];

  return {
    id: `${d.id}-account`,
    label,
    ask: `${label} on ${d.name}`,
    intro: `On it. ${d.name}.`,
    icon: struggling ? "send" : "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${d.name} — ${struggling ? "recovery drafted" : "account reviewed"}`,
      lines: [
        struggling
          ? `The note names the misses without excusing them. Sending it puts the meeting on the calendar.`
          : `The account is being served where its tier expects. Nothing needs a move today.`,
      ],
      tiles: [
        { label: "YTD revenue", value: usd(d.ytdRevenue) },
        { label: "On time", value: `${d.onTimePct}%`, tone: d.onTimePct >= 90 ? "good" : "behind" },
        { label: "Claim rate", value: `${d.claimRate}/100`, tone: d.claimRate <= 2 ? "good" : "behind" },
      ],
      artifact: struggling
        ? {
            kind: "doc",
            kicker: "DRAFT · service recovery",
            title: `${d.name} · where we have fallen short`,
            fields: [
              { label: "To", value: d.name },
              { label: "Segment", value: `${d.segment} · ${d.tier}` },
            ],
            body: [
              `Over the last twelve months we delivered ${d.onTimePct}% of your orders on the date we promised, and you raised ${d.claimRate} claims per hundred orders. For an account of your standing, neither figure is good enough.`,
              `We are putting your orders on the earlier carrier cut-off and holding safety stock on your two fastest styles. You should feel the difference inside a quarter.`,
              `I would like thirty minutes to walk you through it. — Christy`,
            ],
          }
        : {
            kind: "ranked",
            title: "How we serve them · against tier",
            columns: ["Measure", "This account", "Tier expects"],
            rows: [
              { cells: ["On-time delivery", `${d.onTimePct}%`, "90%"], leader: d.onTimePct >= 90 },
              { cells: ["Claims per 100", String(d.claimRate), "2.0"], leader: d.claimRate <= 2 },
              { cells: ["Payment terms", d.paymentTerms, d.paymentTerms] },
            ],
          },
      prompts: [
        "What is driving the claim rate?",
        "Which orders slipped for this account?",
        struggling ? "Escalate to the factory?" : "Are they a growth candidate?",
      ],
    },
  };
}
