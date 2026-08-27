"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  ChartLine,
  Check,
  CheckCircle,
  GitBranch,
  MathOperations,
  PencilSimple,
  ShieldCheck,
  Star,
  Warehouse,
} from "@phosphor-icons/react";
import { AiStar, Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal } from "@/components/ui/Modal";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { FactorPanel, MathPanel, PolicyPanel } from "@/components/planning/deck/DeckPanels";
import { TrajectoryChart } from "@/components/planning/deck/TrajectoryChart";
import { deckFor } from "@/data/demand-deck";
import { approvalTaskFor } from "@/data/planning-approval";
import { datePlus, formatUsd } from "@/data/action-center";
import { TIER_LABEL, isShort, routeFor, targetStock, tierOf, type Exception } from "@/data/planning";
import { useActioned } from "@/lib/actioned";
import { productRoute } from "@/data/nav";
import { skuRecord } from "@/data/catalogue";
import { useChatPanel } from "@/context/ChatPanelContext";

/* ═══════════════════════════════════════════════════════════════
 *  The demand deck
 *
 *  A position, and the whole argument for what to do about it. The
 *  side panel could hold the answer; it could not hold the working —
 *  a five-column attribution table, a waterfall and a chart do not
 *  read in 460px, and the working is exactly what somebody approving
 *  $112K of stock is entitled to see.
 *
 *  Ported in shape from the IRIS project's demand deck so the two
 *  products' decks are one object: the summary card pinned at the
 *  top with the decision on it, and the evidence behind four tabs
 *  underneath, one at a time.
 * ═══════════════════════════════════════════════════════════════ */

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type DeckTab = "drivers" | "math" | "trajectory" | "policy";

const TABS: { id: DeckTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "drivers", label: "What drove this decision", icon: GitBranch },
  { id: "math", label: "Math waterfall", icon: MathOperations },
  { id: "trajectory", label: "Inventory trajectory", icon: ChartLine },
  { id: "policy", label: "Active policy", icon: ShieldCheck },
];

/**
 * One of the five summary tiles.
 *
 * IRIS's own spec: white on the lavender card with a 1px iris-300 border, a
 * caption label, a semibold value that goes destructive-red when the figure is
 * the problem, and a footnote under it. Label and value never wrap — a tile
 * whose value breaks across two lines stops being a tile.
 */
