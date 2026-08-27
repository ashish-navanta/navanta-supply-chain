"use client";

import { useScope } from "@/context/ScopeContext";
import { useState } from "react";
import {
  ArrowsClockwise,
  CalendarCheck,
  CaretDown,
  CaretUp,
  Clock,
  CurrencyDollar,
  Gauge,
  Path,
  Truck,
  Warehouse,
  type Icon,
} from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  DataTable,
  Pill,
  PageHeading,
  SegmentedControl,
  type DataTableColumn,
} from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { useChatPanel } from "@/context/ChatPanelContext";
import { PERSONAS } from "@/types/persona";
import { AbcMixChart, AbcMixLegend } from "@/components/executive/AbcMixChart";
import { money } from "@/data/buying";
import {
  abcMix,
  execMeasures,
  scaleFor,
  inventoryBalance,
  periodLabel,
  transportScorecard,
  topSuppliers,
  type BalanceMode,
  type BalanceRow,
  type ExecMeasure,
  type Period,
  type SupplierRow,
  type TransportMeasure,
} from "@/data/executive";
import { countryOf, flagOf } from "@/data/countries";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { EXEC_ASKS, execTaskFor, type ExecTower } from "@/data/executive-flows";
import { showMeasure } from "@/data/executive";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/* Glyph names come off the measure; the imports live here. Same split the
   category scope uses — the data layer should not reach for a React component. */
const MEASURE_ICON: Record<string, Icon> = {
  CurrencyDollar,
  Truck,
  Path,
  Clock,
  CalendarCheck,
  Gauge,
  ArrowsClockwise,
};



/**
 * Money at the scale it is, which on this seat runs from a supplier's $9.6M to
 * the whole book's $3.7bn.
 *
 * Billions get their own unit rather than being printed as "$3682.2M" — four
 * digits before the decimal is a number a reader has to count the places on, and
 * counting places is exactly what a unit exists to prevent.
 */
const millions = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;

/* The formatter moved to `executive.ts` — the seat's questions answer with
   these same figures now, and two copies would drift. */
const show = showMeasure;

/* ═══════════════════════════════════════════════════════════════
 *  The command center
 *
 *  One page, five measures, and three readings of where the money
 *  sits. The four tower cards that used to be here were each a
 *  smaller copy of that tower's own dashboard — they answered "how
 *  is this desk doing", which is the desk's question. This seat's
 *  question is where the book is exposed, and the answer to that
 *  needs every centre, every plant and every account at once.
 * ═══════════════════════════════════════════════════════════════ */

