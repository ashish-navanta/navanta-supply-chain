"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Barcode,
  Buildings,
  CalendarBlank,
  Factory,
  Hash,
  Notepad,
  Package,
  Palette,
  Ruler,
  Stack,
  Warehouse,
  MapPin,
  Flame,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  DataTable,
  Pill,
  TableShell,
  type DataTableColumn,
} from "@navanta-ai/design-system";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import {
  CARD_RADIUS,
  CARD_SHADOW,
  CardHeading,
  Field,
  FieldRow,
  HAIR,
  RecordSection,
  SectionCard,
} from "@/components/ui/RecordCard";
import { poRoute, orderRoute } from "@/data/nav";
import { QtyStack } from "@/components/ui/QtyStack";
import { SkuLink } from "@/components/ui/SkuLink";
import { QUEUES, formatUsdFull, linesFor } from "@/data/action-center";
import { POSITIONS, tierOf, TIER_LABEL } from "@/data/planning";
import { ORDERS, orderLines } from "@/data/service";
import { palletQuantity, skuRecord, type CatalogueSku } from "@/data/catalogue";

/**
 * One SKU, in full.
 *
 * A product page in this app is not a spec sheet — the spec is four lines and
 * the catalogue already has them. What a person opening a SKU wants to know is
 * where it sits and who is waiting on it: how much is standing at each branch,
 * what is inbound and on whose purchase order, which account orders it is
 * committed to. Those answers live in four different seats, and this is the one
 * page that puts them beside the product they are all about.
 *
 * So the spec is the rail — small, complete, done with — and the body is the
 * position: branches, then supply, then demand. The other colourways sit at the
 * bottom because "what else could I ship instead" is the last question, and it
 * is the one the service seat's whole substitution flow turns on.
 */

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type Panel = "holdings" | "inbound" | "committed" | "siblings";

/** The line a tab shows instead of a table, when this colourway has none of it.
 *  Written as a sentence rather than "No data": what is absent is the answer. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-4" style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
      {children}
    </p>
  );
}

/** A branch holding this SKU, as the planner's book has it. */
interface Holding {
  key: string;
  branch: string;
  classification: string;
  onHand: number;
  incoming: number;
  coverDays: number;
  safetyStock: number;
  leadTimeDays: number;
  vendor: string;
  tier: string | null;
}

/** A purchase order line carrying this SKU. */
interface Inbound {
  ref: string;
  vendor: string;
  qty: number;
  unit: string;
  leadDays: number;
  value: number;
  state: string;
}

/** A account order committed to this SKU. */
interface Committed {
  id: string;
  account: string;
  units: number;
  eta: string;
  stage: string;
}

