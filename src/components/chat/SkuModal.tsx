"use client";

import { useMemo, useState } from "react";
import {
  Buildings,
  Check,
  ClockCounterClockwise,
  PencilSimple,
  Stack,
} from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { ChoiceSection } from "@/components/chat/ChoiceSection";
import { safetyStockCommit, type CommitReport } from "@/components/chat/commit";
import { OverridePanel, SAFETY_STOCK_REASONS } from "@/components/chat/OverridePanel";
import { SkuDetails } from "@/components/chat/SkuDetails";
import { SupplierDetails } from "@/components/chat/SupplierDetails";
import { historyFor, reorderPoint, type ActionRow } from "@/data/action-center";

/**
 * The planner's decision, one SKU at a node.
 *
 * The buyer's accepted lead time arrives here as its consequence: the
 * replenishment window is longer, so the safety stock behind this SKU no longer
 * covers it. The planner confirms the level the agent computed, or overrides it —
 * and because the plant ships in fixed packs, an override steps in that multiple
 * rather than landing on an unshippable number.
 */

/** How sure the agent is of the level. A stocked-out node is unambiguous; a node
 *  with cover left leaves more room for the planner's read of demand. */
function confidenceFor(row: ActionRow): number {
  const days = row.cover?.coverDays ?? 0;
  if (days === 0) return 91;
  return days <= 6 ? 86 : 79;
}

export interface SkuModalProps {
  row: ActionRow;
  agent: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
  onCommitted: (report: CommitReport) => void;
  /** Open straight into the override panel. */
  initialOverriding?: boolean;
}

export function SkuModal({
  row,
  agent,
  nav,
  onClose,
  onCommitted,
  initialOverriding = false,
}: SkuModalProps) {
  const cover = row.cover;
  const recommended = cover?.safetyNeeded ?? 0;
  const moq = cover?.moq ?? 1;

  const [level, setLevel] = useState(String(recommended));
  const [overriding, setOverriding] = useState(initialOverriding);
  const [reason, setReason] = useState<string | null>(null);

  type Panel = "sku" | "supplier" | "history";
  const [panel, setPanel] = useState<Panel>("sku");

  const num = Number.parseInt(level, 10);
  const valid = Number.isFinite(num) && num > 0 && num < 1000;
  const overridden = valid && num !== recommended;
  /* A settled row is a record to read — every row opens under one Review verb, so
     the modal decides what it can offer. */
  const settled = row.state === "settled";

  const history = useMemo(() => historyFor(row, agent), [row, agent]);

  /** Shared with the row's Approve button, which commits without opening this. */
  const commit = () => onCommitted(safetyStockCommit(row, agent, num, reason));

  return (
    <Modal
      title={`${row.refSub} — ${settled ? "review" : "safety stock"}`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        /* The SKU leads, not the style: two nodes can hold the same style with
           different levels, and the SKU is what the policy hangs off. */
        <div className="flex items-center" style={{ gap: 10 }}>
          {/* The product itself, drawn in its variant colour — same swatch the
              queue row leads with, so the modal visibly continues that row. */}
          <SkuSwatch sku={row.refSub.replace(/^SKU\s*/, "")} size={22} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {row.refSub}
          </span>
          <Pill variant="neutral" size="sm">
            {row.ref}
          </Pill>
          <Pill variant="neutral" size="sm">
            {row.party}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={
            settled
              ? `Settled. Safety stock at ${row.party} covers the ${cover?.leadDays ?? 0}-day lead time; ${agent} is watching cover and will raise it again if demand moves.`
              : `Marcus accepted ${cover?.leadDays ?? 0} days from ${cover?.supplier ?? "the supplier"}, up from ${cover?.wasLeadDays ?? 0}. ${agent} has recomputed cover at ${row.party} against the longer window and drafted the requisition inside your limits. What is left is the level.`
          }
          facts={[
            { label: "Days of cover", value: row.date },
            {
              label: "Safety stock",
              value: `${cover?.safetyNow ?? 0} ${row.qtyUnit}`,
              next:
                !settled && valid && num !== (cover?.safetyNow ?? 0)
                  ? `${num} ${row.qtyUnit}`
                  : undefined,
            },
            { label: "ROP / Min", value: cover ? `${reorderPoint(cover)} / ${cover.min}` : "—" },
            { label: "On hand", value: `${row.qtyValue} ${row.qtyUnit}` },
            {
              label: "Lead time",
              value: `${cover?.wasLeadDays ?? 0} days`,
              next: settled ? undefined : `${cover?.leadDays ?? 0} days`,
            },
          ]}
        >
          {settled ? null : overriding ? (
            <OverridePanel
              agent={agent}
              subject="safety stock"
              unit={row.qtyUnit}
              reasons={SAFETY_STOCK_REASONS}
              value={level}
              onValueChange={setLevel}
              recommended={recommended}
              step={moq}
              reason={reason}
              onReasonChange={setReason}
              valid={valid}
              onCancel={() => {
                setOverriding(false);
                setReason(null);
                setLevel(String(recommended));
              }}
              onConfirm={commit}
            />
          ) : (
            <ChoiceSection
              name={`safety-${row.id}`}
              ariaLabel="Set the safety stock"
              requireChoice={false}
              recommendation={{
                line: `${overridden ? "Set" : "Raise"} safety stock to ${
                  valid ? num : recommended
                } ${row.qtyUnit}`,
                confidence: confidenceFor(row),
              }}
              onCancel={onClose}
              confirmLabel={`Confirm · ${valid ? num : recommended} ${row.qtyUnit}`}
              onConfirm={commit}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<PencilSimple size={14} />}
                    onClick={() => setOverriding(true)}
                  >
                    Override quantity
                  </Button>
                  <Button
                    variant="christy"
                    size="sm"
                    iconLeft={<Check size={14} weight="bold" />}
                    disabled={!valid}
                    onClick={commit}
                  >
                    {`Confirm · ${valid ? num : recommended} ${row.qtyUnit}`}
                  </Button>
                </>
              }
            />
          )}
        </AgentSummary>

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "sku", label: "SKU details", icon: Stack },
            { id: "supplier", label: "Vendor details", icon: Buildings },
            {
              id: "history",
              label: "Activity history",
              icon: ClockCounterClockwise,
              badge: history.length,
            },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "sku" ? (
          <SkuDetails row={row} agent={agent} onOpenPanel={setPanel} />
        ) : panel === "supplier" ? (
          <SupplierDetails row={row} />
        ) : (
          <ActivityHistory
            row={row}
            agent={agent}
            leadProposed={undefined}
          />
        )}
      </div>
    </Modal>
  );
}
