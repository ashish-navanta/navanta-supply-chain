"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  CalendarBlank,
  ChartLineUp,
  ChatsCircle,
  CurrencyDollar,
  ClipboardText,
  Hash,
  MapPin,
  Notepad,
  Package,
  Receipt,
  Warehouse,
  Storefront,
  Truck,
  User,
} from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  DataTable,
  TableShell,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { SERVICE_ROUTES, claimRoute, poRoute } from "@/data/nav";
import { QUEUES, threadFor } from "@/data/action-center";
import { agentTaskFor } from "@/data/agent-actions";
import { useChatPanel } from "@/context/ChatPanelContext";
import { useActioned } from "@/lib/actioned";
import { upstreamFor } from "@/data/customer-notice";
import { dealerEtaAfterCommit } from "@/lib/account-eta";
import { AgentBand } from "@/components/ui/AgentBand";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { EmailThread } from "@/components/chat/EmailThread";
import { EtaReconciler } from "@/components/service/EtaReconciler";
import { StageDots } from "@/components/service/StageDots";
import { AccountPanel } from "@/components/service/AccountPanel";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { StatusStepper, type StepperStep } from "@/components/ui/StatusStepper";
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
import {
  CLAIMS,
  CLAIM_KIND_LABEL,
  CLAIM_STAGE_LABEL,
  HEALTH_LABEL,
  STAGE_LABEL,
  bestEta,
  dealerByName,
  formatUsdFull,
  AT_RISK,
  hasEtaConflict,
  lineStage,
  orderLines,
  linePro,
  type OrderLine,
  type OrderMilestone,
  type ServiceOrder,
} from "@/data/service";

/**
 * One account order, drawn the way the Customer Ops portal draws one.
 *
 * Ported from the portal's `orders/[id]` page: a 12-column top row with the
 * status stepper across eight and the money across four, then Christy plus the
 * line items on the left against the order's own record on the right.
 *
 * The reason it is a page and not the modal it replaces: an order is the thing
 * a call is about, and a call runs long. A modal asks the reader to hold the
 * queue behind it in their head and gives them nothing to send anyone; a route
 * is a link Daniela can paste to the buying desk, and the same link is what
 * every SO- reference in this seat now points at.
 */

/** The five milestones of a account order, as steps. */
function stepsFor(order: ServiceOrder, lineCount: number): StepperStep[] {
  return order.milestones.map((ms: OrderMilestone) => {
    const unresolved = ms.events.some(
      (e) => (e.severity === "warning" || e.severity === "critical") && !e.resolved,
    );
    return {
      label: STAGE_LABEL[ms.id],
      status:
        ms.status === "completed"
          ? "completed"
          : ms.status === "active"
            ? unresolved
              ? "error"
              : "active"
            : "pending",
      date: ms.date && ms.date !== "In progress" ? ms.date : undefined,
      /* Items at this stage, not units — the card's own header counts items,
         and a ring reading 120 beside "1 Item" is two answers to one question. */
      count: ms.status === "active" ? lineCount : undefined,
    };
  });
}

/**
 * The alert that sits in the stepper's foot.
 *
 * The portal puts the one sentence that changes what you do here rather than in
 * a banner up top, because the reader is already looking at the stepper to find
 * out where the order is — and "where" and "so what" are one question.
 */
