"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
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
import { loadTaskFor } from "@/data/logistics-flows";
import {
  LOADS,
  LOAD_AT_RISK,
  LOAD_HEALTH_LABEL,
  LOAD_STAGE_LABEL,
  LOGISTICS_BOOK,
  accessorialsFor,
  bestLoadEta,
  detentionNow,
  formatUsd,
  hasLoadEtaConflict,
  loadPallets,
  loadValue,
  loadsOnTime,
  type Load,
  type LoadHealth,
  type LoadStage,
} from "@/data/logistics";
import { LoadEtaReconciler } from "@/components/logistics/LoadEtaReconciler";
import { Panel } from "@/components/buying/Panel";
import { OnTrackPill } from "@/components/ui/OnTrackPill";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** The three lists a load can be in: still moving, the subset of those that is
 *  not moving well, and what has landed. */
type TabId = "open" | "at-risk" | "delivered";

const IN_TAB: Record<TabId, (l: Load) => boolean> = {
  open: (l) => l.stage !== "delivered",
  "at-risk": (l) => LOAD_AT_RISK.has(l.health),
  delivered: (l) => l.stage === "delivered",
};

const TAB_LABEL: Record<TabId, string> = {
  open: "Open",
  "at-risk": "At risk",
  delivered: "Delivered",
};

/**
 * Where a load has got to.
 *
 * The same five-dot idiom the order book uses, so a reader crossing between the
 * service seat and this one learns it once. The colour at the current dot is the
 * argument: blue when the load is fine, red when it is not, so one glance answers
 * both "how far along" and "should I worry".
 */
function StageDots({ load }: { load: Load }) {
  const stages: LoadStage[] = ["tendered", "dispatched", "rolling", "at-gate", "delivered"];
  const at = stages.indexOf(load.stage);
  const delivered = load.stage === "delivered";
  const atRisk = LOAD_AT_RISK.has(load.health);

  return (
    <span className="flex items-center" style={{ gap: 3 }}>
      {stages.map((st, i) => {
        let bg: string;
        /* A delivered load that was signed with an exception is not a clean
           finish, so it does not get the clean-finish colour. */
        if (delivered && atRisk) bg = "var(--ds-icon-error)";
        else if (delivered) bg = "var(--ds-icon-success)";
        else if (i < at) bg = "var(--ds-icon-success)";
        else if (i === at) bg = atRisk ? "var(--ds-icon-error)" : "var(--ds-icon-info)";
        else bg = "var(--ds-border-subtle)";
        return (
          <span
            key={st}
            aria-hidden="true"
            className="rounded-full"
            style={{ width: 8, height: 8, background: bg }}
          />
        );
      })}
    </span>
  );
}

/**
 * The whole load book, not just the exceptions.
 *
 * The action center shows the six loads that shout. The network runs roughly
 * 2,700 deliveries a day, and every "where is my truck" call is about a load that
 * is running perfectly fine — so a page that only holds the exceptions cannot
 * answer the call that eats the day.
 *
 * Selecting a row unfolds the reconciler beneath it rather than opening a modal.
 * Terrence takes these calls with the account on the line; a dialog he has to
 * dismiss to look at the next load is the wrong shape for that.
 */
