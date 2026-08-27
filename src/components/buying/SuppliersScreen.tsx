"use client";

import { countryOf, flagOf } from "@/data/countries";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  EnvelopeSimple,
  Factory,
  Flag,
  Minus,
  PaperPlaneTilt,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  KpiBreakdownCard,
  KpiGrid,
  KpiStatCard,
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
import {
  BOOK,
  SUPPLIERS,
  SUPPLIER_STATUS_LABEL,
  money,
  termsGaps,
  type Supplier,
  type SupplierStatus,
} from "@/data/buying";
import {
  SUPPLIER_PRESETS,
  supplierDraftFor,
  supplierTaskFor,
  type SupplierDraftIcon,
  type SupplierPresetId,
} from "@/data/supplier-drafts";
import { useSearchParams } from "next/navigation";
import { SupplierModal } from "@/components/buying/SupplierModal";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Matches the queue's icon vocabulary — same glyph rules the Opportunities
 *  column uses for its Mercer draft buttons. */
function draftGlyph(icon: SupplierDraftIcon): React.ReactNode {
  const props = { size: 14, weight: "duotone" as const };
  if (icon === "commit") return <CheckCircle {...props} />;
  if (icon === "email") return <EnvelopeSimple {...props} />;
  if (icon === "send") return <PaperPlaneTilt {...props} />;
  if (icon === "flag") return <Flag {...props} />;
  return <PaperPlaneTilt {...props} />;
}

type TabId = "all" | "import" | "domestic" | "watch";

const TAB_LABEL: Record<TabId, string> = {
  all: "All suppliers",
  import: "Import book",
  domestic: "Owned & affiliates",
  watch: "Watchlist",
};

/** A supplier is on the watchlist when the record says act: slipping lead
 *  time, a status that implies a move, or a missing commercial term. */
function onWatchlist(s: Supplier): boolean {
  return (
    s.leadTimeTrend === "slipping" ||
    s.status === "consolidation-target" ||
    s.status === "exit-planned" ||
    s.status === "dual-source-candidate" ||
    (!s.own && s.paymentTermsDays === null)
  );
}

function inTabFor(tab: TabId, s: Supplier): boolean {
  if (tab === "all") return true;
  if (tab === "import") return !s.own;
  if (tab === "domestic") return s.own;
  return onWatchlist(s);
}

const TREND_ICON = {
  slipping: { Glyph: TrendDown, colour: "var(--text-danger)", word: "slipping" },
  improving: { Glyph: TrendUp, colour: "var(--text-success)", word: "improving" },
  stable: { Glyph: Minus, colour: "var(--ds-icon-secondary)", word: "stable" },
} as const;

/**
 * The supplier book. The queue shows a supplier one purchase order at a time;
 * this is the relationship behind it — what we spend, what they hold, how they
 * actually perform, and whether the record is complete enough to negotiate on.
 */