export function ExecutiveCommandCenter() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();

  /* The top bar's category, honoured. All categories reads at company scale;
     Home & Kitchen and Grocery read the book this prototype actually derived;
     anything else has no book here and reads zero — see `scaleFor`. Without this the dropdown was
     the last control on the page that moved and changed nothing. */
  const { category } = useScope();
  const scale = scaleFor(category.id);
  const measures = execMeasures(scale);
  const mix = abcMix();
  /* Seven, which is what it takes to end level with the transport table's seven
     measures beside it — and the tail of the list is the useful part: the sixth
     and seventh are the second and third import sites, which is what shows the
     Vietnam exposure is not one supplier. */
  const suppliers = topSuppliers(7);
  /* Opens on the month, which is the window a plan variance is usually read in. */
  const [period, setPeriod] = useState<Period>("month");
  const transport = transportScorecard(period, scale);

  /* Opens on stockout: a centre short of a class A colourway is a promise that
     cannot be kept, which outranks capital sitting still. */
  const [mode, setMode] = useState<BalanceMode>("stockout");
  const balance = inventoryBalance(mode, scale);

  /* `asked` carries the chip's own question through, so the transcript reports
     the question that was pressed rather than the tower's generic one. The
     Explain buttons on the cards below pass nothing and keep their old wording,
     which is right — they are not asking about a measure. */
  const explain = (tower: ExecTower, asked?: { label?: string; measure?: string }) =>
    startTask(execTaskFor(tower, profile.agent, asked));

  return (
    <div className="flex flex-col gap-4">
      {/* The DS heading, as every other seat carries. This page opened straight
          on its ask row, which made it the only screen in the portal with no
          title — a reader arriving from the rail had the questions before they
          had the subject. */}
      <PageHeading
        title="Executive dashboard"
        subtitle={`${profile.name} · ${profile.role} — the five the whole chain is measured on, and where each one sits`}
      />

      {/* The measures open the page, not a paragraph about them.
          Atlas's brief said in prose what the five tiles say in figures, and said
          it above them — so the reader met the summary before the thing it
          summarised. The asking stays, and there is more than one thing to ask:
          one row per read Atlas actually has, each naming the tower it walks
          back to rather than a generic "ask me anything". */}
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        {EXEC_ASKS.map((q) => (
          <Button
            key={q.tower}
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            onClick={() => explain(q.tower, { label: q.label, measure: q.measure })}
          >
            {q.label}
          </Button>
        ))}
      </div>

      {/* ── The five, each against where it is supposed to be ──────────
          A number alone is not a decision: 77% says nothing, 77% against 85%
          says the month is short. Only working capital's target is derived —
          Σ target stock × carton cost is the capital the policy itself asks
          for — and each card says whether it is measuring against a policy or
          against a plan, so nobody mistakes an assumption for a measurement. */}
      {/* Five across from md up. Three-then-two read as two groups and there is
          only one group: these are the five, and a row break implied a hierarchy
          between them that does not exist. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
        {measures.map((m) => {
          const delta = m.value - m.target;
          const ahead = m.better === "higher" ? delta >= 0 : delta <= 0;
          const pctOff = m.target === 0 ? 0 : Math.abs(delta / m.target) * 100;
          /* Turns is a RATIO, so its variance is a difference of turns — a
             point — not a percentage. "−5%" against a 6× plan asked the reader
             to un-divide it to learn the book turned 0.3 short, and a
             percentage of a ratio is a figure nobody quotes: an operator says
             a point above plan. Percentages stay right for money and for
             accuracy, where the base is a quantity rather than a rate. */
          const variance =
            m.format === "turns"
              ? `${ahead ? "+" : "−"}${Math.abs(delta).toFixed(1)}×`
              : `${ahead ? "+" : "−"}${pctOff.toFixed(0)}%`;
          return (
            <div
              key={m.id}
              title={m.basis}
              className="flex flex-col rounded-[12px] p-4"
              style={{
                background: "var(--surface-base)",
                border: "1px solid var(--ds-border-default)",
                gap: 8,
              }}
            >
              <span
                className="truncate"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}
                title={m.label}
              >
                {m.label}
              </span>
              <span
                style={{ fontSize: 24, fontWeight: 600, color: "var(--ds-text-primary)", ...numeric }}
              >
                {show(m, m.value)}
              </span>
              <span className="flex items-baseline" style={{ gap: 6, fontSize: 12 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: ahead ? "var(--text-success-vivid)" : "var(--text-warning-dark)",
                    ...numeric,
                  }}
                >
                  {variance}
                </span>
                <span className="truncate" style={{ color: "var(--ds-text-secondary)" }}>
                  {`vs ${show(m, m.target)} ${m.targetDerived ? "policy" : "plan"}`}
                </span>
              </span>
              {/* The basis moved to the tile's tooltip. As a third line it was
                  the only thing on the card that truncated — "Demand to date at
                  34% gross …" is worse than not saying it — and it answers a
                  question a reader asks once, not every time they read the tile. */}
            </div>
          );
        })}
      </div>

      {/* Side by side from lg rather than xl. The panel floats on this page, so the
          content is wide at 1197px — and xl waits for 1280, which left the two
          stacked at exactly the width the page is usually read at.
          Stretched, not items-start. The columns were always the same width; the
          balance table is two rows against a chart's 345px, and letting it size
          to its content left the pair ending at different heights with a ragged
          band of page showing under the shorter one. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {/* ── Inventory against turnover, by class ─────────────────────
            The comparison is the point, not either bar. A class holding a
            larger share of the stock than of the demand is capital standing
            still; the reverse is a class being run thin. Both shares are of
            the same book, which is the only thing that makes them comparable
            side by side.
            Turnover is at cost — annualValue is demand × carton cost — and is
            called turnover rather than revenue for that reason: grossing it up
            per class would apply one blended margin to eight product families
            and invent a mix the model does not carry. */}
        <Section
          title="Inventory $ by A vs B vs C"
          aside={<AbcMixLegend />}
          agent={profile.agent}
          onExplain={() => explain("abc")}
        >
          {/* No summary rows under it. Three lines repeating each class's
              positions, value and lean were the chart written out as text — the
              bars already carry both shares with their labels on, and the
              tooltip says which way a class leans in a sentence. */}
          <div className="px-4 pb-4">
            <AbcMixChart slices={mix} />
          </div>
        </Section>

        {/* ── Under-stock and over-stock, by the centre holding it ───
            One question in two directions, which is why it is one table with a
            toggle rather than two. Short and long are not opposites a reader
            compares side by side — they are two lists of the same shape, and a
            centre usually appears on both.
            This replaced a top-items-by-value list, which was honest and
            useless: the dearest eight of 198 positions held 13% of the stock,
            because the fixture spreads demand evenly rather than following the
            power law a real retail book does. Ranking a flat distribution
            gives a leaderboard with no leader. */}
        <Section
          title="Inventory balance"
          agent={profile.agent}
          onExplain={() => explain("balance")}
          toggle={
            /* The DS control, same as the period switch on the card beside it —
               a hand-rolled pair of buttons here meant two segmented controls on
               one page that were not quite the same shape. */
            <SegmentedControl
              size="sm"
              aria-label="Direction"
              value={mode}
              onValueChange={(v: string) => setMode(v as BalanceMode)}
              options={[
                { value: "stockout", label: "Stockout" },
                { value: "overstock", label: "Overstock" },
              ]}
            />
          }
        >
          {/* The DS table, not a hand-rolled grid. Two tables here were a grid
              with a header strip and a Row wrapper, which is what DataTable
              already is — and the local copy had no sorting, so a reader could
              not ask "which centre is worst" of a table built to answer it. */}
          <DataTable<BalanceRow>
            {...SHAW_TABLE_PROPS}
            data={balance}
            rowKey={(b) => b.branch}
            /* Client sort: four rows in memory, so deferring to a caller that
               would sort them in memory anyway is a round trip for nothing. */
            sortMode="client"
            columns={balanceCols(mode)}
          />
        </Section>
      </div>

      {/* Side by side. Both are rankings of the same shape — who holds the
          spend, which lane leaks — and stacked full width they read as two
          unrelated screens rather than the two halves of "who moves it and what
          it costs". Each lost a column to fit, noted where it happened. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {/* ── Who supplies it, and what they deliver against the spend ───
            Spend, fill rate and OTIF are all the supplier record's own. Fill and
            OTIF are kept apart because one number cannot tell a supplier who
            ships short from one who ships late: OTIF is the joint measure, so it
            is always the lower of the pair, and the gap between them is volume
            that arrived complete but arrived late. 99% fill against 96% OTIF is a
            lead-time problem; 94 against 87 is both. */}
        <Section
          title="Top suppliers"
          agent={profile.agent}
          onExplain={() => explain("suppliers")}
          >
          <DataTable<SupplierRow>
            {...SHAW_TABLE_PROPS}
            data={suppliers}
            rowKey={(v) => v.id}
            sortMode="client"
            columns={SUPPLIER_COLUMNS}
          />
        </Section>

        {/* ── Transport, against plan ──────────────────────────────────
            Six measures, one base each, all derived from the lane and load book
            except the plan column — which is authored, sits in one literal in
            the data layer, and is labelled as a plan rather than dressed as a
            measurement.
            Against plan and not against last month: nothing in these fixtures
            carries freight history, so a month-on-month column would have been
            six seeded numbers wearing the authority of a reading.
            It replaced an indexed line chart of cost against service. The chart
            showed one relationship well — cost falling while service held — and
            this shows six measures, which is the trade a dashboard makes. The
            relationship survives as two adjacent rows: cost is under plan on
            both measures and every service and asset row is behind, which is the
            same finding stated rather than drawn. */}
        <Section
          title="Transport against plan"
          agent={profile.agent}
          onExplain={() => explain("transport")}
          toggle={
            <SegmentedControl
              size="sm"
              aria-label="Period"
              value={period}
              onValueChange={(v: string) => setPeriod(v as Period)}
              options={[
                { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" },
                { value: "year", label: "Year" },
              ]}
            />
          }
        >
          <DataTable<TransportMeasure>
            {...SHAW_TABLE_PROPS}
            data={transport}
            rowKey={(m) => m.key}
            columns={transportCols(period)}
          />
        </Section>
      </div>
    </div>
  );
}

