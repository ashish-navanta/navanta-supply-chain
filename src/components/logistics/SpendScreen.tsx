"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AiStar,
  Button,
  DataTable,
  KpiBreakdownCard,
  KpiGrid,
  PageHeading,
  PanelAlert,
  Pill,
  Select,
  TableShell,
  type ActiveFilter,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { useChatPanel } from "@/context/ChatPanelContext";
import { accessorialTaskFor } from "@/data/logistics-flows";
import {
  ACCESSORIALS,
  ACCESSORIAL_LABEL,
  LOGISTICS_BOOK,
  accruingNow,
  costToServeBook,
  detentionNow,
  formatUsd,
  plural,
  loadById,
  type Accessorial,
  type AccessorialKind,
} from "@/data/logistics";
import { Panel } from "@/components/buying/Panel";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type TabId = "accruing" | "booked" | "all";

const IN_TAB: Record<TabId, (a: Accessorial) => boolean> = {
  accruing: (a) => a.status === "accruing",
  booked: (a) => a.status === "booked" || a.status === "disputed",
  all: () => true,
};

const TAB_LABEL: Record<TabId, string> = {
  accruing: "Running now",
  booked: "Booked & disputed",
  all: "Everything",
};

/**
 * A detention clock, drawn as the contract sees it.
 *
 * Free hours then billed hours, on one bar, because the charge is not the story —
 * the overrun is. A bar that fills to the free mark and stops says "nothing owed
 * yet" faster than a $0 can.
 */
