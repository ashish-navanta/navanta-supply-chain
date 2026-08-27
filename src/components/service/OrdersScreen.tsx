"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardText } from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  DataTable,
  KToastContainer,
  KpiBreakdownCard,
  KpiGrid,
  PageHeading,
  Pill,
  Select,
  TableShell,
  Toast,
  type ActiveFilter,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { useRouter } from "next/navigation";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { orderTaskFor } from "@/data/service-flows";
import type { CommitReport } from "@/components/chat/commit";
import {
  AT_RISK,
  HEALTH_LABEL,
  ORDERS,
  ORDER_STAGE_ORDER,
  SERVICE_BOOK,
  STAGE_LABEL,
  formatUsd,
  promisesKept,
  type OrderHealth,
  type ServiceOrder,
  riskFor,
  RISK_LABEL,
} from "@/data/service";
import { useChatPanel } from "@/context/ChatPanelContext";
import { AgentColumnHeader } from "@/components/ui/AgentColumnHeader";
import { OnTrackPill } from "@/components/ui/OnTrackPill";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { StageDots } from "@/components/service/StageDots";
import { orderRoute } from "@/data/nav";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * "28 Aug" as a position in the year, for sorting.
 *
 * The fixtures hold dates as the short strings a person reads, and there is no
 * year on them because the whole book is one season. Rank is all a sort needs.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayOfYear(label: string): number {
  const [d, m] = label.trim().split(" ");
  const month = MONTHS.indexOf(m);
  return month < 0 ? 0 : month * 31 + (Number.parseInt(d, 10) || 0);
}

/** The three lists an order can be in: still coming, arrived, or the subset of
 *  the first that a account is about to ring about. */
type TabId = "open" | "at-risk" | "delivered";

const IN_TAB: Record<TabId, (o: ServiceOrder) => boolean> = {
  open: (o) => o.stage !== "delivered",
  "at-risk": (o) => AT_RISK.has(o.health),
  delivered: (o) => o.stage === "delivered",
};

const TAB_LABEL: Record<TabId, string> = {
  /* "Active orders", not "Open". Open is what a claim or a case is; an order is
     active until it is delivered, and this tab is the book Christy works. */
  open: "Active orders",
  "at-risk": "At risk",
  delivered: "Delivered",
};


/**
 * The whole order book, not just the exceptions.
 *
 * The action center shows the four lines that need Daniela today. This shows all
 * fourteen, because the call she takes is about whichever one the account is
 * holding — and an order running perfectly still needs answering for.
 */
/**
 * Where an order has got to, as the Customer Ops portal draws it.
 *
 * Ported from `orders/OrderList.tsx` — 8px dots at a 3px gap, filled green
 * behind the current stage, coloured at it, and left as a hairline ahead of it.
 * The stage name sits underneath at 13px.
 *
 * The colour at the current dot is the whole point: it is blue when the order is
 * fine and red when it is not, so one glance answers both "how far along" and
 * "should I worry" without reading a word. A pill could only ever answer one of
 * those, which is why the portal does not use one here.
 */
