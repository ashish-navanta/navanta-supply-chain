"use client";

import { useState } from "react";
import {
  Barcode,
  ChartLine,
  Check,
  Clock,
  Factory,
  Hash,
  Package,
  Palette,
  PencilSimple,
  Ruler,
  Star,
  Stack,
  Target,
  Truck,
  Warehouse,
} from "@phosphor-icons/react";
import { AiStar, Button, DetailPanelShell, Pill, Tabs } from "@navanta-ai/design-system";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { Field, FieldRow, RecordSection } from "@/components/ui/RecordCard";
import { productRoute } from "@/data/nav";
import {
  POSITIONS,
  TIER_LABEL,
  asException,
  isShort,
  targetStock,
  tierOf,
} from "@/data/planning";
import { approvalTaskFor } from "@/data/planning-approval";
import { formatUsd } from "@/data/action-center";
import { useScope } from "@/context/ScopeContext";
import { useChatPanel } from "@/context/ChatPanelContext";
import { palletQuantity, skuRecord, type CatalogueSku } from "@/data/catalogue";

/**
 * A product at a glance, over the page you were on.
 *
 * What goes in is what a person clicking a SKU mid-task is usually checking:
 * what it looks like, what it is, how much there is and where it is made. What
 * stays out is everything the full page carries — the branch-by-branch table,
 * the open purchase orders, the account orders, the other colourways — because a
 * panel that reproduces a page is a page in a worse window.
 *
 * The way through to that page is in the header, and it opens in a new tab: the
 * reader is here because they were doing something else, and the whole point of
 * a peek is that it does not cost them their place.
 */

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function ProductPeek({ sku, onClose }: { sku: string | null; onClose: () => void }) {
  const { region } = useScope();
  const { startTask, startWatch, openChat } = useChatPanel();
  /* The last product shown, kept after the SKU clears.
     Two reasons, and both are about the slide. The panel takes 300ms to leave,
     and a record that vanishes the instant it is dismissed leaves an empty box
     travelling across the screen. And the shell only transitions if it was
     already mounted in its closed state — mounting it at the moment of the
     first peek renders it at its final position with nothing to animate FROM,
     which is why the panel used to appear rather than arrive. So it is rendered
     for the life of the app, closed and off-screen, and `open` is what moves. */
  const live = sku ? skuRecord(sku) : undefined;
  const [shown, setShown] = useState<CatalogueSku | undefined>(live);
  /* Synced during render, not in an effect. An effect would paint one frame of
     the old product — or, on the very first peek, one frame of an empty panel
     already sliding in — before correcting itself. */
  if (live && live !== shown) setShown(live);

  /* Which half of the record is on show. Two groups is two scrolls in a 460px
     panel — the spec is eleven fields and the position is six, and a reader who
     came to check one had to scroll past the other. Tabs make it a choice.
     Position leads: the panel is opened from a queue row, and the row's own
     figures are what somebody is deciding on. */
  const [tab, setTab] = useState<"position" | "product">("position");

  const record = live ?? shown;
  const open = live !== undefined;

  const style = record?.style;
  const colourway = record?.colourway;
  const holdings = POSITIONS.filter((p) => p.sku === record?.sku);
  const onHand = holdings.reduce((n, h) => n + h.onHand, 0);
  const incoming = holdings.reduce((n, h) => n + h.incoming, 0);

  /* The position at the centre the app is scoped to — the row the reader most
     likely clicked. Undefined on a catalogue peek for a SKU this centre does not
     hold, which is what the brand pill falls back for. */
  /* With every centre in scope there is no "here" — the peek falls back to the
     brand pill, same as a SKU this centre does not hold. */
  const here = region ? holdings.find((h) => h.branch === region.dc) : undefined;
  const tier = here ? tierOf(here) : null;
  /* The position as something decidable — the same shaping the All Products tab
     uses, so a healthy line still says what IRIS would do about it. */
  const ex = here ? asException(here) : undefined;
  const cover = ex ? Math.round(ex.onHand / Math.max(0.1, ex.demandMean)) : 0;

  return (
    <DetailPanelShell
      open={open}
      onClose={onClose}
      title={record?.sku ?? ""}
      subtitle={style && colourway ? `${style.name} · ${colourway.name}` : ""}
      /* 460 for the two labelled buttons side by side — Add to watchlist and
         Override do not fit beside each other in 420. */
      width={460}
      /* The shell's own header affordance rather than a button in `actions`.
         `actions` renders a band UNDER the title, so a labelled button there
         took a full row of the panel to say what the arrow says beside the SKU —
         and put a second, larger control next to the close button that already
         lives there. It still opens in a new tab, which is the point of a peek:
         the reader is here because they were doing something else. */
      externalHref={record ? productRoute(record.sku) : undefined}
    >
      {/* No padding of its own. The shell already insets its body — mine sat
          inside that, so the swatch and every row were indented twice from the
          panel's edge. */}
      {record && style && colourway ? (
        <div className="flex flex-col gap-2">
          {/* The colour, at a size worth looking at. On a product this IS the
              record — a colourway change is the decision the service seat spends
              a whole screen on, and a 32px chip in a table cannot settle it. */}
          <div className="flex items-center gap-3">
            <SkuSwatch sku={record.sku} size={72} />
            <span className="flex min-w-0 flex-col" style={{ gap: 5 }}>
              {/* What the queue row says about this position, not what the
                  brochure says about the style. A reader opening this panel from
                  Inventory Planning is looking at a line they are deciding on —
                  its centre, its class and how hard it is breaching — and a pill
                  reading "Hearth & Hand with Magnolia" answered a question nobody had. The
                  brand is still in the Identity group below.
                  Where the SKU is not held at the centre in scope there is no
                  position to describe, so the brand pill stands in — that is the
                  case on a catalogue peek, where the reader IS browsing. */}
              {here ? (
                <span className="flex flex-wrap items-center" style={{ gap: 4 }}>
                  <Pill size="sm" variant="neutral" icon={<Warehouse weight="duotone" />}>
                    {here.branch}
                  </Pill>
                  <Pill size="sm" variant="neutral">
                    {here.classification}
                  </Pill>
                  {tier && (
                    <Pill
                      size="sm"
                      variant={tier === "critical" ? "danger" : tier === "high" ? "warning" : "neutral"}
                    >
                      {TIER_LABEL[tier]}
                    </Pill>
                  )}
                  {/* What the position is worth, beside what is wrong with it —
                      the two facts that decide whether this row is worth the
                      reader's next ten minutes. */}
                  {here.dollarsAtRisk > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#212121", ...numeric }}>
                      {formatUsd(here.dollarsAtRisk)}
                    </span>
                  )}
                </span>
              ) : (
                <Pill size="sm" variant="neutral">
                  {style.brand}
                </Pill>
              )}
              <span style={{ fontSize: 13, color: "#71767A" }}>
                {`${colourway.name} · ${colourway.number}`}
              </span>
              <span style={{ fontSize: 12, color: "#979B9F", ...numeric }}>{colourway.hex}</span>
            </span>
          </div>

          {/* ── What IRIS proposes, and the three answers to it ──────
              The reference does this as a modal: a summary block with the
              decision's numbers as tiles, the recommendation under them, and
              the three moves on the right. Shrunk into 460px the moves cannot
              sit beside the sentence, so they stack under it — Approve first
              because it is the one the row is asking for. */}
          {ex && (
            <div
              className="flex flex-col gap-2.5 rounded-[10px] p-3"
              style={{ background: "var(--color-iris-50, #F6F4FE)" }}
            >
              <span className="flex items-center" style={{ gap: 6 }}>
                <AiStar size={14} variant="small" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-iris-700)" }}>
                  Iris summary
                </span>
              </span>

              <span style={{ fontSize: 13, lineHeight: 1.5, color: "#3F3F46" }}>{ex.reason}</span>

              <span className="flex flex-col" style={{ gap: 1 }}>
                <span style={{ fontSize: 11, color: "var(--color-iris-700)" }}>
                  {`Recommended action · ${(ex.confidence * 100).toFixed(0)}% confidence`}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#212121" }}>
                  {ex.recommendedAction}
                </span>
              </span>

              {/* One row. Approve stays filled — it is the move the panel exists
                  to offer — but stacking it above the other two made the block
                  three rows tall for three controls that are read together. The
                  quantity moves up into the recommendation, which already names
                  it, so the labels are short enough to sit side by side. */}
              <div className="flex" style={{ gap: 6 }}>
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  iconLeft={<Check size={14} weight="bold" />}
                  onClick={() => {
                    onClose();
                    startTask(approvalTaskFor(ex));
                  }}
                >
                  {/* Same verb as the row's button — see PartsPlanningScreen. */}
                  {isShort(ex) ? "Approve" : "Transfer"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  fullWidth
                  iconLeft={<Star size={14} weight="bold" />}
                  title="Add to watchlist"
                  onClick={() => {
                    onClose();
                    startWatch({ key: ex.key, label: `${ex.sku} at ${ex.branch}` });
                  }}
                >
                  Watchlist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  fullWidth
                  iconLeft={<PencilSimple size={14} weight="bold" />}
                  onClick={() => {
                    onClose();
                    openChat({ ref: ex.sku, party: ex.branch, partyOwn: true });
                  }}
                >
                  Override
                </Button>
              </div>
            </div>
          )}

          <Tabs
            tabs={[
              { id: "position", label: "Position" },
              { id: "product", label: "Product details" },
            ]}
            activeTab={tab}
            onChange={(id) => setTab(id as "position" | "product")}
            variant="underline"
            size="sm"
            fullWidth
          />

          {/* The position, as reference rather than headline.
              These six were tiles above the actions for a while, and the tiles
              were repeating the row the reader had just clicked — same figures,
              same order, one panel to the right. The decision needs the sentence
              and the three buttons; the numbers behind it belong here with the
              rest of what is true about this line, in the shape the record page
              uses. */}
          {tab === "position" &&
            (ex ? (
            <RecordSection icon={Warehouse} title={`Position · ${ex.branch}`}>
              <FieldRow>
                <Field icon={Warehouse} label="On hand">
                  {`${ex.onHand} units`}
                </Field>
                <Field icon={Truck} label="Incoming">
                  {ex.incoming ? `${ex.incoming} units` : "None"}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field
                  icon={Stack}
                  label="Safety stock"
                  tone={ex.onHand < ex.safetyStock ? "danger" : undefined}
                >
                  {`${ex.safetyStock} units`}
                </Field>
                <Field icon={Target} label="Target stock">
                  {`${targetStock(ex)} units`}
                </Field>
              </FieldRow>
              <FieldRow last>
                <Field icon={Clock} label="Days of cover">
                  {`${cover} days · ${ex.leadTimeDays}-day lead`}
                </Field>
                <Field icon={ChartLine} label="Demand">
                  {`${ex.demandMean.toFixed(1)} units/day`}
                </Field>
              </FieldRow>
            </RecordSection>
          ) : (
            <RecordSection icon={Warehouse} title="Position">
              <FieldRow last>
                <Field icon={Warehouse} label="On hand, all centres">
                  {holdings.length ? `${onHand} units` : "Not stocked"}
                </Field>
                <Field icon={Truck} label="Inbound">
                  {incoming ? `${incoming} units` : "None"}
                </Field>
              </FieldRow>
            </RecordSection>
          ))}

          {/* ── The spec ──────────────────────────────────────────────
              Identity and Construction were two bands over eleven fields, and
              this panel is no longer primarily about the spec — it is where a
              position is decided, and the spec is the reference you check while
              deciding. One group, below the actions. */}
          {tab === "product" && (
          <RecordSection icon={Package} title="Product details">
            <FieldRow>
              <Field icon={Hash} label="Style number" copy={style.style}>
                {style.style}
              </Field>
              <Field icon={Barcode} label="Variant number" copy={colourway.number}>
                {colourway.number}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field icon={Package} label="Style">
                {style.name}
              </Field>
              <Field icon={Palette} label="Variant">
                {colourway.name}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field icon={Ruler} label="Size">
                {style.size}
              </Field>
              <Field icon={Stack} label="Form">
                {style.spec.construction}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field icon={Stack} label="Receives as">
                {style.backing}
              </Field>
              <Field icon={Palette} label="Material">
                {style.fibre}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field icon={Ruler} label="Case pack">
                {`${style.spec.casePack} units · ${style.spec.caseCube.toFixed(1)} ft³`}
              </Field>
              <Field icon={Ruler} label="Units / pallet">
                {palletQuantity(style.spec).toLocaleString()}
              </Field>
            </FieldRow>
            <FieldRow last>
              <Field icon={Factory} label="Made at">
                {style.plant.name}
              </Field>
              <Field icon={Clock} label="Plant lead">
                {`${style.plant.leadDays} days`}
              </Field>
            </FieldRow>
          </RecordSection>
          )}
        </div>
      ) : null}
    </DetailPanelShell>
  );
}
