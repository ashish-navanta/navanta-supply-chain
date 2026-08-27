"use client";

import { useMemo, useState } from "react";
import { ArrowsIn, Factory, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  Input,
  Pill,
  Select,
  Tabs,
  type DataTableColumn,
  type DataTableSlotColumn,
} from "@navanta-ai/design-system";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { formatUsdFull } from "@/data/action-center";
import { SUPPLIERS, type Play, type Supplier } from "@/data/buying";

/**
 * The vendor roster — the decision the review is actually for.
 *
 * Ported from the Allison procurement review deck. A consolidation play is not
 * one decision, it is one per supplier: this factory takes the volume, that one is
 * competed, the third comes off the book. The evidence list said what the sweep
 * found; the roster is where the buyer says what to do about each name, and
 * without it "Approve" approves a paragraph rather than a plan.
 *
 * Held in local state, like the rest of the sheet's working: a roster is a draft
 * until the play is approved, and approving carries it into Act.
 */

/** What happens to this supplier under the play. */
const APPROACHES = [
  { id: "consolidate", label: "Consolidate onto" },
  { id: "compete", label: "Compete / RFQ" },
  { id: "renegotiate", label: "Renegotiate" },
  { id: "transition", label: "Transition away" },
  { id: "hold", label: "Leave as is" },
] as const;

/** How firm that call is. */
const STANCES = [
  { id: "pursue", label: "Pursue" },
  { id: "investigate", label: "Investigate" },
] as const;

type ApproachId = (typeof APPROACHES)[number]["id"];
type StanceId = (typeof STANCES)[number]["id"];

interface RosterRow {
  supplier: Supplier;
  approach: ApproachId;
  stance: StanceId;
}

/**
 * The agent's opening position per supplier.
 *
 * Derived from the share each holds, because that is what the play turns on: the
 * big holders take the consolidated volume, the tail is transitioned away, and a
 * middling holder is competed. A buyer who disagrees changes it — which is the
 * point of the two dropdowns — but they should not have to fill the table in
 * from scratch.
 */
function openingPosition(play: Play, s: Supplier): { approach: ApproachId; stance: StanceId } {
  if (play.kind === "dual-source") {
    return s.categoryShare >= 40
      ? { approach: "renegotiate", stance: "pursue" }
      : { approach: "consolidate", stance: "pursue" };
  }
  if (s.categoryShare >= 30) return { approach: "consolidate", stance: "pursue" };
  if (s.categoryShare >= 12) return { approach: "compete", stance: "investigate" };
  return { approach: "transition", stance: "investigate" };
}