export function SuppliersScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();
  const params = useSearchParams();
  /* Deep-linked from the Mercer chat outcome — ?supplier=SUP-01 opens that
     supplier's record in the modal. Same shape as the Opportunities screen's
     ?play= deep-link. */
  const deepLinked = params.get("supplier");

  const [tab, setTab] = useState<TabId>("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SupplierStatus>("all");
  const [preset, setPreset] = useState<SupplierPresetId | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "annualSpend", dir: "desc" });
  const [openId, setOpenId] = useState<string | null>(deepLinked);
  /* React to the deep link changing while already on the page. Clicking
     "Open chase draft" in the chat pushes ?supplier=SUP-01 onto the same
     route — useState only read the first value, so the modal never opened on
     a repeat. This opens it whenever the param lands or changes.

     Synced during render against the last value applied, not in an effect: the
     compiler rejects a synchronous setState inside one, and an effect would
     paint a frame with the modal still closed before opening it. */
  const [appliedLink, setAppliedLink] = useState(deepLinked);
  if (deepLinked !== appliedLink) {
    setAppliedLink(deepLinked);
    if (deepLinked) setOpenId(deepLinked);
  }
  /* The chat's "Open …" continue link also fires this window event, so the
     modal opens even when the ?supplier= nav lands on the route we are
     already on and the searchParams effect does not re-fire. */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string") setOpenId(id);
    };
    window.addEventListener("shaw:open-supplier", onOpen as EventListener);
    return () => window.removeEventListener("shaw:open-supplier", onOpen as EventListener);
  }, []);
  /* Suppliers Mercer has already been asked to move on. Local to the screen —
     the flow is symbolic, so nothing on the record changes. The button flip
     to "Open" is the visible receipt that the row has been actioned once. */
  const [sent, setSent] = useState<Set<string>>(new Set());

  const inTab = useMemo(() => SUPPLIERS.filter((s) => inTabFor(tab, s)), [tab]);
  const statusesInTab = useMemo(() => [...new Set(inTab.map((s) => s.status))], [inTab]);

  const activePreset = preset ? SUPPLIER_PRESETS.find((p) => p.id === preset) : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (activePreset && !activePreset.match(s)) return false;
      if (!needle) return true;
      return [s.name, s.site, s.country, s.categories.join(" "), SUPPLIER_STATUS_LABEL[s.status], s.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, status, activePreset, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const f = sort.field as keyof Supplier;
      if (f === "annualSpend") return (a.annualSpend - b.annualSpend) * dir;
      if (f === "score") return (a.score - b.score) * dir;
      if (f === "quotedLeadDays") return (a.quotedLeadDays - b.quotedLeadDays) * dir;
      if (f === "otifPct") return (a.otifPct - b.otifPct) * dir;
      return String(a[f] ?? "").localeCompare(String(b[f] ?? "")) * dir;
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((s, i) => rowNumber.set(s.id, i + 1));

  const serialSlot: DataTableSlotColumn<Supplier> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (s) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(s.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] = [
    ...(activePreset
      ? [
          {
            key: `preset:${activePreset.id}`,
            label: "Action",
            value: activePreset.label,
            onRemove: () => {
              setPreset(null);
              setPage(1);
            },
          } satisfies ActiveFilter,
        ]
      : []),
    ...(status === "all"
      ? []
      : [
          {
            key: "status",
            label: "Status",
            value: SUPPLIER_STATUS_LABEL[status],
            onRemove: () => {
              setStatus("all");
              setPage(1);
            },
          } satisfies ActiveFilter,
        ]),
  ];

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "annualSpend",
      label: "Supplier",
      sortable: true,
      minWidth: 210,
      maxWidth: 260,
      cell: (s) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}
          >
            {s.name}
          </span>
          <span
            className="truncate"
            style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}
          >
            {`${money(s.annualSpend)} · ${s.categoryShare}% of category`}
          </span>
        </span>
      ),
    },
    {
      key: "site",
      label: "Source",
      sortable: true,
      minWidth: 165,
      maxWidth: 190,
      cell: (s) => {
        /* The flag, not a handshake. Every row here is a commercial
           relationship, so a handshake said nothing — where the factory SITS is
           the fact that matters on a book where the country decides the duty
           regime, the overlay exposure and the lead time. Owned rows keep their
           neutral variant; the geography is the same kind of fact for both. */
        const c = countryOf(s.country);
        return (
          <Pill
            variant={s.own ? "neutral" : "info"}
            size="sm"
            icon={
              c ? (
                <span style={{ fontSize: 13, lineHeight: 1 }}>{flagOf(c.code)}</span>
              ) : (
                <Factory weight="duotone" />
              )
            }
          >
            {`${s.site}, ${s.country}`}
          </Pill>
        );
      },
    },
    {
      key: "categories",
      label: "Makes",
      minWidth: 150,
      cell: (s) => (
        <span
          className="truncate"
          style={{ fontSize: 14, color: "var(--ds-text-primary)" }}
          title={s.categories.join(" · ")}
        >
          {s.categories[0]}
        </span>
      ),
    },
    {
      key: "quotedLeadDays",
      label: "Lead time",
      sortable: true,
      minWidth: 108,
      cell: (s) => {
        const { Glyph, colour, word } = TREND_ICON[s.leadTimeTrend];
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {`${s.quotedLeadDays} days`}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: colour }}>
              <Glyph size={12} weight="bold" />
              {word}
            </span>
          </span>
        );
      },
    },
    {
      key: "otifPct",
      label: "OTIF",
      sortable: true,
      minWidth: 84,
      cell: (s) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
            {`${s.otifPct}%`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${s.rejectRate} rej/1k`}
          </span>
        </span>
      ),
    },
    {
      key: "paymentTermsDays",
      label: "Terms",
      minWidth: 96,
      /* A missing term is the point of this column, not an empty cell — the
         Net 60 play cannot be run until these two are established. */
      cell: (s) =>
        s.paymentTermsDays === null ? (
          <Pill variant={s.own ? "neutral" : "warning"} size="sm">
            {s.own ? "Internal" : "Not on file"}
          </Pill>
        ) : (
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
            {`Net ${s.paymentTermsDays}`}
          </span>
        ),
    },
    {
      /* Score and status read as one thing — the number is the assessment and
         the status is what we decided to do about it, so they share a column
         rather than each taking 150px of a nine-column table. */
      key: "score",
      label: "Standing",
      sortable: true,
      minWidth: 132,
      cell: (s) => (
        <span className="flex min-w-0 flex-col items-start" style={{ gap: 3 }}>
          <Pill variant={s.score >= 75 ? "info" : s.score >= 62 ? "neutral" : "warning"} size="sm">
            {String(s.score)}
          </Pill>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
            {SUPPLIER_STATUS_LABEL[s.status]}
          </span>
        </span>
      ),
    },
    {
      /* The Mercer next move column. Same shape as the Opportunities screen —
         the button label + drafted artifact is derived from the supplier's own
         state (slipping, terms gap, consolidation posture) and the click opens
         the Mercer chat with a narrated 2-3 step run + Continue/Undo. */
      key: "draft",
      label: `${profile.agent} next move`,
      minWidth: 190,
      stopRowClick: true,
      cell: (s) => {
        const d = supplierDraftFor(s);
        if (d.kind === "none") {
          return <span style={{ fontSize: 12, color: "var(--ds-text-tertiary)" }}>—</span>;
        }
        /* Two states, one button. First press runs Mercer and marks the row
           as sent; second press opens the supplier record. Same shape as an
           email client's Reply → Sent → Open thread. Outline variant so the
           offer doesn't compete with the tab's primary tint or the Mercer
           insight text — matches Opportunities. */
        if (sent.has(s.id)) {
          return (
            <Button
              size="sm"
              variant="outline"
              iconLeft={<ArrowSquareOut size={13} weight="duotone" />}
              onClick={() => setOpenId(s.id)}
              title={`Open ${s.name}`}
              aria-label={`Open ${s.name}`}
            >
              Open
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            variant="outline"
            iconLeft={draftGlyph(d.icon)}
            title={`Have ${profile.agent} ${d.label.toLowerCase()} on ${s.name}`}
            aria-label={`Have ${profile.agent} ${d.label.toLowerCase()} on ${s.name}`}
            onClick={() => {
              const task = supplierTaskFor(s, profile.agent);
              if (task) startTask(task);
              setSent((prev) => {
                const next = new Set(prev);
                next.add(s.id);
                return next;
              });
            }}
          >
            {d.label}
          </Button>
        );
      },
    },
  ];

  const gaps = termsGaps();
  const slipping = SUPPLIERS.filter((s) => s.leadTimeTrend === "slipping");
  const weightedOtif = Math.round(
    SUPPLIERS.reduce((s, v) => s + v.otifPct * v.annualSpend, 0) / BOOK.spend,
  );
  const openSupplier = openId ? SUPPLIERS.find((s) => s.id === openId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* The three pages that lead with an agent brief let it do the
          introducing; this one and the action center open on data, so they
          carry the heading. */}
      <PageHeading
        title="Suppliers"
        subtitle={`The relationships behind the queue — ${SUPPLIERS.length} detailed of ${BOOK.suppliers} on the book`}
      />

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Book on file"
          value={money(BOOK.spend)}
          subtitle={`${SUPPLIERS.length} suppliers detailed · ${BOOK.importShare}% import`}
          info="Annual spend across the suppliers detailed here. The wider book carries roughly 180 relationships."
        />
        <KpiStatCard
          title="Weighted on time in full"
          value={`${weightedOtif}%`}
          subtitle={`Spend-weighted across the book, last 12 months · ${slipping.length} slipping`}
        />
        <KpiBreakdownCard
          title="Open purchase orders"
          value={money(BOOK.openPoValue)}
          subtitle={`${BOOK.openPos} orders across the book`}
          info="Value currently on order, before anything in the action center is decided."
        />
        <KpiStatCard
          title="Terms not on file"
          value={String(gaps.length)}
          subtitle={
            gaps.length
              ? `${gaps.map((s) => s.name).join(" · ")} — blocks the Net 60 play`
              : "None — the record is complete"
          }
        />
      </KpiGrid>

      <TableShell
        title="Supplier book"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: SUPPLIERS.filter((s) => inTabFor(id, s)).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setOpenId(null);
          setStatus("all");
          setPreset(null);
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by supplier, site or what they make"
        filters={
          /* Two pill Selects, right of the search — action-oriented (what
             Mercer would move) on the left, column-oriented (status) on the
             right. Same pattern as Opportunities so the two screens read the
             same way. */
          <div className="flex items-center" style={{ gap: 8 }}>
            <Select
              value={preset ?? "all"}
              onValueChange={(v: string) => {
                setPreset(v === "all" ? null : (v as SupplierPresetId));
                setPage(1);
              }}
            >
              <Select.Trigger
                size="md"
                aria-label="Filter by action"
                className="!rounded-full !px-3.5"
              >
                <Select.Value placeholder="All actions" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All actions</Select.Item>
                {SUPPLIER_PRESETS.map((ps) => (
                  <Select.Item key={ps.id} value={ps.id}>
                    {ps.label} ({inTab.filter(ps.match).length})
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Select
              value={status}
              onValueChange={(v: string) => {
                setStatus(v as "all" | SupplierStatus);
                setPage(1);
              }}
            >
              <Select.Trigger
                size="md"
                aria-label="Filter by status"
                className="!rounded-full !px-3.5"
              >
                <Select.Value placeholder="All statuses" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All statuses</Select.Item>
                {statusesInTab.map((s) => (
                  <Select.Item key={s} value={s}>
                    {SUPPLIER_STATUS_LABEL[s]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        }
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setStatus("all");
          setPreset(null);
          setPage(1);
        }}
        isFiltered={status !== "all" || preset !== null || q.trim().length > 0}
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
            No supplier matches that.
          </div>
        }
      >
        <DataTable<Supplier>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(s) => s.id}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          /* Row click opens the record modal — same shape as the play row's
             Review. Mercer's drafted artifact renders inside the modal. */
          onRowClick={(s) => setOpenId(s.id)}
        />
      </TableShell>

      {openSupplier &&
        (() => {
          const i = sorted.findIndex((s) => s.id === openSupplier.id);
          const step = (by: number) => {
            const next = sorted[i + by];
            return next ? () => setOpenId(next.id) : undefined;
          };
          const nav =
            i < 0
              ? undefined
              : { position: `${i + 1} of ${sorted.length}`, onPrev: step(-1), onNext: step(1) };
          return (
            <SupplierModal
              key={openSupplier.id}
              supplier={openSupplier}
              agent={profile.agent}
              nav={nav}
              onClose={() => setOpenId(null)}
            />
          );
        })()}
    </div>
  );
}
