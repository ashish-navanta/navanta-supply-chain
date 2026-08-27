"use client";

import { useMemo, useState } from "react";
import {
  AiStar,
  Button,
  Chip,
  DataTable,
  PageHeading,
  Pill,
  TableShell,
  Tooltip,
  type DataTableColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  Factory,
  Info,
  PencilSimple,
  Star,
  Warehouse,
  WarningCircle,
} from "@phosphor-icons/react";
import { AgentColumnHeader } from "@/components/ui/AgentColumnHeader";
import { QtyStack } from "@/components/ui/QtyStack";
import { DemandDeckModal } from "@/components/planning/DemandDeckModal";
import { productRoute } from "@/data/nav";
import { useChatPanel } from "@/context/ChatPanelContext";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { exceptionTaskFor } from "@/data/planning-flows";
import { useScope } from "@/context/ScopeContext";
import { useActioned } from "@/lib/actioned";
import { approvalTaskFor, autoRouteTaskFor } from "@/data/planning-approval";
import { ABCMatrix } from "@/components/planning/ABCMatrix";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import {
  BRANCH_COUNT,
  EXCEPTIONS,
  asException,
  excessOf,
  excessValue,
  excessWos,
  isLong,
  isShort,
  otherDc,
  targetStock,
  weeksOfSupply,
  POSITIONS,
  matrixCells,
  planningRollup,
  TIER_LABEL,
  routeFor,
  segmentPolicy,
  tierOf,
  type Classification,
  type Exception,
  type Tier,
} from "@/data/planning";
import { formatUsd } from "@/data/action-center";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * Inventory Planning — the matrix over the exception list.
 *
 * The order is the argument: the matrix says where the trouble is concentrated,
 * and the table below it is whatever the matrix is currently pointing at. A
 * planner opens the day on the shape of the book, not on row one of a list
 * three hundred long.
 */

/**
 * IRIS's tab set, verbatim from `ExceptionTable.tsx`.
 *
 * They are not severity filters — they are the states a row moves through.
 * Action Center is what needs deciding, Watchlist is what the planner parked,
 * Approved is what IRIS cleared or a person signed, and the last three are
 * standing views of the book rather than a queue. Keeping the same set means a
 * row that leaves one tab is somewhere findable rather than gone.
 */
const TAB_REVIEW = "Action Center" as const;
const TAB_ON_HOLD = "Watchlist" as const;
const TAB_RETURNED = "Rejected & Returned" as const;
const TAB_AUTO = "Approved" as const;
const TAB_OVERSTOCK = "Overstock" as const;
const TAB_DEADSTOCK = "Deadstock" as const;
const TAB_ALL = "All Products" as const;

type TabId =
  | typeof TAB_REVIEW
  | typeof TAB_ON_HOLD
  | typeof TAB_RETURNED
  | typeof TAB_AUTO
  | typeof TAB_OVERSTOCK
  | typeof TAB_DEADSTOCK
  | typeof TAB_ALL;

const TABS: TabId[] = [
  TAB_REVIEW,
  TAB_ON_HOLD,
  TAB_RETURNED,
  TAB_AUTO,
  TAB_OVERSTOCK,
  TAB_DEADSTOCK,
  TAB_ALL,
];

/** IRIS's empty copy, so each tab explains itself rather than sharing one line. */
const EMPTY_COPY: Record<TabId, { title: string; desc: string }> = {
  [TAB_REVIEW]: { title: "All clear", desc: "Nothing needs your review right now." },
  [TAB_ON_HOLD]: {
    title: "Nothing on the watchlist",
    desc: "Rows you mark Hold in the Action Center land here.",
  },
  [TAB_RETURNED]: {
    title: "Nothing returned",
    desc: "Products the buyer rejects bounce back here for you to re-decide.",
  },
  [TAB_AUTO]: {
    title: "Nothing approved yet",
    desc: "POs you approve and ones IRIS auto-clears will land here.",
  },
  [TAB_OVERSTOCK]: { title: "No overstock", desc: "Products IRIS flags as overstocked land here." },
  [TAB_DEADSTOCK]: {
    title: "No dead stock",
    desc: "Products with no movement for 7+ months land here, tiered by age.",
  },
  [TAB_ALL]: {
    title: "Search across all products",
    desc: "Type a SKU, description or vendor to search the full catalog — including products with no active exception.",
  },
};

/* Every position, shaped like an exception, so the All Products tab can search
   the full catalog — including products with nothing currently wrong. */
const ALL_ROWS: Exception[] = POSITIONS.map(asException);

/* Both lists, cut to one centre. A position IS a SKU at a centre, so the top
   bar's third scope is not a filter over this page so much as the axis it is
   read along — and a planner working Woodland has no use for Wilton's
   buffers sitting in the same table. */
/* A null name is every centre, not no centre — the DC scope can now be "all",
   and the alternative was three call sites each writing the same conditional. */
function atDc<T extends { branch: string }>(rows: T[], name: string | null): T[] {
  return rows.filter((r) => r.branch === name);
}

/**
 * A column heading, short, with what it means on hover.
 *
 * OH, Inc., LT, SS — the shorthand a planner already writes on a whiteboard,
 * over twelve columns of decision inputs that have to sit side by side to be read
 * together. "Demand Mean" was 116px of chrome above a number 48px wide.
 *
 * The abbreviations only work because the tooltip is there. It carries the full
 * name AND what the figure measures — "Safety stock · The buffer held against
 * demand variability over the lead time" — which is more than the long heading
 * ever said, and it sits on the heading because that is where somebody meeting
 * the table for the first time would look.
 */