function DetentionClock({ a }: { a: Accessorial }) {
  if (a.kind !== "detention" || a.freeHours === undefined || a.elapsedHours === undefined) {
    return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>;
  }
  /* Scale to the free window plus a little headroom, so the overrun is visible
     as a proportion rather than as a sliver against an arbitrary maximum. */
  const scale = Math.max(a.freeHours * 2, a.elapsedHours);
  const freePct = (a.freeHours / scale) * 100;
  const usedPct = (Math.min(a.elapsedHours, a.freeHours) / scale) * 100;
  const overPct = (Math.max(0, a.elapsedHours - a.freeHours) / scale) * 100;

  return (
    <span className="flex flex-col" style={{ gap: 3 }}>
      <span
        aria-hidden="true"
        className="flex"
        style={{
          width: 96,
          height: 6,
          borderRadius: 3,
          background: "var(--ds-border-subtle)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <span style={{ width: `${usedPct}%`, background: "var(--ds-icon-success)" }} />
        <span style={{ width: `${overPct}%`, background: "var(--ds-icon-error)" }} />
        {/* The contract's free mark — the line the charge starts at. */}
        <span
          style={{
            position: "absolute",
            left: `${freePct}%`,
            top: -1,
            bottom: -1,
            width: 1,
            background: "var(--ds-text-primary)",
          }}
        />
      </span>
      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
        {`${a.elapsedHours}h of ${a.freeHours}h free`}
      </span>
    </span>
  );
}

/**
 * What a load costs beyond the linehaul, while it is still costing it.
 *
 * At freight audit every one of these is booked and weeks old, which makes it a
 * fact rather than a decision. A detention clock running right now at a account's
 * dock is something Terrence can pick up a phone about — so the running charges
 * lead, and the audit history sits behind them.
 *
 * The cost-to-serve panel is the one thing on this seat that is really for
 * somebody else: it is the number pricing wants, and it turns a chronically slow
 * receiving dock from a mood into a figure.
 */
export function SpendScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();

  const [tab, setTab] = useState<TabId>("accruing");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | AccessorialKind>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "amount", dir: "desc" });

  const inTab = useMemo(() => ACCESSORIALS.filter(IN_TAB[tab]), [tab]);
  const kindsInTab = useMemo(() => [...new Set(inTab.map((a) => a.kind))], [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((a) => {
      if (kind !== "all" && a.kind !== kind) return false;
      if (!needle) return true;
      return [a.id, a.loadId, a.account, ACCESSORIAL_LABEL[a.kind], a.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, kind, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "amount") return (detentionNow(a) - detentionNow(b)) * dir;
      return (
        String(a[sort.field as keyof Accessorial] ?? "").localeCompare(
          String(b[sort.field as keyof Accessorial] ?? ""),
        ) * dir
      );
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((a, i) => rowNumber.set(a.id, i + 1));

  const serialSlot: DataTableSlotColumn<Accessorial> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (a) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(a.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    kind === "all"
      ? []
      : [
          {
            key: "kind",
            label: "Charge",
            value: ACCESSORIAL_LABEL[kind],
            onRemove: () => {
              setKind("all");
              setPage(1);
            },
          },
        ];

  const columns: DataTableColumn<Accessorial>[] = [
    {
      key: "loadId",
      label: "Load",
      sortable: true,
      minWidth: 140,
      maxWidth: 156,
      cell: (a) => {
        const load = loadById(a.loadId);
        return (
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            <Link
              href={`/logistics/loads?load=${a.loadId}`}
              className="hover:underline"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)" }}
            >
              {a.loadId}
            </Link>
            <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
              {load?.lane ?? "—"}
            </span>
          </span>
        );
      },
    },
    {
      key: "account",
      label: "Account",
      sortable: true,
      minWidth: 156,
      maxWidth: 176,
      cell: (a) => (
        <Pill variant="info" size="sm">
          {a.account}
        </Pill>
      ),
    },
    {
      key: "kind",
      label: "Charge",
      sortable: true,
      minWidth: 128,
      cell: (a) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>
            {ACCESSORIAL_LABEL[a.kind]}
          </span>
          <Pill
            variant={a.status === "accruing" ? "warning" : a.status === "disputed" ? "danger" : "neutral"}
            size="sm"
          >
            {a.status === "accruing" ? "Running now" : a.status === "disputed" ? "Disputed" : "Booked"}
          </Pill>
        </span>
      ),
    },
    {
      key: "clock",
      label: "Against the clock",
      minWidth: 132,
      cell: (a) => <DetentionClock a={a} />,
    },
    {
      key: "amount",
      /* Priced from the clock for anything still running, so the figure on
         screen is the figure at this moment rather than at last save. */
      label: "Charge",
      sortable: true,
      minWidth: 104,
      align: "right",
      cell: (a) => {
        const now = detentionNow(a);
        return (
          <span className="flex flex-col items-end" style={{ gap: 1 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                ...numeric,
                color: now === 0 ? "var(--text-muted)" : "var(--ds-text-primary)",
              }}
            >
              {formatUsd(now)}
            </span>
            {a.status === "accruing" && now > 0 && a.ratePerHour && (
              <span style={{ fontSize: 12, color: "var(--text-danger)", ...numeric }}>
                {`+$${a.ratePerHour}/h`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "note",
      label: "Insight",
      minWidth: 240,
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
      cell: (a) => (
        <span
          title={a.note}
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
          {a.note}
        </span>
      ),
    },
    {
      /* An accruing charge is the one case on this page where reading it is
         not enough — the meter is running while you look at it. Stopping the
         clock is worth more than disputing the bill it becomes. */
      key: "action",
      label: "Action",
      minWidth: 168,
      align: "right",
      stopRowClick: true,
      cell: (a) => (
        <span className="flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            title={`${accessorialTaskFor(a, profile.agent).label} on ${a.loadId}`}
            aria-label={`${accessorialTaskFor(a, profile.agent).label} on ${a.id}`}
            onClick={() => startTask(accessorialTaskFor(a, profile.agent))}
          >
            {accessorialTaskFor(a, profile.agent).label}
          </Button>
        </span>
      ),
    },
  ];

  const running = accruingNow();
  const overrunning = running.filter((a) => detentionNow(a) > 0);
  const book = costToServeBook();
  const dearest = book[0];
  const booked = ACCESSORIALS.filter((a) => a.status === "booked").reduce(
    (s, a) => s + a.amount,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Freight spend"
        subtitle="What the loads cost beyond the linehaul — while the clocks are still running, not weeks later at audit"
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Accruing now"
          value={formatUsd(LOGISTICS_BOOK.accruingSpend)}
          subtitle={
            overrunning.length > 0
              ? `${overrunning.length} of ${plural(running.length, "charge")} past their free window`
              : `${plural(running.length, "clock")} running, none past free yet`
          }
          info="Priced from the clock at this moment. At freight audit this figure is already history."
        />
        <KpiBreakdownCard
          title="Booked this period"
          value={formatUsd(booked)}
          subtitle={`${plural(ACCESSORIALS.filter((a) => a.status === "booked").length, "charge")} settled`}
          info="Accessorials already on the invoice — detention, lumper fees, redelivery and layover."
        />
        <KpiBreakdownCard
          title="In dispute"
          value={formatUsd(
            ACCESSORIALS.filter((a) => a.status === "disputed").reduce((s, a) => s + a.amount, 0),
          )}
          subtitle={`${plural(ACCESSORIALS.filter((a) => a.status === "disputed").length, "charge")} with the carrier`}
          info="Billed against a stale index or outside contract terms, and challenged."
        />
        <KpiBreakdownCard
          title="Dearest to serve"
          value={dearest ? formatUsd(dearest.accessorials) : "—"}
          subtitle={dearest ? `${dearest.account} · ${dearest.loads} loads` : "Nothing charged"}
          info="Accessorials against one account. The number pricing wants, and the one that makes a slow dock a cost rather than a mood."
        />
      </KpiGrid>

      {overrunning.length > 0 && (
        <PanelAlert
          type="warning"
          title={`${overrunning.length} ${overrunning.length === 1 ? "clock is" : "clocks are"} past the free window right now`}
          /* Only a detention charge has a free-time clock. Lumper fees and
             layovers accrue too, and running them through the clock sentence
             printed "undefinedh against undefinedh free" — the figures the
             kind simply does not carry. Each charge now gets the sentence its
             own data can support. */
          description={overrunning
            .map((a) => {
              const head = `${a.loadId} at ${a.account}`;
              const climbing = `${formatUsd(detentionNow(a))} and climbing`;
              if (a.elapsedHours === undefined || a.freeHours === undefined) {
                return `${head} — ${ACCESSORIAL_LABEL[a.kind].toLowerCase()}, ${climbing}`;
              }
              return (
                `${head} — ${a.elapsedHours}h against ${a.freeHours}h free, ${climbing}` +
                (a.ratePerHour ? ` at ${formatUsd(a.ratePerHour)}/h` : "")
              );
            })
            .join(" — ")}
        />
      )}

      <Panel
        title="Cost to serve"
        subtitle="Accessorials by account — what the relationship costs after the freight is paid"
      >
        <ul className="flex flex-col">
          {book.map((d, i) => {
            const worst = book[0].accessorials || 1;
            return (
              <li
                key={d.account}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
              >
                <span className="flex min-w-0 flex-1 flex-col" style={{ minWidth: 200 }}>
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {d.account}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {`${d.loads} loads · ${d.charges.length} ${d.charges.length === 1 ? "charge" : "charges"}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center" style={{ gap: 10 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 88,
                      height: 6,
                      borderRadius: 3,
                      background: "var(--ds-border-subtle)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${(d.accessorials / worst) * 100}%`,
                        height: "100%",
                        background: i === 0 ? "var(--ds-icon-error)" : "var(--color-iris-400)",
                      }}
                    />
                  </span>
                  <span
                    className="ds-body-medium"
                    style={{ color: "var(--ds-text-primary)", ...numeric, width: 68, textAlign: "right" }}
                  >
                    {formatUsd(d.accessorials)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <TableShell
        title="Charges"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: ACCESSORIALS.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setKind("all");
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by load, account or charge"
        filters={
          <Select
            value={kind}
            onValueChange={(v: string) => {
              setKind(v as "all" | AccessorialKind);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by charge">
              <Select.Value placeholder="Charge" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All charges</Select.Item>
              {kindsInTab.map((k) => (
                <Select.Item key={k} value={k}>
                  {ACCESSORIAL_LABEL[k]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setKind("all");
          setPage(1);
        }}
        isFiltered={kind !== "all" || q.trim().length > 0}
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
            No charge matches that.
          </div>
        }
      >
        <DataTable<Accessorial>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(a) => a.id}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </TableShell>
    </div>
  );
}
