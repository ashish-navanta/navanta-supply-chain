"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowSquareOut,
  Factory,
  Warehouse,
  Flag,
  Handshake,
  PaperPlaneTilt,
  Phone,
} from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  KToastContainer,
  KpiBreakdownCard,
  KpiGrid,
  PageHeading,
  Toast,
  Pill,
  Select,
  TableShell,
  type ActiveFilter,
  type DataTableColumn,
  type DataTableSortState,
  type DataTableSlotColumn,
} from "@navanta-ai/design-system";
import { useChatPanel } from "@/context/ChatPanelContext";
import { usePersona } from "@/context/PersonaContext";
import { regionOfRow, useScope } from "@/context/ScopeContext";
import { agentTaskFor, type AgentIcon } from "@/data/agent-actions";
import { PERSONAS } from "@/types/persona";
import {
  CAUSE_LABEL,
  CAUSE_STATUS,
  QUEUES,
  causeOf,
  daysFromToday,
  formatUsd,
  formatUsdFull,
  absoluteDate,
  relativeDay,
  targetCoverDays,
  type ActionRow,
  type Cause,
  type TabId,
} from "@/data/action-center";
import { PO_STAGES, SO_STAGES, currentStage, stagesFor } from "@/data/po-state";
import { ContactModal } from "@/components/chat/ContactModal";
import { DecisionModal } from "@/components/chat/DecisionModal";
import { ClaimModal } from "@/components/chat/ClaimModal";
import type { CommitReport } from "@/components/chat/commit";
import { SkuModal } from "@/components/chat/SkuModal";
import { AgentColumnHeader } from "@/components/ui/AgentColumnHeader";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { useActioned } from "@/lib/actioned";
import { useFiledClaims } from "@/lib/filed-claims";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { recordHref } from "@/lib/record-href";
import { linkedOrderOf } from "@/data/customer-notice";
import { dealerEtaAfterCommit } from "@/lib/account-eta";
import { orderById } from "@/data/service";
import { orderRoute, poRoute } from "@/data/nav";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * The summary row is one row of four, on every seat. Two cards are fixed — what
 * is open, and what owes a decision — which leaves room for the two biggest
 * causes. A seat with more than two open causes keeps them out of the row and
 * names them on the last card's tooltip, so nothing is dropped silently; the
 * full breakdown is a column and a filter away in the table below.
 */
const CAUSE_CARDS = 2;

/**
 * What a cause means in one clause, for the summary card's detail line. The
 * `CAUSE_LABEL` names the category; this says what actually happened, so a card
 * reading "Awaiting reply · 3" is not just a word the reader has to decode.
 */
const CAUSE_HINT: Record<Cause, string> = {
  supply: "a promise date moved",
  shortfall: "cover is short at a node",
  excess: "stock is sitting",
  awaiting: "no reply yet",
  cost: "over a threshold",
  status: "milestones disagree",
  damage: "a claim to settle",
};

/* Actions that reach the counterparty — these open the chat panel. Keyed on
   the action itself rather than the cause, because the same cause is a contact
   at `detected` and a decision at `decide`. */
const CONTACT_ACTIONS = new Set([
  "Contact supplier",
  "Contact plant",
  "Contact terminal",
  "Chase",
  "Pre-inform",
  "Follow up",
  "Verify",
]);


/**
 * Reference cell — the PO number over what it is worth, read together.
 *
 * The reference is also the way in: it opens the line's review in a new tab,
 * which is why the row no longer carries a Review button. A record you want to
 * study belongs beside the queue rather than on top of it, and the queue keeps
 * its place while you read.
 */
function RefCell({
  row,
  valueLabel,
  reviewHref,
}: {
  row: ActionRow;
  /** Omitted where the row's money is not part of the decision. */
  valueLabel?: string;
  reviewHref: string;
}) {
  /* A planner's line is a SKU at a branch, and its reference carries the style
     with the number in the sub-line. Everywhere else — a PO, a account order, a
     load — the reference IS the number. So where a row leads with a style, the
     two swap: the SKU is the key a planner types in and quotes back, and the
     style is its label. One rule, read off the data rather than off which queue
     is on screen, so a queue that gains SKU rows gets it for free. */
  const skuLed = row.refSub.startsWith("SKU ");
  const lead = skuLed ? row.refSub.replace(/^SKU\s*/, "") : row.ref;
  const under = skuLed ? row.ref : undefined;

  /* A swatch, on the rows that are a product. The same one Inventory Planning
     draws, so a planner moving between the two screens recognises a line by its
     colour in both. Not on a PO, an order or a load: those are shipments, and a
     swatch of the style on them would be picturing one SKU out of five. */
  const body = (
    <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
      {/* Same tab, and no new-tab glyph. The record now has a page and the top
          bar has a trail back to this queue, so opening it here is a step the
          reader can undo — where a new tab was a one-way door that left the
          queue behind and made the breadcrumb pointless. */}
      <Link
        href={reviewHref}
        title={`Open ${lead}`}
        className="flex min-w-0 items-center hover:underline"
        /* The design system's link colour, not iris. Iris means the agent here —
           the insight column, the starred headers, the panel — and a reference
           that merely opens a record is not the agent speaking. Blue is what the
           rest of the app uses for "this goes somewhere". */
        style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)" }}
      >
        <span className="truncate" style={skuLed ? numeric : undefined}>
          {lead}
        </span>
      </Link>
      {under && (
        <span
          className="ds-label truncate"
          style={{ color: "var(--ds-text-secondary)" }}
          title={under}
        >
          {under}
        </span>
      )}
      {/* The full figure, not $412K. The reference cell is where a reader picks
          which line to work, and rounding away the last three digits of the
          thing they are about to commit to saves nothing. The summary cards
          above keep the short form — there the reader is comparing magnitudes,
          not reconciling a number. */}
      {valueLabel && (
        <span
          className="truncate"
          style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}
          title={valueLabel}
        >
          {formatUsdFull(row.value)}
        </span>
      )}
    </span>
  );

  if (!skuLed) return body;
  return (
    <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
      <SkuSwatch sku={lead} size={28} />
      {body}
    </span>
  );
}

