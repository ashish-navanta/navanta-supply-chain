"use client";

import { useMemo, useState } from "react";
import { Storefront } from "@phosphor-icons/react";
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
import { useChatPanel } from "@/context/ChatPanelContext";
import { PERSONAS } from "@/types/persona";
import { dealerTaskFor } from "@/data/service-flows";
import {
  DEALERS,
  dealerBook,
  formatUsd,
  type Account,
  type DealerSegment,
} from "@/data/service";
import { AccountModal } from "@/components/service/AccountModal";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * The accounts behind the orders.
 *
 * Daniela sees a account one order at a time and never the relationship — which
 * is how a account with six claims against one batch reads as an awkward
 * customer rather than as a factory problem. This is the buyer's supplier book
 * turned around: what we sell them, how we actually serve them, and what is
 * open on both sides.
 */
export function AccountsScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();

  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<"all" | DealerSegment>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "ytdRevenue", dir: "desc" });
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DEALERS.filter((d) => {
      if (segment !== "all" && d.segment !== segment) return false;
      if (!needle) return true;
      return [d.name, d.city, d.state, d.segment, d.tier, d.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, segment]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const f = sort.field as keyof Account;
      if (f === "ytdRevenue") return (a.ytdRevenue - b.ytdRevenue) * dir;
      if (f === "onTimePct") return (a.onTimePct - b.onTimePct) * dir;
      if (f === "claimRate") return (a.claimRate - b.claimRate) * dir;
      return String(a[f] ?? "").localeCompare(String(b[f] ?? "")) * dir;
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((d, i) => rowNumber.set(d.id, i + 1));

  const serialSlot: DataTableSlotColumn<Account> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (d) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(d.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    segment === "all"
      ? []
      : [
          {
            key: "segment",
            label: "Segment",
            value: segment,
            onRemove: () => {
              setSegment("all");
              setPage(1);
            },
          },
        ];

  const columns: DataTableColumn<Account>[] = [
    {
      key: "ytdRevenue",
      label: "Account",
      sortable: true,
      minWidth: 200,
      maxWidth: 240,
      cell: (d) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
            {d.name}
          </span>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${formatUsd(d.ytdRevenue)} YTD · since ${d.since}`}
          </span>
        </span>
      ),
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      minWidth: 140,
      cell: (d) => (
        <Pill variant="info" size="sm" icon={<Storefront weight="duotone" />}>
          {`${d.city}, ${d.state}`}
        </Pill>
      ),
    },
    {
      key: "segment",
      label: "Segment",
      sortable: true,
      minWidth: 118,
      cell: (d) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>{d.segment}</span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>{`${d.tier} tier`}</span>
        </span>
      ),
    },
    {
      key: "open",
      label: "Open with us",
      minWidth: 132,
      cell: (d) => {
        const book = dealerBook(d.name);
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {formatUsd(book.openValue)}
            </span>
            <span
              style={{
                fontSize: 12,
                color: book.atRisk > 0 ? "var(--text-warning-dark)" : "var(--ds-text-secondary)",
              }}
            >
              {book.atRisk > 0 ? `${book.atRisk} at risk` : "nothing at risk"}
            </span>
          </span>
        );
      },
    },
    {
      key: "onTimePct",
      label: "How we serve them",
      sortable: true,
      minWidth: 138,
      cell: (d) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
            {`${d.onTimePct}% on time`}
          </span>
          <span
            style={{
              fontSize: 12,
              ...numeric,
              color: d.claimRate >= 5 ? "var(--text-danger)" : "var(--ds-text-secondary)",
            }}
          >
            {`${d.claimRate} claims / 100 orders`}
          </span>
        </span>
      ),
    },
    {
      key: "claims",
      label: "Claims",
      minWidth: 96,
      cell: (d) => {
        const book = dealerBook(d.name);
        const open = book.claims.filter((c) => c.stage !== "settled" && c.stage !== "declined");
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {String(open.length)}
            </span>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
              {`${book.claims.length} all time`}
            </span>
          </span>
        );
      },
    },
    {
      key: "action",
      label: "Action",
      minWidth: 190,
      align: "right",
      stopRowClick: true,
      /* The account book had no agent surface at all — it was the one CSR
         screen you could only read. An account served worse than its tier
         expects is exactly the thing a person misses in a table and an
         agent does not, so the move leads and Review follows. */
      cell: (d) => (
        <span className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            iconLeft={<AiStar size={13} variant="small" />}
            title={`${dealerTaskFor(d, profile.agent).label} on ${d.name}`}
            aria-label={`${dealerTaskFor(d, profile.agent).label} on ${d.name}`}
            onClick={() => startTask(dealerTaskFor(d, profile.agent))}
          >
            {dealerTaskFor(d, profile.agent).label}
          </Button>
        </span>
      ),
    },
  ];

  const revenue = DEALERS.reduce((s, d) => s + d.ytdRevenue, 0);
  const weightedOnTime = Math.round(
    DEALERS.reduce((s, d) => s + d.onTimePct * d.ytdRevenue, 0) / revenue,
  );
  const worstClaim = [...DEALERS].sort((a, b) => b.claimRate - a.claimRate)[0];
  const exposed = DEALERS.filter((d) => dealerBook(d.name).atRisk > 0);
  const openDealer = openId ? DEALERS.find((d) => d.id === openId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Accounts"
        subtitle={`${DEALERS.length} accounts — what we sell them, and how we actually serve them`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Revenue year to date"
          value={formatUsd(revenue)}
          subtitle={`${DEALERS.length} accounts · ${DEALERS.filter((d) => d.tier === "Platinum").length} platinum`}
        />
        <KpiBreakdownCard
          title="Weighted on time"
          value={`${weightedOnTime}%`}
          subtitle="Revenue-weighted across the book, last 12 months"
          info="Weighted by revenue, so the accounts that matter most move the number most."
        />
        <KpiBreakdownCard
          title="Accounts with exposure"
          value={String(exposed.length)}
          subtitle={
            exposed.length === 0 ? "Nothing at risk" : exposed.map((d) => d.name.split(" ")[0]).join(" · ")
          }
        />
        <KpiBreakdownCard
          title="Highest claim rate"
          value={`${worstClaim.claimRate}`}
          subtitle={`${worstClaim.name} · claims per 100 orders`}
          info="Worth reading next to the dye-lot flag on the claims page before treating it as a account problem."
        />
      </KpiGrid>

      <TableShell
        title="Account book"
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by account, city or segment"
        filters={
          <Select
            value={segment}
            onValueChange={(v: string) => {
              setSegment(v as "all" | DealerSegment);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by segment">
              <Select.Value placeholder="Segment" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All segments</Select.Item>
              {[...new Set(DEALERS.map((d) => d.segment))].map((s) => (
                <Select.Item key={s} value={s}>
                  {s}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setSegment("all");
          setPage(1);
        }}
        isFiltered={segment !== "all" || q.trim().length > 0}
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
            No account matches that.
          </div>
        }
      >
        <DataTable<Account>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(d) => d.id}
          onRowClick={(d) => setOpenId(d.id)}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </TableShell>

      {openDealer &&
        (() => {
          const i = sorted.findIndex((d) => d.id === openDealer.id);
          const step = (by: number) => {
            const next = sorted[i + by];
            return next ? () => setOpenId(next.id) : undefined;
          };
          const nav =
            i < 0
              ? undefined
              : { position: `${i + 1} of ${sorted.length}`, onPrev: step(-1), onNext: step(1) };
          return (
            <AccountModal
              key={openDealer.id}
              account={openDealer}
              agent={profile.agent}
              nav={nav}
              onClose={() => setOpenId(null)}
            />
          );
        })()}
    </div>
  );
}