function Kpi({
  label,
  value,
  sublabel,
  emphasized,
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col"
      style={{ gap: 4, padding: 8, background: "#FFFFFF", border: "1px solid #E3D2FF", borderRadius: 8 }}
    >
      <span className="type-caption font-normal" style={{ color: "#1E1E1E", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        className="type-body font-semibold"
        style={{
          color: emphasized ? "var(--color-destructive-800, #A7000F)" : "#1E1E1E",
          whiteSpace: "nowrap",
          ...numeric,
        }}
      >
        {value}
      </span>
      {sublabel && (
        <span
          className="type-footnote font-normal"
          style={{
            color: "#1E1E1E",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}

export function DemandDeckModal({ row, onClose }: { row: Exception; onClose: () => void }) {
  const { startTask, startWatch, openChat } = useChatPanel();
  const [tab, setTab] = useState<DeckTab>("drivers");

  const deck = deckFor(row);
  const short = isShort(row);
  const tier = tierOf(row);
  const record = skuRecord(row.sku);
  const cover = Math.round(row.onHand / Math.max(0.1, row.demandMean));

  /* Every action leaves the deck: the run it starts is narrated in the agent
     panel, and a modal sitting over the transcript would hide the thing it just
     asked for. */
  /* Whether this position is still asking for a decision.
     Two ways it can already have one: a planner approved it in this session, or
     Iris cleared it on the routing grid and it never needed a planner at all.
     The band has to say which — "Recommended action" over a position that was
     approved four minutes ago is the deck asking a question it already has the
     answer to. */
  const { decision } = useActioned();
  const approvedHere = decision(row.key);
  const autoRouted = routeFor(row.confidence, row.severity) === "auto";
  const settled = !!approvedHere || autoRouted;

  const act = (run: () => void) => {
    onClose();
    run();
  };

  return (
    <Modal
      title={`${row.sku} — demand deck`}
      size="xwide"
      fixedHeight={820}
      onClose={onClose}
      headerContent={
        <div className="flex min-w-0 items-start gap-3">
          <SkuSwatch sku={row.sku} size={40} />
          <div className="flex min-w-0 flex-col" style={{ gap: 3 }}>
            <span className="flex flex-wrap items-center" style={{ gap: 8 }}>
              <span
                className="font-semibold"
                style={{ fontSize: 17, color: "var(--ds-text-primary)", ...numeric }}
              >
                {row.sku}
              </span>
              {/* Out to the full record, in a new tab. A deck is opened mid-decision
                  and the reader should not lose it to look up a spec. */}
              <Link
                href={productRoute(row.sku)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center hover:underline"
                style={{ gap: 4, fontSize: 13, color: "var(--link-color)" }}
                title={`Open ${row.sku} in a new tab`}
              >
                SKU detail
                <ArrowSquareOut size={13} weight="bold" />
              </Link>
            </span>
            <span className="flex flex-wrap items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>
                {record ? `${record.style.name} · ${record.colourway.name}` : row.description}
              </span>
              <Pill size="sm" variant="neutral" icon={<Warehouse weight="duotone" />}>
                {row.branch}
              </Pill>
              <Pill size="sm" variant="neutral">
                {row.classification}
              </Pill>
              {tier && (
                <Pill
                  size="sm"
                  variant={tier === "critical" ? "danger" : tier === "high" ? "warning" : "neutral"}
                >
                  {TIER_LABEL[tier]}
                </Pill>
              )}
              {row.dollarsAtRisk > 0 && (
                <span
                  className="font-medium"
                  style={{ fontSize: 13, color: "var(--ds-text-primary)", ...numeric }}
                >
                  {formatUsd(row.dollarsAtRisk)}
                </span>
              )}
            </span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col" style={{ padding: 24, gap: 16 }}>
        {/* ── Iris Summary ────────────────────────────────────────
            IRIS's own card, to the millimetre: lavender, rounded 12, the
            header and body at padding 12, and the action band as a separate
            gradient strip flush to the card's foot rather than a bordered row
            inside it. Getting that band right is most of what makes the card
            read as a decision surface instead of a panel with buttons on it. */}
        <div
          className="flex w-full flex-col overflow-hidden rounded-[12px]"
          style={{ background: "#F5EFFF" }}
        >
          <div className="flex flex-col" style={{ gap: 8, padding: 12 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <AiStar size={16} variant="small" />
              <span className="type-body-medium" style={{ color: "#181A1B" }}>
                Iris Summary
              </span>
            </div>

            <p className="type-body font-normal" style={{ color: "#18181B" }}>
              {deck.summary}
            </p>

            {/* Five tiles, IRIS's set: what runs out when, how long a
                replacement takes, how much, when it lands, and the buffer
                underneath it all. */}
            <div className="flex w-full" style={{ gap: 8, marginTop: 8 }}>
              <Kpi
                label="Stock out days"
                value={`${cover} days`}
                sublabel={`${row.onHand} on hand`}
                emphasized={cover < row.leadTimeDays}
              />
              <Kpi
                label="Lead time"
                value={`${row.leadTimeDays} days`}
                sublabel={row.vendor}
              />
              <Kpi
                label={short ? "Order qty" : "Transfer qty"}
                value={`${row.requestedQty} ctn`}
                sublabel={`Target ${targetStock(row)}`}
              />
              <Kpi
                label="Stock lands"
                value={datePlus(row.leadTimeDays)}
                sublabel={row.incoming ? `${row.incoming} already inbound` : "Nothing inbound"}
              />
              <Kpi
                label="Safety stock"
                value={`${row.safetyStock} ctn`}
                sublabel={row.classification}
                emphasized={row.onHand < row.safetyStock}
              />
            </div>
          </div>

          {/* The recommended-action band. Gradient, edge to edge, `items-end`
              so the caption stack and the buttons share a baseline. */}
          <div
            className="flex flex-wrap items-end justify-between"
            style={{
              padding: 12,
              gap: 16,
              /* Green once the position has an answer. The same band carries
                 both states because it is the same fact — what is to be done
                 about this position — and moving it would make the reader look
                 for the decision somewhere new. */
              background: settled
                ? "linear-gradient(to right, var(--surface-success-alt) 72.227%, var(--surface-success) 100%)"
                : "linear-gradient(to right, #EBDFFF 72.227%, #F3ECFE 100%)",
            }}
          >
            <div className="flex flex-col" style={{ gap: 0 }}>
              <span
                className="type-caption font-normal"
                style={{ color: settled ? "var(--text-success)" : "var(--color-iris-700)" }}
              >
                {autoRouted && !approvedHere
                  ? `Auto approved by Iris · Confidence ${(row.confidence * 100).toFixed(0)}%`
                  : settled
                    ? `Approved · Confidence ${(row.confidence * 100).toFixed(0)}%`
                    : `Recommended action · Confidence ${(row.confidence * 100).toFixed(0)}%`}
              </span>
              <span
                className="type-body-medium flex items-center"
                style={{ color: "#18181B", gap: 6 }}
              >
                {settled && (
                  <CheckCircle
                    size={16}
                    weight="fill"
                    className="shrink-0"
                    style={{ color: "var(--text-success)" }}
                  />
                )}
                {autoRouted && !approvedHere
                  ? `All gates cleared · ${row.requestedQty} units`
                  : settled
                    ? `${short ? "Approved" : "Transferred"} · ${row.requestedQty} units`
                    : row.recommendedAction}
              </span>
            </div>
            {/* Nothing left to press once it has an answer. Leaving Approve on a
                position that is already approved invites the reader to do it
                twice and reports nothing when they do. */}
            <div className="flex items-center" style={{ gap: 8 }} hidden={settled}>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<PencilSimple size={14} weight="bold" />}
                onClick={() => act(() => openChat({ ref: row.sku, party: row.branch, partyOwn: true }))}
              >
                Override Quantity
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Star size={14} weight="bold" />}
                onClick={() =>
                  act(() => startWatch({ key: row.key, label: `${row.sku} at ${row.branch}` }))
                }
              >
                Add to Watchlist
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Check size={14} weight="bold" />}
                onClick={() => act(() => startTask(approvalTaskFor(row)))}
              >
                {`${short ? "Approve" : "Transfer"} · ${row.requestedQty} Cartons`}
              </Button>
            </div>
          </div>
        </div>

        {/* ── The evidence, one tab at a time ─────────────────────── */}
        <div className="flex flex-col" style={{ gap: 16 }}>
          <Tabs
            variant="underline"
            tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
            activeTab={tab}
            onChange={(id) => setTab(id as DeckTab)}
          />

          {tab === "drivers" && (
            <FactorPanel factors={deck.factors} confidence={row.confidence} />
          )}
          {tab === "math" && <MathPanel steps={deck.waterfall} />}
          {tab === "trajectory" && <TrajectoryChart row={row} />}
          {tab === "policy" && <PolicyPanel rows={deck.policy} />}
        </div>
      </div>
    </Modal>
  );
}