export function ProductDetailScreen({ record }: { record: CatalogueSku }) {
  const { sku, style, colourway } = record;

  /* Opens on where it sits, which is what the reader came for. The other three
     elaborate it. */
  const [panel, setPanel] = useState<Panel>("holdings");

  /* Where it sits. The planner's book is per sku@branch, so a SKU's position is
     however many branches carry it — which is the first thing that makes a
     product page worth opening rather than a catalogue row worth reading. */
  const holdings: Holding[] = POSITIONS.filter((p) => p.sku === sku).map((p) => ({
    key: p.key,
    branch: p.branch,
    classification: p.classification,
    onHand: p.onHand,
    incoming: p.incoming,
    coverDays: p.demandMean ? Math.round(p.onHand / p.demandMean) : 0,
    safetyStock: p.safetyStock,
    leadTimeDays: p.leadTimeDays,
    vendor: p.vendor,
    tier: tierOf(p) ? TIER_LABEL[tierOf(p)!] : null,
  }));

  /* On order. Read off the buying desk's own rows rather than restated, so the
     quantity here and the quantity on the purchase order cannot differ. */
  const inbound: Inbound[] = QUEUES.buyer.rows.flatMap((b) =>
    linesFor(b)
      .filter((l) => l.sku === sku)
      .map((l) => ({
        ref: b.ref,
        vendor: b.party,
        qty: l.qty,
        unit: l.unit,
        leadDays: l.leadDays,
        value: l.value,
        state: b.state === "settled" ? "Received" : b.state === "waiting" ? "Awaiting vendor" : "Open",
      })),
  );

  /* Who is waiting. Same rule — the order's own lines, not a second list. */
  const committed: Committed[] = ORDERS.flatMap((o) =>
    orderLines(o)
      .filter((l) => l.sku === sku)
      .map((l) => ({
        id: o.id,
        account: o.account,
        units: l.units,
        eta: o.currentEta,
        stage: o.stage,
      })),
  );

  const onHand = holdings.reduce((n, h) => n + h.onHand, 0);
  const inboundQty = holdings.reduce((n, h) => n + h.incoming, 0);
  const committedQty = committed.reduce((n, c) => n + c.units, 0);

  const siblings = style.colourways.filter((c) => c.number !== colourway.number);

  const holdingCols: DataTableColumn<Holding>[] = [
    {
      key: "branch",
      label: "Branch",
      minWidth: 168,
      cell: (h) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>
            {h.branch}
          </span>
          <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
            {h.classification}
          </span>
        </span>
      ),
    },
    {
      key: "onHand",
      label: "On hand",
      minWidth: 90,
      cell: (h) => <QtyStack value={h.onHand} />,
    },
    {
      key: "incoming",
      label: "Inbound",
      minWidth: 90,
      cell: (h) =>
        h.incoming ? (
          <QtyStack value={h.incoming} />
        ) : (
          <span style={{ fontSize: 14, color: "var(--ds-text-secondary)" }}>—</span>
        ),
    },
    {
      key: "safetyStock",
      label: "Safety",
      minWidth: 90,
      cell: (h) => <QtyStack value={h.safetyStock} />,
    },
    {
      key: "leadTimeDays",
      label: "Lead",
      minWidth: 80,
      cell: (h) => <QtyStack value={h.leadTimeDays} unit="days" />,
    },
    {
      key: "vendor",
      label: "Vendor",
      minWidth: 148,
      cell: (h) => (
        <span className="truncate" style={{ fontSize: 14 }}>
          {h.vendor}
        </span>
      ),
    },
    {
      key: "tier",
      label: "Exception",
      minWidth: 104,
      cell: (h) =>
        h.tier ? (
          <Pill size="sm" variant={h.tier === "Critical" ? "danger" : h.tier === "High" ? "warning" : "neutral"}>
            {h.tier}
          </Pill>
        ) : (
          <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>—</span>
        ),
    },
  ];

  const inboundCols: DataTableColumn<Inbound>[] = [
    {
      key: "ref",
      label: "Purchase order",
      minWidth: 148,
      cell: (l) => (
        <Link
          href={poRoute(l.ref)}
          className="hover:underline"
          style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
        >
          {l.ref}
        </Link>
      ),
    },
    {
      key: "vendor",
      label: "Vendor",
      minWidth: 176,
      cell: (l) => <span className="truncate" style={{ fontSize: 14 }}>{l.vendor}</span>,
    },
    {
      key: "qty",
      label: "Quantity",
      minWidth: 100,
      cell: (l) => <span style={{ fontSize: 14, ...numeric }}>{`${l.qty} ${l.unit}`}</span>,
    },
    {
      key: "leadDays",
      label: "Lead",
      minWidth: 76,
      cell: (l) => <span style={{ fontSize: 14, ...numeric }}>{`${l.leadDays} d`}</span>,
    },
    {
      key: "value",
      label: "Value",
      minWidth: 100,
      cell: (l) => <span style={{ fontSize: 14, ...numeric }}>{formatUsdFull(l.value)}</span>,
    },
    {
      key: "state",
      label: "Status",
      minWidth: 124,
      cell: (l) => <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>{l.state}</span>,
    },
  ];

  const committedCols: DataTableColumn<Committed>[] = [
    {
      key: "id",
      label: "Account order",
      minWidth: 132,
      cell: (c) => (
        <Link
          href={orderRoute(c.id)}
          className="hover:underline"
          style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
        >
          {c.id}
        </Link>
      ),
    },
    {
      key: "account",
      label: "Account",
      minWidth: 196,
      cell: (c) => <span className="truncate" style={{ fontSize: 14 }}>{c.account}</span>,
    },
    {
      key: "units",
      label: "Quantity",
      minWidth: 100,
      cell: (c) => <span style={{ fontSize: 14, ...numeric }}>{`${c.units} units`}</span>,
    },
    {
      key: "eta",
      label: "ETA",
      minWidth: 96,
      cell: (c) => <span style={{ fontSize: 14, ...numeric }}>{c.eta}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div
        className="flex items-end justify-between"
        style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}
      >
        <div className="flex items-center gap-3">
          <SkuSwatch sku={sku} size={44} />
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <h1 style={{ fontSize: 20, fontWeight: 600, lineHeight: "144%", color: "#212121", ...numeric }}>
                {sku}
              </h1>
              <Pill size="sm" variant="neutral">
                {style.brand}
              </Pill>
            </span>
            <p className="font-medium" style={{ fontSize: 14, lineHeight: 1.5, color: "#333" }}>
              {`${style.name} · ${colourway.name}`}
            </p>
          </div>
        </div>
      </div>

      {/* What the product IS, first and across the whole width.
          It was the last card in the right-hand rail, which put the identity of
          the thing the page is about below three tables about its position — and
          a reader who has opened a product record to check its backing or its
          plant had to scroll past the stock position to reach it. Position is
          the more perishable fact but the less fundamental one, so it follows. */}
        <SectionCard title="Product details" icon={Package}>
          {/* Three columns, not one.
            These five sections were a stack in a four-column rail, which made
            the page as tall as its narrowest element and put "Made at" — the
            plant and its lead time — below the fold on every product. At full
            width they read across, and alignItems:start lets a short section sit
            short instead of padding to match its neighbour. */}
        <div
          className="px-3 py-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            alignItems: "start",
          }}
        >
            <RecordSection icon={Notepad} title="Identity">
              <FieldRow>
                <Field icon={Hash} label="Style number" copy={style.style}>
                  {style.style}
                </Field>
                <Field icon={Barcode} label="Variant number" copy={colourway.number}>
                  {colourway.number}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={Package} label="Style">
                  {style.name}
                </Field>
                <Field icon={Palette} label="Variant">
                  {colourway.name}
                </Field>
              </FieldRow>
            </RecordSection>

            <RecordSection icon={Ruler} title="Item">
              <FieldRow>
                <Field icon={Buildings} label="Brand">
                  {style.brand}
                </Field>
                <Field icon={Ruler} label="Size">
                  {style.size}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field icon={Stack} label="Form">
                  {style.spec.construction}
                </Field>
                <Field icon={Palette} label="Material">
                  {style.fibre}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field icon={Hash} label="DPCI">
                  {style.dpci}
                </Field>
                <Field icon={Stack} label="Case packaging">
                  {style.spec.packaging}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={Stack} label="Receives as">
                  {style.backing}
                </Field>
                <Field icon={Notepad} label="Merchandising">
                  {style.spec.merchandising.join(", ")}
                </Field>
              </FieldRow>
            </RecordSection>

            {/* The measurements, in the fields the item-setup sheet names them
                by. Case pack and cube are what a DC slot and a container plan
                are arithmetic over. Units per pallet is computed from three of
                them rather than stored — see `palletQuantity` — because it is
                the figure a slot plan compares two items on, which makes it the
                worst one to let drift. */}
            <RecordSection icon={Ruler} title="Case & pallet">
              <FieldRow>
                <Field icon={Hash} label="Case pack">
                  {`${style.spec.casePack} units`}
                </Field>
                <Field icon={Stack} label="Unit weight">
                  {`${style.spec.unitWeight.toFixed(1)} lb`}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field icon={Ruler} label="Case cube">
                  {`${style.spec.caseCube.toFixed(1)} ft³`}
                </Field>
                <Field icon={Stack} label="Units / pallet">
                  {palletQuantity(style.spec).toLocaleString()}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={Ruler} label="Pallet Ti">
                  {`${style.spec.palletTi} cases/layer`}
                </Field>
                <Field icon={Ruler} label="Pallet Hi">
                  {`${style.spec.palletHi} layers`}
                </Field>
              </FieldRow>
            </RecordSection>

            <RecordSection icon={ShieldCheck} title="Compliance">
              <FieldRow>
                <Field icon={Flame} label="Origin">
                  {style.spec.origin}
                </Field>
                <Field icon={Flame} label="Shelf life">
                  {style.spec.shelfLife}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field icon={Lightning} label="Hazmat">
                  {style.spec.hazmat}
                </Field>
                <Field icon={ShieldCheck} label="Regulatory">
                  {style.spec.compliance}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={ShieldCheck} label="Warranty">
                  {style.spec.warranty}
                </Field>
                <Field icon={Notepad} label="Certified">
                  {style.spec.certifications.join(", ")}
                </Field>
              </FieldRow>
            </RecordSection>

            {/* Where Target has it made, from the catalogue — not from whichever
                branches happen to be holding it today. A product is made in one
                place; reading the plant off the stocking positions made it look
                like six, and made it disappear entirely for a colourway nobody
                currently stocks. */}
            <RecordSection icon={Factory} title="Made at">
              <FieldRow>
                <Field icon={Factory} label="Plant">
                  {style.plant.id}
                </Field>
                <Field icon={MapPin} label="Location">
                  {style.plant.location}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={CalendarBlank} label="Lead time">
                  {`${style.plant.leadDays} days`}
                </Field>
                <Field icon={Notepad} label="Note">
                  {style.plant.note}
                </Field>
              </FieldRow>
            </RecordSection>
          </div>
        </SectionCard>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          columnGap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: "span 8" }} className="flex min-w-0 flex-col gap-5">
          {/* One shell, four tabs, following the PO record.
              These were four stacked cards, which read as four subjects and were
              one: this colourway, seen four ways. Stacked, the reader scrolled
              past the two tables that were empty for this SKU to reach the one
              that was not, and each card's own heading competed with the page
              heading above it for what the page was about.
              As tabs the count sits on the tab, so what is empty is visible
              without opening it, and the colourway stack sits at the same weight
              as the three tables rather than reading as an afterthought below
              them — which matters, because substitution is the question the
              service seat's whole alternate flow turns on. */}
          <TableShell
            /* One name held across the tabs, not the open tab's name — retitling
               would make the heading a larger second copy of the tab, and the
               subject never changes. Not "Position", which is the rail card
               beside it: that one is the position in three figures, this is the
               same position in full, and two cards sharing a title is two
               readings of which is which. */
            title="This variant"
            icon={Warehouse}
            customize={false}
            /* Labels and counts, no tab icons. Four labelled tabs with icons and
               badges wanted 599px inside a 541px card and clipped the last one
               off the edge, so something had to go — and between a glyph that
               repeats what the label says and a count that tells the reader
               which tabs are empty before they open them, the glyph is the one
               carrying nothing. The shell keeps its own icon. */
            tabs={[
              { id: "holdings", label: "Where it sits", badge: holdings.length },
              { id: "inbound", label: "On order", badge: inbound.length },
              { id: "committed", label: "Committed", badge: committed.length },
              { id: "siblings", label: "Variants", badge: siblings.length },
            ]}
            activeTab={panel}
            onTabChange={(id) => setPanel(id as Panel)}
            totalItems={0}
            currentPage={1}
            onPageChange={() => {}}
            pageSize={10}
            onPageSizeChange={() => {}}
            className="ts-no-pager"
          >
            {panel === "holdings" &&
              (holdings.length ? (
                <DataTable<Holding>
                  {...SHAW_TABLE_PROPS}
                  data={holdings}
                  columns={holdingCols}
                  rowKey={(h) => h.key}
                />
              ) : (
                <Empty>
                  No branch carries this variant today. It is orderable, not stocked.
                </Empty>
              ))}

            {panel === "inbound" &&
              (inbound.length ? (
                <DataTable<Inbound>
                  {...SHAW_TABLE_PROPS}
                  data={inbound}
                  columns={inboundCols}
                  rowKey={(l) => `${l.ref}-${l.qty}`}
                />
              ) : (
                <Empty>
                  Nothing inbound. What is on the shelf is all there is until somebody raises a
                  purchase order.
                </Empty>
              ))}

            {panel === "committed" &&
              (committed.length ? (
                <DataTable<Committed>
                  {...SHAW_TABLE_PROPS}
                  data={committed}
                  columns={committedCols}
                  rowKey={(c) => `${c.id}-${c.units}`}
                />
              ) : (
                <Empty>No account order is waiting on this variant.</Empty>
              ))}

            {panel === "siblings" &&
              (siblings.length ? (
                <div className="flex flex-wrap gap-2 p-4">
                  {siblings.map((c) => {
                    const other = `${style.style}-${c.number}`;
                    return (
                      /* The peek, so comparing colourways is a glance each rather
                         than a page load each — which is the whole shape of the
                         substitution question this tab exists to answer. */
                      <SkuLink
                        key={c.number}
                        sku={other}
                        title={`${style.name} · ${c.name}`}
                        className="flex min-w-0 items-center gap-2 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]"
                        style={{ border: HAIR }}
                      >
                        <SkuSwatch sku={other} size={22} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate" style={{ fontSize: 13, color: "var(--ds-text-primary)" }}>
                            {c.name}
                          </span>
                          <span
                            className="truncate"
                            style={{ fontSize: 11, color: "var(--ds-text-secondary)", ...numeric }}
                          >
                            {c.number}
                          </span>
                        </span>
                      </SkuLink>
                    );
                  })}
                </div>
              ) : (
                <Empty>The only variant in this style — there is nothing to substitute.</Empty>
              ))}
          </TableShell>
        </div>

        <div style={{ gridColumn: "span 4" }} className="flex flex-col gap-5">
          {/* The position in three figures, because that is what the reader came
              for and the tables below only elaborate it. */}
          <div
            className="flex flex-col overflow-hidden bg-[var(--surface-base)]"
            style={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
          >
            <CardHeading icon={Stack}>Position</CardHeading>
            <div className="flex flex-col gap-3 p-[16px] pt-0">
              <div className="flex flex-col gap-[19px]">
                {[
                  ["On hand, all centres", `${onHand} units`],
                  ["Inbound", inboundQty ? `${inboundQty} units` : "None"],
                  ["Committed to accounts", committedQty ? `${committedQty} units` : "None"],
                  ["Branches stocking", String(holdings.length)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between whitespace-nowrap text-[14px] leading-[1.5]"
                  >
                    <span className="text-[#71717a]">{label}</span>
                    <span className="text-right font-medium text-[#18181b]" style={numeric}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/** The route's own resolver, so a bad reference 404s rather than rendering blank. */
export function productByRoute(sku: string) {
  return skuRecord(sku);
}