/** Quantity — figure stacked over its unit. */
function QtyCell({ row }: { row: ActionRow }) {
  return (
    <span className="flex flex-col" style={{ gap: 1 }}>
      <span
        style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}
      >
        {row.qtyValue}
      </span>
      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>{row.qtyUnit}</span>
    </span>
  );
}

/**
 * Where a status sits in the run, for ordering the filter's list.
 *
 * The two runs share their ends — both start at a raise/placement and finish at
 * a receipt or a delivery — so one rank over both reads correctly whichever
 * seat is looking. Anything that is not a stage (a stocking policy's kind of
 * problem) sorts after the stages rather than among them, because it is not a
 * point on any journey and putting it between two that are would imply it was.
 */
function stageRank(status: string): number {
  const po = PO_STAGES.indexOf(status as (typeof PO_STAGES)[number]);
  if (po >= 0) return po;
  const so = SO_STAGES.indexOf(status);
  if (so >= 0) return so;
  return PO_STAGES.length + 1;
}

/**
 * What the Status column says about a row.
 *
 * Declared once because three places need to agree on it: the cell that draws
 * it, the dropdown that lists what is selectable, and the predicate that
 * filters. The dropdown used to offer causes — "In-transit exception", "Cost
 * variance" — against a column showing stages: "Out for delivery", "Delivered",
 * "Shipped". Nothing in the list matched anything on screen, so a reader picking
 * a status was picking from a vocabulary the table does not use.
 *
 * Where a row has a journey the status is where it has got to. Where it has none
 * — a stocking policy has no stages — it is the kind of problem instead, which
 * is the most a status can mean for a row that is not going anywhere.
 */
function statusOf(row: ActionRow): string {
  const stages = stagesFor(row);
  return stages ? currentStage(stages) : CAUSE_STATUS[causeOf(row.signal)];
}

/**
 * A date with how far away it is underneath.
 *
 * "23 Aug" is a fact; "in 11 days" is the reason to deal with it now or leave
 * it. Same two-line shape as the quantity cell, so the eye reads figure-then-
 * unit down the whole table rather than learning a second pattern.
 *
 * A date that has arrived or passed goes amber. That is information, not
 * decoration — a committed promise still sitting in this queue on the day it
 * falls due is the row most likely to become somebody's phone call.
 */
function DateCell({ value, was }: { value: string; was?: string }) {
  const rel = relativeDay(value);
  const days = daysFromToday(value);
  const due = days !== null && days <= 0;
  return (
    <span className="flex flex-col" style={{ gap: 1 }}>
      <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
        {absoluteDate(value)}
      </span>
      {/* Where the date came from, where it came from somewhere. "in 25 days" is
          worth saying about a promise nobody has moved; on one that HAS moved it
          answers a question nobody asked and hides the one they did — a account
          still holding 15 Aug is the reason the row is open. The relative day
          comes back when there is nothing to compare against. */}
      {was ? (
        <span style={{ fontSize: 12, color: "var(--text-warning)", ...numeric }}>
          {`was ${absoluteDate(was)}`}
        </span>
      ) : (
        rel && (
          <span
            style={{ fontSize: 12, color: due ? "var(--text-warning)" : "var(--ds-text-secondary)" }}
          >
            {rel}
          </span>
        )
      )}
    </span>
  );
}

/**
 * One queue screen for whichever seat is active. Each persona has exactly one
 * queue; the planner's lives on its own route.
 */
/**
 * The row button's glyph, where there is one.
 *
 * A tick was tried on every commit and it earned nothing: the label already
 * says "Re-promise 29 Aug", and a check beside it reads as "done" on a button
 * whose whole point is that it has NOT been done yet. What still gets a glyph
 * is the handful that leave the building — a call, a message, a flag raised
 * with another desk — because there the medium is not in the words.
 */
function actionGlyph(icon: AgentIcon): React.ReactNode | undefined {
  const props = { size: 13, weight: "bold" as const };
  if (icon === "call") return <Phone {...props} />;
  if (icon === "email" || icon === "send") return <PaperPlaneTilt {...props} />;
  if (icon === "flag") return <Flag {...props} />;
  return undefined;
}

