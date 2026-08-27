"use client";

import { useScope } from "@/context/ScopeContext";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AiStar,
  Button,
  Chip,
  ColumnFilterMenu,
  DataTable,
  Pill,
  Select,
  TableShell,
  type ActiveFilter,
  type DataTableColumn,
  type DataTableSlotColumn,
  type DataTableSortState,
} from "@navanta-ai/design-system";
import {
  CaretDoubleRight,
  CheckCircle,
  EnvelopeSimple,
  Flag,
  PaperPlaneTilt,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import { usePersona } from "@/context/PersonaContext";
import { useChatPanel } from "@/context/ChatPanelContext";
import { PERSONAS } from "@/types/persona";
import {
  BASIS_LABEL,
  KIND_LABEL,
  STAGE_LABEL,
  band,
  money,
  type Play,
  type PlayKind,
} from "@/data/buying";
import { AgentColumnHeader } from "@/components/ui/AgentColumnHeader";
import { countryOf, flagOf } from "@/data/countries";
import {
  DRAFT_FILTER_KEYS,
  DRAFT_FILTER_LABEL,
  LEVER_LABEL,
  playDraftFor,
  playDraftKey,
  playTaskFor,
  type DraftFilterKey,
  type PlayDraft,
  type PlayDraftIcon,
  type PlayDraftIntent,
} from "@/data/play-drafts";
import { feedActionLabelFor, feedFlowTaskFor } from "@/data/feed-flows";
import { PlayModal } from "@/components/buying/PlayModal";
import { AgentBrief } from "@/components/buying/AgentBrief";
import Link from "next/link";
import { BUYING_ROUTES, playRoute } from "@/data/nav";
import { acceptPlay, dismissPlay, parkPlay, reopenPlay, usePlays } from "@/lib/plays";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";

/**
 * How much work a play is, in the three words a buyer actually uses.
 *
 * The cut-points are where the fixtures' own estimates cluster: a lever you can
 * run inside a quarter, one that spans two, and one that needs a season.
 */
function effortBand(weeks: number): "Low" | "Medium" | "High" {
  return weeks <= 6 ? "Low" : weeks <= 10 ? "Medium" : "High";
}

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** The three lists a play can be in. Same cut as the queue's tabs: what needs
 *  me, what I already took, and what I decided against. */
type TabId = "feed" | "act" | "committed" | "parked" | "dismissed";

const TAB_STAGES: Record<TabId, ReadonlySet<Play["stage"]>> = {
  feed: new Set(["surfaced", "qualifying"]),
  act: new Set(["accepted"]),
  committed: new Set(["committed", "realizing", "realized"]),
  parked: new Set(["parked"]),
  dismissed: new Set(["dismissed"]),
};

const TAB_LABEL: Record<TabId, string> = {
  feed: "Feed",
  act: "Act",
  committed: "Committed",
  parked: "Parked",
  dismissed: "Rejected",
};

/** Action-oriented saved filter — a shortcut into a slice of what Mercer already
 *  did. Lives in the second toolbar dropdown, next to the column-oriented Type
 *  filter. Same rows either dropdown could reach; the split is by mental model —
 *  Type is what the play is about, Action is what is left to do. */
type PresetId = "quick-wins" | "high-value" | "blocked";

type Preset = {
  id: PresetId;
  label: string;
  icon: React.ReactNode;
  match: (p: Play) => boolean;
};

const PRESETS: Preset[] = [
  {
    id: "quick-wins",
    label: "Ready to approve",
    icon: <Sparkle weight="duotone" size={14} />,
    match: (p) => playDraftKey(p) === "ready",
  },
  {
    id: "high-value",
    label: "High-value bets",
    icon: <CaretDoubleRight weight="duotone" size={14} />,
    /* Fixture plays are in the $500K–$2.5M band, so $500K is the top third. */
    match: (p) => p.recommended >= 500_000,
  },
  {
    id: "blocked",
    label: "Needs your input",
    icon: <Warning weight="duotone" size={14} />,
    match: (p) => playDraftKey(p) === "needs-input",
  },
];

/** Confidence as a bar plus its number — a bare percentage in a column of
 *  percentages is unrankable at a glance. */
function ConfidenceCell({ pct }: { pct: number }) {
  return (
    <span className="flex min-w-0 flex-col" style={{ gap: 3 }}>
      <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>{`${pct}%`}</span>
      <span
        aria-hidden="true"
        style={{
          height: 4,
          width: 56,
          borderRadius: 999,
          background: "var(--ds-border-subtle)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background:
              pct >= 78
                ? "var(--text-success-vivid)"
                : pct >= 65
                ? "var(--color-iris-500, #6d5bd0)"
                : "var(--text-warning)",
          }}
        />
      </span>
    </span>
  );
}

function draftGlyph(icon: PlayDraftIcon): React.ReactNode {
  const props = { size: 14, weight: "duotone" as const };
  if (icon === "commit") return <CheckCircle {...props} />;
  if (icon === "email") return <EnvelopeSimple {...props} />;
  if (icon === "send") return <PaperPlaneTilt {...props} />;
  if (icon === "flag") return <Flag {...props} />;
  return <PaperPlaneTilt {...props} />;
}


/**
 * The opportunity feed — everything Mercer found against the book that the
 * exception queue would never surface, because nothing has gone wrong yet.
 *
 * Two action columns, matching the queue's pattern: the *automated* column
 * carries the artifact Mercer has already prepared (a shortlist, a letter,
 * a benchmark) and the buyer just approves; the *open* column is the manual
 * path into the record for the plays that still need a page's worth of work.
 */
export function OpportunitiesScreen() {
  const { persona } = usePersona();
  const profile = PERSONAS[persona];
  const params = useSearchParams();
  const { openChat, startTask } = useChatPanel();

  const [tab, setTab] = useState<TabId>("feed");
  const [q, setQ] = useState("");
  /* Column-level filters replace the old single Type select. */
  const [kindFilter, setKindFilter] = useState<Set<PlayKind>>(new Set());
  const [draftFilter, setDraftFilter] = useState<Set<DraftFilterKey>>(new Set());
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<DataTableSortState>({ field: "recommended", dir: "desc" });

  /* Deep-linked from the command center — ?play=OPP-101 opens that row. */
  const deepLinked = params.get("play");
  const [openId, setOpenId] = useState<string | null>(deepLinked);

  /* No toast on this screen anymore: the chat panel is already reporting the
     outcome — with Undo living inside the outcome card — so a second copy on
     the top right was a duplicate the eye had to reconcile against the receipt
     it repeated. */
  const dismissModal = () => setOpenId(null);

  /* Read through the store, so a play the buyer accepted or committed is where
     they left it. PLAYS is the starting position; this is the current one. */
  const { plays } = usePlays();

  /* The top bar's sourcing scope, honoured here. The buyer's three dropdowns
     used to be local state in the top bar and were read nowhere — a control that
     moves and changes nothing is worse than no control, because the reader stops
     trusting what the bar says. */
  const { inSourcing } = useScope();
  const scoped = useMemo(() => plays.filter(inSourcing), [plays, inSourcing]);

  const inTab = useMemo(() => scoped.filter((p) => TAB_STAGES[tab].has(p.stage)), [scoped, tab]);

  const kindsInTab = useMemo(() => [...new Set(inTab.map((p) => p.kind))], [inTab]);
  const draftKeysInTab = useMemo(
    () => [...new Set(inTab.map((p) => playDraftKey(p)))],
    [inTab],
  );

  const activePreset = preset ? PRESETS.find((x) => x.id === preset) : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((p) => {
      if (kindFilter.size > 0 && !kindFilter.has(p.kind)) return false;
      if (draftFilter.size > 0 && !draftFilter.has(playDraftKey(p))) return false;
      if (activePreset && !activePreset.match(p)) return false;
      if (!needle) return true;
      return [p.id, p.title, p.category, p.region, KIND_LABEL[p.kind], p.summary, p.action]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inTab, kindFilter, draftFilter, activePreset, q]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === "recommended") return (a.recommended - b.recommended) * dir;
      if (sort.field === "addressable") return (a.addressable - b.addressable) * dir;
      if (sort.field === "totalSpend")
        return ((a.totalSpend ?? a.addressable) - (b.totalSpend ?? b.addressable)) * dir;
      if (sort.field === "vendorCount")
        return ((a.vendorCount ?? a.supplierIds.length) - (b.vendorCount ?? b.supplierIds.length)) * dir;
      if (sort.field === "confidencePct") return (a.confidencePct - b.confidencePct) * dir;
      if (sort.field === "effortWeeks") return (a.effortWeeks - b.effortWeeks) * dir;
      if (sort.field === "id") return a.id.localeCompare(b.id) * dir;
      if (sort.field === "kind") return KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]) * dir;
      if (sort.field === "draft") {
        /* ready ⩾ needs-input ⩾ none — approve-first when descending. */
        const rank: Record<PlayDraft["kind"], number> = { ready: 2, "needs-input": 1, none: 0 };
        return (rank[playDraftKey(a)] - rank[playDraftKey(b)]) * dir;
      }
      return String(a[sort.field as keyof Play] ?? "")
        .localeCompare(String(b[sort.field as keyof Play] ?? "")) * dir;
    });
  }, [filtered, sort]);

  const rowNumber = new Map<string, number>();
  sorted.forEach((p, i) => rowNumber.set(p.id, i + 1));

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

  /* Chip strip above the table — same active-filter contract as `activeFilters`,
     but summarized per preset/column funnel for legibility. */
  const activeFilters: ActiveFilter[] = [
    ...(activePreset
      ? [
          {
            key: `preset:${activePreset.id}`,
            label: "Preset",
            value: activePreset.label,
            onRemove: () => {
              setPreset(null);
              setPage(1);
            },
          } satisfies ActiveFilter,
        ]
      : []),
    ...[...kindFilter].map(
      (k): ActiveFilter => ({
        key: `kind:${k}`,
        label: "Lever",
        value: LEVER_LABEL[k],
        onRemove: () => {
          const next = new Set(kindFilter);
          next.delete(k);
          setKindFilter(next);
          setPage(1);
        },
      }),
    ),
    ...[...draftFilter].map(
      (d): ActiveFilter => ({
        key: `draft:${d}`,
        label: `${profile.agent} next move`,
        value: DRAFT_FILTER_LABEL[d],
        onRemove: () => {
          const next = new Set(draftFilter);
          next.delete(d);
          setDraftFilter(next);
          setPage(1);
        },
      }),
    ),
  ];

  /* One press on the row-level button, whatever tab it is.
     The chat panel narrates the run; the store mutation lands the visible
     state change at the same beat. Undo is grafted onto every outcome card
     — the reversal is a real store call for intents that mutated, and a
     symbolic "acknowledge / withdraw" for the pre-worked intents that only
     drafted an artifact. Either way the buyer has one visible way to take
     the last click back without leaving the chat. */
  const runNextMove = (p: Play, intent: PlayDraftIntent) => {
    const task = playTaskFor(p, profile.agent);

    /* Snapshot the parked/dismissed reason before reopen() clears the
       decision — undo needs to know what to write back. */
    const priorReason = p.dismissReason;

    if (intent === "approve") {
      acceptPlay(p);
    } else if (intent === "revive" || intent === "reopen") {
      reopenPlay(p);
    }
    /* advance / log / recover / archive: no store mutation. The tracker page
       (via the outcome's Continue link) is where the buyer actually signs
       off — Undo on those cards just withdraws the drafted step from the
       transcript. */

    if (task) {
      const undoConfig: Record<PlayDraftIntent, { label: string; onUndo: () => void }> = {
        approve: {
          label: "Undo — back to Feed",
          onUndo: () => reopenPlay(p),
        },
        advance: {
          label: "Withdraw step",
          onUndo: () => {
            /* No store change to reverse; the button flips to "Undone" so
               the run reads as retracted. */
          },
        },
        log: {
          label: "Discard draft",
          onUndo: () => {
            /* The tracker draft was never submitted from here — discarding
               is just clearing the drafted card. */
          },
        },
        recover: {
          label: "Cancel recovery",
          onUndo: () => {
            /* Same — the recovery move was drafted, not submitted. */
          },
        },
        archive: {
          label: "Undo archive",
          onUndo: () => {
            /* Archive is drafted, not sent. Withdraw the draft. */
          },
        },
        revive: {
          label: "Undo — back to Parked",
          onUndo: () => parkPlay(p, priorReason ?? "Right play, wrong quarter"),
        },
        reopen: {
          label: "Undo — back to Rejected",
          onUndo: () => dismissPlay(p, priorReason ?? "Not taken this cycle"),
        },
      };
      task.outcome.undo = undoConfig[intent];
      startTask(task);
    }
  };

  const columns: DataTableColumn<Play>[] = [
    {
      key: "recommended",
      label: "Opportunity",
      sortable: true,
      minWidth: 230,
      maxWidth: 300,
      cell: (p) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}
            title={p.title}
          >
            {p.title}
          </span>
          <span
            style={{ fontSize: 12, color: "var(--ds-text-secondary)", ...numeric }}
          >
            {p.id}
          </span>
        </span>
      ),
    },
    {
      key: "subCategory",
      label: "Sub-category",
      minWidth: 140,
      cell: (p) => (
        <span style={{ fontSize: 13, color: "var(--ds-text-primary)" }}>
          {p.subCategory ?? p.category}
        </span>
      ),
    },
    {
      key: "country",
      label: "Country",
      minWidth: 96,
      /* Flag and ISO code, in a pill. The column held three notations at once —
         "US" beside "United States", "CH" beside "China" — which cannot be
         sorted or grouped and read as three different fields. `countryOf`
         resolves either spelling; the flag is derived from the code rather than
         stored, since every flag is the same arithmetic on its two letters.
         A row that only knows its region keeps plain text: a continent has no
         flag, and flying one for it would be a guess. */
      cell: (p) => {
        const c = countryOf(p.country);
        if (!c) {
          return (
            <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>
              {p.country ?? p.region}
            </span>
          );
        }
        return (
          <Pill size="sm" variant="neutral" title={c.name}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>{flagOf(c.code)}</span>
            {c.code}
          </Pill>
        );
      },
    },
    {
      key: "kind",
      label: "Lever",
      sortable: true,
      minWidth: 168,
      headerCell: () => (
        <ColumnFilterMenu
          label="Lever"
          activeDir={sort.field === "kind" ? (sort.dir ?? null) : null}
          options={kindsInTab.map((k) => ({ value: k, label: LEVER_LABEL[k] }))}
          selected={[...kindFilter]}
          onSort={(dir) => {
            setSort({ field: "kind", dir });
            setPage(1);
          }}
          onToggle={(v) => {
            const k = v as PlayKind;
            const next = new Set(kindFilter);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            setKindFilter(next);
            setPage(1);
          }}
          onClear={() => {
            setKindFilter(new Set());
            setPage(1);
          }}
        />
      ),
      cell: (p) => (
        <Pill variant="neutral" size="sm">
          {LEVER_LABEL[p.kind]}
        </Pill>
      ),
    },
    {
      key: "totalSpend",
      label: "Total spend",
      sortable: true,
      minWidth: 108,
      cell: (p) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
          {money(p.totalSpend ?? p.addressable)}
        </span>
      ),
    },
    {
      key: "addressable",
      label: "Addressable",
      sortable: true,
      minWidth: 108,
      cell: (p) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
          {money(p.addressable)}
        </span>
      ),
    },
    {
      key: "vendors",
      label: "Vendors",
      sortable: true,
      minWidth: 84,
      sortKey: "vendorCount",
      cell: (p) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
          {p.vendorCount ?? p.supplierIds.length}
        </span>
      ),
    },
    {
      key: "confidencePct",
      label: "Confidence",
      sortable: true,
      minWidth: 100,
      cell: (p) => <ConfidenceCell pct={p.confidencePct} />,
    },
    {
      /* Savings as its own column, one point-estimate figure in iris — the
         same colour the Action column's chat uses, so Mercer's number and
         Mercer's move read as one voice. */
      key: "recommendedSavings",
      label: "Savings",
      sortable: true,
      /* Starred: this is Mercer's estimate, not a figure read off a contract —
         the same mark the insight and action columns carry. */
      headerCell: () => <AgentColumnHeader>Savings</AgentColumnHeader>,
      minWidth: 108,
      sortKey: "recommended",
      cell: (p) => (
        <span
          style={{ fontSize: 14, fontWeight: 500, color: "var(--color-iris-700)", ...numeric }}
        >
          {money(p.recommended)}
        </span>
      ),
    },
    {
      key: "effortWeeks",
      label: "Effort",
      sortable: true,
      minWidth: 88,
      /* A band, not a week count. "14 weeks" is a precision nobody has before
         the work is scoped, and a buyer picking what to start does not compare
         12 against 14 — they ask whether this is a quick one. The weeks are
         still what it sorts on and what the tooltip says, because the estimate
         is real even if the third digit of it is not. */
      cell: (p) => {
        const band = effortBand(p.effortWeeks);
        return (
          <Pill
            size="sm"
            variant={band === "High" ? "warning" : band === "Medium" ? "info" : "neutral"}
            title={`About ${p.effortWeeks} weeks`}
          >
            {band}
          </Pill>
        );
      },
    },
    {
      key: "summary",
      label: `${profile.agent} Insight`,
      minWidth: 230,
      wrapLines: 2,
      headerCell: () => (
        <span className="flex items-center" style={{ gap: 4 }}>
          <AiStar size={14} variant="small" />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: "18px",
              color: "var(--ds-text-primary)",
            }}
          >
            {`${profile.agent} Insight`}
          </span>
        </span>
      ),
      cell: (p) => (
        <span
          title={p.summary}
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
          {p.action}
        </span>
      ),
    },
    {
      /* The one AI entry point on the table, and it is stage-aware — the same
         column reads a different move on every tab:
           Feed      → the lever chain (Review index / Start RFP / …)
           Act       → Run next step   (advance the playbook)
           Committed → Log this quarter, or Approve recovery if drifting
           Realized  → Archive & broadcast the win
           Parked    → Revive to Feed
           Rejected  → Reopen
         Feed runs the multi-step flow; the rest open their own scoped Mercer
         run via runNextMove. A "Draft consolidation" button on a committed
         play was the bug — a lever is a thing you do to a live opportunity,
         not to one already past commit. */
      key: "action",
      label: "Action",
      headerCell: () => <AgentColumnHeader>Action</AgentColumnHeader>,
      minWidth: 180,
      stopRowClick: true,
      cell: (p) => {
        if (TAB_STAGES.feed.has(p.stage)) {
          const label = feedActionLabelFor(p);
          return (
            <Button
              size="sm"
              variant="outline"
              title={`${label} — ${profile.agent} will run the chain`}
              aria-label={`${label} on ${p.id}`}
              onClick={() => startTask(feedFlowTaskFor(p, profile.agent, startTask))}
            >
              {label}
            </Button>
          );
        }
        const d = playDraftFor(p);
        if (d.kind !== "ready") {
          return <span style={{ fontSize: 12, color: "var(--ds-text-tertiary)" }}>—</span>;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            iconLeft={undefined}
            title={`${d.label} — ${profile.agent}`}
            aria-label={`${d.label} on ${p.id}`}
            onClick={() => runNextMove(p, d.intent)}
          >
            {d.label}
          </Button>
        );
      },
    },
  ];

  const feed = plays.filter((p) => TAB_STAGES.feed.has(p.stage));
  const feedLow = feed.reduce((s, p) => s + p.savingsLow, 0);
  const feedHigh = feed.reduce((s, p) => s + p.savingsHigh, 0);
  const highConfidence = feed.filter((p) => p.confidencePct >= 75).length;

  const openPlay = openId ? plays.find((p) => p.id === openId) ?? null : null;

  const isFiltered =
    kindFilter.size > 0 || draftFilter.size > 0 || preset !== null || q.trim().length > 0;

  const clearEverything = () => {
    setKindFilter(new Set());
    setDraftFilter(new Set());
    setPreset(null);
    setQ("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <AgentBrief
        agent={profile.agent}
        title={`${profile.agent} — last night's sweep`}
        /* Two sentences: what was found, and what to read first. The old one ran
           to four and spent three of them narrating the top two plays — which the
           table underneath already shows, ranked, with their own insight column.
           A brief that restates the list it sits above is the list twice. */
        paragraph={
          `${feed.length} plays surfaced, worth ${band(feedLow, feedHigh)} · ` +
          `${highConfidence} at 75% confidence or better. ` +
          `Read the dual-source play next to your action center — it is the same ` +
          `Luen Hing Housewares lead time that just moved on PO-4471.`
        }
        chips={[
          { label: "Open the action center", href: BUYING_ROUTES.actionCenter },
          { label: "See what is already committed", href: BUYING_ROUTES.value },
        ]}
      />

      <TableShell
        title="Sourcing opportunities"
        tabs={(Object.keys(TAB_STAGES) as TabId[]).map((id) => ({
          id,
          label: TAB_LABEL[id],
          badge: plays.filter((p) => TAB_STAGES[id].has(p.stage)).length,
        }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setOpenId(null);
          setKindFilter(new Set());
          setDraftFilter(new Set());
          setPreset(null);
          setQ("");
          setPage(1);
        }}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by play, category or supplier"
        filters={
          /* Preset chips on the left — action-oriented saved cuts — and the
             column-oriented Lever dropdown on the right. Chips read at a
             glance and carry their own counts; a dropdown was hiding those
             counts one click away. Only one preset can be active at a time,
             matching a radio not a multi-select. */
          <div className="flex flex-nowrap items-center" style={{ gap: 8 }}>
            {PRESETS.map((ps) => {
              const count = inTab.filter(ps.match).length;
              return (
                <Chip
                  key={ps.id}
                  icon={ps.icon}
                  selected={preset === ps.id}
                  count={count}
                  className="whitespace-nowrap shrink-0"
                  onClick={() => {
                    setPreset(preset === ps.id ? null : ps.id);
                    setPage(1);
                  }}
                >
                  {ps.label}
                </Chip>
              );
            })}
            <Select
              value={kindFilter.size === 1 ? [...kindFilter][0] : "all"}
              onValueChange={(v: string) => {
                if (v === "all") setKindFilter(new Set());
                else setKindFilter(new Set([v as PlayKind]));
                setPage(1);
              }}
            >
              <Select.Trigger
                size="md"
                aria-label="Filter by lever"
                className="!rounded-full !px-3.5"
              >
                <Select.Value placeholder="All levers" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All levers</Select.Item>
                {kindsInTab.map((k) => (
                  <Select.Item key={k} value={k}>
                    {LEVER_LABEL[k]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        }
        activeFilters={activeFilters}
        onClearAllFilters={clearEverything}
        isFiltered={isFiltered}
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
            {tab === "feed"
              ? `Nothing surfaced. ${profile.agent} sweeps the book again overnight.`
              : tab === "act" || tab === "committed"
              ? "Nothing taken yet — commit a play from the feed."
              : "Nothing dismissed. A dismissal here is kept as calibration for the next sweep."}
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
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          onRowClick={(p) => setOpenId(p.id)}
        />
      </TableShell>

      {openPlay &&
        (() => {
          const i = sorted.findIndex((p) => p.id === openPlay.id);
          const step = (by: number) => {
            const next = sorted[i + by];
            return next ? () => setOpenId(next.id) : undefined;
          };
          const nav =
            i < 0
              ? undefined
              : { position: `${i + 1} of ${sorted.length}`, onPrev: step(-1), onNext: step(1) };
          return (
            <PlayModal
              key={openPlay.id}
              play={openPlay}
              agent={profile.agent}
              nav={nav}
              onClose={() => setOpenId(null)}
              /* The modal's own commit/dismiss paths used to raise a toast for
                 the outcome. Now that the chat panel is the receipt everywhere,
                 the modal just closes and lets the caller-side handlers show
                 the run — no second copy of the sentence. */
              onCommitted={() => dismissModal()}
              onDismissed={() => {
                dismissPlay(openPlay, openPlay.dismissReason ?? "Not taken this cycle");
                dismissModal();
              }}
              /* Accepting moves the play into Act and takes the buyer there —
                 the work is the point of saying yes, and leaving them on the
                 feed to go and find the row they just accepted is a step the
                 flow does not need. */
              onAccepted={
                TAB_STAGES.feed.has(openPlay.stage)
                  ? () => {
                      acceptPlay(openPlay);
                      setOpenId(null);
                      setTab("act");
                      setPage(1);
                    }
                  : undefined
              }
              onParked={
                TAB_STAGES.feed.has(openPlay.stage)
                  ? () => {
                      parkPlay(openPlay, "Right play, wrong quarter");
                      setOpenId(null);
                      setTab("parked");
                      setPage(1);
                    }
                  : undefined
              }
              /* The agent takes the play into the panel, where a question about
                 it is a conversation rather than another form. */
              onAskAgent={() => {
                setOpenId(null);
                openChat({ ref: openPlay.id, party: openPlay.owner, partyOwn: true });
              }}
              /* Non-Feed footer CTAs — one per stage, mirroring the row-level
                 Mercer next-move but as a manual button the buyer clicks
                 themselves after reading the record. */
              decidedActions={(() => {
                const s = openPlay.stage;
                if (s === "accepted") {
                  return [
                    {
                      label: "Commit figure",
                      variant: "christy" as const,
                      onClick: () => {
                        runNextMove(openPlay, "approve");
                        dismissModal();
                      },
                    },
                  ];
                }
                if (s === "committed" || s === "realizing") {
                  const drift = openPlay.drift?.flagged;
                  return [
                    {
                      label: drift ? "Approve recovery" : "Log this quarter",
                      variant: "christy" as const,
                      onClick: () => {
                        runNextMove(openPlay, drift ? "recover" : "log");
                        dismissModal();
                      },
                    },
                  ];
                }
                if (s === "realized") {
                  return [
                    {
                      label: "Archive & broadcast",
                      variant: "christy" as const,
                      onClick: () => {
                        runNextMove(openPlay, "archive");
                        dismissModal();
                      },
                    },
                  ];
                }
                if (s === "parked") {
                  return [
                    {
                      label: "Revive to Feed",
                      variant: "christy" as const,
                      onClick: () => {
                        runNextMove(openPlay, "revive");
                        dismissModal();
                      },
                    },
                  ];
                }
                if (s === "dismissed") {
                  return [
                    {
                      label: "Reopen",
                      variant: "christy" as const,
                      onClick: () => {
                        runNextMove(openPlay, "reopen");
                        dismissModal();
                      },
                    },
                  ];
                }
                return undefined;
              })()}
            />
          );
        })()}
    </div>
  );
}