function alertFor(order: ServiceOrder): {
  tone: "danger" | "warning" | "success";
  title: string;
  body: string;
  details: string[];
} {
  const slipped = order.currentEta !== order.promisedOn;
  if (order.health === "delivered-clean") {
    return {
      tone: "success",
      title: "Delivered clean",
      body: `${order.units} units signed for on ${order.deliveredOn ?? order.currentEta}. Nothing outstanding.`,
      details: order.receipt ? [`Goods receipt ${order.receipt}`] : [],
    };
  }
  if (order.health === "delivered-short") {
    return {
      tone: "danger",
      title: `${order.shortPallets ?? 0} units short on arrival`,
      body: `Signed for ${order.deliveredOn ?? order.currentEta}. The shortfall is claimable against the receipt.`,
      details: order.receipt ? [`Goods receipt ${order.receipt}`] : [],
    };
  }
  if (order.health === "backordered") {
    return {
      tone: "danger",
      title: "Balance on backorder",
      body: `Part of the order shipped; the balance has no date against it yet.`,
      details: [],
    };
  }
  if (slipped) {
    /* Confirmed changes what this is. An unconfirmed re-promise is a problem the
       CSR still owns — the account is holding a date Target cannot meet and does not
       know it. A confirmed one is the outcome the conversation was for: the
       customer has agreed in writing, and what is left is delivering it. Drawing
       both in the same red left a finished job looking like an open one, and the
       queue and the page then disagreed about whether anybody owed anything. */
    /* A proposal outranks the slip in the alert, because it is the newer fact and
       the actionable one: the reader does not need telling the date moved — they
       need telling somebody has already worked out what to do about it. */
    if (order.proposed && !order.confirmedOn) {
      const p = order.proposed;
      return {
        tone: "warning",
        title: `Confirm ${p.sku}, accept ${p.date} as the promise`,
        body: `${p.units} units of ${p.sku} are standing at ${p.at} and can hold the install; the balance lands ${p.date}. Neither is on the record yet.`,
        details: [
          `"${p.said}"`,
          ...(order.installOn
            ? [`Install ${order.installOn}${order.crewBooked ? " · crew booked" : ""}`]
            : []),
        ],
      };
    }
    const alt = order.lines.find((l) => l.alternateFor);
    if (order.confirmedOn) {
      return {
        tone: "warning",
        title: `Revised date confirmed by ${order.account}`,
        body: alt
          ? `${order.account} accepted ${order.currentEta} in writing on ${order.confirmedOn}, and took ${alt.units} units of ${alt.style} as an alternate for the ${alt.alternateFor}. That part ships against the original ${order.promisedOn} — the remaining ${order.units - alt.units} land on the revised date.`
          : `${order.account} accepted ${order.currentEta} in writing on ${order.confirmedOn}, against the ${order.promisedOn} originally promised. Nothing is owed to them; the date is the one to hold.`,
        details: [
          ...(order.installOn
            ? [`Install ${order.installOn}${order.crewBooked ? " · crew booked" : ""}`]
            : []),
          ...(alt ? [`Alternate ${alt.sku} · batch ${alt.dyeLot}`] : []),
        ],
      };
    }
    return {
      tone: "danger",
      title: `Re-promised ${order.promisedOn} → ${order.currentEta}`,
      body: `${order.units} units of ${order.style}, now landing ${order.currentEta}.`,
      details: order.installOn
        ? [
            `Install ${order.installOn}${order.crewBooked ? " · crew booked" : ""}`,
          ]
        : [],
    };
  }
  return {
    tone: order.health === "on-track" ? "success" : "warning",
    title: order.health === "on-track" ? "Running to promise" : HEALTH_LABEL[order.health],
    body: `${order.units} units of ${order.style} against ${order.promisedOn}.`,
    details: order.installOn
      ? [`Install ${order.installOn}${order.crewBooked ? " · crew booked" : ""}`]
      : [],
  };
}

const TABS = [
  { id: "items", label: "Products", icon: Package },
  /* Second, same as on the purchase order. What was actually said to the account
     is the evidence behind every date on this page — a rep about to accept a
     re-promise is asked to stand behind a conversation somebody else had, and
     until now they had to take the summary's word for it. */
  { id: "thread", label: "Email & call thread", icon: ChatsCircle },
  { id: "tracking", label: "Where it is", icon: ChartLineUp },
  { id: "account", label: "Account", icon: Storefront },
  { id: "claims", label: "Claims", icon: ClipboardText },
] as const;

