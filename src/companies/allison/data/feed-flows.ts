/**
 * The Action-column flows on the opportunity feed.
 *
 * Every lever runs as a three-step chain inside the Mercer chat: the initial
 * press narrates the setup and lands an outcome tiles-and-CTA card whose CTA
 * fires the next task in the flow. Same panel, no page navigations, no lost
 * context — Ashish's "complete interactive" run.
 *
 *   Index / hedge     Review index      → Draft clause      → Send to counsel
 *   Make vs buy       Model make vs buy → Cost internal     → Commit to make
 *   RFP               Start RFP         → Invite vendors    → Send RFP
 *   Consolidate       Draft consolidation → Rank vendors    → Award to top
 *
 * The last node of each chain is `settled` — no further CTA — because the
 * lever's own record page is where the artifact actually goes. The chat is
 * the run's transcript; the artifact lives beyond it.
 */
import {
  KIND_LABEL,
  band,
  money,
  type Play,
} from "./buying";
import type { AgentIcon, AgentStep, AgentTask, FlowArtifact } from "./agent-actions";
/* The store, because a flow that narrates a step and does not move the record
   leaves the transcript and the table telling different stories. */
import { acceptPlay, advanceFlow } from "@/lib/plays";

/* Which flow a lever runs. The eight PlayKinds collapse to four families —
   the reference's four Action labels. */
type FlowKey = "index-hedge" | "make-vs-buy" | "rfp" | "consolidate";

function flowKeyFor(p: Play): FlowKey {
  if (p.kind === "index-hedge" || p.kind === "index-clause") return "index-hedge";
  if (p.kind === "make-vs-buy") return "make-vs-buy";
  if (p.kind === "rfp" || p.kind === "dual-source" || p.kind === "terms" || p.kind === "tariff")
    return "rfp";
  return "consolidate";
}

interface FlowNode {
  /** Task id suffix, unique per node so each entry is its own transcript row. */
  key: string;
  /** The CTA label the previous outcome uses for this step. Also the task's
   *  own `label` and `ask` verb. */
  label: string;
  icon: AgentIcon;
  /** The line the agent opens with. */
  intro: (p: Play, agent: string) => string;
  /** What the agent actually did — 2 to 3 steps of read-only work. */
  steps: (p: Play, agent: string) => AgentStep[];
  outcome: {
    title: (p: Play) => string;
    lines: (p: Play) => string[];
    tiles?: (p: Play) => NonNullable<AgentTask["outcome"]["tiles"]>;
    artifact?: (p: Play) => FlowArtifact;
    prompts?: (p: Play) => string[];
  };
}

interface Flow {
  icon: AgentIcon;
  /** Ordered nodes — the first is what the Action button fires; each node's
   *  outcome offers the next one, until the last which is settled. */
  nodes: FlowNode[];
}

const line = (label: string, text: string, source: string): AgentStep => ({ label, text, source });

