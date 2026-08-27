"use client";

import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { formatUsd, reorderPoint, type ActionRow } from "@/data/action-center";

/**
 * The SKU at a node, read-only, each field naming the system it came from. The
 * planner's unit of work is this — a style at a location and the policy behind
 * it — never the purchase order that caused the change.
 */
export function SkuDetails({
  row,
  agent,
  onOpenPanel,
}: {
  row: ActionRow;
  agent: string;
  onOpenPanel?: (panel: "supplier") => void;
}) {
  const c = row.cover;

  return (
    <DetailCard>
      <DetailSection title="The SKU">
        <DetailItem label="Style" value={row.ref} source="Item master" />
        <DetailItem label="SKU" value={row.refSub} source="Item master" />
        <DetailItem label="Category" value={row.product} source="Item master" />
        <DetailItem label="Node" value={row.party} source="OMP · network master" />
        <DetailItem
          label="On hand"
          value={`${row.qtyValue} ${row.qtyUnit}`}
          source="WMS · SAP WM"
        />
        <DetailItem label="Days of cover" value={row.date} source={`${agent} · OMP demand`} />
        <DetailItem label="Exposure" value={formatUsd(row.value)} source="OMP · open orders" />
      </DetailSection>

      {c && (
        <DetailSection title="Coverage policy">
          <DetailItem
            label="Safety stock"
            value={`${c.safetyNow} ${row.qtyUnit}`}
            source="OMP · policy"
          />
          <DetailItem label="Reorder point" value={`${reorderPoint(c)} ${row.qtyUnit}`} source="OMP · policy" />
          <DetailItem label="Minimum" value={`${c.min} ${row.qtyUnit}`} source="OMP · policy" />
          <DetailItem
            label="Ships in packs of"
            value={String(c.moq)}
            source="Supplier master · MOQ"
          />
          <DetailItem
            label="Supplier"
            value={c.supplier}
            source="Supplier master"
            onSelect={onOpenPanel && (() => onOpenPanel("supplier"))}
          />
          <DetailItem
            label="Lead time accepted"
            value={`${c.leadDays} days`}
            source="Buying · confirmed by Marcus"
          />
        </DetailSection>
      )}
    </DetailCard>
  );
}