/* ─── The columns, as DataTable definitions ─────────────────────
 * Sortable where sorting answers a question a reader would ask — which centre is
 * worst, which supplier holds the most spend, who misses their dates. Not on the
 * name columns: nobody wants these tables alphabetically.
 * ─────────────────────────────────────────────────────────────── */

/** Cartons and dollars change their meaning with the direction, so the headers do. */
function balanceCols(mode: BalanceMode): DataTableColumn<BalanceRow>[] {
  return [
    {
      key: "branch",
      label: "Distribution centre",
      minWidth: 168,
      /* The planner's own branch pill, glyph and all. A distribution centre
         should look the same on the seat that reads the network as on the seat
         that works it — and the warehouse is what tells this column apart from a
         plant, which is the confusion the two scopes exist to prevent. */
      cell: (b: BalanceRow) => (
        <Pill variant="neutral" size="sm" icon={<Warehouse weight="duotone" />}>
          {b.branch}
        </Pill>
      ),
    },
    {
      key: "products",
      label: "Products",
      align: "right",
      minWidth: 96,
      sortable: true,
      cell: (b: BalanceRow) => <span style={numeric}>{b.products}</span>,
    },
    {
      key: "units",
      label: mode === "stockout" ? "Units short" : "Units over",
      align: "right",
      minWidth: 124,
      sortable: true,
      cell: (b: BalanceRow) => <span style={numeric}>{b.units.toLocaleString("en-US")}</span>,
    },
    {
      /* Renamed by direction, because the same arithmetic means two different
         things: short is revenue that cannot be served, long is capital that
         cannot be spent. */
      key: "value",
      label: mode === "stockout" ? "$ at risk" : "$ tied up",
      align: "right",
      minWidth: 112,
      sortable: true,
      cell: (b: BalanceRow) => (
        <span style={{ fontWeight: 600, color: "var(--ds-text-primary)", ...numeric }}>
          {money(b.value)}
        </span>
      ),
    },
  ];
}