const FLOWS: Record<FlowKey, Flow> = {
  /* ── Index / hedge ────────────────────────────────────────────────── */
  "index-hedge": {
    icon: "flag",
    nodes: [
      {
        key: "review",
        label: "Review index",
        icon: "flag",
        intro: (p) => `On it. ${p.title}.`,
        steps: (p, agent) => [
          line(
            "Read the pricing pattern",
            `${money(p.totalSpend ?? p.addressable)} bought on a flat contract price while the marker moves monthly · we carry last quarter's peak into a falling market.`,
            `Ariba · contract register`,
          ),
          line(
            "Priced the swing against the marker",
            `${p.summary}`,
            `${agent} · index model`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — the hedge is worth ${money(p.recommended)}`,
          lines: (p) => [
            `The marker's movement returned to us as an index clause would have landed ${band(p.savingsLow, p.savingsHigh)} over the four quarters. Next: draft the clause language.`,
          ],
          tiles: (p) => [
            { label: "Total spend", value: money(p.totalSpend ?? p.addressable) },
            { label: "Confidence", value: `${p.confidencePct}%`, tone: "good" },
            { label: "Savings", value: money(p.recommended), tone: "good" },
          ],
          artifact: () => ({
            kind: "mini-chart",
            title: "Benchmark marker · four quarters",
            unit: "$/",
            points: [
              { period: "Q4 25", value: 2180 },
              { period: "Q1 26", value: 2140 },
              { period: "Q2 26", value: 2020 },
              { period: "Q3 26", value: 1980 },
            ],
            note: "Marker down 9% while our contract price held flat — the clause captures that swing.",
          }),
          prompts: () => [
            "What's the collar risk if the marker spikes?",
            "Compare against a fixed-price re-tender",
            "Which supplier accepts an index clause faster?",
          ],
        },
      },
      {
        key: "draft",
        label: "Draft clause",
        icon: "commit",
        intro: (p) => `On it. Drafting the index clause on ${p.id}.`,
        steps: (p, agent) => [
          line(
            "Named the marker",
            `The ${p.subCategory?.toLowerCase() ?? p.category.toLowerCase()} marker tracks a benchmark both suppliers already publish against — it is the anchor a clause can hold.`,
            `${agent} · benchmark index`,
          ),
          line(
            "Set the cadence and the collar",
            `Quarterly reset, ±8% collar so a single spike does not blow the year — matches how the suppliers themselves buy their feedstock.`,
            `${agent} · clause draft`,
          ),
          line(
            "Wrote the language into the two contracts",
            `Redline drops into CT-4118 and CT-4207 at renewal, no other terms move.`,
            `Ariba · contracts CT-4118, CT-4207`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — clause redlined`,
          lines: () => [
            `Quarterly reset against the published marker, ±8% collar, effective at renewal. Legal has the draft. Next: send it to counsel for sign-off.`,
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "DRAFT · index clause",
            title: `${p.id} · Price adjustment · Section 4.3`,
            body: [
              `Contract price shall reset each calendar quarter against the published ${p.subCategory?.toLowerCase() ?? p.category.toLowerCase()} benchmark marker, as of the last business day of the preceding quarter.`,
              `Reset is subject to a symmetric collar of ±8% off the prior quarter's price; movements beyond the collar are held for the next reset window.`,
              `Clause supersedes Section 4.1 (annual renegotiation) at renewal; all other commercial terms remain unchanged.`,
            ],
          }),
          prompts: () => [
            "Widen the collar to ±10%?",
            "Draft the finance approval memo",
            "Which contracts renew first?",
          ],
        },
      },
      {
        key: "counsel",
        label: "Send to counsel",
        icon: "send",
        intro: (p) => `On it. Handing the ${p.id} clause to counsel.`,
        steps: (p, agent) => [
          line(
            "Packaged the redline for counsel",
            `Two contracts, one clause, marker methodology attached · counsel needs one review across both.`,
            `${agent} · handoff`,
          ),
          line(
            "Queued the two renewals",
            `Renewals fire on their existing dates — clause lands with them, no separate cycle.`,
            `Ariba · renewals calendar`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — with counsel`,
          lines: () => [
            `Counsel has the redline. The renewal calendar will pick it up on its next fire. Nothing else moves until counsel comes back.`,
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "EMAIL · sent",
            title: "Redline for review · CT-4118 & CT-4207",
            fields: [
              { label: "To", value: "counsel@fossil.com" },
              { label: "Cc", value: "finance@fossil.com" },
              { label: "Subject", value: `${p.id} · Index-linked price clause · renewals` },
            ],
            body: [
              `Redline attached. One clause across both contracts — quarterly reset against the published marker with a ±8% collar, effective at renewal.`,
              `Renewal dates on file are unchanged. Please flag any language you'd like tightened before it goes out.`,
              `— Marcus`,
            ],
          }),
          prompts: () => [
            "Track counsel's turnaround",
            "What if counsel wants a floor instead of a collar?",
            "Draft the supplier-facing summary",
          ],
        },
      },
    ],
  },

  /* ── Make vs buy ──────────────────────────────────────────────────── */
  "make-vs-buy": {
    icon: "commit",
    nodes: [
      {
        key: "model",
        label: "Model make vs buy",
        icon: "commit",
        intro: (p) => `On it. Costing internal production on ${p.title}.`,
        steps: (p, agent) => [
          line(
            "Read the incumbent quote",
            `${money(p.totalSpend ?? p.addressable)} on the standing external quote · single supplier.`,
            `Ariba · standing quote`,
          ),
          line(
            "Read the plant's headroom",
            `Indy Central Stores polymer line has second-shift capacity across the addressable volume, feedstock already contracted.`,
            `Plant schedule · capacity survey`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — the make case is worth ${money(p.recommended)}`,
          lines: (p) => [
            `Internal polymerisation lands ${money(p.recommended)} against the incumbent quote at ${p.confidencePct}% confidence. Next: cost internal production line by line.`,
          ],
          tiles: (p) => [
            { label: "External quote", value: money(p.totalSpend ?? p.addressable) },
            { label: "Confidence", value: `${p.confidencePct}%`, tone: "good" },
            { label: "Make savings", value: money(p.recommended), tone: "good" },
          ],
          artifact: () => ({
            kind: "compare",
            title: "External buy vs internal make · $/MT",
            aLabel: "Buy",
            bLabel: "Make",
            rows: [
              { label: "Feedstock", a: "$1,940", b: "$1,860", delta: "−$80", tone: "good" },
              { label: "Conversion", a: "$720", b: "$540", delta: "−$180", tone: "good" },
              { label: "Overhead", a: "$210", b: "$260", delta: "+$50", tone: "behind" },
              { label: "Fully loaded", a: "$2,870", b: "$2,660", delta: "−$210", tone: "good" },
            ],
          }),
          prompts: () => [
            "Sensitivity if benzene moves 10%?",
            "What's Indy Central Stores's utilisation ceiling?",
            "Model a 12-month phase-in",
          ],
        },
      },
      {
        key: "cost",
        label: "Cost internal production",
        icon: "commit",
        intro: () => `On it. Costing the internal line.`,
        steps: (_p, agent) => [
          line(
            "Priced feedstock at the hedged marker",
            `Caprolactam sits on the hedge that landed OPP-001 · the make case reads at the hedged number, not spot.`,
            `${agent} · feedstock`,
          ),
          line(
            "Priced conversion at second-shift rate",
            `Second-shift labour, energy at the negotiated rate — no capex, this is idle capacity being lit.`,
            `${agent} · conversion model`,
          ),
          line(
            "Rolled the fully-loaded cost against the quote",
            `Delta held at 6.1% under the standing quote across the addressable volume.`,
            `${agent} · make-vs-buy model`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — make holds at 6.1% under`,
          lines: () => [
            `The make case survives feedstock and conversion at plant rates. Next: commit to make on the addressable share.`,
          ],
          artifact: () => ({
            kind: "compare",
            title: "Fully-loaded cost · sensitivity",
            aLabel: "Base",
            bLabel: "Stressed",
            rows: [
              { label: "Feedstock @ hedged marker", a: "$1,860", b: "$1,930", delta: "+$70" },
              { label: "Second-shift labour", a: "$310", b: "$310" },
              { label: "Energy @ negotiated rate", a: "$230", b: "$260", delta: "+$30" },
              { label: "Total make · $/MT", a: "$2,660", b: "$2,760", delta: "+$100", tone: "behind" },
              { label: "Δ vs buy quote", a: "−$210", b: "−$110", tone: "good" },
            ],
          }),
          prompts: () => [
            "What breaks the case?",
            "Draft the plant capacity commitment",
            "Compare against a 2-year buy contract",
          ],
        },
      },
      {
        key: "commit",
        label: "Commit to make",
        icon: "commit",
        intro: () => `On it. Committing the make case.`,
        steps: (p, agent) => [
          line(
            "Wrote the sourcing rule",
            `Indy Central Stores line named as the primary source for the addressable ${money(p.addressable)} at second-shift rate.`,
            `SAP ECC · sourcing rules`,
          ),
          line(
            "Left the incumbent on the tail",
            `The remainder stays on the external quote as a backup — the case is a shift, not a break.`,
            `${agent} · handover`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — make committed`,
          lines: (p) => [
            `Indy Central Stores is the primary line on ${money(p.addressable)} of demand. The realized figure will show up on Value realization once the ERP posts the first quarter.`,
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "SOURCING RULE · written",
            title: `${p.id} · Primary source · Indy Central Stores`,
            fields: [
              { label: "Category", value: p.subCategory ?? p.category },
              { label: "Volume", value: `${money(p.addressable)} annualised` },
              { label: "Effective", value: "Next PO cycle" },
              { label: "Backup", value: "Incumbent external supplier · unchanged terms" },
            ],
            body: [
              `Indy Central Stores polymer line is the primary source for the addressable volume, priced at fully-loaded second-shift cost.`,
              `Incumbent external supplier retained as a named backup on the tail — no volume commitment, no minimum draw.`,
              `Rule fires on the next PO cycle. Realised savings begin reporting once the ERP posts the first quarter's actuals.`,
            ],
          }),
          prompts: () => [
            "Track the first quarter's actuals",
            "What if Indy Central Stores utilisation shifts?",
            "Draft the change note to the plant",
          ],
        },
      },
    ],
  },

  /* ── RFP ──────────────────────────────────────────────────────────── */
  rfp: {
    icon: "send",
    nodes: [
      {
        key: "scope",
        label: "Start RFP",
        icon: "send",
        intro: (p) => `On it. Setting the RFP scope for ${p.title}.`,
        steps: (p, agent) => [
          line(
            "Read the category",
            `${money(p.totalSpend ?? p.addressable)} spend, ${p.vendorCount ?? p.supplierIds.length} vendors on file — ${money(p.addressable)} of it can move without requalifying the line.`,
            `SAP ECC · spend cube`,
          ),
          line(
            "Wrote the RFP scope",
            `${p.summary}`,
            `${agent} · RFP scope`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — RFP scope ready`,
          lines: (p) => [
            `Scope covers the addressable ${money(p.addressable)} at the current spec, band ${band(p.savingsLow, p.savingsHigh)}. Next: invite the qualified vendors.`,
          ],
          tiles: (p) => [
            { label: "Total spend", value: money(p.totalSpend ?? p.addressable) },
            { label: "Addressable", value: money(p.addressable) },
            { label: "Savings", value: money(p.recommended), tone: "good" },
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "DRAFT · RFP scope",
            title: `${p.id} · Request for proposal · ${p.title}`,
            fields: [
              { label: "Category", value: p.subCategory ?? p.category },
              { label: "Volume", value: `${money(p.addressable)} annualised` },
              { label: "Spec", value: "Current bill of materials · no change" },
              { label: "Delivery", value: "Weekly · FCL, DDP Cline Tool & Service Co" },
              { label: "Response due", value: "Two weeks from send" },
            ],
            body: [
              `Line items align to the current spec sheet — no substitution, no requalification burden on our side. Vendors quote at their standard commercial terms.`,
              `Evaluation runs on landed cost, delivery reliability across the last four quarters, and terms; commercial score published on award.`,
            ],
          }),
          prompts: () => [
            "Include a volume tier?",
            "What's the walk-away price?",
            "Add sustainability weight?",
          ],
        },
      },
      {
        key: "invite",
        label: "Invite vendors",
        icon: "email",
        intro: () => `On it. Inviting the qualified field.`,
        steps: (_p, agent) => [
          line(
            "Screened the field",
            `Kept the vendors carrying the required certification and the right MFI grade — three on the short list, two on the alternates.`,
            `Supplier master · capability matrix`,
          ),
          line(
            "Drafted the invite",
            `One package: spec, volume, delivery window, response due in two weeks. The alternates get the same package on request.`,
            `${agent} · RFP invite`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — invite drafted`,
          lines: () => [
            `Three vendors on the short list, two alternates ready. Next: send the RFP.`,
          ],
          artifact: () => ({
            kind: "ranked",
            title: "Shortlist · qualified field",
            columns: ["Vendor", "Country", "Cert.", "OTIF", "Status"],
            rows: [
              { cells: ["Aalborg Core Films", "DK", "GRS", "94%", "Short list"], leader: true },
              { cells: ["Rotterdam Polymer", "NL", "GRS · REACH", "92%", "Short list"] },
              { cells: ["Zhejiang Yuanda", "CN", "REACH", "91%", "Short list"] },
              { cells: ["Bac Ninh Composite", "VN", "REACH", "89%", "Alternate"] },
              { cells: ["Haiphong Resilient", "VN", "REACH", "87%", "Alternate"] },
            ],
            footnote: "Short list gets the invite; alternates receive the pack on request.",
          }),
          prompts: () => [
            "Swap Zhejiang for a US alternate?",
            "Draft the invite email",
            "What's the risk of a three-way tie?",
          ],
        },
      },
      {
        key: "send",
        label: "Send RFP",
        icon: "send",
        intro: () => `On it. Sending the RFP.`,
        steps: (_p, agent) => [
          line(
            "Sent the package to the short list",
            `All three received the invite with the same spec pack; return by the response date logs to Ariba automatically.`,
            `${agent} · Ariba send`,
          ),
          line(
            "Logged the follow-up cadence",
            `Reminder in seven days, escalation to category the day after due — no vendor drops through the gap.`,
            `Ariba · RFP schedule`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — RFP in the field`,
          lines: () => [
            `The three named vendors have the RFP. Responses come back to Ariba on the due date; nothing else needs pressing until then.`,
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "EMAIL · sent to short list",
            title: `${p.id} · RFP · ${p.title}`,
            fields: [
              { label: "To", value: "3 vendors · short list" },
              { label: "Cc", value: "sourcing@fossil.com · sap@fossil.com" },
              { label: "Subject", value: `${p.title} · request for proposal` },
              { label: "Due", value: "Two weeks from send" },
            ],
            body: [
              `Please find attached the RFP package for ${p.title}, covering ${money(p.addressable)} of annualised volume against the enclosed spec.`,
              `Responses due within two weeks. Award follows on landed cost, delivery reliability and terms — evaluation methodology is in the pack.`,
              `Reminders will fire at seven days and one day out; contact category for any clarifications.`,
              `— Marcus`,
            ],
          }),
          prompts: () => [
            "Set a reminder for the due date",
            "What's the fastest path to award?",
            "Draft the internal award memo",
          ],
        },
      },
    ],
  },

  /* ── Consolidate ──────────────────────────────────────────────────── */
  consolidate: {
    icon: "commit",
    nodes: [
      {
        key: "draft",
        label: "Draft consolidation",
        icon: "commit",
        intro: (p) => `On it. Drafting the consolidation case on ${p.title}.`,
        steps: (p, agent) => [
          line(
            "Read the split",
            `${p.vendorCount ?? p.supplierIds.length} vendors on the category · none holding a tier because none holds enough volume.`,
            `SAP ECC · spend cube`,
          ),
          line(
            "Named the two strongest",
            `${p.summary}`,
            `${agent} · benchmark model`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — case drafted for ${money(p.recommended)}`,
          lines: (p) => [
            `Consolidating the addressable ${money(p.addressable)} onto the top two lands a volume tier neither has today. Next: rank them.`,
          ],
          tiles: (p) => [
            { label: "Total spend", value: money(p.totalSpend ?? p.addressable) },
            { label: "Vendors", value: String(p.vendorCount ?? p.supplierIds.length) },
            { label: "Savings", value: money(p.recommended), tone: "good" },
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "DRAFT · consolidation case",
            title: `${p.id} · Consolidate onto top two`,
            body: [
              `Category runs across ${p.vendorCount ?? p.supplierIds.length} vendors, none holding a tier because none holds enough volume — the split is the cost.`,
              `Moving the addressable ${money(p.addressable)} onto the two strongest reaches a volume threshold the incumbent field cannot access today, at the current spec.`,
              `Estimated savings ${money(p.recommended)} at ${p.confidencePct}% confidence, band ${band(p.savingsLow, p.savingsHigh)}. No requalification cost.`,
            ],
          }),
          prompts: () => [
            "What's the risk of single-sourcing here?",
            "Model a three-vendor split instead",
            "Which vendor drops out cleanly?",
          ],
        },
      },
      {
        key: "rank",
        label: "Rank vendors",
        icon: "commit",
        intro: () => `On it. Ranking the field.`,
        steps: (_p, agent) => [
          line(
            "Scored on landed cost",
            `Top holder is 3.6% under the field average on landed cost across the last four quarters.`,
            `${agent} · landed-cost model`,
          ),
          line(
            "Scored on delivery reliability",
            `The two candidates both hold OTIF above 92% · neither is the delivery risk on this category.`,
            `Supplier feed · OTIF`,
          ),
          line(
            "Wrote the composite ranking",
            `Composite puts the top holder first by 6 points; the second slot is closer, at 3 points.`,
            `${agent} · scorecard`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — shortlist ranked`,
          lines: () => [
            `Top vendor by 6 points on the composite. Next: award the addressable volume to the top of the shortlist.`,
          ],
          artifact: () => ({
            kind: "ranked",
            title: "Composite ranking · landed cost + OTIF + terms",
            columns: ["Rank", "Vendor", "Landed", "OTIF", "Composite"],
            rows: [
              { cells: ["1", "Rotterdam Polymer", "−3.6%", "94%", "87"], leader: true },
              { cells: ["2", "Aalborg Core Films", "−2.1%", "94%", "81"] },
              { cells: ["3", "Bac Ninh Composite", "+0.4%", "89%", "72"] },
              { cells: ["4", "Haiphong Resilient", "+1.2%", "87%", "68"] },
            ],
            footnote: "Weights: landed cost 50% · OTIF 30% · terms 20%.",
          }),
          prompts: () => [
            "What breaks the top vendor's score?",
            "Award-and-alternate strategy",
            "Draft the award letter",
          ],
        },
      },
      {
        key: "award",
        label: "Award to top",
        icon: "commit",
        intro: () => `On it. Awarding the volume.`,
        steps: (p, _agent) => [
          line(
            "Wrote the sourcing rule",
            `Addressable ${money(p.addressable)} routes to the top of the shortlist at the tier price.`,
            `SAP ECC · sourcing rules`,
          ),
          line(
            "Held the alternates on the record",
            `The other vendors stay on file as backup — the record does not lose names it may need again.`,
            `Supplier master`,
          ),
        ],
        outcome: {
          title: (p) => `${p.id} — awarded`,
          lines: (p) => [
            `Top vendor holds the addressable ${money(p.addressable)}. The tier price fires on the next PO cycle · realized value will show on Value realization once the ERP posts it.`,
          ],
          artifact: (p) => ({
            kind: "doc",
            kicker: "SOURCING RULE · written",
            title: `${p.id} · Award · top of the shortlist`,
            fields: [
              { label: "Category", value: p.subCategory ?? p.category },
              { label: "Volume", value: `${money(p.addressable)} annualised` },
              { label: "Tier price", value: "Applies on the next PO cycle" },
              { label: "Alternates", value: "Held on file · no volume commitment" },
            ],
            body: [
              `Rotterdam Polymer holds the addressable volume at the negotiated tier price, effective the next PO cycle.`,
              `The remaining vendors stay on file as alternates — no minimum draw, no exit cost — so the record does not lose names it may need again.`,
              `Realised value begins reporting on Value realization once the ERP posts the first quarter's actuals.`,
            ],
          }),
          prompts: () => [
            "Track the first quarter's actuals",
            "Notify the alternates cleanly",
            "Draft the internal announcement",
          ],
        },
      },
    ],
  },
};