type Panel = (typeof TABS)[number]["id"];

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function OrderDetailScreen({
  order,
  onFileClaim,
}: {
  order: ServiceOrder;
  /** Hands the order to the claim wizard, which lives in the chat panel. */
  onFileClaim?: (order: ServiceOrder) => void;
}) {
  const { persona } = usePersona();
  const agent = PERSONAS[persona].agent;

  const { startTask } = useChatPanel();
  const [panel, setPanel] = useState<Panel>("items");
  const [lineSort, setLineSort] = useState<DataTableSortState>({ field: null, dir: "desc" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* The lines as the shipment actually stands, matched to the purchase order
     behind it where there is one. */
  const lines = useMemo(() => orderLines(order), [order]);
  const [origin, destination] = order.lane.split("→").map((x) => x.trim());

  /* The lines the table is actually showing: searched, then paged. A PO's
     colourway split runs to five or more SKUs on a big order, which is exactly
     where a reader starts scrolling inside a card. */
  const matched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((l) =>
      `${l.sku} ${l.style} ${l.dyeLot}`.toLowerCase().includes(needle),
    );
  }, [lines, q]);
  const paged = useMemo(
    () => matched.slice((page - 1) * pageSize, page * pageSize),
    [matched, page, pageSize],
  );

  const account = dealerByName(order.account);
  const claims = CLAIMS.filter((c) => c.orderId === order.id);
  const alert = alertFor(order);
  const eta = bestEta(order);

  /* Freight and tax are derived at the portal's own rates rather than stored —
     the order carries one value, and inventing a second figure to sit beside it
     is how two surfaces start disagreeing about what an order is worth. */
  const subtotal = lines.reduce((sum, l) => sum + l.units * l.unitValue, 0);
  const freight = Math.round(subtotal * 0.025);
  const tax = Math.round(subtotal * 0.075);
  const total = subtotal + freight + tax;

  const claimable = order.stage === "delivered";


  /* One row per SKU, with its own stage. Lines do not always travel together —
     a split leaves one SKU on a truck and another on backorder — and the account
     rings about a line, not about the order's average. */
  const lineSerial: DataTableSlotColumn<OrderLine> = {
    id: "sn",
    width: 40,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (_l, ctx) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {ctx.index + 1}
      </span>
    ),
  };

  const lineColumns: DataTableColumn<OrderLine>[] = [
    {
      key: "sku",
      label: "Product SKUs",
      sortable: true,
      minWidth: 200,
      /* The drawn thumbnail leads the cell — the same silhouette-in-variant-colour
         the queue rows and the SKU modal carry, so a line item is recognisable as
         a product before it is readable as a number. */
      cell: (l) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={l.sku} size={28} />
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 500, ...numeric }}>
            {l.sku}
          </span>
          <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
            {l.style}
          </span>
          {/* The line the agent wants to swap, named where the reader is already
              looking at SKUs. A proposal described only in a paragraph makes them
              scan the table for a number they are holding in their head. */}
          {order.proposed?.sku === l.sku && (
            <span className="truncate" style={{ fontSize: 12, color: "#59349C" }}>
              {`${order.proposed.units} of ${l.units} units proposed as the swap`}
            </span>
          )}
          </span>
        </span>
      ),
    },
    {
      key: "stage",
      label: "Status",
      minWidth: 148,
      /* Dots, not a pill — the same four the order book and the queue use, so a
         line, an order and a queue row all say "how far along" the same way. A
         pill said the stage but not the distance left. */
      cell: (l) => {
        const st = lineStage(order, l);
        return (
          <StageDots
            stage={st}
            atRisk={st !== order.stage || AT_RISK.has(order.health)}
            label={STAGE_LABEL[st]}
          />
        );
      },
    },
    {
      key: "pro",
      label: "Tracking",
      minWidth: 124,
      /* Per line, because a split shipment travels under two references and
         "one unit arrived, where is the rest" is a question about one of
         them. */
      cell: (l) => {
        const pro = linePro(order, l);
        return pro ? (
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>{pro}</span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>NA</span>
        );
      },
    },
    {
      key: "dyeLot",
      label: "Batch",
      sortable: true,
      minWidth: 88,
      cell: (l) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-secondary)", ...numeric }}>
          {l.dyeLot}
        </span>
      ),
    },
    {
      key: "units",
      label: "Units",
      sortable: true,
      minWidth: 76,
      cell: (l) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>{l.units}</span>
      ),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      minWidth: 108,
      cell: (l) => (
        <span
          style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)", ...numeric }}
        >
          {formatUsdFull(l.units * l.unitValue)}
        </span>
      ),
    },
  ];
  const slipped = order.currentEta !== order.promisedOn;

  /* The queue line this order is waiting on, if it has one — that is where the
     agent's move lives. Read from the CSR queue rather than invented here, so
     the band's button and the row's button are the same button, and settling one
     settles the other. */
  const queueRow = useMemo(() => QUEUES.csr.rows.find((r) => r.ref === order.id), [order.id]);
  const actioned = useActioned();
  const settledRow = queueRow ? actioned.live([queueRow])[0] : undefined;
  const done = !!settledRow && settledRow.state === "settled" && queueRow?.state !== "settled";
  const task = settledRow ? agentTaskFor(settledRow) : null;

  /* The exchange behind the order, read off the queue line it belongs to — the
     same source the purchase order's thread uses, so one conversation is not
     reported twice in two voices. */
  const threadRow = settledRow ?? queueRow;
  const thread = useMemo(
    () => (threadRow ? threadFor(threadRow, PERSONAS.csr.agent) : []),
    [threadRow],
  );

  /* The purchase order this one is waiting on, where it has one. Naming it is
     the difference between "the date moved" and "the date moved BECAUSE the plant
     capped its line, and here is the reference" — the first invites the CSR to
     argue with the date, the second tells them who is already on it. */
  const upstream = settledRow ? upstreamFor(settledRow) : null;

  /* The agent's read: what is wrong, why, then its own line on the order. Once a
     run has landed, the words it wrote replace them. */
  /* Composed, not concatenated. Joining the alert title, the upstream line and
     the order's note gave four sentences that named the SKU three times and the
     date twice — everything true and nothing readable, in the paragraph a rep
     reads before deciding. A proposal needs two sentences: why the date cannot
     hold, and what the account will accept instead. */
  const summary =
    done && settledRow
      ? settledRow.insight
      : order.proposed && !order.confirmedOn
        ? [
            upstream
              ? `${upstream.party}'s line is capped on ${upstream.ref}, so the balance cannot land before ${order.proposed.date}.`
              : `The plant cannot land this before ${order.proposed.date}.`,
            /* Ends on the ask, in the words of the decision rather than of the
               work. "12 units swapped and 6 Sep promised does both" describes
               what the agent will do; the reader is deciding whether to let it, so
               the sentence closes with confirm and accept. */
            /* What the swap is worth, in the same words the queue row uses.
               "Confirm the alternate and accept 6 Sep as the promise date"
               named two writes and a date already on the page; the alternate is
               standing at a DC and beats the original, which is the reason to
               press anything. */
            `${order.account.split(" ")[0]} will take ${order.proposed.sku} on the backfill to hold their ${order.installOn ?? "install"} crew — confirm the alternate to save ${order.proposed.savesDays ?? 4} days, landing ${order.proposed.arrivesOn ?? order.proposed.date}.`,
          ].join(" ")
        : [
            `${alert.title}.`,
            upstream
              ? `${upstream.refSub} on ${upstream.ref} — ${upstream.party}'s lead time is what moved this.`
              : "",
            order.note,
          ]
            .filter(Boolean)
            .join(" ");

  /* Where the date stands, and where the agent's move would put it — the same
     framing the PO page uses. A card proposing "re-promise to 29 Aug" above a
     line reading "Est. delivery: 19 Aug" leaves the reader to work out which of
     the two is on the record, and the answer is the whole decision. */
  const proposed = !done && task?.resultState?.eta;
  /* What the buyer has actually committed upstream, if anything. This is the far
     end of the app's central claim: Mercer writes a longer lead time to Bac
     Ninh's record, the goods book in at the DC on the new date, and the account's
     delivery moves with them. Until that commit exists the order's own ETA is the
     best anybody has, and substituting a derived date for it would be the app
     promising something nobody agreed to. */
  const upstreamCommit = dealerEtaAfterCommit(order.id);
  const onRecord =
    order.stage === "delivered"
      ? (order.deliveredOn ?? eta.date)
      : (upstreamCommit?.date ?? eta.date);

  const etaLine = (
    <span
      className="flex flex-wrap items-center gap-1"
      style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}
    >
      {/* A proposal states what the account holds TODAY and what is being asked
          for. "Est. delivery: 6 Sep" reported the proposed date as though it were
          already the promise — which is the confusion the confirm exists to
          prevent, and it hid the 15 Aug that Summit is still working to. */}
      {order.proposed && !order.confirmedOn ? (
        <>
          <span>Earlier ETA:</span>
          <span className="font-medium">{order.promisedOn}</span>
          <span style={{ color: "#71767A" }}>— accept</span>
          <span className="font-medium" style={{ color: "#DE1010" }}>
            {order.proposed.date}
          </span>
          <span style={{ color: "#71767A" }}>as the new promise date</span>
        </>
      ) : proposed && proposed !== onRecord ? (
        <>
          <span>On the record:</span>
          <span className="font-medium">{onRecord}</span>
          <span style={{ color: "#71767A" }}>— the re-promise moves it to</span>
          <span className="font-medium" style={{ color: "#DE1010" }}>
            {proposed}
          </span>
        </>
      ) : (
        <>
          <span>{order.stage === "delivered" ? "Delivered:" : "Est. delivery:"}</span>
          <span className="font-medium" style={{ color: slipped ? "#DE1010" : undefined }}>
            {onRecord}
          </span>
          {/* Named, not silent. A date that changes on its own reads as a bug;
              the same date with "since PO-4463 was committed" beside it is the
              thing the walkthrough is trying to show. */}
          {upstreamCommit && upstreamCommit.date !== eta.date && (
            <span style={{ color: "#71767A" }}>
              {`— was ${eta.date}, moved when ${upstreamCommit.poRef} was committed`}
            </span>
          )}
        </>
      )}
      {order.installOn && (
        <span style={{ fontSize: 13, color: "#71767A" }}>
          {`· install ${order.installOn}${order.crewBooked ? ", crew booked" : ""}`}
        </span>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div
        className="flex items-end justify-between"
        style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}
      >
        <div className="flex flex-col gap-1">
          {/* No back link here — the top bar's trail carries it, and two ways
              back an inch apart is one more than anybody looks for. */}
          <div className="flex items-center gap-2">
            <Package size={20} weight="duotone" className="shrink-0" style={{ color: "var(--color-iris-700)" }} />
            <h1 style={{ fontSize: 20, fontWeight: 600, lineHeight: "144%", color: "#212121" }}>
              {order.id}
            </h1>
            {/* No risk pill. It says what the stepper's red ring and the agent's
                opening sentence both say a hand's width below, and the PO header
                lost its badges for the same reason. */}
          </div>
          <div className="flex items-center gap-3">
            <p
              className="whitespace-nowrap font-medium"
              style={{ fontSize: 14, lineHeight: 1.5, color: "#333" }}
            >
              {`Placed ${order.orderedOn} · ${order.account}`}
            </p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-2">
          {claimable && onFileClaim && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<ClipboardText size={14} weight="bold" />}
              onClick={() => onFileClaim(order)}
            >
              File a claim
            </Button>
          )}
          <Link href={SERVICE_ROUTES.accounts}>
            <Button size="sm" variant="secondary" iconLeft={<Storefront size={14} weight="bold" />}>
              Account record
            </Button>
          </Link>
        </div>
      </div>
      {/* One grid, two columns that each stack their own cards — the PO page's
          layout, so a reader moving between the two seats finds the same things
          in the same places. A account order and a purchase order are the same
          shipment seen from opposite ends; they had drifted into two shapes. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          columnGap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: "span 8" }} className="flex min-w-0 flex-col gap-5">
          <StatusStepper
            title="Order status"
            icon={Package}
            steps={stepsFor(order, lines.length)}
            totalItems={lines.length}
          >
            <div className="flex w-full flex-col gap-3 px-4 pb-4">
              {task ? (
                <AgentBand
                  agent={agent}
                  summary={summary}
                  meta={etaLine}
                  actionLine={task.ask}
                  confirmLabel={task.label}
                  onConfirm={() => startTask(task)}
                />
              ) : (
                <div
                  className="flex w-full flex-col gap-2 rounded-[12px] p-3"
                  style={{ background: "#F5EFFF" }}
                >
                  <span className="flex items-center gap-2">
                    <AiStar size={16} variant="small" />
                    <span
                      className="font-medium"
                      style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
                    >
                      {`${agent} Summary`}
                    </span>
                  </span>
                  <p className="px-1" style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}>
                    {summary}
                  </p>
                  <div className="px-1">{etaLine}</div>
                </div>
              )}
            </div>
          </StatusStepper>

          <TableShell
            title="Order record"
            icon={Package}
            customize={false}
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
              badge:
                t.id === "items"
                  ? lines.length
                  : t.id === "thread"
                    ? thread.length || undefined
                    : t.id === "claims"
                      ? claims.length || undefined
                      : undefined,
            }))}
            activeTab={panel}
            onTabChange={(next) => setPanel(next as Panel)}
            /* Search and a pager on the products tab only — the other three are
               short, already in their own order, and a pager under four lines is
               furniture. `ts-search-below` puts the field under the tabs, since
               the tabs decide which list it even applies to. */
            totalItems={panel === "items" ? matched.length : 0}
            currentPage={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            searchValue={panel === "items" ? q : undefined}
            onSearchChange={
              panel === "items"
                ? (v) => {
                    setQ(v);
                    setPage(1);
                  }
                : undefined
            }
            searchPlaceholder="Search SKU, style or batch"
            isFiltered={panel === "items" && q.trim().length > 0}
            /* Only on the tab it describes. The shell shows its empty state
               whenever `totalItems` is 0, and the other three tabs pass 0 because
               they have no pager — so a account card and a claims list were both
               carrying "No product on this order matches that." underneath
               perfectly good content. */
            noResultsState={
              panel === "items" ? (
                <span className="type-cell" style={{ padding: 24, color: "var(--ds-text-secondary)" }}>
                  No product on this order matches that.
                </span>
              ) : undefined
            }
            className={
              panel === "items" ? "ts-search-below ts-scroll-tabs" : "ts-no-pager ts-scroll-tabs"
            }
          >
            {panel === "items" ? (
              /* The DS table, not a hand-rolled grid: sorting, the serial slot
                 and the row chrome are its job, and a bespoke grid beside a real
                 DataTable elsewhere on the page reads as two components. */
              <DataTable<OrderLine>
                {...SHAW_TABLE_PROPS}
                columns={lineColumns}
                leadingSlots={[lineSerial]}
                data={paged}
                rowKey={(l) => l.sku}
                sort={lineSort}
                onSortChange={setLineSort}
                sortMode="client"
              />
            ) : panel === "thread" ? (
              <div className="p-4">
                {threadRow ? (
                  <EmailThread row={threadRow} agent={agent} />
                ) : (
                  <p style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
                    Nothing has been sent or logged on this order.
                  </p>
                )}
              </div>
            ) : panel === "tracking" ? (
              /* The tab is now only the reconciliation — the carrier, lane and
                 receipt moved to the rail beside the map, where they read as the
                 shipment's record rather than as an appendix to a disagreement. */
              <div className="flex flex-col gap-3 p-4">
                {hasEtaConflict(order) ? (
                  <EtaReconciler order={order} agent={agent} />
                ) : (
                  <p style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
                    {`Every system agrees on ${eta.date}. ${agent} rechecks them on each scan event and raises it here if they diverge.`}
                  </p>
                )}
                <div className="flex flex-col">
                  {order.etas.map((e, i) => (
                    <div
                      key={e.source}
                      className="flex items-center justify-between gap-4 py-2.5"
                      style={{ borderTop: i > 0 ? HAIR : undefined }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span style={{ fontSize: 14, color: "#212121" }}>{e.source}</span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{e.note}</span>
                      </span>
                      <span className="shrink-0 font-medium" style={{ fontSize: 14, color: "#212121" }}>
                        {e.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : panel === "account" ? (
              /* A account card, not a column of label/value rows — see
                 AccountPanel. Half those rows were the figures that decide how a
                 call goes, and in a list of identical rows they read as trivia. */
              account ? (
                <AccountPanel account={account} orderId={order.id} />
              ) : (
                <p className="p-4" style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
                  {`No account record for ${order.account}.`}
                </p>
              )
            ) : (
              <div className="flex flex-col p-4">
                {claims.length === 0 ? (
                  <p style={{ fontSize: 14, lineHeight: "22px", color: "#52525c" }}>
                    {claimable
                      ? "Nothing claimed against this order."
                      : "Nothing to claim against until the order is receipted."}
                  </p>
                ) : (
                  claims.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-4 py-2.5"
                      style={{ borderTop: i > 0 ? HAIR : undefined }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="font-medium"
                          style={{ fontSize: 14, lineHeight: 1.5, color: "#212121" }}
                        >
                          {`${c.id} — ${CLAIM_KIND_LABEL[c.kind]}`}
                        </span>
                        {/* The adjudicated figure once there is one, the ask
                            until then — printing a request as if it were a
                            settlement is how a credit gets promised by a table. */}
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {`${CLAIM_STAGE_LABEL[c.stage]} · ${formatUsdFull(
                            c.adjudicated ?? c.requested,
                          )}${c.adjudicated === null ? " requested" : ""}`}
                        </span>
                      </span>
                      {/* The claim itself, not the list it is in. Landing on
                          the list and hunting for the row you just clicked is
                          the reason a record needs a page. */}
                      <Link
                        href={claimRoute(c.id)}
                        style={{ fontSize: 13, color: "var(--link-color)" }}
                      >
                        Open
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}
          </TableShell>
        </div>

        <div style={{ gridColumn: "span 4" }} className="flex flex-col gap-5">
          <div
            className="flex flex-col overflow-hidden bg-[var(--surface-base)]"
            style={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
          >
            <CardHeading icon={CurrencyDollar}>Order summary</CardHeading>
            <div className="flex flex-col gap-3 p-[16px] pt-0">
              <div className="flex flex-col gap-[19px]">
                {[
                  ["Item total", formatUsdFull(subtotal)],
                  ["Freight charges", formatUsdFull(freight)],
                  ["Discount added", "$0"],
                  ["Estimated tax", formatUsdFull(tax)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between whitespace-nowrap text-[14px] leading-[1.5]"
                  >
                    <span className="text-[#71717a]">{label}</span>
                    <span className="text-right font-medium text-[#18181b]">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between whitespace-nowrap border-t border-[#e4e4e7] pt-[16px] text-right text-[14px] font-semibold leading-[1.33] text-[#212121]">
                <span>Total</span>
                <span>{formatUsdFull(total)}</span>
              </div>
              <div className="flex items-center justify-between whitespace-nowrap text-[14px]">
                <span className="leading-[1.5] text-[#71717a]">Payment terms</span>
                <span className="text-right font-medium leading-[1.5] text-[#212121]">
                  {account?.paymentTerms ?? "Net 30"}
                </span>
              </div>
            </div>
          </div>

          {/* Order Information, on the HMTX portal's own structure (Figma
              1118:20640): grey band section headings, fields as label-over-value
              two to a row, and a copy affordance on the references somebody
              actually retypes into another system. The flat right-aligned list
              this replaces made every long value — a lane, an address — compete
              with its own label for one line, and truncate. */}
          <SectionCard title="Order Information" icon={Package}>
            <div className="flex flex-col gap-2 px-3 py-2">
              <RecordSection icon={Notepad} title="Order identity">
                <FieldRow>
                  <Field icon={Hash} label="Order number" copy={order.id}>
                    {order.id}
                  </Field>
                  <Field icon={CalendarBlank} label="Placed">
                    {order.orderedOn}
                  </Field>
                </FieldRow>
                {/* Who it is for, in the identity rather than only in Shipping.
                    "Ship to" answers where the units go; a reader asking whose
                    order this is was being sent to a different section to find
                    out, and then given a name with nowhere to click. */}
                <FieldRow>
                  <Field icon={Storefront} label="Account">
                    <Link
                      href={SERVICE_ROUTES.accounts}
                      title={`Open ${order.account}'s record`}
                      className="truncate hover:underline"
                      style={{ color: "var(--link-color)" }}
                    >
                      {order.account}
                    </Link>
                  </Field>
                  <Field icon={User} label="Account">
                    <span className="truncate">
                      {account ? `${account.tier} · ${account.segment}` : "Not on file"}
                    </span>
                  </Field>
                </FieldRow>
                <FieldRow last={!upstream}>
                  <Field icon={Hash} label={slipped ? "Re-promised" : "Promised"} tone={slipped ? "danger" : undefined}>
                    {slipped ? `${order.currentEta} · was ${order.promisedOn}` : order.promisedOn}
                  </Field>
                  <Field icon={ClipboardText} label="Install">
                    {order.installOn
                      ? `${order.installOn}${order.crewBooked ? " · crew booked" : ""}`
                      : "None booked"}
                  </Field>
                </FieldRow>
                {upstream && (
                  <FieldRow last>
                    {/* Opened in a new tab: a CSR checking why a date moved is
                        mid-call and should not lose the order they are being
                        asked about. */}
                    <Field icon={Receipt} label="Supplied by" copy={upstream.ref}>
                      <a
                        href={poRoute(upstream.ref)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${upstream.ref} in the buying seat`}
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: "var(--link-color)" }}
                      >
                        {upstream.ref}
                        <ArrowSquareOut size={12} className="shrink-0" />
                      </a>
                    </Field>
                    <Field icon={CalendarBlank} label="Cause">
                      <span className="truncate">{upstream.refSub}</span>
                    </Field>
                  </FieldRow>
                )}
              </RecordSection>

              <RecordSection icon={Truck} title="Shipping">
                <FieldRow>
                  <Field icon={Warehouse} label="Order warehouse">
                    {origin}
                  </Field>
                  <Field icon={User} label="Ship to" copy={order.account}>
                    <span className="truncate">{order.account}</span>
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field icon={Truck} label="Shipper" copy={order.carrier}>
                    <span className="truncate">{order.carrier}</span>
                  </Field>
                  <Field icon={Hash} label="Tracking" copy={order.proNumber}>
                    {order.proNumber ?? "Not tendered"}
                  </Field>
                </FieldRow>
                {/* No map beside the lane. The portal pairs an address with one
                    at full column width; squeezed to 206px in a two-up field row
                    its own labels collided with each other, which is worse than
                    no map. The lane reads as its two ends and where the load has
                    got to between them. */}
                <FieldRow>
                  <Field icon={MapPin} label="From">
                    <span className="truncate">{origin}</span>
                  </Field>
                  <Field icon={MapPin} label="To">
                    <span className="truncate">{destination}</span>
                  </Field>
                </FieldRow>
                {/* The receipt belongs to the shipment, beside the lane and the
                    tracking number it arrives with — it was filed under the
                    account, where it is nobody's reference for anything. */}
                <FieldRow last>
                  <Field icon={Hash} label="Goods receipt" copy={order.receipt}>
                    {order.receipt ?? "Not delivered"}
                  </Field>
                  <Field icon={Warehouse} label="Pallets">
                    {`${order.units} on the order`}
                  </Field>
                </FieldRow>
              </RecordSection>
              {/* No "Account reference" section. Its two useful fields — a name and
                  a number — are the first thing on the Account tab now, at the size
                  somebody dialling actually needs, with Target's record against this
                  account beside them. The other two were a stage the stepper draws
                  a hand's width above and a receipt that belongs to the shipment. */}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
