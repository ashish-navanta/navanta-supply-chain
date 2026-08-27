"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { claimRoute, orderRoute } from "@/data/nav";
import { Check, ClipboardText } from "@phosphor-icons/react";
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
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { claimTaskFor } from "@/data/service-flows";
import type { CommitReport } from "@/components/chat/commit";
import {
  CLAIMS,
  CLAIM_KIND_LABEL,
  CLAIM_STAGE_LABEL,
  OPEN_CLAIM_STAGES,
  claimAsRow,
  approvalRate,
  claimsNeedingAction,
  formatUsd,
  openClaims,
  type ClaimKind,
  type ClaimStage,
  type ServiceClaim,
} from "@/data/service";
import { useChatPanel } from "@/context/ChatPanelContext";
import { AgentColumnHeader } from "@/components/ui/AgentColumnHeader";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

type TabId = "open" | "decided" | "all";

const IN_TAB: Record<TabId, (c: ServiceClaim) => boolean> = {
  open: (c) => OPEN_CLAIM_STAGES.has(c.stage),
  decided: (c) => !OPEN_CLAIM_STAGES.has(c.stage),
  all: () => true,
};

const TAB_LABEL: Record<TabId, string> = {
  open: "Open",
  decided: "Decided",
  all: "All claims",
};

function stageTone(s: ClaimStage): "info" | "neutral" | "warning" | "danger" {
  if (s === "credit-ready") return "warning";
  if (s === "declined") return "danger";
  if (s === "settled" || s === "approved") return "info";
  return "neutral";
}

/**
 * Every claim and its money.
 *
 * The action center carries the two claims that need a signature today. This
 * carries all ten, plus the thing no row can show on its own: a batch with
 * three claims against it is a supplier conversation, not a account one.
 */