const SUPPLIER_COLUMNS: DataTableColumn<SupplierRow>[] = [
  {
    /* The rank. Every other table in the app that is ordered by something opens
       with it, and here the order IS the finding — these are the five dearest
       relationships on the book, in order. */
    key: "rank",
    label: "#",
    width: 44,
    cell: (_v: SupplierRow, ctx: { index: number }) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {ctx.index + 1}
      </span>
    ),
  },
  {
    key: "site",
    label: "Supplier site",
    minWidth: 150,
    /* Site and flag, nothing else. The dedicated/independent pill was here on the
       reasoning that a dedicated co-pack line missing its dates is a capacity decision and an
       independent supplier missing them is a contract one — true, and it is the supplier
       book's business, not this table's. What it cost was a column: with the pill
       gone, fill rate and on-time each get their own again. */
    cell: (v: SupplierRow) => (
      <span className="flex min-w-0 items-center" style={{ gap: 7 }}>
        <Flag country={v.country} />
        <span className="truncate" style={{ fontSize: 13, color: "var(--ds-text-primary)" }}>
          {v.label}
        </span>
      </span>
    ),
  },
  {
    key: "spend",
    label: "Annual spend",
    align: "right",
    minWidth: 108,
    sortable: true,
    /* One figure. The share of spend was underneath it, and five rows sorted
       descending already say which is the biggest — the percentage was restating
       the ordering the table is in. */
    cell: (v: SupplierRow) => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)", ...numeric }}>
        {millions(v.spend)}
      </span>
    ),
  },
  {
    key: "fill",
    label: "Fill rate",
    align: "right",
    minWidth: 88,
    sortable: true,
    cell: (v: SupplierRow) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-primary)", ...numeric }}>
        {`${v.fillRate}%`}
      </span>
    ),
  },
  {
    /* Back in its own column beside fill rate, which is where the pair belongs:
       OTIF is the joint measure so it can only be the lower of the two, and the
       gap between them read side by side is volume that arrived complete and
       arrived late. 99 against 96 is a lead-time problem; 94 against 87 is both. */
    key: "otif",
    label: "On time",
    align: "right",
    minWidth: 92,
    sortable: true,
    /* No colour. A threshold at 92 made three of five rows amber, which reads as
       an alert list rather than a book — and the number a reader acts on is the
       gap to the fill rate beside it, not whether it cleared a line somebody
       picked. */
    cell: (v: SupplierRow) => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)", ...numeric }}>
        {`${v.otif}%`}
      </span>
    ),
  },
];

/* A function of the period, like balanceCols is of the direction — the header of
   the current column IS the period, so it cannot be a module constant. */