function ColumnHead({
  short,
  full,
  what,
  field,
  sort,
  agent = false,
}: {
  short: string;
  full: string;
  what: string;
  field: string;
  sort: DataTableSortState;
  /** Marks the column as the agent's, like the two at the end of the table. */
  agent?: boolean;
}) {
  /* The caret, drawn here because `headerCell` replaces the shell's own header
     span — including the sort icon it would otherwise put there. The click still
     works either way (the handler is on the `th`), so without this the column
     sorted with nothing on screen saying it could. Same three states and the same
     14px bold caret the table draws everywhere else. */
  const Caret = sort.field !== field ? CaretUpDown : sort.dir === "asc" ? CaretUp : CaretDown;
  return (
    <span className="inline-flex items-center">
      <Tooltip
        content={
          <span className="flex flex-col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 500 }}>{full}</span>
            <span style={{ opacity: 0.8 }}>{what}</span>
          </span>
        }
      >
        <span className="inline-flex items-center" style={{ gap: 4 }}>
          {/* Inside the tooltip's trigger so the star is part of the heading
              rather than something sitting next to it, and hovering it explains
              the column like hovering the words does. */}
          {agent && <AiStar size={14} variant="small" />}
          {short}
        </span>
      </Tooltip>
      <Caret
        size={14}
        weight="bold"
        className={`ml-1 ${sort.field === field ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
      />
    </span>
  );
}

export function PartsPlanningScreen() {
  const { region } = useScope();
  const { startTask, startWatch, startOverride } = useChatPanel();
  /* The row whose deck is open. Held here rather than in the peek context
     because a deck is about a POSITION — this SKU at this centre — and the peek
     is keyed on a SKU alone, which is the right shape for a catalogue click and
     the wrong one for a decision. */
  const [deckRow, setDeckRow] = useState<Exception | null>(null);
  const actioned = useActioned();
  /* The seat's own agent, so the override run is narrated by whoever is sitting
     here rather than a hard-coded "Iris". */
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  /* Everything on this page — the nine-box, the rollup, the tab badges and the
     table — is drawn from these two, so the centre cuts all of them at once and
     they cannot disagree about which book is on screen. */
  const positions = useMemo(() => atDc(POSITIONS, region?.dc ?? null), [region]);
  const exceptions = useMemo(() => atDc(EXCEPTIONS, region?.dc ?? null), [region]);
  const allRows = useMemo(() => atDc(ALL_ROWS, region?.dc ?? null), [region]);
  const cells = useMemo(() => matrixCells(positions), [positions]);
  const roll = useMemo(() => planningRollup(positions), [positions]);
  const [selected, setSelected] = useState<Classification | null>(null);
  const [tab, setTab] = useState<TabId>(TAB_REVIEW);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  /* Severity first, biggest exposure inside it — the order the page opens on,
     and the one it returns to when a sort is cleared. */
  const [sort, setSort] = useState<DataTableSortState>({ field: null, dir: "desc" });
  /* Which severities the planner is looking at. A set rather than one value:
     "Critical and High" is the normal morning, and forcing a choice between them
     would make the chips a worse version of the tabs already above them. */
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [pageSize, setPageSize] = useState(10);

  /* Which rows belong to which tab. Derived from the row's own state rather
     than a stored tab, so a row cannot be in two at once. */
  const inTab = (id: TabId, e: Exception) => {
    const auto = routeFor(e.confidence, e.severity) === "auto";
    const over = isLong(e);
    /* What the planner has already decided about this position this session.
       It outranks everything the row itself says: a line that has been approved
       is not owed a review however hard it is breaching, and one that has been
       parked belongs on the watchlist even if its policy is untouched. */
    const decided = actioned.decision(e.key)?.bucket;
    switch (id) {
      case TAB_REVIEW:
        if (decided) return false;
        /* Under-stock only. A long position is a real exception and it belongs on
           this page, but it is not the same KIND of decision — one is "buy me
           some", the other is "this is in the wrong place", and they leave by
           different doors to different desks. Mixing them made the Action Center
           a list of two unrelated jobs where the buttons happened to match. The
           long ones are on Overstock, which is where a planner goes looking for
           them. */
        return !auto && !e.overridden && isShort(e);
      case TAB_ON_HOLD:
        /* Two ways onto the watchlist and they mean the same thing — somebody
           took this position out of the machine's hands. An override is that
           decision made against the policy; a parking is it made against the
           line, with a reason typed in the panel. */
        return decided === "watchlist" || (!decided && e.overridden);
      case TAB_RETURNED:
        /* Empty, and correctly so. A return is an event: the buying seat looked
           at a raise IRIS proposed and sent it back. Nothing in this prototype
           produces one, so inventing rows here would put two lines in front of a
           planner that no one had rejected. The tab stays, with its empty copy
           explaining what will land in it. */
        return false;
      case TAB_AUTO:
        /* Approved: routed there by confidence, or sent there by a press. */
        return decided === "approved" || (!decided && auto);
      /* Overstock and Deadstock are conditions, not states of the work — a
         position does not stop being long because somebody approved a move on
         it, and it will still be long tomorrow. So a decision does not remove
         it from these two. */
      case TAB_OVERSTOCK:
        /* Where the transfer lives — see `otherDc`. A decision does not remove a
           row from here: it will still be long until the lane is booked and the
           units actually move. */
        return over;
      case TAB_DEADSTOCK:
        /* No movement to speak of and stock still on the floor. */
        return e.demandMean < 1.2 && e.onHand > 0;
      case TAB_ALL:
        return true;
    }
  };

  /* Whether the All Products tab is on offer — see the tab strip below. */
  const searching = q.trim().length > 0;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    /* All Products searches the whole book, not just what is currently
       excepting — that is the point of the tab. */
    const base: Exception[] = tab === TAB_ALL ? allRows : exceptions;
    return base
      .filter((e) => (selected ? e.classification === selected : true))
      .filter((e) => inTab(tab, e))
      .filter((e) =>
        needle
          ? /* Product and SKU, which is what the box says. The centre is a
               two-item scope in the top bar and the supplier is one of three
               plants; searching either from here duplicated a control that is
               already on screen, and made the placeholder promise four things
               where the reader wanted one. */
            [e.sku, e.description].some((f) => f.toLowerCase().includes(needle))
          : true,
      );
  /* `actioned` is in here because a decision moves rows between tabs — see
     `inTab`. Without it the list would not re-cut when a run lands. */
  }, [selected, tab, q, allRows, exceptions, actioned]);

  /* Counted before the chips are applied, so each one says what it WOULD give
     rather than what is left after the others. A chip reading 0 because another
     chip is on is a chip that has stopped being a filter and started being a
     result. */
  const tierCounts = useMemo(() => {
    const n: Record<Tier, number> = { critical: 0, high: 0, med: 0 };
    for (const e of rows) {
      const t = tierOf(e);
      if (t) n[t] += 1;
    }
    return n;
  }, [rows]);

  const inTier = useMemo(() => {
    if (!tiers.size) return rows;
    return rows.filter((e) => {
      const t = tierOf(e);
      return t !== null && tiers.has(t);
    });
  }, [rows, tiers]);
  /**
   * What each column sorts ON, which is rarely what it prints.
   *
   * Half these cells are composed — a SKU over its description, a branch over
   * its classification pill, a severity drawn as a word. Sorting the rendered
   * string would order Exception alphabetically, putting Critical after Elevated,
   * which is the one ordering a severity column must not have. So each key names
   * the value underneath: a number where the column is a figure, a rank where it
   * is a grade, the text where it is genuinely text.
   */
  const sortValue = (e: Exception, field: string): number | string => {
    switch (field) {
      case "sku":
        return e.sku;
      case "branch":
        return `${e.branch} ${e.classification}`;
      case "onHand":
        return e.onHand;
      case "incoming":
        return e.incoming;
      case "leadTime":
        return e.leadTimeDays;
      case "safetyStock":
        return e.safetyStock;
      case "demandMean":
        return e.demandMean;
      case "vendor":
        return e.vendor;
      /* Worst first when descending, which is what a reader clicking a severity
         column is asking for — ranked by tier, so the order matches the words in
         the cells rather than the model underneath them. */
      case "exception": {
        const t = tierOf(e);
        return t === "critical" ? 3 : t === "high" ? 2 : t === "med" ? 1 : 0;
      }
      case "requestedQty":
        return e.requestedQty;
      case "value":
        return e.dollarsAtRisk;
      /* The surplus columns — see `overstockColumns`. */
      case "targetStock":
        return targetStock(e);
      case "excess":
        return excessOf(e);
      case "wos":
        return weeksOfSupply(e);
      case "excessWos":
        return excessWos(e);
      case "eoValue":
        return excessValue(e);
      case "transferTo":
        return e.transferTo ?? otherDc(e.branch);
      default:
        return 0;
    }
  };

  const sorted = useMemo(() => {
    if (!sort.field) return inTier;
    const dir = sort.dir === "asc" ? 1 : -1;
    const field = sort.field;
    return [...inTier].sort((a, b) => {
      const av = sortValue(a, field);
      const bv = sortValue(b, field);
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))) * dir
      );
    });
  }, [inTier, sort]);

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  /* IRIS's REVIEW_COLUMNS, in its order. Twelve of them, which is why this page
     pushes the agent panel into an overlay rather than letting it take 380px:
     the decision inputs — on hand against incoming, safety stock, demand, lead
     time — only mean anything read together, and a table that drops half of
     them off the right edge is a table that has to be scrolled to be used. */
  /* ── Two column sets, because they are two decisions ────────────
     A shortage is read against time: how many days of cover, how long the lead
     is, how much to request. A surplus is read against a level and a horizon:
     how much is above target, how many weeks of supply that is, and what the
     capital costs. Lead time is beside the point when you already have too much,
     and days of cover is the wrong unit for something that will take a season to
     burn.

     The headings are the industry's, not invented: target stock, excess qty,
     WOS (weeks of supply), excess WOS, and E&O value for the capital standing in
     it. An earlier pass had a column called "Clear in", which is not a thing
     anybody's report says. */
  const columns: DataTableColumn<Exception>[] = [
    {
      key: "sku",
      label: "Product SKUs",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Product SKUs" full="Product SKU" what="The stock-keeping unit and the style it belongs to." field="sku" sort={st} />
      ),
      minWidth: 232,
      /* Number over name, matching the buying seat's line items. The SKU is the
         key — it is what a planner types into the system and what a buyer quotes
         back — so it leads, and the style reads as the label under it.
         The swatch in front of both is what makes the column scannable: eleven
         rows of numbers over style names is a column of text, and nothing in it
         said whether a row was stoneware or a towel. */
      cell: (e) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={e.sku} />
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            {/* A peek, not a page. A planner scanning exceptions clicks a SKU to
                check what it is, then goes back to the row they were on — and
                the panel answers that without costing them the list. The full
                record is a click further, from inside the panel. */}
            {/* The deck, not the peek. On this page a SKU is a position somebody
                is deciding on, and the first view should be the argument for
                what to do about it — the working, the policy and where the line
                is heading. The peek stays what a SKU click means everywhere
                else, where the reader is looking a product up rather than
                deciding on it.
                Still an anchor: cmd-click goes straight to the record page, so
                the deck does not take that away. */}
            <a
              href={productRoute(e.sku)}
              title={`Demand deck · ${e.sku} at ${e.branch}`}
              className="truncate hover:underline"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
              onClick={(ev) => {
                if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                setDeckRow(e);
              }}
            >
              {e.sku}
            </a>
            <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
              {e.description}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "branch",
      label: "DC & classification",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          /* "DC", like OH and SS and LT beside it. The heading was 190px of
             nowrap over a 110px pill, and the two words it spent that on are
             both visible in the cell — the centre's name and the class are
             stacked right underneath. The tooltip carries the full name. */
          short="DC"
          full="DC & classification"
          what="The distribution centre holding this stock — not the plant that made it — and its ABC × XYZ class."
          field="branch"
          sort={st}
        />
      ),
      /* The pill is 110px wide and the heading is now just "DC" — see the
         ColumnHead above. 190 was sized for words that no longer print. */
      minWidth: 132,
      /* The action centre's own cell: the node as a chip with its factory glyph,
         the class as a chip under it. Two screens showing the same branch two
         ways is how a reader stops believing either — and a plain string beside a
         pill elsewhere reads as the less trustworthy of the two. */
      cell: (e) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          {/* A warehouse. Every value in this column is a distribution centre —
              where the stock stands — and the supplier column beside it is what
              carries the plant. */}
          <Pill variant="neutral" size="sm" icon={<Warehouse weight="duotone" />}>
            {e.branch}
          </Pill>
          <span className="flex">
            <Pill variant="neutral" size="sm">
              {e.classification}
            </Pill>
          </span>
        </span>
      ),
    },
    {
      key: "onHand",
      label: "OH",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="OH" full="On hand" what="Cartons physically in the centre today — cased units, as the DC receives them." field="onHand" sort={st} />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={e.onHand} />,
    },
    {
      key: "incoming",
      label: "Inc.",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Inc." full="Incoming" what="Cartons already on order and travelling, from the buying desk’s open purchase orders." field="incoming" sort={st} />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={e.incoming} />,
    },
    {
      key: "leadTime",
      label: "LT",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="LT" full="Lead time" what="Days from placing a replenishment to receiving it." field="leadTime" sort={st} />
      ),
      minWidth: 70,
      cell: (e) => <QtyStack value={e.leadTimeDays} unit="days" />,
    },
    {
      key: "safetyStock",
      label: "SS",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="SS" full="Safety stock" what="The buffer held against demand variability over the lead time." field="safetyStock" sort={st} />
      ),
      minWidth: 76,
      cell: (e) => (
        <span
          /* Below the buffer is the whole reason most of these rows exist, so
             the whole cell carries the warning — the unit under the figure is
             part of the same reading. */
          style={{
            color: e.onHand < e.safetyStock ? "var(--text-warning)" : undefined,
          }}
        >
          <QtyStack value={e.safetyStock} />
        </span>
      ),
    },
    {
      key: "demandMean",
      label: "Demand",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Demand" full="Demand mean" what="Average units consumed a day at this centre." field="demandMean" sort={st} />
      ),
      minWidth: 88,
      cell: (e) => (
        <QtyStack value={e.demandMean.toFixed(1)} unit="units/day" />
      ),
    },
    {
      key: "vendor",
      label: "Supplier",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Supplier" full="Supplier" what="The supplier plant that replenishes this SKU into this centre." field="vendor" sort={st} />
      ),
      minWidth: 144,
      /* A pill, and in the info blue rather than the neutral grey the centre
         beside it wears. Two pilled columns sitting side by side in the same
         grey read as one wide column of chips; the colour is what says these
         are two different kinds of place. The factory glyph makes the same
         point — a plant supplies, a centre holds. */
      cell: (e) => (
        <Pill variant="info" size="sm" icon={<Factory weight="duotone" />}>
          {e.vendor}
        </Pill>
      ),
    },
    {
      key: "exception",
      label: "Exception",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Exception" full="Exception severity" what="How hard this position is breaching its policy." field="exception" sort={st} />
      ),
      /* One short pill — Critical, High or Med. The heading is the widest
         thing in the column, so this is as narrow as the word allows. */
      minWidth: 104,
      /* The same three words as the chips above, from the same `tierOf`. The
         column said "Elevated" while the chip filtering it said "High" — one
         severity under two names a hand's width apart, and nothing on screen
         telling the reader they were the same thing.
         A DS pill rather than an icon beside a word, for the reason every other
         status in this app is one: hand-rolling it gave this column its own red,
         its own weight and no background. */
      cell: (e) => {
        const t = tierOf(e);
        if (!t) return <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>—</span>;
        return (
          <Pill
            size="sm"
            variant={t === "critical" ? "danger" : t === "high" ? "warning" : "neutral"}
          >
            {TIER_LABEL[t]}
          </Pill>
        );
      },
    },
    {
      key: "requestedQty",
      label: "Req. Qty.",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Req. Qty."
          full="Requested quantity"
          what="Cartons IRIS proposes ordering to close the gap. A proposal, not a figure read off a record — which is what the star means."
          field="requestedQty"
          sort={st}
          agent
        />
      ),
      minWidth: 90,
      cell: (e) => <QtyStack value={e.requestedQty} />,
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Value" full="Value at risk" what="What the requested quantity is worth at cost." field="value" sort={st} />
      ),
      minWidth: 100,
      cell: (e) => (
        <span style={{ fontSize: 14, ...numeric }}>
          {e.dollarsAtRisk > 0 ? formatUsd(e.dollarsAtRisk) : "—"}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      /* Its own column, last, and marked as the agent's the same way the insight
         beside it is — because pressing it hands the line to Iris rather than
         writing anything here. Twelve columns of decision inputs make the case;
         these last two are what the page is FOR, and they sit together at the
         end of the sentence. */
      headerCell: () => (
        <span className="inline-flex items-center" style={{ gap: 4 }}>
          <AiStar size={14} variant="small" />
          Action
        </span>
      ),
      /* The accept button plus two 28px icon buttons and their gaps. */
      minWidth: 160,
      /* The row is not itself clickable here, but the cell declares itself
         anyway: the moment it becomes so, a press on this button must not also
         count as a press on the row. */
      stopRowClick: true,
      /* Three controls, and they are three different answers to one proposal:
         accept it, ask about it, or set your own number instead. The verb alone
         on the accept button — the figure is in Req. Qty. two cells away, and
         the tooltip carries the move, the quantity and the reasoning for anyone
         who wants it before they press.

         Icon-only for the other two. They are alternatives to the main move
         rather than peers of it, and three labelled buttons in one cell would
         read as three equal choices. Each carries a DS tooltip with its name,
         because an icon on its own is a guess.

         Outline throughout: iris is what this app spends on the agent's own
         surfaces — the panel, the star. A column of filled buttons would make
         the table compete with the panel it hands work to. */
      cell: (e) => (
        <span className="flex items-center" style={{ gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            title={`${e.recommendedAction} · ${(e.confidence * 100).toFixed(0)}% confidence${
              routeFor(e.confidence, e.severity) === "auto" ? " · auto-routed" : ""
            } — ${e.reason}`}
            aria-label={`${e.recommendedAction} on ${e.sku} at ${e.branch}`}
            /* `approvalTaskFor`, not the branch's `exceptionTaskFor(…, "approve")`.
               Both narrate an approval; this one measures against TARGET rather
               than the safety-stock floor, counts what is travelling, and routes
               a shortage to buying and a surplus to logistics. The other reads
               "periods of cover" where this book has days and units. */
            onClick={() => startTask(approvalTaskFor(e))}
          >
            {/* The verb the row is actually asking for. Read off the position,
                not off the tab — All Products carries both kinds, and a button
                labelled from the tab would say "Approve" over a transfer there.
                "Approve" on a long position was also the wrong word twice over:
                approving is what a planner does to a purchase they cannot make,
                and moving stock between two Target centres is a decision they
                simply take. */}
            {isShort(e) ? "Approve" : "Transfer"}
          </Button>

          <Tooltip content="Add to watchlist">
            <Button
              size="icon"
              variant="outline"
              /* The DS icon size is 32px and `sm` is 28px, so squared off to
                 match the button beside it — three controls in one cell at two
                 different heights reads as a mistake. */
              className="h-7 w-7"
              aria-label={`Add ${e.sku} at ${e.branch} to the watchlist`}
              /* Opens the panel and asks why. The reason is the point: a
                 watchlist that takes rows without one becomes a list of things
                 somebody once hesitated over, and nobody can tell later whether
                 the hesitation still applies. */
              onClick={() => startWatch({ key: e.key, label: `${e.sku} at ${e.branch}` })}
            >
              {/* Phosphor's Star, and now it is the right glyph: this button
                  DOES bookmark the row. AiStar was here while the button opened
                  the agent — the gradient star is the app's mark for Iris, and
                  wearing it on a watchlist control claimed the agent was about
                  to do something. It is not; it is asking the planner a
                  question. */}
              <Star size={14} weight="bold" />
            </Button>
          </Tooltip>

          <Tooltip content="Override">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              aria-label={`Override the proposed quantity for ${e.sku} at ${e.branch}`}
              /* Asks for the two things an override needs — a quantity and a
                 reason — rather than drafting a cost-compare card the planner
                 cannot answer. The old run showed "Today" against "Policy says"
                 with identical figures in every column, because nothing had
                 changed yet: it displayed the position it was about to override
                 instead of letting anybody override it. */
              onClick={() =>
                startOverride({
                  key: e.key,
                  label: `${e.sku} at ${e.branch}`,
                  suggestedQty: e.requestedQty,
                  policy: e.systemPolicy,
                })
              }
            >
              <PencilSimple size={14} weight="bold" />
            </Button>
          </Tooltip>
        </span>
      ),
    },
  ];

  /* The surplus set. Same first two columns and the same action, different
     middle — see the note above the shortage columns. */
  const overstockColumns: DataTableColumn<Exception>[] = [
    {
      key: "sku",
      label: "Product SKUs",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Product SKUs" full="Product SKU" what="The stock-keeping unit and the style it belongs to." field="sku" sort={st} />
      ),
      minWidth: 232,
      /* Number over name, matching the buying seat's line items. The SKU is the
         key — it is what a planner types into the system and what a buyer quotes
         back — so it leads, and the style reads as the label under it.
         The swatch in front of both is what makes the column scannable: eleven
         rows of numbers over style names is a column of text, and nothing in it
         said whether a row was stoneware or a towel. */
      cell: (e) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={e.sku} />
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            {/* The deck, as on the shortage set above. */}
            <a
              href={productRoute(e.sku)}
              title={`Demand deck · ${e.sku} at ${e.branch}`}
              className="truncate hover:underline"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
              onClick={(ev) => {
                if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                setDeckRow(e);
              }}
            >
              {e.sku}
            </a>
            <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
              {e.description}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "branch",
      label: "DC & classification",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          /* "DC", like OH and SS and LT beside it. The heading was 190px of
             nowrap over a 110px pill, and the two words it spent that on are
             both visible in the cell — the centre's name and the class are
             stacked right underneath. The tooltip carries the full name. */
          short="DC"
          full="DC & classification"
          what="The distribution centre holding this stock — not the plant that made it — and its ABC × XYZ class."
          field="branch"
          sort={st}
        />
      ),
      /* The pill is 110px wide and the heading is now just "DC" — see the
         ColumnHead above. 190 was sized for words that no longer print. */
      minWidth: 132,
      /* The action centre's own cell: the node as a chip with its factory glyph,
         the class as a chip under it. Two screens showing the same branch two
         ways is how a reader stops believing either — and a plain string beside a
         pill elsewhere reads as the less trustworthy of the two. */
      cell: (e) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          {/* A warehouse. Every value in this column is a distribution centre —
              where the stock stands — and the supplier column beside it is what
              carries the plant. */}
          <Pill variant="neutral" size="sm" icon={<Warehouse weight="duotone" />}>
            {e.branch}
          </Pill>
          <span className="flex">
            <Pill variant="neutral" size="sm">
              {e.classification}
            </Pill>
          </span>
        </span>
      ),
    },
    {
      key: "onHand",
      label: "OH",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="OH" full="On hand" what="Cartons physically in the centre today — cased units, as the DC receives them." field="onHand" sort={st} />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={e.onHand} />,
    },
    {
      key: "targetStock",
      label: "Target",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Target"
          full="Target stock"
          what="What the policy asks this centre to hold: lead-time demand plus the safety buffer. Excess is measured from here, not from the buffer alone."
          field="targetStock"
          sort={st}
        />
      ),
      minWidth: 82,
      cell: (e) => <QtyStack value={targetStock(e)} />,
    },
    {
      key: "excess",
      label: "Excess",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Excess"
          full="Excess quantity"
          what="Cartons above target — on hand less lead-time demand and safety stock. This is what a transfer moves."
          field="excess"
          sort={st}
        />
      ),
      minWidth: 84,
      /* Signed and amber, because the sign is the whole point: this column only
         ever counts one way and a bare number reads as a stock figure. */
      cell: (e) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--text-warning)", ...numeric }}>
            {`+${excessOf(e)}`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>units</span>
        </span>
      ),
    },
    {
      key: "wos",
      label: "WOS",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="WOS"
          full="Weeks of supply"
          what="How long everything on hand lasts at the current run rate. Weeks rather than days, because a surplus is measured in the season it takes to burn."
          field="wos"
          sort={st}
        />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={weeksOfSupply(e)} unit="weeks" />,
    },
    {
      key: "excessWos",
      label: "Excess WOS",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Excess WOS"
          full="Excess weeks of supply"
          what="Weeks of cover above target — the excess expressed as time. Sixty days on hand against twenty days of required coverage is forty days of excess."
          field="excessWos"
          sort={st}
        />
      ),
      minWidth: 100,
      cell: (e) => <QtyStack value={`+${excessWos(e)}`} unit="weeks" />,
    },
    {
      key: "incoming",
      label: "Inc.",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Inc."
          full="Incoming"
          what="Cartons still on open purchase orders. On a long position this is the aggravating fact — it is already over target and more is arriving."
          field="incoming"
          sort={st}
        />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={e.incoming} />,
    },
    {
      key: "demandMean",
      label: "Demand",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Demand" full="Demand mean" what="Average units consumed a day at this centre." field="demandMean" sort={st} />
      ),
      minWidth: 88,
      cell: (e) => <QtyStack value={e.demandMean.toFixed(1)} unit="units/day" />,
    },
    {
      key: "eoValue",
      label: "E&O value",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="E&O value"
          full="Excess & obsolete value"
          what="The capital standing in the surplus — excess units at cost. Not value at risk: nothing here is at risk of being missed, the money simply is not working."
          field="eoValue"
          sort={st}
        />
      ),
      minWidth: 96,
      cell: (e) => (
        <span style={{ fontSize: 14, ...numeric }}>{formatUsd(excessValue(e))}</span>
      ),
    },
    {
      key: "transferTo",
      label: "Transfer to",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Transfer to"
          full="Transfer destination"
          what="Where the surplus goes. Target runs two centres in this book, so the answer is the other one — no purchase, and the network keeps the same units."
          field="transferTo"
          sort={st}
        />
      ),
      minWidth: 132,
      cell: (e) => (
        <Pill variant="neutral" size="sm" icon={<Warehouse weight="duotone" />}>
          {e.transferTo ?? otherDc(e.branch)}
        </Pill>
      ),
    },
    {
      key: "action",
      label: "Action",
      /* Its own column, last, and marked as the agent's the same way the insight
         beside it is — because pressing it hands the line to Iris rather than
         writing anything here. Twelve columns of decision inputs make the case;
         these last two are what the page is FOR, and they sit together at the
         end of the sentence. */
      headerCell: () => (
        <span className="inline-flex items-center" style={{ gap: 4 }}>
          <AiStar size={14} variant="small" />
          Action
        </span>
      ),
      /* The accept button plus two 28px icon buttons and their gaps. */
      minWidth: 160,
      /* The row is not itself clickable here, but the cell declares itself
         anyway: the moment it becomes so, a press on this button must not also
         count as a press on the row. */
      stopRowClick: true,
      /* Three controls, and they are three different answers to one proposal:
         accept it, ask about it, or set your own number instead. The verb alone
         on the accept button — the figure is in Req. Qty. two cells away, and
         the tooltip carries the move, the quantity and the reasoning for anyone
         who wants it before they press.

         Icon-only for the other two. They are alternatives to the main move
         rather than peers of it, and three labelled buttons in one cell would
         read as three equal choices. Each carries a DS tooltip with its name,
         because an icon on its own is a guess.

         Outline throughout: iris is what this app spends on the agent's own
         surfaces — the panel, the star. A column of filled buttons would make
         the table compete with the panel it hands work to. */
      cell: (e) => (
        <span className="flex items-center" style={{ gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            title={`${e.recommendedAction} · ${(e.confidence * 100).toFixed(0)}% confidence${
              routeFor(e.confidence, e.severity) === "auto" ? " · auto-routed" : ""
            } — ${e.reason}`}
            aria-label={`${e.recommendedAction} on ${e.sku} at ${e.branch}`}
            /* The run, in the panel. The press is the consent — it named the
               move and the figure — so the reading runs unasked and the writing
               follows without asking twice. See approvalTaskFor. */
            onClick={() => startTask(approvalTaskFor(e))}
          >
            {/* The verb the row is actually asking for. Read off the position,
                not off the tab — All Products carries both kinds, and a button
                labelled from the tab would say "Approve" over a transfer there.
                "Approve" on a long position was also the wrong word twice over:
                approving is what a planner does to a purchase they cannot make,
                and moving stock between two Target centres is a decision they
                simply take. */}
            {isShort(e) ? "Approve" : "Transfer"}
          </Button>

          <Tooltip content="Add to watchlist">
            <Button
              size="icon"
              variant="outline"
              /* The DS icon size is 32px and `sm` is 28px, so squared off to
                 match the button beside it — three controls in one cell at two
                 different heights reads as a mistake. */
              className="h-7 w-7"
              aria-label={`Add ${e.sku} at ${e.branch} to the watchlist`}
              /* Opens the panel and asks why. The reason is the point: a
                 watchlist that takes rows without one becomes a list of things
                 somebody once hesitated over, and nobody can tell later whether
                 the hesitation still applies. */
              onClick={() => startWatch({ key: e.key, label: `${e.sku} at ${e.branch}` })}
            >
              {/* Phosphor's Star, and now it is the right glyph: this button
                  DOES bookmark the row. AiStar was here while the button opened
                  the agent — the gradient star is the app's mark for Iris, and
                  wearing it on a watchlist control claimed the agent was about
                  to do something. It is not; it is asking the planner a
                  question. */}
              <Star size={14} weight="bold" />
            </Button>
          </Tooltip>

          <Tooltip content="Override">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              aria-label={`Override the proposed quantity for ${e.sku} at ${e.branch}`}
              onClick={() =>
                startOverride({
                  key: e.key,
                  label: `${e.sku} at ${e.branch}`,
                  suggestedQty: e.requestedQty,
                  policy: e.systemPolicy,
                })
              }
            >
              <PencilSimple size={14} weight="bold" />
            </Button>
          </Tooltip>
        </span>
      ),
    },
  ];

  /* ── The approved set ───────────────────────────────────────────
     A decided row is read for different reasons than an open one. Nobody is
     sizing it any more — the question is what was approved, how much, against
     what position, and who signed it. So the buffer, the demand rate and the
     exception tier drop out, and Approved Qty, Value and Approved by come in.

     "Approved by" is the column that makes the tab worth having: the routing
     grid sends high-confidence rows through without a human, and a planner
     answering for the book needs to see at a glance which ones went that way. */
  const approvedColumns: DataTableColumn<Exception>[] = [
    {
      key: "sku",
      label: "Product SKUs",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Product SKUs" full="Product SKU" what="The stock-keeping unit and the style it belongs to." field="sku" sort={st} />
      ),
      minWidth: 232,
      /* Number over name, matching the buying seat's line items. The SKU is the
         key — it is what a planner types into the system and what a buyer quotes
         back — so it leads, and the style reads as the label under it.
         The swatch in front of both is what makes the column scannable: eleven
         rows of numbers over style names is a column of text, and nothing in it
         said whether a row was stoneware or a towel. */
      cell: (e) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={e.sku} />
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            {/* A peek, not a page. A planner scanning exceptions clicks a SKU to
                check what it is, then goes back to the row they were on — and
                the panel answers that without costing them the list. The full
                record is a click further, from inside the panel. */}
            {/* The deck, not the peek. On this page a SKU is a position somebody
                is deciding on, and the first view should be the argument for
                what to do about it — the working, the policy and where the line
                is heading. The peek stays what a SKU click means everywhere
                else, where the reader is looking a product up rather than
                deciding on it.
                Still an anchor: cmd-click goes straight to the record page, so
                the deck does not take that away. */}
            <a
              href={productRoute(e.sku)}
              title={`Demand deck · ${e.sku} at ${e.branch}`}
              className="truncate hover:underline"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
              onClick={(ev) => {
                if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                setDeckRow(e);
              }}
            >
              {e.sku}
            </a>
            <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
              {e.description}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "branch",
      label: "DC & classification",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          /* "DC", like OH and SS and LT beside it. The heading was 190px of
             nowrap over a 110px pill, and the two words it spent that on are
             both visible in the cell — the centre's name and the class are
             stacked right underneath. The tooltip carries the full name. */
          short="DC"
          full="DC & classification"
          what="The distribution centre holding this stock — not the plant that made it — and its ABC × XYZ class."
          field="branch"
          sort={st}
        />
      ),
      /* The pill is 110px wide and the heading is now just "DC" — see the
         ColumnHead above. 190 was sized for words that no longer print. */
      minWidth: 132,
      /* The action centre's own cell: the node as a chip with its factory glyph,
         the class as a chip under it. Two screens showing the same branch two
         ways is how a reader stops believing either — and a plain string beside a
         pill elsewhere reads as the less trustworthy of the two. */
      cell: (e) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          {/* A warehouse. Every value in this column is a distribution centre —
              where the stock stands — and the supplier column beside it is what
              carries the plant. */}
          <Pill variant="neutral" size="sm" icon={<Warehouse weight="duotone" />}>
            {e.branch}
          </Pill>
          <span className="flex">
            <Pill variant="neutral" size="sm">
              {e.classification}
            </Pill>
          </span>
        </span>
      ),
    },
    {
      key: "onHand",
      label: "OH",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="OH" full="On hand" what="Cartons physically in the centre today." field="onHand" sort={st} />
      ),
      minWidth: 76,
      cell: (e) => <QtyStack value={e.onHand} />,
    },
    {
      key: "leadTime",
      label: "LT",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="LT" full="Lead time" what="Days from placing a replenishment to receiving it." field="leadTime" sort={st} />
      ),
      minWidth: 70,
      cell: (e) => <QtyStack value={e.leadTimeDays} unit="days" />,
    },
    {
      key: "vendor",
      label: "Supplier",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Supplier" full="Supplier" what="The supplier plant that replenishes this SKU into this centre." field="vendor" sort={st} />
      ),
      minWidth: 144,
      cell: (e) => (
        <Pill variant="info" size="sm" icon={<Factory weight="duotone" />}>
          {e.vendor}
        </Pill>
      ),
    },
    {
      key: "requestedQty",
      label: "Approved Qty",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead
          short="Approved Qty"
          full="Approved quantity"
          what="Cartons signed off — requested from the plant, or released for transfer."
          field="requestedQty"
          sort={st}
          agent
        />
      ),
      minWidth: 116,
      cell: (e) => <QtyStack value={e.requestedQty} />,
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      headerCell: ({ sort: st }) => (
        <ColumnHead short="Value" full="Value at risk" what="The exposure this approval closes." field="value" sort={st} />
      ),
      minWidth: 100,
      cell: (e) => (
        <span style={{ fontSize: 14, ...numeric }}>
          {e.dollarsAtRisk > 0 ? formatUsd(e.dollarsAtRisk) : "—"}
        </span>
      ),
    },
    {
      key: "approvedBy",
      label: "Approved by",
      sortable: true,
      minWidth: 132,
      /* Iris where the routing grid cleared it, the planner where they pressed
         the button. Marked with the star only in the first case — a person's
         name does not need the agent's glyph on it. */
      cell: (e) =>
        actioned.decision(e.key)?.bucket === "approved" ? (
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>Priya Raghavan</span>
        ) : (
          <span className="flex items-center" style={{ gap: 5 }}>
            <AiStar size={13} variant="small" />
            <span style={{ fontSize: 14, color: "var(--color-iris-700)" }}>Iris</span>
          </span>
        ),
    },
    {
      /* An action, not a claim. This column read "Auto-approved · all gates
         cleared" on every row — a sentence with no way to check it, which is the
         one thing an auto-approval must never be. A reader asked to trust nine of
         these has to be able to open one, so the column opens one: the gate the
         engine walked, step by step, in the order it walked it.
         Left-aligned with the star on the heading, as everywhere else on this
         seat — the glyph belongs to the column, not to each button. */
      key: "review",
      label: "Action",
      headerCell: () => <AgentColumnHeader>Action</AgentColumnHeader>,
      minWidth: 120,
      cell: (e) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => startTask(autoRouteTaskFor(e))}
          title={`Why ${e.sku} at ${e.branch} was settled without a planner`}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Inventory Planning"
        subtitle="Priya · Deployment Planner — where the book is exposed, and what IRIS proposes about it"
      />

      {/* No KPI row. The nine-box below is the summary — it says where the
          trouble is concentrated and how much of it there is, per cell — and a
          strip of totals above it answered the same question less precisely
          while pushing the matrix, which is the thing worth looking at, below
          the fold. */}
      <ABCMatrix
        cells={cells}
        selected={selected}
        onSelect={(c) => {
          setSelected(c);
          setPage(1);
        }}
        skuTotal={roll.skus}
        branchCount={BRANCH_COUNT}
      />

      <TableShell
        /* "Planner review" rather than "Exceptions": the tabs beneath it are not
           all exceptions — Approved, Overstock and All Products are standing
           views of the book — and a title that names only one of seven states
           mislabels the six it does not. */
        title={selected ? `Planner review · ${selected}` : "Planner review"}
        /* All Products only once the planner is searching. The other six tabs
           are states of the work — queued, approved, on a watchlist — and this
           one is the whole catalogue, which is not a state and is not what the
           page is for. It exists for the one question the work tabs cannot
           answer: "where is this SKU, and is anything wrong with it?" That
           question always starts at the search box, so the tab appears when the
           search does. */
        tabs={TABS.filter((id) => id !== TAB_ALL || searching).map((id) => ({
          id,
          label: id,
          badge: (id === TAB_ALL ? allRows : exceptions)
            .filter((e) => (selected ? e.classification === selected : true))
            .filter((e) => inTab(id, e)).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
          /* Clearing the box takes the tab away with it, so a planner cannot be
             left standing on a tab that is no longer in the strip. */
          if (!v.trim() && tab === TAB_ALL) setTab(TAB_REVIEW);
        }}
        searchPlaceholder="Search by product and SKU"
        /* Beside the search, because severity is the first cut a planner makes
           and the tabs above are about what has HAPPENED to a position — queued,
           approved, on a watchlist — not how hard it is breaching. Each carries
           its own count so the row doubles as the shape of the book. */
        filters={
          <span className="flex flex-wrap items-center" style={{ gap: 8 }}>
            {(["critical", "high", "med"] as Tier[]).map((t) => (
              <Chip
                key={t}
                selected={tiers.has(t)}
                variant={t === "critical" ? "danger" : t === "high" ? "warning" : "neutral"}
                count={tierCounts[t]}
                icon={
                  t === "med" ? (
                    <Info size={13} weight="duotone" />
                  ) : (
                    <WarningCircle size={13} weight="duotone" />
                  )
                }
                onClick={() => {
                  setTiers((prev) => {
                    const next = new Set(prev);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                  setPage(1);
                }}
              >
                {TIER_LABEL[t]}
              </Chip>
            ))}
          </span>
        }
        activeFilters={
          selected
            ? [
                {
                  key: "cell",
                  label: "Classification",
                  value: `${selected} · ${segmentPolicy(selected).sl}% SL`,
                  onRemove: () => setSelected(null),
                },
              ]
            : []
        }
        onClearAllFilters={() => {
          setSelected(null);
          setQ("");
          setTiers(new Set());
          setPage(1);
        }}
        isFiltered={!!selected || tiers.size > 0 || q.trim().length > 0}
        /* The count the pager works from has to be the list the pager is paging —
           it was reading `rows`, which is the tab before the chips narrow it, so
           turning a chip on left the footer offering pages that no longer had
           anything on them. */
        totalItems={sorted.length}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        emptyState={
          <div className="flex flex-col gap-1" style={{ padding: 24 }}>
            <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
              {EMPTY_COPY[tab].title}
            </span>
            <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
              {EMPTY_COPY[tab].desc}
            </span>
          </div>
        }
      >
        <DataTable<Exception>
          {...SHAW_TABLE_PROPS}
          /* The surplus set on Overstock, the shortage set everywhere else. All
             Products keeps the shortage columns: it is the whole book, most of
             which is neither, and lead time and cover are what a reader looking
             a SKU up actually wants. */
          columns={
            tab === TAB_OVERSTOCK
              ? overstockColumns
              : tab === TAB_AUTO
                ? approvedColumns
                : columns
          }
          data={paged}
          rowKey={(e) => e.key}
          /* The decided row holds its green for a beat before it leaves. Without
             it the list just gets shorter while the reader is watching the
             panel, which reads as a glitch rather than as work being finished.
             Same beat, same colour as the queue. */
          rowStyle={(e) =>
            actioned.isSettling(e.key)
              ? { background: "#ECFDF5", transition: "background 220ms ease-out" }
              : undefined
          }
          rowHoverColor={(e) => (actioned.isSettling(e.key) ? "#ECFDF5" : undefined)}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            /* Back to the first page. A sort that reorders the whole list while
               leaving the reader on page 3 shows them rows they did not ask for
               and hides the ones they did. */
            setPage(1);
          }}
        />
      </TableShell>

      {deckRow && <DemandDeckModal row={deckRow} onClose={() => setDeckRow(null)} />}
    </div>
  );
}
