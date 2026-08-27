"use client";

import { useMemo, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  EmptyState,
  KpiBreakdownCard,
  KpiGrid,
  KpiProgressCard,
  KpiStatCard,
  Pill,
  TableShell,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { useChatPanel } from "@/context/ChatPanelContext";
import { PERSONAS } from "@/types/persona";
import {
  STAGE_LABEL,
  money,
  rampToDate,
  realizedToDate,
  trackStage,
  type Play,
  type TrackStage,
} from "@/data/buying";
import { makeLivePlay, usePlays } from "@/lib/plays";
import { valueTaskFor, makeLiveTaskFor } from "@/data/value-tracking";
import { Panel } from "@/components/buying/Panel";
import { BUYING_ROUTES } from "@/data/nav";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

/**
 * How long ago a commitment was made, in the words a reader uses.
 *
 * Against the fixtures' fixed today — see TODAY — because nothing in this
 * prototype reads a clock, and a ledger whose ages drift every time somebody
 * opens it cannot be walked through twice.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthsAgo(label: string): string {
  const [d, m, y] = label.trim().split(" ");
  const month = MONTHS.indexOf(m);
  if (month < 0) return "";
  /* TODAY is "12 Aug" and the book runs in 2026. */
  const months = (2026 - (Number.parseInt(y ?? "2026", 10) || 2026)) * 12 + (7 - month);
  const days = 12 - (Number.parseInt(d, 10) || 0);
  const total = months * 30 + days;
  if (total < 14) return "this month";
  if (total < 45) return "1 month ago";
  if (total < 365) return `${Math.round(total / 30)} months ago`;
  const years = Math.round(total / 365);
  return years === 1 ? "a year ago" : `${years} years ago`;
}

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/* The reference's two bar colours: a flat blue for projected, a flat green for
   realized. Kept as constants so the legend, the bars and the chat mini-chart
   cannot drift apart. */
const RAMP_PROJECTED = "#3B82F6";
const RAMP_REALIZED = "#16A34A";

/** One ramp bar with its figure printed above. A quarter with no realized
 *  value yet draws a 2px stub on the baseline — present, not yet reported. */