export function VendorRoster({ play, agent }: { play: Play; agent: string }) {
  /* Two lists, kept apart because the controls are different. External vendors
     get the commercial roster (compete, transition, scorecard, terms). Internal
     Target-dedicated plants get a read-only band above the roster — they are
     context on what the sourcing decision is competing with, not names to
     negotiate with. A Compete / RFQ dropdown pointed at Cedar Mills Co-Pack
     would be a mistake the flow shouldn't be able to make. */
  const inScope = useMemo(
    () => SUPPLIERS.filter((s) => play.supplierIds.includes(s.id)),
    [play],
  );
  const internalInScope = useMemo(() => inScope.filter((s) => s.own), [inScope]);
  const seeded = useMemo<RosterRow[]>(
    () =>
      inScope
        .filter((s) => !s.own)
        .map((supplier) => ({
          supplier,
          ...openingPosition(play, supplier),
        })),
    [inScope],
  );

  const [rows, setRows] = useState<RosterRow[]>(seeded);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "in-play">("in-play");

  const set = (id: string, patch: Partial<RosterRow>) =>
    setRows((prev) => prev.map((r) => (r.supplier.id === id ? { ...r, ...patch } : r)));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (scope === "in-play" && r.approach === "hold") return false;
      if (!needle) return true;
      return [r.supplier.name, r.supplier.region, r.supplier.site]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, scope]);

  const inPlay = rows.filter((r) => r.approach !== "hold");
  const addressable = inPlay.reduce((sum, r) => sum + r.supplier.annualSpend, 0);

  const serial: DataTableSlotColumn<RosterRow> = {
    id: "sn",
    width: 40,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (_r, ctx) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>{ctx.index + 1}</span>
    ),
  };

  const columns: DataTableColumn<RosterRow>[] = [
    {
      key: "vendor",
      label: "Vendor",
      minWidth: 208,
      cell: (r) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>
            {r.supplier.name}
          </span>
          <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
            {`${r.supplier.site} · ${r.supplier.country}`}
          </span>
        </span>
      ),
    },
    {
      key: "share",
      label: "Holds",
      minWidth: 116,
      /* Share of the category, then the spend behind it — the two figures that
         decide whether a name is an anchor or a tail. */
      cell: (r) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
            {`${r.supplier.categoryShare}%`}
          </span>
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {formatUsdFull(r.supplier.annualSpend)}
          </span>
        </span>
      ),
    },
    {
      key: "scorecard",
      label: "Scorecard",
      minWidth: 108,
      /* On time in full and quality, as one number a buyer already trusts. */
      cell: (r) => {
        const score = Math.round(r.supplier.otifPct * 0.7 + (100 - r.supplier.rejectRate * 10) * 0.3);
        return (
          <Pill variant={score >= 85 ? "neutral" : score >= 70 ? "warning" : "danger"} size="sm">
            {`${score}/100`}
          </Pill>
        );
      },
    },
    {
      key: "approach",
      label: "Approach",
      minWidth: 176,
      stopRowClick: true,
      cell: (r) => (
        <Select
          value={r.approach}
          onValueChange={(v: string) => set(r.supplier.id, { approach: v as ApproachId })}
        >
          <Select.Trigger size="sm" aria-label={`Approach for ${r.supplier.name}`}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {APPROACHES.map((a) => (
              <Select.Item key={a.id} value={a.id}>
                {a.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      ),
    },
    {
      key: "remove",
      label: "",
      minWidth: 48,
      stopRowClick: true,
      /* Out of the play, not deleted — the vendor is still on the category, it
         just is not one this move touches. "Leave as is" is where it lands, and
         the All vendors view is how it comes back. */
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Take ${r.supplier.name} out of this play`}
          title="Take out of this play"
          onClick={() => set(r.supplier.id, { approach: "hold" })}
        >
          <Trash size={14} style={{ color: "var(--ds-text-secondary)" }} />
        </Button>
      ),
    },
    {
      key: "stance",
      label: "Status",
      minWidth: 148,
      stopRowClick: true,
      cell: (r) => (
        <Select
          value={r.stance}
          onValueChange={(v: string) => set(r.supplier.id, { stance: v as StanceId })}
        >
          <Select.Trigger size="sm" aria-label={`Stance on ${r.supplier.name}`}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {STANCES.map((st) => (
              <Select.Item key={st.id} value={st.id}>
                {st.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      ),
    },
  ];

  /* Grouped by approach, as the reference groups them. A play is not a flat list
     of suppliers with a dropdown each — it is two or three moves, and each move
     has its own size and its own effort. Grouping puts the dials where they
     belong: on the move, not on the row. */
  const groups = useMemo(() => {
    const byApproach = new Map<ApproachId, RosterRow[]>();
    for (const r of shown) {
      if (r.approach === "hold" && scope === "in-play") continue;
      byApproach.set(r.approach, [...(byApproach.get(r.approach) ?? []), r]);
    }
    return APPROACHES.filter((a) => byApproach.has(a.id)).map((a) => ({
      approach: a,
      rows: byApproach.get(a.id)!,
    }));
  }, [shown, scope]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span style={{ width: 240 }}>
          <Input
            size="md"
            type="search"
            value={q}
            placeholder="Search vendors…"
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search vendors"
            suffix={<MagnifyingGlass size={14} />}
          />
        </span>
        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
          {`Addressable cap ${formatUsdFull(addressable)} · the names this play can reach`}
        </span>
      </div>

      {internalInScope.length > 0 && (
        /* Target capacity in scope — read-only band above the roster. Internal
           plants sit here because their share of the category matters to the
           sourcing decision (a play is smaller if the plant already carries
           some of it) but they aren't names Mercer would compete or draft a
           letter to. See make-vs-buy — that's a different lever. */
        <div
          className="flex flex-col gap-2 rounded-[8px] p-3"
          style={{
            background: "var(--surface-sunken, #F7F7F7)",
            border: "1px solid var(--ds-border-subtle)",
          }}
        >
          <span
            className="flex items-center gap-1.5"
            style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ds-text-primary)" }}
          >
            <Factory size={13} weight="duotone" style={{ color: "#71767A" }} />
            Target capacity in scope · {internalInScope.length}{" "}
            {internalInScope.length === 1 ? "plant" : "plants"}
          </span>
          <div className="flex flex-col" style={{ gap: 4 }}>
            {internalInScope.map((p) => (
              <span
                key={p.id}
                className="flex flex-wrap items-center"
                style={{ gap: 8, fontSize: 12.5 }}
              >
                <span style={{ fontWeight: 500, color: "var(--ds-text-primary)" }}>
                  {p.name}
                </span>
                <span style={{ color: "var(--ds-text-secondary)" }}>
                  {`${p.site} · ${p.categoryShare}% of the category · ${formatUsdFull(
                    p.annualSpend,
                  )}`}
                </span>
              </span>
            ))}
          </div>
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            Read-only here. A make-vs-buy shift lives in capacity planning, not
            this sourcing roster.
          </span>
        </div>
      )}

      {/* DS underline tabs, not pill buttons — the reference's own two views. */}
      <Tabs
        variant="underline"
        className="border-b border-[color:var(--ds-border-subtle)]"
        tabs={[
          { id: "in-play", label: "Allotted vendors", badge: inPlay.length },
          { id: "all", label: "All vendors", badge: rows.length },
        ]}
        activeTab={scope}
        onChange={(id) => setScope(id as "all" | "in-play")}
      />

      {groups.map(({ approach, rows: groupRows }) => {
        const spend = groupRows.reduce((sum, r) => sum + r.supplier.annualSpend, 0);
        const share = addressable > 0 ? Math.round((spend / addressable) * 100) : 0;
        const size = sizeOf(approach.id, groupRows.length);
        const effort = effortOf(approach.id);
        /* The prize and the leakage, off the group's own spend — so a buyer who
           moves a name between approaches sees both figures move with it. */
        const estimated = Math.round(spend * (play.recommended / play.addressable));
        const risk = Math.round(estimated * (effort === "High" ? 0.4 : effort === "Medium" ? 0.25 : 0.12));

        return (
          <div
            key={approach.id}
            className="flex flex-col overflow-hidden rounded-[12px]"
            style={{ border: "1px solid var(--ds-border-subtle)" }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-3 py-2.5"
              style={{ background: "var(--surface-sunken)" }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="flex shrink-0 items-center justify-center rounded-[8px]"
                  style={{ width: 28, height: 28, background: "var(--surface-base)" }}
                >
                  <ArrowsIn size={14} weight="bold" style={{ color: "var(--ds-text-primary)" }} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
                      {approach.label}
                    </span>
                    <Pill variant="neutral" size="sm">
                      {String(groupRows.length)}
                    </Pill>
                  </span>
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    {`${groupRows.length} vendor${groupRows.length === 1 ? "" : "s"} · ${share}% of the addressable spend`}
                  </span>
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-4">
                {[
                  ["Saving potential", size],
                  ["Effort", effort],
                  ["Estimated saving", formatUsdFull(estimated)],
                  ["Risk involved", formatUsdFull(risk)],
                ].map(([label, value]) => (
                  <span key={label} className="flex flex-col">
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      {label}
                    </span>
                    <span
                      style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}
                    >
                      {value}
                    </span>
                  </span>
                ))}
              </span>
            </div>

            <DataTable<RosterRow>
              {...SHAW_TABLE_PROPS}
              columns={columns}
              leadingSlots={[serial]}
              data={groupRows}
              rowKey={(r) => r.supplier.id}
              rowHeight="auto"
            />
          </div>
        );
      })}

      {groups.length === 0 && (
        <span className="type-cell" style={{ padding: 20, color: "var(--ds-text-secondary)" }}>
          No vendor matches that.
        </span>
      )}

      <span className="flex items-start gap-1.5">
        <Factory size={13} weight="duotone" className="mt-0.5 shrink-0" style={{ color: "#71767A" }} />
        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
          {`${agent} set the opening position from the share each name holds. Move a name between approaches and both figures on the group move with it — approving the play carries this roster into Act.`}
        </span>
      </span>
    </div>
  );
}

/** T-shirt size for a move, from what it is and how many names it touches. */
function sizeOf(approach: ApproachId, count: number): string {
  if (approach === "consolidate") return count > 2 ? "L" : "M";
  if (approach === "compete") return "M";
  if (approach === "transition") return "S";
  return "S";
}

/** How hard the move is to run — a qualification is not a price conversation. */
function effortOf(approach: ApproachId): "Low" | "Medium" | "High" {
  if (approach === "transition") return "High";
  if (approach === "compete" || approach === "consolidate") return "Medium";
  return "Low";
}