export function LoadsScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();
  const params = useSearchParams();

  const [tab, setTab] = useState<TabId>("open");
  const [q, setQ] = useState("");
  const [health, setHealth] = useState<"all" | LoadHealth>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "value", dir: "desc" });
  const [openId, setOpenId] = useState<string | null>(params.get("load"));

  const inTab = useMemo(() => LOADS.filter(IN_TAB[tab]), [tab]);
  const healthsInTab = useMemo(() => [...new Set(inTab.map((l) => l.health))], [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((l) => {
      if (health !== "all" && l.health !== health) return false;
      if (!needle) return true;
      return [l.id, l.orderId ?? "", l.account, l.lane, l.carrier, l.unitId ?? "", LOAD_HEALTH_LABEL[l.health]]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, health, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "value") return (loadValue(a) - loadValue(b)) * dir;
      if (sort.field === "miles") return (a.miles - b.miles) * dir;
      return (
        String(a[sort.field as keyof Load] ?? "").localeCompare(
          String(b[sort.field as keyof Load] ?? ""),
        ) * dir
      );
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((l, i) => rowNumber.set(l.id, i + 1));

  const serialSlot: DataTableSlotColumn<Load> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (l) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(l.id)}
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
            value: LOAD_HEALTH_LABEL[health],
            onRemove: () => {
              setHealth("all");
              setPage(1);
            },
          },
        ];

  const columns: DataTableColumn<Load>[] = [
    {
      key: "value",
      label: "Load",
      sortable: true,
      minWidth: 140,
      maxWidth: 152,
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
            {l.id}
          </span>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {formatUsd(loadValue(l))}
          </span>
        </span>
      ),
    },
    {
      key: "lane",
      label: "Lane",
      sortable: true,
      minWidth: 176,
      maxWidth: 208,
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, color: "var(--ds-text-primary)" }} title={l.lane}>
            {l.lane}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${l.miles.toLocaleString()} mi · ${loadPallets(l)} units`}
          </span>
        </span>
      ),
    },
    {
      key: "carrier",
      /* Own iron and bought capacity read differently at a glance, because the
         question "could the fleet have taken this" is the seat's whole job. */
      label: "Carrier / Mode",
      sortable: true,
      minWidth: 150,
      maxWidth: 172,
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <Pill variant={l.haul === "fleet" ? "info" : "neutral"} size="sm">
            {l.haul === "fleet" ? `Fleet #${l.unitId}` : l.carrier.replace("Purchased · ", "")}
          </Pill>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
            {l.account}
          </span>
        </span>
      ),
    },
    {
      key: "eta",
      label: "Reconciled ETA",
      minWidth: 148,
      /* One ETA, with what it cost to get it. The confidence is not decoration —
         it is the difference between an answer Terrence will repeat to a account
         and one he will hedge on. */
      cell: (l) => {
        const best = bestLoadEta(l);
        const conflict = hasLoadEtaConflict(l);
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {best.eta}
            </span>
            <span
              style={{
                fontSize: 12,
                ...numeric,
                color: conflict ? "var(--text-danger)" : "var(--ds-text-secondary)",
              }}
            >
              {conflict
                ? `${l.etas.length} systems disagree`
                : `${best.confidence}% · ${best.system}`}
            </span>
          </span>
        );
      },
    },
    {
      key: "stage",
      label: "Status",
      minWidth: 140,
      cell: (l) => (
        <span
          className="flex min-w-0 flex-col"
          style={{ gap: 4 }}
          aria-label={`${LOAD_STAGE_LABEL[l.stage]}${LOAD_AT_RISK.has(l.health) ? ` — ${LOAD_HEALTH_LABEL[l.health]}` : ""}`}
        >
          <StageDots load={l} />
          <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", whiteSpace: "nowrap" }}>
            {LOAD_STAGE_LABEL[l.stage]}
          </span>
        </span>
      ),
    },
    {
      key: "health",
      label: "Exception",
      sortable: true,
      minWidth: 118,
      cell: (l) => {
        if (l.health === "clean") return <OnTrackPill />;
        const variant =
          l.health === "damaged" || l.health === "recovering"
            ? "danger"
            : l.health === "eta-conflict" || l.health === "window-risk"
              ? "warning"
              : "neutral";
        return (
          <Pill variant={variant} size="sm">
            {LOAD_HEALTH_LABEL[l.health]}
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
      cell: (l) => (
        <span
          title={l.note}
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
          {l.note}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      minWidth: 190,
      align: "right",
      stopRowClick: true,
      /* Two controls, and they answer different questions. The agent move is
         what to DO about the load; Sources is the evidence behind its ETA,
         which the reconciler already draws inline. */
      cell: (l) => (
        <span className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            title={`${loadTaskFor(l, profile.agent).label} on ${l.id}`}
            aria-label={`${loadTaskFor(l, profile.agent).label} on ${l.id}`}
            onClick={() => startTask(loadTaskFor(l, profile.agent))}
          >
            {loadTaskFor(l, profile.agent).label}
          </Button>
        </span>
      ),
    },
  ];

  const onTime = loadsOnTime();
  const open = LOADS.filter(IN_TAB.open);
  const selected = openId ? LOADS.find((l) => l.id === openId) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Loads"
        subtitle={`Every load on the book — ${LOADS.length} moving and delivered, not only the ${LOGISTICS_BOOK.atRisk} that need you`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="In-transit value"
          value={formatUsd(LOGISTICS_BOOK.inFlightValue)}
          subtitle={`${open.length} loads not yet delivered`}
          info="Value riding on loads that have not landed, before anything in the action center is worked."
        />
        <KpiBreakdownCard
          title="Clean POD rate"
          value={`${onTime.pct}%`}
          subtitle={`${onTime.kept} of ${onTime.total} signed without an exception`}
          info="Share of proofs of delivery signed without an OS&D exception. A load signed short or damaged is not a clean POD, however happy the tracking systems are about it."
        />
        <KpiBreakdownCard
          title="ETA variance"
          value={String(LOGISTICS_BOOK.etaConflicts)}
          subtitle={
            LOGISTICS_BOOK.etaConflicts > 0
              ? "Open the sources to see which to repeat"
              : "Every source agrees"
          }
          info="Loads where the tractor, trailer and shipment feeds name different arrival times — the variance is the thing to close, not the count."
        />
        <KpiBreakdownCard
          title="Private fleet share"
          value={`${Math.round((open.filter((l) => l.haul === "fleet").length / Math.max(1, open.length)) * 100)}%`}
          subtitle={`${open.filter((l) => l.haul === "fleet").length} of ${open.length} in-flight loads`}
          info="Share of moving loads on the private fleet rather than bought capacity."
        />
      </KpiGrid>

      <TableShell
        title="Load book"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: LOADS.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setHealth("all");
          setQ("");
          setPage(1);
          setOpenId(null);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by load, order, account, lane or unit"
        filters={
          <Select
            value={health}
            onValueChange={(v: string) => {
              setHealth(v as "all" | LoadHealth);
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
                  {LOAD_HEALTH_LABEL[h]}
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
            No load matches that.
          </div>
        }
      >
        <DataTable<Load>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(l) => l.id}
          onRowClick={(l) => setOpenId(openId === l.id ? null : l.id)}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </TableShell>

      {/* The sources for one load. Below the table rather than over it — the
          account is on the phone and the next row still has to be reachable. */}
      {selected && (
        <Panel
          title={`${selected.id} · ${selected.lane}`}
          subtitle={`${selected.carrier} · ${loadPallets(selected)} units · ${formatUsd(loadValue(selected))}${selected.orderId ? ` · carries ${selected.orderId}` : ""}`}
        >
          <div className="flex flex-col gap-3">
            <LoadEtaReconciler load={selected} agent={profile.agent} />

            {selected.pod?.exception && (
              <PanelAlert
                type="warning"
                title={`Signed with an exception — ${selected.pod.at}`}
                description={`${selected.pod.exception}. Signed by ${selected.pod.signedBy}. Every tracking system reads this load complete.`}
              />
            )}

            {accessorialsFor(selected.id).length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                  Charges beyond the linehaul
                </span>
                <ul className="flex flex-col">
                  {accessorialsFor(selected.id).map((a, i) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                          {a.note}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Pill variant={a.status === "accruing" ? "warning" : "neutral"} size="sm">
                          {a.status === "accruing" ? "Accruing now" : a.status}
                        </Pill>
                        <span
                          className="ds-body-medium"
                          style={{ color: "var(--ds-text-primary)", ...numeric }}
                        >
                          {formatUsd(detentionNow(a))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.health === "clean" && !selected.pod?.exception && (
              <span
                className="flex items-center gap-2 ds-label"
                style={{ color: "var(--text-muted)" }}
              >
                <Warning size={14} />
                Nothing outstanding on this load.
              </span>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