export function OrdersScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startClaim, startTask } = useChatPanel();
  const router = useRouter();

  const [tab, setTab] = useState<TabId>("open");
  const [q, setQ] = useState("");
  const [health, setHealth] = useState<"all" | OrderHealth>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "value", dir: "desc" });

  const [toast, setToast] = useState<CommitReport | null>(null);

  const inTab = useMemo(() => ORDERS.filter(IN_TAB[tab]), [tab]);
  const healthsInTab = useMemo(() => [...new Set(inTab.map((o) => o.health))], [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((o) => {
      if (health !== "all" && o.health !== health) return false;
      if (!needle) return true;
      return [o.id, o.account, o.style, o.lane, o.carrier, o.receipt ?? "", HEALTH_LABEL[o.health]]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, health, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "value") return (a.value - b.value) * dir;
      if (sort.field === "units") return (a.units - b.units) * dir;
      /* By position in the journey, not alphabetically. Sorting the labels puts
         "Delivered" before "In process" before "Order placed", which is neither
         the order things happen in nor any order a reader asked for. */
      /* By the date, not the string. "11 Sep" sorts before "28 Aug"
         alphabetically, which is a column of dates in no order at all. */
      if (sort.field === "promisedOn") {
        return (dayOfYear(a.currentEta) - dayOfYear(b.currentEta)) * dir;
      }
      if (sort.field === "stage") {
        return (ORDER_STAGE_ORDER.indexOf(a.stage) - ORDER_STAGE_ORDER.indexOf(b.stage)) * dir;
      }
      return String(a[sort.field as keyof ServiceOrder] ?? "")
        .localeCompare(String(b[sort.field as keyof ServiceOrder] ?? "")) * dir;
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((o, i) => rowNumber.set(o.id, i + 1));

  const serialSlot: DataTableSlotColumn<ServiceOrder> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (o) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(o.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    health === "all"
      ? []
      : [
          {
            key: "health",
            label: "Status",
            value: HEALTH_LABEL[health],
            onRemove: () => {
              setHealth("all");
              setPage(1);
            },
          },
        ];

  const columns: DataTableColumn<ServiceOrder>[] = [
    {
      key: "value",
      label: "Order",
      sortable: true,
      minWidth: 148,
      maxWidth: 160,
      cell: (o) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          {/* The order number is the way in. Every SO- reference in this seat
              points at the same page, so the reader learns one gesture rather
              than a Review button here and a link somewhere else. */}
          <Link
            href={orderRoute(o.id)}
            className="truncate hover:underline"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)" }}
          >
            {o.id}
          </Link>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {formatUsd(o.value)}
          </span>
        </span>
      ),
    },
    {
      key: "account",
      label: "Account",
      sortable: true,
      minWidth: 150,
      maxWidth: 168,
      cell: (o) => (
        <Pill variant="info" size="sm">
          {o.account}
        </Pill>
      ),
    },
    {
      /* Capped tight: nine columns plus the insight line, and a long style name
         ("Organic Granola Clusters 12oz") pushed the Action button into
         horizontal overflow. The full name is on the cell's title. */
      key: "style",
      label: "Style",
      minWidth: 150,
      maxWidth: 172,
      cell: (o) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, color: "var(--ds-text-primary)" }} title={o.style}>
            {o.style}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${o.units} units`}
          </span>
        </span>
      ),
    },
    {
      key: "promisedOn",
      label: "Promise date",
      sortable: true,
      minWidth: 116,
      /* The date that stands, and only that. Printing the original struck
         through above the new one put two dates in one cell and made the reader
         work out which one they were answering to — on a queue the CSR reads to
         see what they owe a account, that is the wrong question. Where it moved,
         the date is red and the original is on the record page and in the
         tooltip; the row says what the promise IS. */
      cell: (o) => {
        const slipped = o.currentEta !== o.promisedOn;
        /* Red follows the RISK, not the history. A date that moved on an order
           now running to its new promise is not a problem — colouring it red
           beside an "On track" pill put two answers on one row and made the
           reader pick. The move is still worth knowing, so it stays in the
           tooltip. */
        const exposed = riskFor(o) !== null;
        return (
          <span
            style={{
              fontSize: 14,
              ...numeric,
              color: exposed ? "var(--text-danger)" : "var(--ds-text-primary)",
            }}
            title={slipped ? `Re-promised — originally ${o.promisedOn}` : undefined}
          >
            {o.currentEta}
          </span>
        );
      },
    },
    {
      key: "stage",
      label: "Status",
      sortable: true,
      minWidth: 148,
      cell: (o) => (
        <span
          className="flex min-w-0 flex-col"
          style={{ gap: 4 }}
          aria-label={`${STAGE_LABEL[o.stage]}${AT_RISK.has(o.health) ? ` — ${HEALTH_LABEL[o.health]}` : ""}`}
        >
          <StageDots stage={o.stage} atRisk={AT_RISK.has(o.health)} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ds-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {STAGE_LABEL[o.stage]}
          </span>
        </span>
      ),
    },
    {
      key: "health",
      /* One word. The dots carry progress, the insight beside this explains the
         cause, and this says only how much trouble the order is in — the crew
         date and the ETA conflict used to live here and were saying, worse, what
         the insight column already says better. */
      label: "Risk",
      sortable: true,
      minWidth: 96,
      cell: (o) => {
        const risk = riskFor(o);
        /* "On track", not a dash. A dash reads as missing data — the reader
           cannot tell whether the order is fine or whether nobody has assessed
           it, which on a risk column is the one thing it must not leave open.
           Neutral, so it recedes behind the two that are not fine. */
        if (!risk) return <OnTrackPill />;
        return (
          <Pill variant={risk === "critical" ? "danger" : risk === "high" ? "warning" : "neutral"} size="sm">
            {RISK_LABEL[risk]}
          </Pill>
        );
      },
    },
    {
      key: "note",
      label: "Insight",
      minWidth: 215,
      wrapLines: 2,
      headerCell: () => (
        <span className="flex items-center" style={{ gap: 4 }}>
          <AiStar size={14} variant="small" />
          <span
            style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px", color: "var(--ds-text-primary)" }}
          >
            {`${profile.agent} Insight`}
          </span>
        </span>
      ),
      cell: (o) => (
        <span
          title={o.note}
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
          {o.note}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      /* Starred at the head, so the buttons under it do not each need one —
         said once per column it is a label, said ten times it is decoration. */
      headerCell: () => <AgentColumnHeader>Action</AgentColumnHeader>,
      minWidth: 112,
      stopRowClick: true,
      cell: (o) => {
        /* Critical only. An order whose crew is booked against a date that has
           moved is a thing Christy has to DO something about, and the agent move
           is that something. Everything else is fine — offering "Confirm the
           window" on twelve calm orders makes the column a wall of buttons and
           buries the two rows that matter. A calm row gets Review, which is what
           a reader wants from it: the record. */
        const risk = riskFor(o);
        const needsAgent = risk === "critical" || risk === "high";
        return (
        <span className="flex items-center gap-1.5">
          {needsAgent ? (
            <Button
              size="sm"
              variant="outline"
                title={`${orderTaskFor(o, profile.agent).label} on ${o.id}`}
              aria-label={`${orderTaskFor(o, profile.agent).label} on ${o.id}`}
              onClick={() => startTask(orderTaskFor(o, profile.agent))}
            >
              {orderTaskFor(o, profile.agent).label}
            </Button>
          ) : (
            <Link href={orderRoute(o.id)}>
              <Button
                size="sm"
                variant="outline"
                title={`Open ${o.id}`}
                aria-label={`Review ${o.id}`}
              >
                Review
              </Button>
            </Link>
          )}
          {/* Filing is only possible against a receipted delivery, so the button
              only exists where it would work. */}
          {o.receipt && (
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              title={`File a claim against ${o.receipt}`}
              aria-label={`File a claim against ${o.id}`}
              onClick={() => startClaim(o)}
            >
              <ClipboardText size={14} />
            </Button>
          )}
        </span>
        );
      },
    },
  ];

  const kept = promisesKept();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Orders"
        subtitle={`Every order on the book — ${ORDERS.length} live and delivered, not only the ${SERVICE_BOOK.atRisk} that need you`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Open order value"
          value={formatUsd(SERVICE_BOOK.openValue)}
          subtitle={`${ORDERS.filter(IN_TAB.open).length} orders not yet delivered`}
          info="Value on orders that have not landed, before anything in the action center is worked."
        />
        <KpiBreakdownCard
          title="Promises kept"
          value={`${kept.pct}%`}
          subtitle={`${kept.kept} of ${kept.total} delivered on the promised date`}
          info="Deliveries that arrived on the date the account was originally given, not on a re-promise."
        />
        <KpiBreakdownCard
          title="At risk"
          value={String(SERVICE_BOOK.atRisk)}
          subtitle={`${ORDERS.filter((o) => o.crewBooked && AT_RISK.has(o.health)).length} with a crew already booked`}
          info="Delayed, backordered, or running so close to the floor-set date that a day would break it."
        />
        <KpiBreakdownCard
          title="In transit"
          value={String(SERVICE_BOOK.inTransit)}
          subtitle={
            SERVICE_BOOK.etaConflicts > 0
              ? `${SERVICE_BOOK.etaConflicts} with systems disagreeing on the date`
              : "Every ETA agrees"
          }
        />
      </KpiGrid>

      <TableShell
        title="Order book"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: ORDERS.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setHealth("all");
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by order, account, style or receipt"
        filters={
          <Select
            value={health}
            onValueChange={(v: string) => {
              setHealth(v as "all" | OrderHealth);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by status">
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {healthsInTab.map((h) => (
                <Select.Item key={h} value={h}>
                  {HEALTH_LABEL[h]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setHealth("all");
          setPage(1);
        }}
        isFiltered={health !== "all" || q.trim().length > 0}
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
            No order matches that.
          </div>
        }
      >
        <DataTable<ServiceOrder>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(o) => o.id}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          /* The row is the way into the record, so the Action column carries
             only the move. A Review button beside a clickable row was the
             same navigation twice. */
          onRowClick={(o) => router.push(orderRoute(o.id))}
        />
      </TableShell>

      {toast && (
        <KToastContainer position="top-right" className="z-[110]">
          <Toast
            type="success"
            className="transition-[opacity,translate,scale]"
            title={toast.title}
            message={
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