export function QueueScreen() {
  const { persona } = usePersona();
  const { startTask } = useChatPanel();
  const profile = PERSONAS[persona];
  const queue = QUEUES[persona];

  const [tab, setTab] = useState<TabId>(queue.tabs[0].id);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Exposure orders the queue — with priority gone, the money is the signal
  // for what to work first.
  const [sort, setSort] = useState<DataTableSortState>({ field: "value", dir: "desc" });

  // Reset transient state when the persona switches — a tab or filter from one
  // seat's queue is meaningless in another's.
  /* One open row rather than one state per modal kind: the header arrows step
     through the list, and a neighbour may need the other modal, so the row has
     to decide which one renders. */
  const params = useSearchParams();
  const [openRow, setOpenRow] = useState<ActionRow | null>(null);

  /**
   * Open the row a `?review=` link names.
   *
   * This used to be the initial value of `openRow`, computed once in a lazy
   * initialiser — which meant it was computed on the render where
   * `useSearchParams()` is still empty. On a statically prerendered route the
   * params arrive on a later pass, and a lazy initialiser never runs again, so
   * every review link in the app opened the queue with no modal on it. Every
   * reference cell is such a link, which is why none of them worked.
   *
   * Keyed on the id last acted on rather than on whether a modal is open, so
   * closing the panel does not fight the URL: the param has not changed, so
   * nothing reopens. Navigating to a different row still does.
   */
  const reviewParam = params.get("review");
  const [appliedReview, setAppliedReview] = useState<string | null>(null);
  if (reviewParam !== appliedReview) {
    setAppliedReview(reviewParam);
    const row = reviewParam ? queue.rows.find((r) => r.id === reviewParam) : undefined;
    if (row) setOpenRow(row);
  }
  /* Committed work is reported by a toast rather than a panel inside the modal:
     the modal closes on commit, so anything drawn in it would flash and go. */
  const [toast, setToast] = useState<CommitReport | null>(null);

  /** Close whichever modal is open and raise the notification. */
  const commit = (report: CommitReport) => {
    setOpenRow(null);
    setToast(report);
  };

  const [lastKey, setLastKey] = useState(persona);
  if (lastKey !== persona) {
    setLastKey(persona);
    setTab(QUEUES[persona].tabs[0].id);
    setQ("");
    setStatus("all");
    setPage(1);
    setSort({ field: "value", dir: "desc" });
  }

  /* Rows the agent has finished with have left the queue. Applied once, here,
     rather than at the table: the summary cards and the rail badge count from
     the same list, and a line that is gone from the table but still inside
     "6 need a decision" is the disagreement this whole seat argues against. */
  const actioned = useActioned();
  /* Narrowed to the plant in the top bar before anything else touches the list,
     so the tab counts, the summary cards and the rail badge all describe the
     same book the table is showing. Filtering later would have the cards
     counting rows the reader cannot see. */
  const { inScope, region, country, category, entity, empty } = useScope();
  /* Claims filed in this session sit at the front of the seat's own rows.
     They go through `actioned.live` and `inScope` with everything else — a row
     the reader just created is still a row, and exempting it would leave it
     visible after it had been settled, or showing under a plant it does not
     belong to. */
  const { rows: filedClaims, isArriving } = useFiledClaims();
  const rows = useMemo(
    () => actioned.live([...filedClaims, ...queue.rows]).filter(inScope),
    [actioned, queue, inScope, filedClaims],
  );

  const active = queue.tabs.find((t) => t.id === tab) ?? queue.tabs[0];
  /* Settled lines are described by what was done, not by what went wrong, so the
     cause column and its filter only exist on the open tab. */
  /* The settled tab is a record, not a work list: its cause has been dealt
     with and there is nothing left to press. Both the cause column and the
     action column hang off this. */
  const showCause = active.id !== "settled";
  const showAction = active.id !== "settled";

  const inTab = useMemo(
    () =>
      rows.filter(
        (r) =>
          active.states.includes(r.state) &&
          // A tab with a `kind` splits orders from claims; without one, state alone decides.
          (!active.kind || (active.kind === "claim") === Boolean(r.claim)),
      ),
    [rows, active],
  );

  /* ── The summary row ─────────────────────────────────────────────────
     Counted over the WHOLE queue, not the active tab. These cards are the
     seat's standing position — what is open, what owes a decision, and what
     kind of problem it all is — and a standing position that changes when you
     switch tabs is not one. Tabs and filters narrow the table below; the row
     above it stays put so the figures you arrived with are still the figures
     you are working against.

     Everything here is scoped to rows that are still live. A settled line is a
     record, and rolling it into "open exposure" or into a cause count would
     report closed work as outstanding. */
  const openRows = useMemo(() => rows.filter((r) => r.state !== "settled"), [rows]);

  /** Causes across everything still open, largest first, with the money behind
   *  each. Every cause the seat currently has gets a card — that is the point
   *  of the row: all of it, upfront. */
  const causeStats = useMemo(() => {
    const buckets = new Map<Cause, { count: number; value: number }>();
    for (const r of openRows) {
      const c = causeOf(r.signal);
      const hit = buckets.get(c) ?? { count: 0, value: 0 };
      buckets.set(c, { count: hit.count + 1, value: hit.value + r.value });
    }
    return [...buckets.entries()]
      .map(([c, s]) => ({ cause: c, ...s }))
      .sort((a, b) => b.count - a.count || b.value - a.value);
  }, [openRows]);

  const totals = useMemo(() => {
    const of = (rows: ActionRow[]) => ({
      count: rows.length,
      value: rows.reduce((s, r) => s + r.value, 0),
    });
    return {
      open: of(openRows),
      decide: of(openRows.filter((r) => r.state === "decide")),
      settledCount: rows.length - openRows.length,
    };
  }, [rows, openRows]);

  /** Causes that did not fit the row of four. Named on the last card rather than
   *  dropped — a summary that silently omits a category is worse than one that
   *  admits the row is full. */
  const restCauses = causeStats.slice(CAUSE_CARDS);

  /* The cause FILTER still offers only what the active tab contains — a filter
     that can select a cause with no rows behind it on this tab is a dead end. */
  const statusesInQueue = useMemo(() => {
    const seen = new Set<string>();
    for (const r of inTab) seen.add(statusOf(r));
    /* In the order the run happens, not alphabetically — "Delivered, In process,
       Out for delivery" reads as three unrelated words, and a transport reader
       looking for the late ones expects to find them at one end. */
    return [...seen].sort((a, b) => stageRank(a) - stageRank(b));
  }, [inTab]);

  /* Which kinds of reference this tab's linked-order column holds — see the
     column's own note. Computed here because the column list is rebuilt per
     render and both the header and the cell need the same answer. */
  const linkedLabel = useMemo(() => {
    let inbound = false;
    let outbound = false;
    for (const r of inTab) {
      const link = linkedOrderOf(r);
      if (!link) continue;
      if (link.inbound) inbound = true;
      else outbound = true;
    }
    if (inbound && !outbound) return "Linked PO";
    if (outbound && !inbound) return "Linked SO";
    return "Linked order";
  }, [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((r) => {
      if (showCause && status !== "all" && statusOf(r) !== status) return false;
      if (!needle) return true;
      return [
        r.ref, r.refSub, r.party, r.product, r.status, r.insight,
        r.qtyValue, r.qtyUnit, statusOf(r), CAUSE_LABEL[causeOf(r.signal)],
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, showCause, status, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    /* A line another desk is waiting on outranks a bigger line nobody is blocked
       by. Exposure is the right axis among peers — it is what the seat is
       measured on — but it is the wrong first question when one of these rows has
       a planner re-sizing a buffer and a buyer holding a date against it. Being
       part of a live chain is the tie-break, not a replacement for the sort: the
       reader still gets biggest-first within each group. */
    const chained = (r: ActionRow) => (r.chainFrom ? 0 : 1);
    /* The seat's lead row sits above all of it — see `lead` on ActionRow. It
       survives a re-sort on purpose: it is where the seat opens, not a claim
       about its exposure. */
    const lead = (r: ActionRow) => (r.lead ? 0 : 1);
    return [...filtered].sort((a, b) => {
      const byLead = lead(a) - lead(b);
      if (byLead !== 0) return byLead;
      const byChain = chained(a) - chained(b);
      if (byChain !== 0) return byChain;
      if (sort.field === "value") return (a.value - b.value) * dir;
      if (sort.field === "cause") {
        return CAUSE_LABEL[causeOf(a.signal)].localeCompare(CAUSE_LABEL[causeOf(b.signal)]) * dir;
      }
      /* Dates as dates. The column holds "8 Aug", "Today 14:20" and "3d ago" in
         one place, and a string compare only ever put them in the right order by
         accident — "8" sorts before "T", which is the correct answer for the
         wrong reason and would have flipped the moment a load was due in
         September. */
      if (sort.field === "date") {
        /* Rank by the date the cell actually shows — see the column's note. */
        const shown = (r: ActionRow) =>
          dealerEtaAfterCommit(r.ref)?.date ?? r.committedOn ?? r.date;
        const at = daysFromToday(shown(a));
        const bt = daysFromToday(shown(b));
        if (at !== null && bt !== null) return (at - bt) * dir;
        if (at !== null) return -1;
        if (bt !== null) return 1;
      }
      const av = String(a[sort.field as keyof ActionRow] ?? "");
      const bv = String(b[sort.field as keyof ActionRow] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sort]);

  /* Numbering follows the sort, so #1 is always the first thing to work. */
  const rowNumber = new Map<string, number>();
  sorted.forEach((r, i) => rowNumber.set(r.id, i + 1));

  const serialSlot: DataTableSlotColumn<ActionRow> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (row) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(row.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    !showCause || status === "all"
      ? []
      : [
          {
            key: "status",
            label: "Status",
            value: status,
            onRemove: () => {
              setStatus("all");
              setPage(1);
            },
          },
        ];

  /**
   * Where the line has got to, drawn as the Customer Ops portal draws it.
   *
   * Same dots as the Orders table and the same derivation as the tracking card
   * in the panel, so a row cannot say "allocated" here and "shipped" there. The
   * current dot turns amber when the row is a decision rather than a wait, which
   * is what makes the column worth its width: one glance gives both how far
   * along and whether it is on you.
   */
  const statusColumn: DataTableColumn<ActionRow> = {
    key: "status",
    label: "Status",
    /* 148 was sized for the widest stage name plus its dots; on the planner's
       rows, which carry a one-word cause instead of a journey, that left a
       column of whitespace between the figures and the insight. Capped so the
       longest label still fits without the column claiming room for it on every
       row. */
    minWidth: 108,
    maxWidth: 132,
    cell: (r) => {
      const stages = stagesFor(r);
      /* No journey to draw — a stocking policy has no stages. `statusOf` says
         what kind of problem it is instead. */
      if (!stages) {
        return (
          <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>{statusOf(r)}</span>
        );
      }
      const at = stages.findIndex((st) => st.state === "active");
      const needsYou = r.state === "decide";
      return (
        <span
          className="flex min-w-0 flex-col"
          style={{ gap: 4 }}
          aria-label={`${currentStage(stages)}${needsYou ? " — needs a decision" : ""}`}
        >
          <span className="flex items-center" style={{ gap: 3 }}>
            {stages.map((st, i) => {
              let bg: string;
              if (st.state === "done") bg = "var(--ds-icon-success)";
              else if (i === at) bg = needsYou ? "var(--ds-icon-error)" : "var(--ds-icon-info)";
              else bg = "var(--ds-border-subtle)";
              return (
                <span
                  key={st.label}
                  aria-hidden="true"
                  className="rounded-full"
                  style={{ width: 8, height: 8, background: bg }}
                />
              );
            })}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ds-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {currentStage(stages)}
          </span>
        </span>
      );
    },
  };

  const columns: DataTableColumn<ActionRow>[] = [
    {
      // Sorted on `value`: the money is the number stacked in this cell and the
      // axis the queue is ranked by, now that Exposure has no column of its own.
      key: "value",
      label: active.refLabel ?? queue.refLabel,
      sortable: true,
      minWidth: 140,
      // Capped so a long style name ("Organic Granola Clusters 12oz")
      // truncates instead of stretching the column and pushing the action
      // button into horizontal overflow.
      maxWidth: 215,
      cell: (r) => (
        <RefCell row={r} valueLabel={queue.valueLabel} reviewHref={recordHref(r.ref, `${profile.route}?review=${r.id}`)} />
      ),
    },
    {
      key: "party",
      label: queue.partyLabel,
      sortable: true,
      minWidth: 145,
      maxWidth: 162,
      // The counterparty reads as a chip in every queue — supplier, plant,
      // node, account or carrier. Neutral, so it never competes with the
      // priority pill. The icon says whether it's Target's or someone else's,
      // which changes the move: an own plant gets rescheduled, a third party
      // gets a call.
      /* On a planner row the branch alone does not say what the policy should
         do about it — the ABC × XYZ class does, and it is the axis Parts
         Planning classifies on. Same letter, same meaning, one type. */
      cell: (r) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <Pill
            variant={r.partyOwn ? "neutral" : "info"}
            size="sm"
            /* A warehouse where the party is a distribution centre, a factory
               where it is a plant. Both read as Target's own, so `partyOwn`
               cannot tell them apart — and drawing a DC with a factory said the
               stock was made where it is merely standing.

               Asked of the catalogue, not of the string. This used to test for
               "DC-" followed by a digit, which stopped being true the moment the
               twelve invented sites became Woodland and Wilton — and every
               centre quietly went back to wearing a factory. */
            icon={
              regionOfRow(r) ? (
                <Warehouse weight="duotone" />
              ) : r.partyOwn ? (
                <Factory weight="duotone" />
              ) : (
                <Handshake weight="duotone" />
              )
            }
          >
            {r.party}
          </Pill>
          {r.cover && (
            <span className="flex">
              <Pill variant="neutral" size="sm">
                {r.cover.classification}
              </Pill>
            </span>
          )}
        </span>
      ),
    },
    // No Product column: a PO routinely spans several SKUs (PO-4471 is four),
    // so a single product per row would be a lie on the buyer's tabs. The
    // field stays on the row and remains searchable.
    {
      key: "qty",
      label: queue.qtyLabel,
      minWidth: 76,
      cell: (r) => <QtyCell row={r} />,
    },
    /* Planner-only, and in the order a planner reads them: what is here, what
       is coming, and how long the next lot takes. Those three are the whole of
       a cover decision, and the queue used to make the reader open the row to
       find two of them. */
    ...(queue.partyLabel === "DC & classification"
      ? [
          {
            key: "incoming",
            label: "Incoming",
            minWidth: 84,
            cell: (r: ActionRow) =>
              r.cover ? (
                <span className="flex flex-col" style={{ gap: 1 }}>
                  <span
                    className="ds-body"
                    style={{ color: "var(--ds-text-primary)", ...numeric }}
                  >
                    {r.cover.incoming}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {r.cover.incoming === 0 ? "nothing due" : r.qtyUnit}
                  </span>
                </span>
              ) : null,
          },
          {
            key: "lead",
            label: "Lead time",
            minWidth: 92,
            cell: (r: ActionRow) =>
              r.cover ? (
                <span className="flex flex-col" style={{ gap: 1 }}>
                  <span
                    className="ds-body"
                    style={{ color: "var(--ds-text-primary)", ...numeric }}
                  >
                    {`${r.cover.leadDays} days`}
                  </span>
                  {r.cover.leadDays !== r.cover.wasLeadDays && (
                    <span className="ds-label" style={{ color: "var(--text-danger)" }}>
                      {`was ${r.cover.wasLeadDays}`}
                    </span>
                  )}
                </span>
              ) : null,
          },
        ]
      : []),
    {
      key: "date",
      label: queue.dateLabel,
      minWidth: 84,
      /* The committed date where the row has one. `date` itself carries the
         REVISED promise on a decide row and elapsed time on a waiting row, so
         reading it here put three different things under one heading. The
         revised date belongs to the decision, and the modal shows both. */
      cell: (r) => {
        /* A account order's date is its purchase order's receipt plus the run out
           to the account, so committing upstream moves it here too — see
           `dealerEtaAfterCommit`. */
        const moved = dealerEtaAfterCommit(r.ref);
        const order = orderById(r.ref);
        /* What this date replaced. A commit upstream moved it from the order's own
           ETA; failing that, a re-promised order moved it from the date the account
           was originally given. Undefined where nothing moved, and the cell goes
           back to saying how far off it is. */
        const was = moved
          ? order?.currentEta
          : order && order.currentEta !== order.promisedOn
            ? order.promisedOn
            : undefined;
        /* This screen is a stocking POLICY, so the column is the policy's figure:
           how many days of cover the lead time and its buffer are sized to give.
           It read 6 — today's on-hand position — which is a different measurement
           under the same heading, and it made a 42-day replenishment window look
           like it was covered by six days of stock. Where the position stands is
           On hand and Incoming, two columns to the left, and the insight names it
           in words. */
        if (r.cover) {
          return (
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {`${targetCoverDays(r.cover)} days`}
            </span>
          );
        }
        return <DateCell value={moved?.date ?? r.committedOn ?? r.date} was={was} />;
      },
    },
    /* The order a line is against — on the two seats where a line IS one.
       A load carries an order and a claim is filed against one, so on those
       seats the reference is half the row's meaning.
       Not on buying: a purchase order is raised, received, and only then is the
       order against it cut, so a buyer working an open PO has no order to link
       to and the column could only promise a record nobody has created.
       Not on planning either, and for the mirror reason. A planner's row is a
       stocking policy on a SKU, not a shipment; whichever purchase order happens
       to be inbound against it is not what they are deciding, and the Incoming
       column already tells them cover is on its way. A reference they will not
       open is a column of width taken from the numbers they will.
       Still only where some row on the tab actually has one — a column of dashes
       tells the reader nothing except that the column was a mistake. */
    ...((persona === "logistics" || persona === "csr") && inTab.some((r) => linkedOrderOf(r))
      ? [
          {
            key: "linked",
            /* "Sales order" was right until an inbound load appeared under it. A
               drayage off a vessel carries a purchase order, and a header that
               promises one kind of reference while the column holds two is the
               drift this app keeps having to undo. */
            /* Named for what the column actually holds, read off the tab
               rather than assumed from the seat. A account order links the
               purchase order supplying it; a claim links the sales order it is
               filed against; a load links whichever it is carrying. So the same
               column is "Linked PO" on one tab and "Linked SO" on the next, and
               only takes the vaguer name when a tab genuinely holds both. */
            label: linkedLabel,
            minWidth: 132,
            stopRowClick: true,
            cell: (r: ActionRow) => {
              const link = linkedOrderOf(r);
              /* A backhaul leg is running empty — there is nothing to name. A
                 dash said "we do not know"; saying what the leg IS is true and is
                 what the reader wanted. */
              if (!link) {
                return (
                  <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>
                    {r.signal === "backhaul" ? "Empty return" : "—"}
                  </span>
                );
              }
              /* The direction under the reference rather than beside it: it is
                 the qualifier on the number, and a reader scanning the column for
                 "which of these are coming in" wants one glance down a single
                 line, not to read six pills. */
              return (
                <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
                  {/* A new tab, always. This link crosses a seat: opening it in
                      place swaps the rail, the agent panel and the queue the
                      reader was working out from under them, and the only way
                      back is a breadcrumb they have to notice. The load is the
                      job; the order it carries is a thing they glance at and
                      close. */}
                  <a
                    href={link.inbound ? poRoute(link.ref) : orderRoute(link.ref)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-1 hover:underline"
                    style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)" }}
                    title={`Open ${link.ref} in a new tab`}
                  >
                    <span className="truncate">{link.ref}</span>
                    <ArrowSquareOut size={11} className="shrink-0" />
                  </a>
                  {/* Only where the column is mixed. Where the header has
                      already said "Linked PO", a row of identical "Inbound"
                      labels is a second column of one repeated word. */}
                  {linkedLabel === "Linked order" && (
                    <span
                      className="truncate"
                      style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}
                      title={
                        link.inbound
                          ? "A purchase order — goods coming in to a Target RDC"
                          : "A sales order — goods going out to a account"
                      }
                    >
                      {link.inbound ? "Inbound" : "Outbound"}
                    </span>
                  )}
                </span>
              );
            },
          },
        ]
      : []),
    /* Status stays on the settled tab. `showCause` used to gate it, which
       conflated two different things: the CAUSE has been dealt with and is not
       worth a column, but where the line has got to is exactly what a settled
       record is for — a committed PO still has to be acknowledged and still has
       to arrive. */
    statusColumn,
    {
      key: "insight",
      label: "Iris Insight",
      minWidth: 200,
      wrapLines: 2,
      headerCell: () => <AgentColumnHeader>{profile.agent} Insight</AgentColumnHeader>,
      /* Two lines where the line is a move and a figure: the words on top, the
         numbers under them. On one line "Change safety stock 57 → 76" clamped
         mid-sentence and the two numbers — the only part nothing else on the row
         carries — were the half that got cut. The tooltip keeps the whole
         sentence either way. */
      cell: (r) =>
        r.cover ? (
          <span className="flex min-w-0 flex-col" title={r.insight} style={{ gap: 1 }}>
            <span
              className="truncate"
              style={{ fontSize: 14, lineHeight: "18px", color: "var(--color-iris-700)" }}
            >
              Change safety stock
            </span>
            <span
              className="truncate font-medium"
              style={{ fontSize: 14, lineHeight: "18px", color: "var(--color-iris-700)", ...numeric }}
            >
              {`${r.cover.safetyNow} → ${r.cover.safetyNeeded}`}
            </span>
          </span>
        ) : (
          <span
            title={r.insight}
            style={{
              fontSize: 14,
              lineHeight: "18px",
              color: "var(--color-iris-700)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {r.insight}
          </span>
        ),
    },
  ];

  /* The action column, only where there is an action. A settled line has
     nothing to press — `agentTaskFor` returns null for it, so the column was
     already empty; dropping it gives the record its width back. */
  const actionColumn: DataTableColumn<ActionRow> = {
      key: "action",
      label: "Action",
      headerCell: () => <AgentColumnHeader>Action</AgentColumnHeader>,
      minWidth: 142,
      stopRowClick: true,
      /* One control. Review is the reference itself now, which leaves this
         column for the only thing that is genuinely an action on the row: hand
         its named move to the agent.
         Left-aligned, not flushed to the table's edge: the labels differ in
         length, so ranging them right staggers every button's first character
         and the eye has to find each one. Ranged left they start on a common
         edge and read as a column of moves.
         Plain outline, no brand colour: iris is what this app spends on the
         agent's own surfaces — the panel, the star, the insight column. A row
         of six purple buttons made the table compete with the panel it hands
         work to, and made a routine control look like a promotion. The label
         says what it does; the glyph says which kind. Neither needs tinting. */
      cell: (r) => {
        const agentTask = agentTaskFor(r);
        if (!agentTask) return null;

        return (
          <span className="flex items-center">
            <Button
              size="sm"
              variant="outline"
              /* Undefined rather than an empty element: the DS reserves the
                 icon slot's gap whenever `iconLeft` is present, so a null
                 component still left a 6px hole before the label. */
              iconLeft={actionGlyph(agentTask.icon)}
              title={`Ask ${profile.agent} to ${agentTask.label.toLowerCase()} on ${r.ref}`}
              aria-label={`Ask ${profile.agent} to ${agentTask.label.toLowerCase()} on ${r.ref}`}
              onClick={() => startTask(agentTask)}
            >
              {agentTask.label}
            </Button>
          </span>
        );
      },
    };


  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        /* The planner's queue is stocking policy — every row is a level that
           has to move — so it is named for what it is rather than for the shape
           it shares with the other seats. The separate policy page said the same
           thing about the same SKUs a click away, which is why it is gone. */
        title={persona === "planner" ? "Product stocking policy" : `${profile.pageTitle} action center`}
        /* The whole scope is named here as well as in the top bar. A queue that
           is three rows long because a filter is on, with the filter forty
           pixels above the fold, is a queue the reader reads as empty. The
           centre only appears on the planner's, because that is the only seat
           whose rows sit at one — a purchase order belongs to a plant and a
           load to a lane, and naming a centre over either would claim a scope
           that is not cutting anything. */
        subtitle={
          empty
            ? `${profile.name} · ${profile.role} — that book is not loaded in this prototype`
            : `${profile.name} · ${profile.role} — ${profile.seat} · ${category.label}${
                region ? ` · ${region.name}` : ""
              }${country ? ` · ${country.name}` : ""}${entity ? ` · ${entity}` : ""}`
        }
      />

      {/* The seat's standing position, whole-queue and tab-independent: what is
          open, the part of it that owes a decision, then one card per cause the
          seat currently has. Every figure the person needs is here on arrival —
          switching tabs or filtering narrows the table, never this row. */}
      {/* Columns follow the cards, not a fixed four. A seat with one cause
          renders three and used to leave a quarter of the row empty — a grid
          that reserves a slot for a card that does not exist reads as something
          having failed to load. */}
      <KpiGrid columns={(2 + Math.min(CAUSE_CARDS, causeStats.length)) as 2 | 3 | 4}>
        <KpiBreakdownCard
          title="Value at risk"
          value={formatUsd(totals.open.value)}
          subtitle={
            totals.settledCount === 0
              ? `${totals.open.count} open ${totals.open.count === 1 ? "line" : "lines"}`
              : `${totals.open.count} open · ${totals.settledCount} settled`
          }
          info={queue.valueLabel ?? "Exposure"}
        />
        <KpiBreakdownCard
          title="Needs disposition"
          value={String(totals.decide.count)}
          subtitle={
            totals.decide.count === 0
              ? "Nothing waiting on you"
              : `${formatUsd(totals.decide.value)} exposed · ${profile.agent} has done the legwork`
          }
        />

        {/* The diagnosis. The two cards above say how much is open and how much
            is yours to decide; these say what kind of problem it actually is. */}
        {causeStats.slice(0, CAUSE_CARDS).map((s, i) => (
          <KpiBreakdownCard
            key={s.cause}
            title={CAUSE_LABEL[s.cause]}
            value={String(s.count)}
            subtitle={`${formatUsd(s.value)} exposed · ${CAUSE_HINT[s.cause]}`}
            /* The last card carries whatever did not fit, so a seat with a
               third cause is never quietly missing it. */
            info={
              i === CAUSE_CARDS - 1 && restCauses.length > 0
                ? `Also open: ${restCauses
                    .map((r) => `${CAUSE_LABEL[r.cause]} (${r.count}, ${formatUsd(r.value)})`)
                    .join(" · ")}`
                : undefined
            }
          />
        ))}
      </KpiGrid>

      <TableShell
        title={queue.shellTitle}
        tabs={queue.tabs.map((t) => ({
          id: t.id,
          label: t.label,
          badge: rows.filter(
            (r) =>
              t.states.includes(r.state) &&
              (!t.kind || (t.kind === "claim") === Boolean(r.claim)),
          ).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          /* The arrows step through the ACTIVE tab's list, so a row left open
             from the other tab would sit outside it — the position read "0 of 3"
             and stepping went nowhere. Changing the list closes the row. */
          setOpenRow(null);
          setStatus("all");
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder={queue.searchPlaceholder}
        filters={
          showCause ? (
          <Select
            value={status}
            onValueChange={(v: string) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by status">
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {statusesInQueue.map((v) => (
                <Select.Item key={v} value={v}>
                  {v}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          ) : null
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setStatus("all");
          setPage(1);
        }}
        isFiltered={(showCause && status !== "all") || q.trim().length > 0}
        totalItems={sorted.length}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        emptyState={
          <div className="type-cell" style={{ padding: 24, color: "var(--ds-text-secondary)" }}>
            {queue.emptyText}
          </div>
        }
      >
        <DataTable<ActionRow>
          {...SHAW_TABLE_PROPS}
          columns={showAction ? [...columns, actionColumn] : columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(r) => r.id}
          /* The row holds its green for a beat before it goes. Without it the
             list just gets shorter while the reader is looking at the panel,
             which reads as a glitch rather than as work being finished. */
          rowStyle={(r) =>
            actioned.isSettling(r.id)
              ? { background: "#ECFDF5", transition: "background 220ms ease-out" }
              : /* A row that has just been filed arrives rather than appearing.
                   The reader's eye is in the chat panel when it lands, and a
                   table that is silently one row longer when they look back
                   reads as a list they mis-remembered. Iris rather than green:
                   green is this queue's word for finished, and a filed claim is
                   the opposite — it is the newest thing owed. */
                isArriving(r.id)
                ? {
                    background: "var(--color-iris-50, #F7F2FF)",
                    animation: "queue-row-arrive 420ms ease-out both",
                    transition: "background 600ms ease-out",
                  }
                : undefined
          }
          rowHoverColor={(r) =>
            actioned.isSettling(r.id)
              ? "#ECFDF5"
              : isArriving(r.id)
                ? "var(--color-iris-50, #F7F2FF)"
                : undefined
          }
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </TableShell>

      {openRow &&
        (() => {
          const i = sorted.findIndex((r) => r.id === openRow.id);
          const step = (by: number) => {
            const next = sorted[i + by];
            return next ? () => setOpenRow(next) : undefined;
          };
          /* No arrows when the row isn't in the current list — a filter or a
             search can narrow it out from under the modal. */
          const nav =
            i < 0
              ? undefined
              : {
                  position: `${i + 1} of ${sorted.length}`,
                  onPrev: step(-1),
                  onNext: step(1),
                };
          /* `key` remounts on row change so per-row state — a staged override,
             a half-written reply — never leaks to the next row.

             A row carrying `cover` is a planner's SKU: the planner never sees the
             purchase order, only the level that has to move because of it. */
          return openRow.claim ? (
            <ClaimModal
              key={openRow.id}
              row={openRow}
              agent={profile.agent}
              signer={profile.name}
                            nav={nav}
              onClose={() => setOpenRow(null)}
              onCommitted={commit}
            />
          ) : openRow.cover ? (
            <SkuModal
              key={openRow.id}
              row={openRow}
              agent={profile.agent}
                            nav={nav}
              onClose={() => setOpenRow(null)}
              onCommitted={commit}
            />
          ) : CONTACT_ACTIONS.has(openRow.action) ? (
            <ContactModal
              key={openRow.id}
              label={openRow.action}
              row={openRow}
              agent={profile.agent}
              signer={profile.name}
              nav={nav}
              onClose={() => setOpenRow(null)}
              onCommitted={commit}
            />
          ) : (
            <DecisionModal
              key={openRow.id}
              row={openRow}
              agent={profile.agent}
                            nav={nav}
              onClose={() => setOpenRow(null)}
              onCommitted={commit}
            />
          );
        })()}

      {toast && (
        <KToastContainer position="top-right" className="z-[110]">
          <Toast
            type="success"
            /* The DS transitions `opacity,transform`, but Tailwind v4 animates
               translate and scale through the `translate` and `scale` CSS
               properties — neither of which is `transform` — so the toast's
               movement snapped while only its opacity faded. Naming the
               properties it actually animates restores the DS's own motion. */
            className="transition-[opacity,translate,scale]"
            title={toast.title}
            message={
              /* The DS Toast types `message` as a string but renders it as a
                 node, and it is the only slot inside the card — so the Undo
                 link goes here rather than in a fork of the component. */
              (
                <span className="flex flex-col items-start gap-1.5">
                  <span>{toast.message}</span>
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    style={{ fontWeight: 500 }}
                    onClick={() => setToast(null)}
                  >
                    Undo
                  </button>
                </span>
              ) as unknown as string
            }
            duration={8000}
            onClose={() => setToast(null)}
          />
        </KToastContainer>
      )}
    </div>
  );
}