export function ClaimsScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startClaim, startTask } = useChatPanel();
  const params = useSearchParams();

  const [tab, setTab] = useState<TabId>("open");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | ClaimKind>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "requested", dir: "desc" });

  /** Deep-linked from an order modal — ?claim=CLM-2041. */
  const [openId, setOpenId] = useState<string | null>(params.get("claim"));
  const [toast, setToast] = useState<CommitReport | null>(null);

  const inTab = useMemo(() => CLAIMS.filter(IN_TAB[tab]), [tab]);
  const kindsInTab = useMemo(() => [...new Set(inTab.map((c) => c.kind))], [inTab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (!needle) return true;
      return [c.id, c.orderId, c.account, c.style, c.batch, c.receipt, CLAIM_KIND_LABEL[c.kind], c.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, kind, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "requested") return (a.requested - b.requested) * dir;
      if (sort.field === "units") return (a.units - b.units) * dir;
      return String(a[sort.field as keyof ServiceClaim] ?? "")
        .localeCompare(String(b[sort.field as keyof ServiceClaim] ?? "")) * dir;
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((c, i) => rowNumber.set(c.id, i + 1));

  const serialSlot: DataTableSlotColumn<ServiceClaim> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (c) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(c.id)}
      </span>
    ),
  };

  const activeFilters: ActiveFilter[] =
    kind === "all"
      ? []
      : [
          {
            key: "kind",
            label: "Type",
            value: CLAIM_KIND_LABEL[kind],
            onRemove: () => {
              setKind("all");
              setPage(1);
            },
          },
        ];

  /** Approving a credit from the row, with the same wording the modal uses. */
  const approve = (c: ServiceClaim): CommitReport => {
    const credit = c.adjudicated ?? c.requested;
    const over = credit > c.policyCap;
    return {
      title: `${c.id} — ${formatUsd(credit)} credit approved`,
      message:
        `Raised against ${c.receipt} and the invoice corrected. ${profile.agent} has told ${c.account}` +
        (over
          ? ` and flagged it for a second signature — ${formatUsd(credit)} is over the ${formatUsd(c.policyCap)} cap.`
          : ` and will confirm the collection.`),
    };
  };

  const columns: DataTableColumn<ServiceClaim>[] = [
    {
      key: "requested",
      label: "Claim",
      sortable: true,
      minWidth: 160,
      maxWidth: 190,
      stopRowClick: true,
      /* The reference opens the record; the row still opens the review sheet.
         Same split as the queues: a reference is a place, an action is a job. */
      cell: (c) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <Link
            href={claimRoute(c.id)}
            title={`Open ${c.id}`}
            className="truncate hover:underline"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)" }}
          >
            {c.id}
          </Link>
          <Link
            href={orderRoute(c.orderId)}
            title={`Open ${c.orderId}`}
            className="truncate hover:underline"
            style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}
          >
            {`against ${c.orderId}`}
          </Link>
        </span>
      ),
    },
    {
      key: "account",
      label: "Account",
      sortable: true,
      minWidth: 158,
      maxWidth: 182,
      cell: (c) => (
        <Pill variant="info" size="sm">
          {c.account}
        </Pill>
      ),
    },
    {
      key: "kind",
      label: "Type",
      sortable: true,
      minWidth: 150,
      cell: (c) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)" }}>
            {CLAIM_KIND_LABEL[c.kind]}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}>
            {`${c.units} units · lot ${c.batch}`}
          </span>
        </span>
      ),
    },
    {
      key: "money",
      label: "Asked → adjudicated",
      minWidth: 140,
      /* Both figures. A claim where the two differ is the interesting one, and a
         single "value" column would hide exactly that. */
      cell: (c) => (
        <span className="flex flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
            {formatUsd(c.requested)}
          </span>
          <span
            style={{
              fontSize: 12,
              ...numeric,
              color:
                c.adjudicated === null
                  ? "var(--ds-text-secondary)"
                  : c.adjudicated === c.requested
                    ? "var(--text-success)"
                    : "var(--text-warning-dark)",
            }}
          >
            {c.adjudicated === null
              ? "not yet adjudicated"
              : c.adjudicated === c.requested
                ? "agreed in full"
                : `${formatUsd(c.adjudicated)} adjudicated`}
          </span>
        </span>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      minWidth: 130,
      cell: (c) => (
        <span className="flex min-w-0 flex-col items-start" style={{ gap: 2 }}>
          <Pill variant={stageTone(c.stage)} size="sm">
            {CLAIM_STAGE_LABEL[c.stage]}
          </Pill>
          {(c.adjudicated ?? c.requested) > c.policyCap && (
            <span style={{ fontSize: 12, color: "var(--text-danger)" }}>Over cap</span>
          )}
        </span>
      ),
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
      cell: (c) => (
        <span
          title={c.note}
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
          {c.note}
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
      cell: (c) => (
        <span className="flex items-center gap-1.5">
          {/* Adjudicate, or approve what was adjudicated — the agent shows
              the working either way, which is the part a credit decision
              actually needs on the record. */}
          <Button
            size="sm"
            variant="outline"
            title={`${claimTaskFor(c, profile.agent).label} on ${c.id}`}
            aria-label={`${claimTaskFor(c, profile.agent).label} on ${c.id}`}
            onClick={() => startTask(claimTaskFor(c, profile.agent))}
          >
            {claimTaskFor(c, profile.agent).label}
          </Button>
          {/* One press only where there is a figure to approve — an
              un-adjudicated claim has no number to commit. */}
          {c.stage === "credit-ready" && (
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              title={`Approve ${formatUsd(c.adjudicated ?? c.requested)} credit`}
              aria-label={`Approve credit for ${c.id}`}
              onClick={() => {
                setToast(approve(c));
                setOpenId(null);
              }}
            >
              <Check size={14} weight="bold" />
            </Button>
          )}
        </span>
      ),
    },
  ];

  const rate = approvalRate();
  const open = openClaims();
  const needing = claimsNeedingAction();
  const openClaim = openId ? CLAIMS.find((c) => c.id === openId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title="Claims"
          subtitle={`${CLAIMS.length} claims on the book — ${needing.length} adjudicated and waiting on your signature`}
        />
        {/* Filing runs in the agent's panel, not in a dialog — the claim is a
            conversation with Christy, and she adjudicates it at the end of it. */}
        <Button
          variant="christy"
          iconLeft={<ClipboardText size={14} />}
          onClick={() => startClaim()}
        >
          File a claim
        </Button>
      </div>

      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Approval rate"
          value={`${rate.pct}%`}
          subtitle={`${rate.approved} of ${rate.decided} decided claims approved`}
          info="Approved or settled as a share of everything decided. Declines are usually the filing window, not the evidence."
        />
        <KpiBreakdownCard
          title="Open claims"
          value={String(open.length)}
          subtitle={`${formatUsd(open.reduce((s, c) => s + (c.adjudicated ?? c.requested), 0))} at stake`}
        />
        <KpiBreakdownCard
          title="Needs your signature"
          value={String(needing.length)}
          subtitle={
            needing.length === 0
              ? "Nothing waiting on you"
              : `${formatUsd(needing.reduce((s, c) => s + (c.adjudicated ?? c.requested), 0))} adjudicated and ready`
          }
        />
        <KpiBreakdownCard
          title="Over policy cap"
          value={String(
            CLAIMS.filter((c) => OPEN_CLAIM_STAGES.has(c.stage) && (c.adjudicated ?? c.requested) > c.policyCap)
              .length,
          )}
          subtitle="Open claims that need a second signature"
          info="A claim over the cap can still be filed and adjudicated; it cannot be approved alone."
        />
      </KpiGrid>

      <TableShell
        title="Claim book"
        tabs={(Object.keys(TAB_LABEL) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: CLAIMS.filter(IN_TAB[id]).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setOpenId(null);
          setKind("all");
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by claim, order, account or batch"
        filters={
          <Select
            value={kind}
            onValueChange={(v: string) => {
              setKind(v as "all" | ClaimKind);
              setPage(1);
            }}
          >
            <Select.Trigger size="md" aria-label="Filter by type">
              <Select.Value placeholder="Type" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All types</Select.Item>
              {kindsInTab.map((k) => (
                <Select.Item key={k} value={k}>
                  {CLAIM_KIND_LABEL[k]}
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
            No claim matches that.
          </div>
        }
      >
        <DataTable<ServiceClaim>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </TableShell>

      {/* Reviewing a claim reuses the queue's own claim modal, which already
          knows how to adjudicate a credit against a policy cap. It needs an
          ActionRow, so the claim is projected onto one. */}
      {openClaim && (
        <ClaimReview
          claim={openClaim}
          agent={profile.agent}
          onClose={() => setOpenId(null)}
          onCommitted={(r) => {
            setOpenId(null);
            setToast(r);
          }}
        />
      )}

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

/* ─── Claim review ───────────────────────────────────────────────────────────
 * The existing ClaimModal is written against the queue's ActionRow, and it is
 * the surface that already handles the credit override and the policy cap. Rather
 * than fork it, a claim is projected onto the row shape it expects — by
 * `claimAsRow`, which lives with the claims now that the record page needs the
 * same projection.
 * ───────────────────────────────────────────────────────────────────────── */

import { ClaimModal } from "@/components/chat/ClaimModal";

function ClaimReview({
  claim,
  agent,
  onClose,
  onCommitted,
}: {
  claim: ServiceClaim;
  agent: string;
  onClose: () => void;
  onCommitted: (r: CommitReport) => void;
}) {
  return (
    <ClaimModal
      row={claimAsRow(claim)}
      agent={agent}
      signer={PERSONAS.csr.name}
      onClose={onClose}
      onCommitted={onCommitted}
    />
  );
}
