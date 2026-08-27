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
import { unitTaskFor } from "@/data/logistics-flows";
import {
  FLEET,
  LOGISTICS_BOOK,
  UNIT_STATUS_LABEL,
  availableUnits,
  fleetUtilisation,
  onWatch,
  unitsOnWatch,
  utilisation,
  type PowerUnit,
  type UnitStatus,
} from "@/data/logistics";
import { Panel } from "@/components/buying/Panel";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type TabId = "all" | "available" | "watch";

const IN_TAB: Record<TabId, (u: PowerUnit) => boolean> = {
  all: () => true,
  available: (u) => u.status === "available" && u.hos.drivingLeft > 0,
  watch: (u) => onWatch(u) !== null,
};

const TAB_LABEL: Record<TabId, string> = {
  all: "Whole fleet",
  available: "Can take work",
  watch: "Watchlist",
};

/**
 * The hours clock, drawn as two bars.
 *
 * Today's driving hours and the eight-day cycle bind at different times, and one
 * number cannot say that. A unit with nine hours today and sixteen on the cycle
 * is fine for a regional run and cannot be planned for anything overnight —
 * which is exactly the mistake dispatching from a single "hours left" figure
 * makes.
 */
function HoursBars({ hos }: { hos: PowerUnit["hos"] }) {
  const rows: { label: string; value: number; of: number }[] = [
    { label: "Today", value: hos.drivingLeft, of: 11 },
    { label: "Cycle", value: hos.cycleLeft, of: 70 },
  ];
  return (
    <span className="flex flex-col" style={{ gap: 3 }}>
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / r.of) * 100));
        /* Under a fifth of the clock is the point where a run stops being
           plannable, so that is where the bar changes colour. */
        const tone =
          pct <= 20 ? "var(--ds-icon-error)" : pct <= 45 ? "var(--ds-icon-warning)" : "var(--ds-icon-success)";
        return (
          <span key={r.label} className="flex items-center" style={{ gap: 6 }}>
            <span
              style={{ fontSize: 11, color: "var(--ds-text-secondary)", width: 34, ...numeric }}
            >
              {r.label}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 46,
                height: 5,
                borderRadius: 3,
                background: "var(--ds-border-subtle)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <span style={{ display: "block", width: `${pct}%`, height: "100%", background: tone }} />
            </span>
            <span style={{ fontSize: 12, color: "var(--ds-text-primary)", ...numeric }}>
              {`${r.value}h`}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * The fleet, as one book.
 *
 * Capacity, driver hours and maintenance windows live in three systems — TMW/TMT,
 * Forwarder feed and the telematics feed — which is why "can the fleet take
 * this" is currently answered by phoning the yard. This is the buyer's supplier
 * book pointed inward at Target's own iron: what we own, what it is doing, and what
 * will stop it doing more this week.
 *
 * The watchlist is derived, never stored. A flag that can disagree with the
 * numbers underneath it is worse than no flag at all.
 */
export function FleetScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();

  const [tab, setTab] = useState<TabId>("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | UnitStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "id", dir: "asc" });

  const inTab = useMemo(() => FLEET.filter(IN_TAB[tab]), [tab]);
  const statusesInTab = useMemo(() => [...new Set(inTab.map((u) => u.status))], [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (!needle) return true;
      return [u.id, u.driver, u.tractor, u.domicile, u.loadId ?? "", UNIT_STATUS_LABEL[u.status]]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, status, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "utilisation") return (utilisation(a) - utilisation(b)) * dir;
      if (sort.field === "hos") return (a.hos.cycleLeft - b.hos.cycleLeft) * dir;
      return (
        String(a[sort.field as keyof PowerUnit] ?? "").localeCompare(
          String(b[sort.field as keyof PowerUnit] ?? ""),
        ) * dir
      );
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((u, i) => rowNumber.set(u.id, i + 1));

  const serialSlot: DataTableSlotColumn<PowerUnit> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (u) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(u.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    status === "all"
      ? []
      : [
          {
            key: "status",
            label: "Status",
            value: UNIT_STATUS_LABEL[status],
            onRemove: () => {
              setStatus("all");
              setPage(1);
            },
          },
        ];

  const columns: DataTableColumn<PowerUnit>[] = [
    {
      key: "id",
      label: "Unit",
      sortable: true,
      minWidth: 150,
      maxWidth: 170,
      cell: (u) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
            {`#${u.id}`}
          </span>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)" }} title={u.tractor}>
            {u.tractor}
          </span>
        </span>
      ),
    },
    {
      key: "driver",
      label: "Driver",
      sortable: true,
      minWidth: 140,
      maxWidth: 160,
      cell: (u) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>
            {u.driver}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${u.driverYears} yrs · ${u.domicile}`}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      label: "Doing what",
      sortable: true,
      minWidth: 148,
      cell: (u) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <Pill
            variant={
              u.status === "maintenance"
                ? "danger"
                : u.status === "off-duty"
                  ? "neutral"
                  : u.status === "available"
                    ? "info"
                    : "warning"
            }
            size="sm"
          >
            {UNIT_STATUS_LABEL[u.status]}
          </Pill>
          {u.loadId ? (
            <Link
              href={`/logistics/loads?load=${u.loadId}`}
              className="truncate hover:underline"
              style={{ fontSize: 12, color: "var(--link-color)" }}
            >
              {u.loadId}
            </Link>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No load</span>
          )}
        </span>
      ),
    },
    {
      key: "hos",
      /* The clock, not a number. Both bars, because the two limits bind at
         different times and the pair is the answer. */
      label: "Hours left",
      sortable: true,
      minWidth: 132,
      cell: (u) => <HoursBars hos={u.hos} />,
    },
    {
      key: "maintenance",
      label: "Next service",
      minWidth: 140,
      cell: (u) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, color: "var(--ds-text-primary)" }} title={u.maintenance.item}>
            {u.maintenance.item}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {u.maintenance.bookedFor
              ? u.maintenance.bookedFor
              : `in ${u.maintenance.dueIn.toLocaleString()} ${u.maintenance.dueUnit}`}
          </span>
        </span>
      ),
    },
    {
      key: "utilisation",
      /* Loaded share, which is the number that says whether the fleet is being
         run as an asset or as a fallback. */
      label: "Loaded",
      sortable: true,
      minWidth: 104,
      cell: (u) => {
        const pct = utilisation(u);
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span
              style={{
                fontSize: 14,
                ...numeric,
                color: pct >= 85 ? "var(--text-success)" : pct >= 78 ? "var(--ds-text-primary)" : "var(--text-danger)",
              }}
            >
              {`${pct}%`}
            </span>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
              {`${u.emptyMiles.toLocaleString()} mi empty`}
            </span>
          </span>
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
      cell: (u) => (
        <span
          title={u.note}
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
          {u.note}
        </span>
      ),
    },
    {
      /* The fleet table read but never acted. A tractor sitting free with
         hours on the clock, or one running past its service interval, are
         both decisions — so each row now carries the one it needs. */
      key: "action",
      label: "Action",
      minWidth: 178,
      align: "right",
      stopRowClick: true,
      cell: (u) => (
        <span className="flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            title={`${unitTaskFor(u, profile.agent).label} on ${u.id}`}
            aria-label={`${unitTaskFor(u, profile.agent).label} on ${u.id}`}
            onClick={() => startTask(unitTaskFor(u, profile.agent))}
          >
            {unitTaskFor(u, profile.agent).label}
          </Button>
        </span>
      ),
    },
  ];

  const watch = unitsOnWatch();
  const free = availableUnits();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Fleet"
        subtitle={`${FLEET.length} power units — what they are doing, what hours they have left, and what takes them off the road`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Can take work"
          value={String(LOGISTICS_BOOK.unitsAvailable)}
          subtitle={
            free.length > 0
              ? `${free.map((u) => `#${u.id}`).join(", ")} · legal hours today`
              : "Nothing free with hours"
          }
          info="Available and with driving hours left. A unit off duty or in the shop is not capacity, however idle it looks."
        />
        <KpiBreakdownCard
          title="Loaded miles"
          value={`${fleetUtilisation()}%`}
          subtitle={`${FLEET.reduce((s, u) => s + u.emptyMiles, 0).toLocaleString()} empty miles this month`}
          info="Miles run loaded as a share of all miles. The number that says whether the fleet is an asset or a fallback."
        />
        <KpiBreakdownCard
          title="On the watchlist"
          value={String(watch.length)}
          subtitle={watch.length > 0 ? "Maintenance or hours bite this week" : "Nothing due this week"}
          info="Derived from the record: service inside 1,500 miles or 10 days, a cycle under 20 hours, or already in the shop."
        />
        <KpiBreakdownCard
          title="Under a load"
          value={String(FLEET.filter((u) => u.loadId !== undefined).length)}
          subtitle={`of ${FLEET.length} units`}
          info="Units currently assigned to a moving load."
        />
      </KpiGrid>

      {/* The watchlist ahead of the table, because it is what changes this
          week's dispatching — the same order Inventory Planning uses. */}
      {watch.length > 0 && (
        <Panel
          title="What comes out of the pool"
          subtitle="Derived from hours and the maintenance record, not a stored flag"
        >
          <ul className="flex flex-col">
            {watch.map((u, i) => (
              <li
                key={u.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {`#${u.id} · ${u.driver}`}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {u.note}
                  </span>
                </span>
                <Pill variant={u.status === "maintenance" ? "danger" : "warning"} size="sm">
                  {onWatch(u)}
                </Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <TableShell
        title="Power units"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: FLEET.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setStatus("all");
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by unit, driver, tractor or domicile"
        filters={
          <Select
            value={status}
            onValueChange={(v: string) => {
              setStatus(v as "all" | UnitStatus);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by status">
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {statusesInTab.map((s) => (
                <Select.Item key={s} value={s}>
                  {UNIT_STATUS_LABEL[s]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setStatus("all");
          setPage(1);
        }}
        isFiltered={status !== "all" || q.trim().length > 0}
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
            No unit matches that.
          </div>
        }
      >
        <DataTable<PowerUnit>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(u) => u.id}
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
