/**
 * Iris's runs on the planner's book screens.
 *
 * Inventory Planning carried three buttons — Approve, Ask Iris, Override —
 * that all did the same thing: open the panel with a subject and no verb.
 * Three controls indistinguishable in effect is worse than one, so each
 * now runs its own task and says what it changed.
 *
 * The catalogue had no agent surface at all; a SKU's run sweeps the
 * positions and names where it is actually exposed.
 */
import type { AgentTask, FlowArtifact } from "@/data/agent-actions";
import type { Exception, SkuPolicyRow } from "@/data/planning";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`;

/** What the buyer pressed on an exception row. */
export type ExceptionIntent = "approve" | "explain" | "override";

/**
 * One exception's move. The row already carries `recommendedAction` — the
 * verb phrase IRIS wrote — so the task narrates the case behind it rather
 * than inventing a second recommendation.
 */
export function exceptionTaskFor(
  e: Exception,
  agent: string,
  intent: ExceptionIntent,
): AgentTask {
  const short = e.onHand + e.incoming < e.safetyStock;
  const cover = e.demandMean > 0 ? Math.round((e.onHand + e.incoming) / e.demandMean) : 0;
  const label =
    intent === "approve"
      ? `Approve ${e.requestedQty}`
      : intent === "override"
      ? "Override the level"
      : "Explain this line";

  const readSteps = [
    {
      label: "Read the position",
      text:
        `${e.sku} at ${e.branch} · ${e.description}. ${e.onHand} on hand, ${e.incoming} incoming, ` +
        `against a ${e.safetyStock} safety stock and ${e.demandMean}/period demand — about ${cover} periods of cover.`,
      source: `WMS · ${e.key}`,
    },
    {
      label: "Read the classification",
      text:
        `${e.classification} on ${e.adi.toFixed(1)} ADI and ${e.cv2.toFixed(2)} CV² — ` +
        `system policy is ${e.systemPolicy}${e.overridden ? `, currently overridden to ${e.currentPolicy} by ${e.overriddenBy ?? "a planner"}` : ", in force as written"}.`,
      source: "Segmentation · ABC × XYZ",
    },
    {
      label: "Sized the exposure",
      text:
        `${usd(e.dollarsAtRisk)} at risk on this position at ${Math.round(e.fillRate * 100)}% fill. ` +
        `${e.reason}`,
      source: `${agent} · exposure model · ${Math.round(e.confidence * 100)}% confidence`,
    },
  ];

  const artifact: FlowArtifact = {
    kind: "compare",
    title: `${e.sku} at ${e.branch} · position`,
    aLabel: "Today",
    bLabel: intent === "approve" ? "After" : "Policy says",
    rows: [
      {
        label: "On hand + incoming",
        a: String(e.onHand + e.incoming),
        b: String(e.onHand + e.incoming + (intent === "approve" ? e.requestedQty : 0)),
        delta: intent === "approve" ? `+${e.requestedQty}` : "—",
        tone: intent === "approve" ? "good" : undefined,
      },
      {
        label: "Against safety stock",
        a: String(e.safetyStock),
        b: String(e.safetyStock),
        delta: short ? "short" : "covered",
        tone: short ? "behind" : "good",
      },
      {
        label: "Periods of cover",
        a: String(cover),
        b: String(
          e.demandMean > 0
            ? Math.round((e.onHand + e.incoming + (intent === "approve" ? e.requestedQty : 0)) / e.demandMean)
            : cover,
        ),
        tone: cover < 2 ? "behind" : "good",
      },
      {
        label: "Exposure",
        a: usd(e.dollarsAtRisk),
        b: intent === "approve" ? usd(0) : usd(e.dollarsAtRisk),
        delta: intent === "approve" ? `−${usd(e.dollarsAtRisk)}` : "—",
        tone: intent === "approve" ? "good" : "behind",
      },
    ],
  };

  const outcomeByIntent = {
    approve: {
      title: `${e.sku} — ${e.requestedQty} approved`,
      line: `${e.recommendedAction}. The requisition is raised against ${e.vendor} and the exposure closes when it lands.`,
    },
    override: {
      title: `${e.sku} — override drafted`,
      line: `Policy says ${e.systemPolicy}. An override holds a different level and needs a reason on the record — that reason is what the next planner reads.`,
    },
    explain: {
      title: `${e.sku} — why this line is here`,
      line: `${e.reason} Nothing has been changed; this is the read behind the recommendation.`,
    },
  }[intent];

  return {
    id: `${e.key}-${intent}`,
    label,
    ask: `${label} on ${e.sku} at ${e.branch}`,
    intro: `On it. ${e.sku} at ${e.branch}.`,
    icon: intent === "approve" ? "commit" : intent === "override" ? "flag" : "call",
    actAt: readSteps.length,
    steps: readSteps,
    outcome: {
      kind: "settled",
      title: outcomeByIntent.title,
      lines: [outcomeByIntent.line],
      tiles: [
        { label: "Requested", value: String(e.requestedQty) },
        { label: "At risk", value: usd(e.dollarsAtRisk), tone: short ? "behind" : "quiet" },
        {
          label: "Fill rate",
          value: `${Math.round(e.fillRate * 100)}%`,
          tone: e.fillRate >= 0.95 ? "good" : "behind",
        },
      ],
      artifact,
      prompts: [
        "What happens if we do nothing?",
        `Is ${e.branch} the right node to hold this?`,
        intent === "approve" ? "Can another branch cover it instead?" : "What would the system do here?",
      ],
    },
  };
}

/* ── Catalogue ────────────────────────────────────────────────────────── */

/**
 * A SKU's run on the catalogue: sweep every position and name the node
 * that is actually exposed. The catalogue lists what Target sells; this
 * answers the only question a planner asks of it.
 */
export function skuTaskFor(
  sku: string,
  description: string,
  positions: SkuPolicyRow[],
  agent: string,
): AgentTask {
  const total = positions.reduce((s, p) => s + p.onHand + p.incoming, 0);
  const exposed = [...positions].sort((a, b) => b.dollarsAtRisk - a.dollarsAtRisk);
  const worst = exposed[0];
  const atRisk = positions.reduce((s, p) => s + p.dollarsAtRisk, 0);

  const steps = [
    {
      label: "Swept the network",
      text: `${sku} sits at ${positions.length} ${positions.length === 1 ? "node" : "nodes"} with ${total} units on hand and incoming across all of them.`,
      source: "WMS · positions",
    },
    {
      label: worst ? "Found where it is exposed" : "Checked the exposure",
      text: worst
        ? `${worst.branch} carries the worst of it — ${worst.onHand} on hand against a ${worst.safetyStock} safety stock, ${usd(worst.dollarsAtRisk)} at risk at ${Math.round(worst.fillRate * 100)}% fill.`
        : "No position carries meaningful exposure on this SKU today.",
      source: worst ? `WMS · ${worst.key}` : "WMS · positions",
    },
    {
      label: "Read the rebalance",
      text:
        positions.length > 1 && worst
          ? `The longest node could cover the shortest without buying anything — a transfer inside the network on a matching batch is the one write ${agent} is allowed to make here.`
          : `A single node holds this SKU, so there is nothing to rebalance against.`,
      source: `${agent} · network balance`,
    },
  ];

  return {
    id: `${sku}-catalogue`,
    label: "Where is it exposed?",
    ask: `Where is ${sku} exposed?`,
    intro: `On it. ${description}.`,
    icon: "commit",
    actAt: steps.length,
    steps,
    outcome: {
      kind: "settled",
      title: `${sku} — ${usd(atRisk)} at risk across ${positions.length} ${positions.length === 1 ? "node" : "nodes"}`,
      lines: [
        worst
          ? `${worst.branch} is the node to fix first. Everything else on this SKU is holding.`
          : `Nothing on this SKU needs a move today.`,
      ],
      tiles: [
        { label: "Nodes", value: String(positions.length) },
        { label: "Units", value: String(total) },
        { label: "At risk", value: usd(atRisk), tone: atRisk > 0 ? "behind" : "good" },
      ],
      artifact:
        positions.length > 0
          ? {
              kind: "ranked",
              title: "Where it sits · worst first",
              columns: ["Branch", "On hand", "Safety", "At risk"],
              rows: exposed.slice(0, 5).map((p, i) => ({
                cells: [p.branch, String(p.onHand), String(p.safetyStock), usd(p.dollarsAtRisk)],
                leader: i === 0 && p.dollarsAtRisk > 0,
              })),
              footnote: "Ranked by exposure carried, not by volume held.",
            }
          : undefined,
      prompts: [
        "Rebalance from the longest node?",
        "What is driving demand here?",
        "Is this a rationalisation candidate?",
      ],
    },
  };
}