function RampBar({
  value,
  max,
  color,
}: {
  value: number | undefined;
  max: number;
  color: string;
}) {
  const AREA = 200;
  const reported = value !== undefined && value > 0;
  const h = reported ? Math.max(4, (value! / max) * AREA) : 2;
  return (
    <span className="flex flex-1 flex-col items-center justify-end" style={{ gap: 4 }}>
      {reported && (
        <span
          style={{
            fontSize: 12,
            color: "var(--ds-text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value! >= 1_000_000 ? `$${(value! / 1_000_000).toFixed(1)}M` : `$${Math.round(value! / 1000)}K`}
        </span>
      )}
      <span
        style={{
          width: "100%",
          height: h,
          borderRadius: "6px 6px 0 0",
          background: reported ? color : "var(--ds-border-subtle)",
        }}
      />
    </span>
  );
}

/** "Q3 26" as a sortable number — plays are authored in commit order. */
function periodRank(period: string): number {
  const m = /^Q(\d)\s+(\d{2})$/.exec(period.trim());
  if (!m) return 0;
  return Number(m[2]) * 4 + Number(m[1]);
}

/** "Q3 26" → "Q3 '26" — the reference's axis label. */
function periodLabel(period: string): string {
  const m = /^Q(\d)\s+(\d{2})$/.exec(period.trim());
  if (!m) return period;
  return `Q${m[1]} '${m[2]}`;
}

/** Compact money for the bar-top labels — always a single figure. */
function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1000)}K`;
}

/** Where a play stands against its ramp. Derived, never stored. */
function health(p: Play): { label: string; tone: "good" | "behind" | "quiet" } {
  const expected = rampToDate(p);
  const actual = realizedToDate(p);
  if (p.stage === "realized") return { label: "Closed", tone: "good" };
  if (expected === 0) return { label: "Not yet reporting", tone: "quiet" };
  if (actual >= expected) return { label: "On ramp", tone: "good" };
  return { label: `${Math.round((1 - actual / expected) * 100)}% behind ramp`, tone: "behind" };
}

type TabId = "committed" | "realized";

/**
 * Value realization — Allison's three-stage track machine on Target's plays.
 *
 * Committed plays are promises; the ones made live sit on the savings ramp and
 * report against it; the ERP closes them into Realized. The ramp draws
 * projected against realized for every live play, and Review opens the Mercer
 * chat with that specific commit's figures and graph.
 */
export function ValueScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const { startTask } = useChatPanel();
  const { plays, riskById } = usePlays();

  const [tab, setTab] = useState<TabId>("committed");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "recommended", dir: "desc" });

  /* The ledger, live-aware, read through the store so make-live and ERP
     transitions land immediately. */
  const ledger = useMemo(
    () => plays.filter((p) => ["committed", "realizing", "realized"].includes(p.stage)),
    [plays],
  );
  const live = useMemo(() => ledger.filter((p) => trackStage(p) === "live"), [ledger]);
  const realizedPlays = useMemo(() => ledger.filter((p) => trackStage(p) === "realized"), [ledger]);
  /* The Committed tab holds committed + live, live pinned to the top. */
  const committedTab = useMemo(
    () => ledger.filter((p) => trackStage(p) !== "realized"),
    [ledger],
  );

  const committed = ledger.reduce((s, p) => s + p.recommended, 0);
  const realized = ledger.reduce((s, p) => s + realizedToDate(p), 0);
  const expected = ledger.reduce((s, p) => s + rampToDate(p), 0);

  /* The ramp: projected vs realized per quarter, across live + realized plays
     (a committed play has not gone live, so it does not draw yet). */
  const rampPlays = useMemo(
    () => ledger.filter((p) => trackStage(p) !== "committed"),
    [ledger],
  );
  const rampPeriods = useMemo(
    () =>
      [...new Set(rampPlays.flatMap((p) => (p.ramp ?? []).map((r) => r.period)))].sort(
        (a, b) => periodRank(a) - periodRank(b),
      ),
    [rampPlays],
  );
  const rampTotals = useMemo(
    () =>
      rampPeriods.map((period) => {
        let projected = 0;
        let realizedSum = 0;
        let anyRealized = false;
        for (const p of rampPlays) {
          const point = p.ramp?.find((r) => r.period === period);
          if (!point) continue;
          projected += point.projected;
          if (point.realized !== undefined) {
            realizedSum += point.realized;
            anyRealized = true;
          }
        }
        return { period, projected, realized: anyRealized ? realizedSum : undefined };
      }),
    [rampPeriods, rampPlays],
  );
  const rampMax = Math.max(1, ...rampTotals.map((t) => Math.max(t.projected, t.realized ?? 0)));
  /* The reference's footnote figures: realized so far, the full projected ramp,
     the quarter count and its span. */
  const rampRealizedTotal = rampTotals.reduce((s, t) => s + (t.realized ?? 0), 0);
  const rampProjectedTotal = rampTotals.reduce((s, t) => s + t.projected, 0);
  const rampSpan =
    rampTotals.length > 0
      ? `${periodLabel(rampTotals[0].period)}–${periodLabel(rampTotals[rampTotals.length - 1].period)}`
      : "";

  const rows = tab === "committed" ? committedTab : realizedPlays;

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const base = [...rows];
    if (sort.field) {
      base.sort((a, b) => {
        if (sort.field === "recommended") return (a.recommended - b.recommended) * dir;
        if (sort.field === "realized") return (realizedToDate(a) - realizedToDate(b)) * dir;
        return String(a[sort.field as keyof Play] ?? "").localeCompare(
          String(b[sort.field as keyof Play] ?? ""),
        ) * dir;
      });
    }
    /* Live plays pinned to the top of the Committed tab, whatever the sort. */
    if (tab === "committed") {
      base.sort((a, b) => Number(trackStage(b) === "live") - Number(trackStage(a) === "live"));
    }
    return base;
  }, [rows, sort, tab]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((p, i) => rowNumber.set(p.id, i + 1));

  const goLive = (p: Play) => {
    makeLivePlay(p);
    startTask(makeLiveTaskFor(p, profile.agent));
  };
  /* Review passes the same goLive callback into the task builder — if the
     commit is still committed, the outcome's CTA fires it inline, so the
     make-live decision can be taken straight from the read. */
  const openReview = (p: Play) =>
    startTask(valueTaskFor(p, profile.agent, riskById(p.id), goLive));

  const serialSlot: DataTableSlotColumn<Play> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (p) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {rowNumber.get(p.id)}
      </span>
    ),
  };

  const stagePill = (p: Play) => {
    const ts = trackStage(p);
    if (ts === "live")
      return (
        <Pill variant="info" size="sm" icon={<Lightning weight="fill" />}>
          Live
        </Pill>
      );
    if (ts === "realized")
      return (
        <Pill variant="info" size="sm">
          {STAGE_LABEL[p.stage]}
        </Pill>
      );
    return (
      <Pill variant="neutral" size="sm">
        Committed
      </Pill>
    );
  };

  const columns: DataTableColumn<Play>[] = [
    {
      key: "recommended",
      label: "Committed play",
      sortable: true,
      minWidth: 250,
      maxWidth: 330,
      cell: (p) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}
            title={p.title}
          >
            {p.title}
          </span>
          {/* The reference, and only that. The lever is a fact about the play
              and the date is a fact about the commitment — both were crammed
              into one 12px line that truncated before it reached either. The
              date has its own column now; the lever is on the record. */}
          <span
            className="truncate"
            style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}
          >
            {p.id}
          </span>
        </span>
      ),
    },
    {
      key: "committedOn",
      label: "Committed on",
      sortable: true,
      minWidth: 96,
      /* The date over how long ago it was. A commitment's age is the thing a
         reader is actually judging — a play committed eleven months ago and not
         yet realized is a different conversation from one committed in July —
         and "2026" printed under every row said nothing, since the whole ledger
         is the same year. */
      cell: (p) => {
        if (!p.committedOn) return <span style={{ fontSize: 14 }}>—</span>;
        const parts = p.committedOn.trim().split(" ");
        const hasYear = parts.length > 2;
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {hasYear ? parts.slice(0, 2).join(" ") : parts.join(" ")}
            </span>
            <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
              {monthsAgo(p.committedOn)}
            </span>
          </span>
        );
      },
    },
    {
      key: "committedValue",
      label: "Committed",
      minWidth: 104,
      cell: (p) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
          {money(p.recommended)}
        </span>
      ),
    },
    {
      key: "realized",
      label: "Realized",
      sortable: true,
      minWidth: 128,
      cell: (p) => {
        const actual = realizedToDate(p);
        const target = rampToDate(p);
        return (
          <span className="flex flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
              {actual > 0 ? money(actual) : "—"}
            </span>
            <span
              style={{
                fontSize: 12,
                ...numeric,
                color: actual >= target && target > 0 ? "var(--text-success)" : "var(--text-warning-dark)",
              }}
            >
              {target === 0 ? "not reporting yet" : `against ${money(target)} planned`}
            </span>
          </span>
        );
      },
    },
    {
      key: "stage",
      label: "Stage",
      minWidth: 108,
      cell: (p) => stagePill(p),
    },
    {
      key: "health",
      label: "Against ramp",
      minWidth: 132,
      cell: (p) => {
        const h = health(p);
        return (
          <Pill variant={h.tone === "good" ? "info" : h.tone === "behind" ? "warning" : "neutral"} size="sm">
            {h.label}
          </Pill>
        );
      },
    },
    {
      /* The action column carries two moves: a committed play can go live, and
         any play can be reviewed in the Mercer chat with its own ramp. */
      key: "action",
      label: "Action",
      minWidth: 168,
      align: "right",
      stopRowClick: true,
      cell: (p) => (
        <span className="flex items-center justify-end gap-1.5">
          {trackStage(p) === "committed" && (
            <Button
              size="sm"
              variant="primary"
              iconLeft={<Lightning size={14} weight="duotone" />}
              onClick={() => goLive(p)}
            >
              Make live
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => openReview(p)}>
            Review
          </Button>
        </span>
      ),
    },
  ];

  if (ledger.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl py-10"
          style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-default)" }}
        >
          <EmptyState
            title="Nothing committed yet"
            description="Commit a play from the opportunity feed and it starts reporting here."
            link={{ label: "Open the opportunity feed", href: BUYING_ROUTES.opportunities }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={4}>
        <KpiBreakdownCard
          title="Committed"
          value={money(committed)}
          subtitle={`${ledger.length} plays · ${live.length} live · ${realizedPlays.length} realized`}
          info="The figure signed off at commit, before any realization is counted."
        />
        <KpiProgressCard
          title="Realized to date"
          value={money(realized)}
          subtitle={expected > 0 ? `${money(expected)} of ramp has come due` : "Nothing due yet"}
          progress={expected > 0 ? Math.round((realized / expected) * 100) : 0}
          tone={realized >= expected ? "success" : "warning"}
        />
        <KpiStatCard
          title="Against ramp"
          value={expected > 0 ? `${Math.round((realized / expected) * 100)}%` : "—"}
          subtitle={
            expected === 0
              ? "No ramp has reported yet"
              : realized >= expected
              ? "Every live play on or ahead of ramp"
              : `${money(expected - realized)} behind the ramp`
          }
        />
        <KpiBreakdownCard
          title="Still to come"
          value={money(Math.max(0, committed - realized))}
          subtitle="Committed value not yet landed"
          info="What the remaining ramp periods still have to deliver for the commitments to be met."
        />
      </KpiGrid>

      <Panel
        title="Savings ramp · quarterly"
        subtitle={
          rampPlays.length > 0
            ? `Projected vs realized savings by quarter across ${rampPlays.length} live ${rampPlays.length === 1 ? "play" : "plays"}`
            : "No live plays yet — make a committed play live and the ramp fills"
        }
      >
        {rampTotals.length === 0 ? (
          <div className="type-cell" style={{ padding: 20, color: "var(--ds-text-secondary)" }}>
            Nothing on the ramp yet. Make a committed play live to start it.
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 16 }}>
            <div className="flex items-center" style={{ gap: 20 }}>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: RAMP_PROJECTED }} />
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>Projected</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: RAMP_REALIZED }} />
                <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>Realized</span>
              </span>
            </div>
            {/* Bars sit on a shared baseline with the value printed above each —
                the reference's exact layout. Empty realized draws a hairline
                stub rather than nothing, so the quarter still reads as present
                but unreported. */}
            <div
              className="flex items-end justify-between"
              style={{ gap: 28, height: 240, borderBottom: "1px solid var(--ds-border-subtle)" }}
            >
              {rampTotals.map((t) => (
                <div key={t.period} className="flex flex-1 items-end justify-center" style={{ gap: 4 }}>
                  <RampBar value={t.projected} max={rampMax} color={RAMP_PROJECTED} />
                  <RampBar value={t.realized} max={rampMax} color={RAMP_REALIZED} />
                </div>
              ))}
            </div>
            <div className="flex" style={{ gap: 28 }}>
              {rampTotals.map((t) => (
                <span
                  key={t.period}
                  className="ds-label flex-1 text-center"
                  style={{ color: "var(--ds-text-secondary)" }}
                >
                  {periodLabel(t.period)}
                </span>
              ))}
            </div>
            <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
              {`Realized to date ${moneyShort(rampRealizedTotal)} · ramp projects ${moneyShort(
                rampProjectedTotal,
              )} across ${rampTotals.length} quarters (${rampSpan}). Realized fills once the ERP is connected.`}
            </span>
          </div>
        )}
      </Panel>

      <TableShell
        title="Committed plays"
        tabs={[
          { id: "committed", label: "Committed", badge: committedTab.length },
          { id: "realized", label: "Realized", badge: realizedPlays.length },
        ]}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setPage(1);
        }}
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
            {tab === "realized"
              ? "Nothing realized yet — a play lands here once the ERP confirms its full ramp."
              : "Nothing committed yet."}
          </div>
        }
      >
        <DataTable<Play>
          {...SHAW_TABLE_PROPS}
          columns={columns}
          leadingSlots={[serialSlot]}
          data={sorted}
          rowKey={(p) => p.id}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(p) => openReview(p)}
        />
      </TableShell>
    </div>
  );
}
