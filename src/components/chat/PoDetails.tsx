"use client";

import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { formatUsd, linesFor, type ActionRow } from "@/data/action-center";

export interface PoDetailsProps {
  row: ActionRow;
  agent: string;
  /** Jump to the tab that details a fact. Omit and those values read as text. */
  onOpenPanel?: (panel: "supplier" | "products") => void;
}

/**
 * The order, read-only: a mirror of the systems of record, each field naming the
 * system it came from. What has happened to the order lives in its own Activity
 * history tab.
 */
export function PoDetails({ row, agent, onOpenPanel }: PoDetailsProps) {
  const lines = linesFor(row);

  return (
    <DetailCard>
      <DetailSection title="The order">
        <DetailItem label="PO number" value={row.ref} source="SAP ECC" />
        <DetailItem
          label="Quantity"
          value={`${row.qtyValue} ${row.qtyUnit}`}
          source="SAP ECC"
        />
        <DetailItem label="Exposure" value={formatUsd(row.value)} source="SAP ECC" />
        {/* Plain count — the label already says what is being counted, and the
            Products tab is one click away in the tab bar above. */}
        <DetailItem label="Products" value={String(lines.length)} source="SAP ECC" />
        <DetailItem label="Product family" value={row.product} source="Item master" />
        {/* On a waiting row the date field holds how long the request has been
            outstanding ("3d ago"), not a date — labelling that "Promise date"
            would be a straight misread. */}
        <DetailItem
          label={row.state === "waiting" ? "Asked" : "Promise date"}
          value={row.date}
          source={row.state === "waiting" ? `${agent} · chase log` : "OMP · PO promise date"}
        />
        <DetailItem
          label="Counterparty"
          value={row.party}
          source="Supplier master"
          onSelect={onOpenPanel && (() => onOpenPanel("supplier"))}
        />
      </DetailSection>

    </DetailCard>
  );
}