/**
 * Build the task for one node in a lever's chain. The outcome's `action`
 * fires the next node; the last node has no action and ends settled.
 *
 * `startTask` is threaded through so a node's own outcome can spawn the
 * next one inside the same chat.
 */
function taskForNode(
  p: Play,
  agent: string,
  flowKey: FlowKey,
  nodeIdx: number,
  startTask: (t: AgentTask) => void,
): AgentTask {
  const flow = FLOWS[flowKey];
  const node = flow.nodes[nodeIdx];
  const next = flow.nodes[nodeIdx + 1];
  const steps = node.steps(p, agent);
  return {
    id: `${p.id}-${node.key}`,
    /* The row catches up as each step lands: still in the feed while there is
       more chain to run, into Act once there is not. The last node IS the
       decision — a lever whose clauses are drafted or whose award is
       recommended has been taken on, and leaving it in the feed would ask the
       buyer to accept something they have already done. */
    onLanded: next ? () => advanceFlow(p, nodeIdx + 1) : () => acceptPlay(p),
    label: node.label,
    ask: `${node.label} on ${p.id}`,
    intro: node.intro(p, agent),
    icon: node.icon,
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: node.outcome.title(p),
      lines: node.outcome.lines(p),
      tiles: node.outcome.tiles?.(p),
      artifact: node.outcome.artifact?.(p),
      prompts: node.outcome.prompts?.(p),
      /* The chain: the outcome's CTA fires the next node in the same chat.
         Last node has nothing to fire, so the chain ends here. */
      action: next
        ? {
            label: next.label,
            onAction: () => startTask(taskForNode(p, agent, flowKey, nodeIdx + 1, startTask)),
          }
        : undefined,
    },
  };
}

/**
 * The Action-column entry point — starts a play's lever flow at the first
 * node. Every follow-on step lives inside the same chat, driven by the
 * outcome CTA on each card.
 */
export function feedFlowTaskFor(
  p: Play,
  agent: string,
  startTask: (t: AgentTask) => void,
): AgentTask {
  /* Resumes where the play got to rather than restarting the chain. */
  return taskForNode(p, agent, flowKeyFor(p), stepOf(p), startTask);
}

/** Which node the play is on, clamped so a stale step cannot read past the end. */
function stepOf(p: Play): number {
  const n = FLOWS[flowKeyFor(p)].nodes.length;
  return Math.min(Math.max(p.flowStep ?? 0, 0), n - 1);
}

/** The label the row-level Action button carries — the step it is up to. */
export function feedActionLabelFor(p: Play): string {
  return FLOWS[flowKeyFor(p)].nodes[stepOf(p)].label;
}
