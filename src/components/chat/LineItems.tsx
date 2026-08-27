"use client";

import { useMemo, useState } from "react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { formatUsdFull, linesFor, type ActionRow, type RowLine } from "@/data/action-center";
import { SkuSwatch } from "@/components/ui/SkuSwatch";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * What the money on a PO is made of — its SKU lines. Shared by both modals: the
 * decision needs to know whether one colourway or the whole order is exposed,
 * and the contact needs it to answer "which lines are you asking about?".
 *
 * The table, and nothing around it. Every place this appears is already inside
 * a tab panel whose tab says "Products" and carries the count — a shell titling
 * it "Line items · 5" underneath was the same sentence a second time, with a
 * pager on five rows that never paged.
 */
export function LineItems({ row, query = "" }: { row: ActionRow; query?: string }) {
  const lines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = linesFor(row);
    if (!needle) return all;
    return all.filter((l) => `${l.sku} ${l.name}`.toLowerCase().includes(needle));
  }, [row, query]);
  const [sort, setSort] = useState<DataTableSortState>({ field: null, dir: "desc" });

  const columns: DataTableColumn<RowLine>[] = [
    {
      key: "sku",
      label: "Product SKUs",
      sortable: true,
      minWidth: 260,
      /* The drawn thumbnail leads the cell, as it does on every other SKU table —
         a line is recognisable as a product before it is readable as a number. */
      cell: (l) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={l.sku} size={28} />
          <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
            <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
              {l.sku}
            </span>
            <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
              {l.name}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "qty",
      label: "Qty",
      sortable: true,
      minWidth: 90,
      cell: (l) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span className="ds-body" style={{ color: "var(--ds-text-primary)", ...numeric }}>
            {l.qty}
          </span>
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {l.unit}
          </span>
        </span>
      ),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      minWidth: 120,
      cell: (l) => (
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)", ...numeric }}>
          {formatUsdFull(l.value)}
        </span>
      ),
    },
  ];

  const serialSlot: DataTableSlotColumn<RowLine> = {
    id: "sn",
    width: 40,
    header: () => (
      <span className="type-cell-medium" style={{ color: "var(--ds-text-primary)" }}>
        #
      </span>
    ),
    cell: (_l, ctx) => (
      <span className="type-cell" style={{ color: "var(--ds-text-secondary)", ...numeric }}>
        {ctx.index + 1}
      </span>
    ),
  };

  return (
    <DataTable<RowLine>
      headerVariant="default"
      rowBorderColor="#F1F3F5"
      rowHoverBg="var(--surface-hover)"
      cellPaddingX={12}
      headerPaddingX={12}
      rowHeight={52}
      headerHeight={40}
      columns={columns}
      leadingSlots={[serialSlot]}
      data={lines}
      rowKey={(l) => l.sku}
      sort={sort}
      onSortChange={setSort}
      sortMode="client"
    />
  );
}
