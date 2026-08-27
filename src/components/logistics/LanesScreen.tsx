"use client";

import { useMemo, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  DataTable,
  KpiBreakdownCard,
  KpiGrid,
  PageHeading,
  PanelAlert,
  Pill,
  TableShell,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { useChatPanel } from "@/context/ChatPanelContext";
import { laneTaskFor, backhaulTaskFor } from "@/data/logistics-flows";
import {
  HABIT_FLOOR,
  LANES,
  LOGISTICS_BOOK,
  formatUsd,
  formatUsdExact,
  laneById,
  laneDelta,
  laneHabitCost,
  lanesToRebalance,
  openBackhauls,
  plural,
  unitById,
  type Lane,
} from "@/data/logistics";
import { Panel } from "@/components/buying/Panel";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type TabId = "all" | "rebalance" | "backhaul";

const TAB_LABEL: Record<TabId, string> = {
  all: "Every lane",
  rebalance: "Worth rebalancing",
  backhaul: "Thin backhaul",
};

const IN_TAB: Record<TabId, (l: Lane) => boolean> = {
  all: () => true,
  rebalance: (l) => laneHabitCost(l) >= HABIT_FLOOR,
  backhaul: (l) => l.backhaulCoverage < 50,
};

/**
 * The two rates side by side, drawn to scale against each other.
 *
 * A pair of numbers in a column of numbers is unrankable at a glance, and the
 * decision this page exists for is a comparison. The bars are scaled to the
 * dearer of the two so the gap is the thing the eye lands on, and the cheaper one
 * is the one that carries the colour.
 */
function RateCompare({ lane }: { lane: Lane }) {
  const worst = Math.max(lane.fleetCostPerMile, lane.purchasedRatePerMile);
  const rows: { label: string; rate: number; own: boolean }[] = [
    { label: "Fleet", rate: lane.fleetCostPerMile, own: true },
    { label: "Bought", rate: lane.purchasedRatePerMile, own: false },
  ];
  const cheaper = lane.fleetCostPerMile <= lane.purchasedRatePerMile ? "Fleet" : "Bought";

  return (
    <span className="flex flex-col" style={{ gap: 3 }}>
      {rows.map((r) => (
        <span key={r.label} className="flex items-center" style={{ gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--ds-text-secondary)", width: 40 }}>
            {r.label}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 52,
              height: 5,
              borderRadius: 3,
              background: "var(--ds-border-subtle)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "block",
                width: `${(r.rate / worst) * 100}%`,
                height: "100%",
                background:
                  r.label === cheaper ? "var(--ds-icon-success)" : "var(--ds-border-strong, #d4d4d8)",
              }}
            />
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-primary)", ...numeric }}>
            {`$${r.rate.toFixed(2)}`}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Lanes and what they cost on each kind of capacity.
 *
 * Fleet answered "can we". This answers "should we". Lane rates get looked up
 * after the decision rather than before it, so the decision gets made on habit —
 * and habit is visible here as money: `laneHabitCost` prices the gap between the
 * split a lane actually runs and the split its rates argue for.
 *
 * The fleet rate is all-in, including the empty return the lane really runs.
 * Quoting own iron without the empty leg is how a lane looks cheap on the fleet
 * and is not, which is the specific error this page exists to stop.
 */
export function LanesScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();

  const [tab, setTab] = useState<TabId>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "habit", dir: "desc" });

  const inTab = useMemo(() => LANES.filter(IN_TAB[tab]), [tab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return inTab;
    return inTab.filter((l) =>
      [l.id, l.origin, l.destination, l.note].join(" ").toLowerCase().includes(needle),
    );
  }, [inTab, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "habit") return (laneHabitCost(a) - laneHabitCost(b)) * dir;
      if (sort.field === "rates") return (laneDelta(a) - laneDelta(b)) * dir;
      if (sort.field === "volume") return (a.loadsThisMonth - b.loadsThisMonth) * dir;
      if (sort.field === "backhaulCoverage") return (a.backhaulCoverage - b.backhaulCoverage) * dir;
      return (
        String(a[sort.field as keyof Lane] ?? "").localeCompare(
          String(b[sort.field as keyof Lane] ?? ""),
        ) * dir
      );
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((l, i) => rowNumber.set(l.id, i + 1));

  const serialSlot: DataTableSlotColumn<Lane> = {
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

  const columns: DataTableColumn<Lane>[] = [
    {
      key: "origin",
      label: "Lane",
      sortable: true,
      minWidth: 178,
      maxWidth: 210,
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}
            title={`${l.origin} → ${l.destination}`}
          >
            {`${l.origin} → ${l.destination}`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${l.miles.toLocaleString()} mi`}
          </span>
        </span>
      ),
    },
    {
      key: "volume",
      label: "This month",
      sortable: true,
      minWidth: 108,
      cell: (l) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
            {`${l.loadsThisMonth} loads`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${l.palletsThisMonth.toLocaleString()} units`}
          </span>
        </span>
      ),
    },
    {
      key: "rates",
      label: "Cost per mile",
      sortable: true,
      minWidth: 152,
      cell: (l) => <RateCompare lane={l} />,
    },
    {
      key: "fleetShare",
      /* What actually ran, next to what the rates argue for. The gap between
         these two columns IS the habit. */
      label: "Ran on fleet",
      sortable: true,
      minWidth: 118,
      cell: (l) => {
        const delta = laneDelta(l);
        const shouldFavourFleet = delta > 0;
        const mismatch = shouldFavourFleet ? l.fleetShare < 60 : l.fleetShare > 40;
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span
              style={{
                fontSize: 14,
                ...numeric,
                color: mismatch ? "var(--text-danger)" : "var(--ds-text-primary)",
              }}
            >
              {`${l.fleetShare}%`}
            </span>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
              {shouldFavourFleet ? "fleet is cheaper" : "bought is cheaper"}
            </span>
          </span>
        );
      },
    },
    {
      key: "backhaulCoverage",
      label: "Backhaul",
      sortable: true,
      minWidth: 104,
      cell: (l) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span
            style={{
              fontSize: 14,
              ...numeric,
              color:
                l.backhaulCoverage >= 60
                  ? "var(--text-success)"
                  : l.backhaulCoverage >= 40
                    ? "var(--ds-text-primary)"
                    : "var(--text-danger)",
            }}
          >
            {`${l.backhaulCoverage}%`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>returns loaded</span>
        </span>
      ),
    },
    {
      key: "habit",
      /* The point of the page as one number: what the current split costs
         against running each load the cheaper way. */
      label: "Cost of habit",
      sortable: true,
      minWidth: 120,
      cell: (l) => {
        const cost = laneHabitCost(l);
        if (cost < HABIT_FLOOR) {
          return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>;
        }
        return (
          <span className="flex flex-col items-start" style={{ gap: 2 }}>
            <Pill variant={cost >= 1_000 ? "danger" : "warning"} size="sm">
              {`${formatUsdExact(cost)}/mo`}
            </Pill>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
              {`${formatUsdExact(cost * 12)} a year`}
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
      /* The lane page argued the economics and then offered nothing to do
         about them. The move follows the argument: where fleet is cheaper,
         shift volume onto it; where bought wins, re-tender. */
      key: "action",
      label: "Action",
      minWidth: 172,
      align: "right",
      stopRowClick: true,
      cell: (l) => (
        <span className="flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            title={`${laneTaskFor(l, profile.agent).label} · ${l.origin} → ${l.destination}`}
            aria-label={`${laneTaskFor(l, profile.agent).label} on ${l.id}`}
            onClick={() => startTask(laneTaskFor(l, profile.agent))}
          >
            {laneTaskFor(l, profile.agent).label}
          </Button>
        </span>
      ),
    },
  ];

  const rebalance = lanesToRebalance();
  const offers = openBackhauls();
  const expiringSoon = offers.filter((b) => b.expiresInHours <= 4);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Lanes & rates"
        subtitle={`${LANES.length} lanes with both rates on them — so fleet versus bought is decided before the load is tendered, not after`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Cost of habit"
          value={`${formatUsdExact(LOGISTICS_BOOK.habitCost * 12)}/yr`}
          subtitle={`${formatUsdExact(LOGISTICS_BOOK.habitCost)} a month across ${rebalance.length} ${rebalance.length === 1 ? "lane" : "lanes"}`}
          info="What the current fleet/bought split costs against running each load on whichever is cheaper all-in. Annualised because a month of it reads as noise. Derived from the rates, not estimated."
        />
        <KpiBreakdownCard
          title="Fleet cheaper on"
          value={`${LANES.filter((l) => laneDelta(l) > 0).length} of ${LANES.length}`}
          subtitle="lanes, all-in including the empty return"
          info="A fleet rate quoted without the empty return is how a lane looks cheap on own iron and is not."
        />
        <KpiBreakdownCard
          title="Backhaul on offer"
          value={formatUsd(LOGISTICS_BOOK.backhaulRevenue)}
          subtitle={`${plural(offers.length, "return leg")} inside their window`}
          info="Revenue available on return legs that are still bookable. A backhaul found after dispatch is not a backhaul."
        />
        <KpiBreakdownCard
          title="Thinnest coverage"
          value={`${Math.min(...LANES.map((l) => l.backhaulCoverage))}%`}
          subtitle={`${plural(LANES.filter((l) => l.backhaulCoverage < 50).length, "lane")} under half`}
          info="Share of return legs that run loaded. Low coverage is what pushes an all-in fleet rate above bought capacity."
        />
      </KpiGrid>

      {expiringSoon.length > 0 && (
        <PanelAlert
          type="warning"
          title={`${expiringSoon.length} backhaul ${expiringSoon.length === 1 ? "offer expires" : "offers expire"} within four hours`}
          description={expiringSoon
            .map(
              (b) =>
                `${b.shipper} · ${formatUsd(b.revenue)} · ${b.expiresInHours}h left${b.unitId ? ` · fills #${b.unitId}'s empty return` : ""}`,
            )
            .join(" — ")}
        />
      )}

      {/* The backhaul board sits above the lane table: it expires, and the lane
          table does not. Ordering by urgency rather than by hierarchy. */}
      <Panel
        title="Backhaul board"
        subtitle="Return legs somebody else will pay for, soonest to expire first"
      >
        <ul className="flex flex-col">
          {offers.map((b, i) => {
            const lane = laneById(b.laneId);
            const unit = b.unitId ? unitById(b.unitId) : undefined;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
              >
                <span className="flex min-w-0 flex-1 flex-col" style={{ minWidth: 220 }}>
                  <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                    {`${b.shipper} — ${lane ? `${lane.destination} → ${lane.origin}` : b.laneId}`}
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {`${b.pickup} → ${b.deliver} · ${b.milesOutOfRoute} mi out of route`}
                    {unit ? ` · fills #${unit.id} (${unit.driver})` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center" style={{ gap: 10 }}>
                  <Pill variant={b.expiresInHours <= 4 ? "danger" : "neutral"} size="sm">
                    <span className="flex items-center gap-1">
                      <Clock size={12} weight="bold" />
                      {`${b.expiresInHours}h left`}
                    </span>
                  </Pill>
                  <span
                    className="ds-body-medium"
                    style={{ color: "var(--ds-text-primary)", ...numeric, width: 68, textAlign: "right" }}
                  >
                    {formatUsd(b.revenue)}
                  </span>
                  {/* This button was wired to nothing at all. It books the
                      backhaul now — the run drafts the rate confirmation and
                      says what the empty leg was costing. */}
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<AiStar size={13} variant="small" />}
                    aria-label={`Book the ${b.shipper} backhaul`}
                    onClick={() => startTask(backhaulTaskFor(b, profile.agent))}
                  >
                    Book
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <TableShell
        title="Lane book"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: LANES.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by lane or origin"
        totalItems={sorted.length}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        isFiltered={q.trim().length > 0}
        emptyState={
          <div className="type-cell" style={{ padding: 24, color: "var(--ds-text-secondary)" }}>
            No lane matches that.
          </div>
        }
      >
        <DataTable<Lane>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(l) => l.id}
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