function transportCols(period: Period): DataTableColumn<TransportMeasure>[] {
  return [
  {
    key: "metric",
    label: "Measure",
    minWidth: 200,
    /* A glyph per measure. Seven rows in seven different units read as one
       undifferentiated list; the icon is what lets a reader come back to this
       card and find the freight bill without reading four labels first. Named in
       the data layer and resolved here, the same split the category scope uses. */
    cell: (m: TransportMeasure) => (
      <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
        <span className="flex shrink-0 items-center" style={{ color: "var(--ds-text-secondary)" }}>
          {(() => {
            const Glyph = MEASURE_ICON[m.icon];
            return Glyph ? <Glyph size={16} weight="duotone" /> : null;
          })()}
        </span>
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
        <span className="truncate" style={{ fontSize: 13, color: "var(--ds-text-primary)" }}>
          {m.label}
        </span>
        {/* The base under every measure, because six measures in six different
            units is exactly where a reader stops knowing what they are looking
            at — and 75% on four delivered loads is a true number that invites a
            false conclusion. */}
          <span className="truncate" style={{ fontSize: 11.5, color: "var(--ds-text-secondary)" }}>
            {m.basis}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "value",
      label: periodLabel(period),
    align: "right",
    minWidth: 108,
    cell: (m: TransportMeasure) => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)", ...numeric }}>
        {m.value}
      </span>
    ),
  },
  {
    key: "plan",
    label: "Plan",
    align: "right",
    minWidth: 88,
    cell: (m: TransportMeasure) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>{m.plan}</span>
    ),
  },
  {
    /* The variance is the only coloured thing on the card, and it is coloured
       against the plan rather than against a threshold somebody picked — which is
       the difference between a reading and an opinion. The caret carries it too,
       so the column survives being printed or read by anyone who cannot separate
       the two greens. */
    key: "variance",
    label: "vs plan",
    align: "right",
    minWidth: 104,
    cell: (m: TransportMeasure) => (
      <span
        className="inline-flex items-center"
        style={{
          gap: 4,
          fontSize: 13,
          fontWeight: 600,
          color: m.ahead ? "var(--text-success-vivid)" : "var(--text-warning-dark)",
          ...numeric,
        }}
      >
        {m.ahead ? <CaretUp size={11} weight="fill" /> : <CaretDown size={11} weight="fill" />}
        {m.variance}
      </span>
      ),
    },
  ];
}

/* ─── The pieces these sections share ───────────────────────────
 * Extracted on the third use, not the first. Three sections wanted the same
 * frame — a title, a subtitle, an Explain that hands the reading to Atlas, and
 * an optional link into the tower that owns it — and two wanted the same bar in
 * a cell. Written out each time, the second copy had already drifted.
 * ─────────────────────────────────────────────────────────────── */

/** Just the flag, for a cell that already names the place in words. */
function Flag({ country }: { country: string }) {
  const c = countryOf(country);
  if (!c) return null;
  return (
    <span title={c.name} aria-label={c.name} style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
      {flagOf(c.code)}
    </span>
  );
}

function Section({
  title,
  subtitle,
  aside,
  agent,
  onExplain,
  toggle,
  children,
}: {
  title: string;
  /** Optional, and mostly absent. A subtitle restating what the table below says
   *  in numbers is a caption on a chart that captions itself. */
  subtitle?: string;
  /** A key or note under the title. */
  aside?: React.ReactNode;
  agent: string;
  onExplain: () => void;
  /** A control that changes what the body shows, beside the Explain. */
  toggle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[12px]"
      style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-default)" }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ds-text-primary)" }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: 12.5, color: "var(--ds-text-secondary)" }}>{subtitle}</span>
          )}
          {aside && <span className="pt-1.5">{aside}</span>}
        </span>
        <span className="flex shrink-0 items-center" style={{ gap: 8 }}>
          {/* No drill-in link. Every section here had one and none of them earned
              its place: the seat that owns each record is one rail click away,
              and a purple link beside a button competed with the Explain for the
              only action on the card. */}
          {toggle}
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            onClick={onExplain}
            title={`Have ${agent} explain ${title.toLowerCase()}`}
          >
            Explain
          </Button>
        </span>
      </div>
      {children}
    </div>
  );
}

/* ─── The stockout / overstock switch ────────────────────────────
 * A segmented pair, not two buttons and not a Select: there are exactly two
 * directions, both are always available, and the one you are not looking at is
 * worth showing rather than hiding behind a menu.
 * ─────────────────────────────────────────────────────────────── */

