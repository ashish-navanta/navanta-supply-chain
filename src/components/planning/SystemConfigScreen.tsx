"use client";

import { useState } from "react";
import {
  ChartBar,
  CurrencyCircleDollar,
  Gauge,
  PencilSimple,
  UserFocus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  Input,
  PageHeading,
  Switch,
  Tabs,
  Tooltip,
} from "@navanta-ai/design-system";
import {
  CONFIDENCE_WEIGHTS,
  ROUTING_GRID,
  SEGMENT_POLICY,
  STOCKING_POLICY_META,
  segmentMeaning,
  type ConfidenceWeight,
  type RoutingMode,
  type SegmentPolicy,
} from "@/data/planning";

/**
 * System Configurations.
 *
 * Ported from IRIS's `policy/system` page. Three tabs, because the levers do
 * three different jobs: Segmentation & Policy is the structural classification,
 * Confidence & Routing is the autonomy dial, and Buying is PO sign-off.
 *
 * Every editable section carries its own saved baseline and its own save bar.
 * That is deliberate in IRIS and worth keeping: a change to the routing grid
 * must never raise a save prompt on Buying Approval, because these are reviewed
 * and committed one section at a time by someone accountable for each.
 */

/** IRIS's page constants, verbatim. */
const C = {
  text: "#181A1B",
  text2: "#52525C",
  text3: "#A1A1AB",
  border: "#E4E4E7",
  hair: "#F1F3F5",
  chip: "#FAFAFA",
} as const;

/* ── Shell pieces ─────────────────────────────────────────────────────────── */

function ConfigCard({
  icon,
  title,
  subtitle,
  headerAction,
  footer,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  headerAction?: React.ReactNode;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="w-full overflow-hidden rounded-[12px] bg-[var(--surface-base)]"
      style={{ border: "1px solid var(--ds-border-subtle)" }}
    >
      <header className="flex items-start justify-between gap-[10px] px-[14px] py-[12px]">
        <div className="flex items-start gap-[10px]">
          <span className="mt-[2px] shrink-0" style={{ color: C.text }}>
            {icon}
          </span>
          <div className="flex flex-col">
            <h3 className="text-[14px] font-semibold leading-[22px]" style={{ color: C.text }}>
              {title}
            </h3>
            <p className="text-[12px] font-normal leading-[18px]" style={{ color: C.text2 }}>
              {subtitle}
            </p>
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </header>
      {children}
      {footer && (
        <div
          className="px-[14px] py-[12px] text-[12px] leading-[18px]"
          style={{ background: C.chip, borderTop: `1px solid ${C.hair}`, color: C.text3 }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

function SectionSaveBar({
  onDiscard,
  onSave,
  message,
}: {
  onDiscard: () => void;
  onSave: () => void;
  message?: string;
}) {
  const invalid = Boolean(message);
  const tone = invalid ? "var(--color-destructive-700, #B42318)" : C.text2;
  return (
    <div
      className="flex items-center justify-between gap-[16px] px-[14px] py-[10px]"
      style={{ background: C.chip, borderTop: `1px solid ${C.hair}` }}
    >
      <div className="flex items-center gap-[8px]">
        <WarningCircle size={16} weight="duotone" color={tone} />
        <span className="text-[13px] font-medium" style={{ color: tone }}>
          {message ?? "Unsaved changes in this section"}
        </span>
      </div>
      <div className="flex items-center gap-[8px]">
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="christy" size="sm" onClick={onSave} disabled={invalid}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function EditButton({ label = "Edit", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto gap-[4px] px-[6px] py-[4px] text-[13px] font-normal"
      style={{ color: C.text }}
      onClick={onClick}
    >
      <PencilSimple size={12} weight="regular" />
      {label}
    </Button>
  );
}

/** Read-mode value chip. */
function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-[32px] min-w-[78px] items-center justify-center whitespace-nowrap rounded-[8px] px-[12px] text-[13px] tabular-nums"
      style={{ background: C.chip, border: `1px solid ${C.border}`, color: C.text }}
    >
      {children}
    </span>
  );
}

/** Name · description · value row. */
function ConfigRow({
  name,
  desc,
  children,
}: {
  name: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-[52px] items-center gap-[16px] px-[14px]"
      style={{ borderBottom: `1px solid ${C.hair}` }}
    >
      <div className="flex w-[230px] shrink-0 items-center gap-[10px]">
        <span className="text-[14px]" style={{ color: C.text }}>
          {name}
        </span>
      </div>
      <div className="flex-1 text-[12px] leading-[18px]" style={{ color: C.text2 }}>
        {desc}
      </div>
      <div className="flex shrink-0 items-center gap-[12px]">{children}</div>
    </div>
  );
}

/** Compact inline number field. Held as a string while typing — a number state
 *  fights the reader the moment they clear a field to retype it. */
function NumField({
  value,
  onChange,
  prefix,
  suffix,
  ariaLabel,
  width = 72,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  ariaLabel: string;
  width?: number;
  invalid?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {prefix && (
        <span className="text-[13px]" style={{ color: C.text2 }}>
          {prefix}
        </span>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        className="h-7 text-right text-[14px]"
        style={{ width, fontVariantNumeric: "tabular-nums" }}
      />
      {suffix && (
        <span className="text-[13px]" style={{ color: C.text2 }}>
          {suffix}
        </span>
      )}
    </span>
  );
}

/**
 * The 3×3 auto-approval grid.
 *
 * The coloured tile preserves the at-a-glance heatmap — auto clustered in the
 * safe corner, manual in the risky one — while the whole tile is the control.
 * State is carried by icon and label, not colour alone, and the cell is a real
 * `role="switch"` so it works from a keyboard and reads to a screen reader.
 */
function RoutingGrid({
  colHeaders,
  rowHeaders,
  value,
  onChange,
}: {
  colHeaders: string[];
  rowHeaders: string[];
  value: RoutingMode[][];
  onChange: (ri: number, ci: number, mode: RoutingMode) => void;
}) {
  return (
    <div className="overflow-x-auto p-[14px]" style={{ borderTop: `1px solid ${C.hair}` }}>
      <table
        className="w-full min-w-[440px] table-fixed"
        style={{ borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr>
            <th className="w-[120px]" />
            {colHeaders.map((h) => (
              <th
                key={h}
                className="px-[8px] py-[6px] text-center text-[12px] font-medium"
                style={{ color: C.text2 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowHeaders.map((rowHeader, ri) => (
            <tr key={rowHeader}>
              <th
                className="whitespace-nowrap pr-[12px] text-right text-[12px] font-medium"
                style={{ color: C.text2 }}
              >
                {rowHeader}
              </th>
              {value[ri].map((mode, ci) => {
                const isAuto = mode === "auto";
                return (
                  <td key={ci} className="p-[4px]">
                    <Tooltip
                      content={`Click to update to ${isAuto ? "Manual" : "Auto"} action`}
                      className="block w-full"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAuto}
                        aria-label={`${rowHeader} · ${colHeaders[ci]}: ${isAuto ? "Auto" : "Manual"}. Click to switch.`}
                        onClick={() => onChange(ri, ci, isAuto ? "manual" : "auto")}
                        className="flex h-[44px] w-full cursor-pointer items-center justify-center gap-[6px] rounded-[8px] text-[14px] font-semibold transition-[filter,background,border-color] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-iris-500)] focus-visible:ring-offset-1"
                        style={
                          isAuto
                            ? {
                                background: "var(--color-iris-50)",
                                border: "1px solid transparent",
                                color: "var(--color-iris-700)",
                              }
                            : {
                                background: C.chip,
                                border: `1px solid ${C.border}`,
                                color: C.text2,
                              }
                        }
                      >
                        {isAuto ? (
                          <AiStar size={16} variant="small" />
                        ) : (
                          <UserFocus size={16} weight="duotone" />
                        )}
                        {isAuto ? "Auto" : "Manual"}
                      </button>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Datasets ─────────────────────────────────────────────────────────────── */

const SEG_META = {
  weights: {
    name: "ABC composite weights",
    desc: "Rank score that sorts products into A/B/C — revenue weighted against units sold",
  },
  dist: { name: "A / B / C distribution", desc: "Composite-rank cut by product count" },
  nonStock: {
    name: "Non-stock threshold",
    desc: "Products above this unit cost are treated as non-stock / build-to-order",
  },
} as const;

type SegConfig = {
  /** Revenue's share of the composite; quantity takes the rest. */
  revenueW: number;
  distA: number;
  distB: number;
  distC: number;
  nonStock: number;
};

const SEG_DEFAULTS: SegConfig = { revenueW: 70, distA: 20, distB: 30, distC: 50, nonStock: 4000 };

type SysTab = "segmentation" | "confidence" | "buying";

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function SystemConfigScreen() {
  const [tab, setTab] = useState<SysTab>("segmentation");

  /* Segmentation inputs */
  const [seg, setSeg] = useState<SegConfig>(SEG_DEFAULTS);
  const [savedSeg, setSavedSeg] = useState<SegConfig>(SEG_DEFAULTS);
  const [segEdit, setSegEdit] = useState(false);

  /* Segment policy table — edited a row at a time, as IRIS does. Committing one
     row should not ask about the other eight. */
  const [segPolicy, setSegPolicy] = useState<SegmentPolicy[]>(SEGMENT_POLICY);
  const [editRow, setEditRow] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<{ sl: string; reviewDays: string; tau: string }>({
    sl: "",
    reviewDays: "",
    tau: "",
  });

  /* Confidence weights */
  const [weights, setWeights] = useState<ConfidenceWeight[]>(CONFIDENCE_WEIGHTS);
  const [savedWeights, setSavedWeights] = useState<ConfidenceWeight[]>(CONFIDENCE_WEIGHTS);
  const [weightEdit, setWeightEdit] = useState(false);

  /* Routing */
  const [routing, setRouting] = useState<RoutingMode[][]>(ROUTING_GRID.initial.map((r) => [...r]));
  const [savedRouting, setSavedRouting] = useState<RoutingMode[][]>(
    ROUTING_GRID.initial.map((r) => [...r]),
  );

  /* Buying */
  const [emergencyOn, setEmergencyOn] = useState(true);
  const [savedEmergency, setSavedEmergency] = useState(true);

  const num = (v: string) => Number(v.replace(/[^0-9.]/g, ""));
  const distTotal = seg.distA + seg.distB + seg.distC;
  const distValid = distTotal === 100;
  const segDirty = JSON.stringify(seg) !== JSON.stringify(savedSeg);
  const weightTotal = weights.reduce((s, w) => s + w.pct, 0);
  const weightsValid = weightTotal === 100;
  const weightsDirty = JSON.stringify(weights) !== JSON.stringify(savedWeights);
  const routingDirty = JSON.stringify(routing) !== JSON.stringify(savedRouting);
  const emergencyDirty = emergencyOn !== savedEmergency;
  const autoCount = routing.flat().filter((m) => m === "auto").length;

  const startRow = (r: SegmentPolicy) => {
    setRowDraft({
      sl: String(r.sl),
      reviewDays: String(r.reviewDays),
      tau: r.tau == null ? "" : String(r.tau),
    });
    setEditRow(r.seg);
  };
  const saveRow = (seg2: string) => {
    setSegPolicy((prev) =>
      prev.map((r) =>
        r.seg === seg2
          ? {
              ...r,
              sl: num(rowDraft.sl),
              reviewDays: num(rowDraft.reviewDays),
              tau: rowDraft.tau.trim() === "" ? null : num(rowDraft.tau),
            }
          : r,
      ),
    );
    setEditRow(null);
  };
  const rowInvalid =
    editRow !== null &&
    (num(rowDraft.sl) < 50 ||
      num(rowDraft.sl) > 100 ||
      num(rowDraft.reviewDays) < 1 ||
      num(rowDraft.reviewDays) > 90);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="System Configurations"
        subtitle="Set the strategic rules IRIS runs on — how products are segmented, the policy each segment gets, and when to auto-approve or route to a human."
      />

      <Tabs
        variant="underline"
        tabs={[
          { id: "segmentation", label: "Segmentation & Policy", icon: ChartBar },
          { id: "confidence", label: "Confidence & Routing", icon: Gauge },
          { id: "buying", label: "Buying", icon: CurrencyCircleDollar },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as SysTab)}
      />

      {tab === "segmentation" && (
        <div className="flex flex-col gap-4">
          {/* 1 · Segmentation inputs */}
          <ConfigCard
            icon={<ChartBar size={16} weight="duotone" />}
            title="Segmentation"
            subtitle="How products are classified before any policy is applied"
            headerAction={segEdit ? undefined : <EditButton onClick={() => setSegEdit(true)} />}
          >
            <div style={{ borderTop: `1px solid ${C.hair}` }}>
              {/* Revenue and quantity are one weighting seen from two sides, so
                  editing either moves the other and the total never drifts. */}
              <ConfigRow name={SEG_META.weights.name} desc={SEG_META.weights.desc}>
                {segEdit ? (
                  <div className="flex items-center gap-[12px]">
                    <label className="flex items-center gap-[6px]">
                      <span className="text-[13px]" style={{ color: C.text2 }}>
                        Revenue
                      </span>
                      <NumField
                        value={String(seg.revenueW)}
                        onChange={(v) =>
                          setSeg((s) => ({ ...s, revenueW: Math.max(0, Math.min(100, num(v))) }))
                        }
                        suffix="%"
                        ariaLabel="Revenue weight"
                      />
                    </label>
                    <label className="flex items-center gap-[6px]">
                      <span className="text-[13px]" style={{ color: C.text2 }}>
                        Qty
                      </span>
                      <NumField
                        value={String(100 - seg.revenueW)}
                        onChange={(v) =>
                          setSeg((s) => ({
                            ...s,
                            revenueW: Math.max(0, Math.min(100, 100 - num(v))),
                          }))
                        }
                        suffix="%"
                        ariaLabel="Quantity weight"
                      />
                    </label>
                    <span
                      className="whitespace-nowrap text-[13px] tabular-nums"
                      style={{ color: C.text2, fontWeight: 500 }}
                    >
                      = 100%
                    </span>
                  </div>
                ) : (
                  <ValuePill>{`Revenue ${seg.revenueW}% · Qty ${100 - seg.revenueW}%`}</ValuePill>
                )}
              </ConfigRow>

              <ConfigRow name={SEG_META.dist.name} desc={SEG_META.dist.desc}>
                {segEdit ? (
                  <div className="flex items-center gap-[12px]">
                    {(["distA", "distB", "distC"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-[6px]">
                        <span className="text-[13px]" style={{ color: C.text2 }}>
                          {k.slice(-1)}
                        </span>
                        <NumField
                          value={String(seg[k])}
                          onChange={(v) =>
                            setSeg((s) => ({ ...s, [k]: Math.max(0, Math.min(100, num(v))) }))
                          }
                          suffix="%"
                          width={64}
                          invalid={!distValid}
                          ariaLabel={`${k.slice(-1)} share of products`}
                        />
                      </label>
                    ))}
                    <span
                      className="whitespace-nowrap text-[13px] tabular-nums"
                      style={{
                        color: distValid ? C.text2 : "var(--color-destructive-700, #B42318)",
                        fontWeight: 500,
                      }}
                    >
                      = {distTotal}%
                    </span>
                  </div>
                ) : (
                  <ValuePill>{`A ${seg.distA}% · B ${seg.distB}% · C ${seg.distC}%`}</ValuePill>
                )}
              </ConfigRow>

              <ConfigRow name={SEG_META.nonStock.name} desc={SEG_META.nonStock.desc}>
                {segEdit ? (
                  <div className="flex items-center gap-[6px]">
                    <NumField
                      value={String(seg.nonStock)}
                      onChange={(v) => setSeg((s) => ({ ...s, nonStock: Math.max(0, num(v)) }))}
                      prefix="$"
                      width={120}
                      ariaLabel="Non-stock unit cost threshold"
                    />
                    <span className="text-[13px]" style={{ color: C.text2 }}>
                      /unit
                    </span>
                  </div>
                ) : (
                  <ValuePill>{`≤ $${seg.nonStock.toLocaleString()}/unit`}</ValuePill>
                )}
              </ConfigRow>
            </div>
            {segEdit && (
              <SectionSaveBar
                onDiscard={() => {
                  setSeg(savedSeg);
                  setSegEdit(false);
                }}
                onSave={() => {
                  setSavedSeg(seg);
                  setSegEdit(false);
                }}
                message={
                  !distValid
                    ? `A / B / C must total 100% — currently ${distTotal}%`
                    : segDirty
                      ? undefined
                      : "No changes in this section"
                }
              />
            )}
          </ConfigCard>

          {/* 2 · Segment policy table */}
          <ConfigCard
            icon={<ChartBar size={16} weight="duotone" />}
            title="Segment policy"
            subtitle="The policy each ABC × XYZ segment gets, its recompute cadence, service level and overstock cap"
            footer="Every segment is Periodic review, with CZ carved out as the one Min/Max exception — a continuous reorder-point policy with no fixed cadence, so its review shows —. The recompute cadence follows the XYZ tier alone: how often the parameters are re-derived is a question about how fast demand moves, not about how much the line is worth."
          >
            <div className="overflow-x-auto p-[14px]" style={{ borderTop: `1px solid ${C.hair}` }}>
              <table
                className="w-full min-w-[640px]"
                style={{ borderCollapse: "separate", borderSpacing: 0 }}
              >
                <thead>
                  <tr>
                    {["Segment", "Meaning", "Policy", "Review", "Service level", "τ", ""].map(
                      (h, i) => (
                        <th
                          key={h || "act"}
                          className="px-[8px] py-[6px] text-[12px] font-medium"
                          style={{
                            color: C.text2,
                            textAlign: i >= 3 && i < 6 ? "right" : "left",
                            borderBottom: `1px solid ${C.hair}`,
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {segPolicy.map((s) => {
                    const editing = editRow === s.seg;
                    const cell: React.CSSProperties = {
                      borderBottom: `1px solid ${C.hair}`,
                      fontVariantNumeric: "tabular-nums",
                    };
                    return (
                      <tr key={s.seg}>
                        <td
                          className="px-[8px] py-[10px] text-[14px] font-semibold"
                          style={{ ...cell, color: C.text }}
                        >
                          {s.seg}
                        </td>
                        <td className="px-[8px] py-[10px] text-[12px]" style={{ ...cell, color: C.text2 }}>
                          {segmentMeaning(s.seg)}
                        </td>
                        <td className="px-[8px] py-[10px] text-[14px]" style={{ ...cell, color: C.text }}>
                          {STOCKING_POLICY_META[s.policy].label}
                        </td>
                        <td
                          className="px-[8px] py-[10px] text-right text-[14px]"
                          style={{ ...cell, color: C.text }}
                        >
                          {s.policy === "min-max" ? (
                            "—"
                          ) : editing ? (
                            <NumField
                              value={rowDraft.reviewDays}
                              onChange={(v) => setRowDraft((d) => ({ ...d, reviewDays: v }))}
                              suffix="d"
                              width={60}
                              ariaLabel={`${s.seg} recompute cadence`}
                            />
                          ) : (
                            `${s.reviewDays} days`
                          )}
                        </td>
                        <td
                          className="px-[8px] py-[10px] text-right text-[14px]"
                          style={{ ...cell, color: C.text }}
                        >
                          {editing ? (
                            <NumField
                              value={rowDraft.sl}
                              onChange={(v) => setRowDraft((d) => ({ ...d, sl: v }))}
                              suffix="%"
                              width={60}
                              ariaLabel={`${s.seg} service level`}
                            />
                          ) : (
                            `${s.sl}%`
                          )}
                        </td>
                        <td
                          className="px-[8px] py-[10px] text-right text-[14px]"
                          style={{ ...cell, color: s.tau ? C.text : C.text3 }}
                        >
                          {editing ? (
                            <NumField
                              value={rowDraft.tau}
                              onChange={(v) => setRowDraft((d) => ({ ...d, tau: v }))}
                              suffix="×"
                              width={60}
                              ariaLabel={`${s.seg} overstock multiplier`}
                            />
                          ) : s.tau ? (
                            `${s.tau}×`
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-[8px] py-[10px] text-right" style={cell}>
                          {editing ? (
                            <span className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto px-[8px] py-[4px] text-[13px] font-normal"
                                style={{ color: C.text2 }}
                                onClick={() => setEditRow(null)}
                              >
                                Discard
                              </Button>
                              <Button
                                variant="christy"
                                size="sm"
                                disabled={rowInvalid}
                                onClick={() => saveRow(s.seg)}
                              >
                                Save
                              </Button>
                            </span>
                          ) : (
                            <EditButton onClick={() => startRow(s)} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ConfigCard>
        </div>
      )}

      {tab === "confidence" && (
        <div className="flex flex-col gap-4">
          <ConfigCard
            icon={<Gauge size={16} weight="duotone" />}
            title="Auto-approval routing"
            subtitle="Confidence against risk — what IRIS settles alone, and what reaches a planner"
            footer={`${autoCount} of 9 combinations are settled automatically. Changing a tile changes what the Inventory Planning queue routes to you — this grid is the gate, not a description of one.`}
          >
            <RoutingGrid
              colHeaders={ROUTING_GRID.colHeaders}
              rowHeaders={ROUTING_GRID.rowHeaders}
              value={routing}
              onChange={(ri, ci, mode) =>
                setRouting((prev) =>
                  prev.map((row, r) => (r === ri ? row.map((m, c) => (c === ci ? mode : m)) : row)),
                )
              }
            />
            {routingDirty && (
              <SectionSaveBar
                onDiscard={() => setRouting(savedRouting.map((r) => [...r]))}
                onSave={() => setSavedRouting(routing.map((r) => [...r]))}
              />
            )}
          </ConfigCard>

          <ConfigCard
            icon={<ChartBar size={16} weight="duotone" />}
            title="Confidence score"
            subtitle="What goes into the score the routing grid reads, and how much each factor counts"
            headerAction={
              weightEdit ? undefined : <EditButton onClick={() => setWeightEdit(true)} />
            }
            footer="A score is only as good as its worst input, which is why data sufficiency and demand stability are scored separately rather than folded into forecast accuracy."
          >
            <div className="flex flex-col p-[14px]" style={{ borderTop: `1px solid ${C.hair}` }}>
              {weights.map((w, i) => (
                <div
                  key={w.name}
                  className="flex flex-col gap-[6px] py-[10px]"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${C.hair}` }}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium" style={{ color: C.text }}>
                      {w.name}
                    </span>
                    {weightEdit ? (
                      <NumField
                        value={String(w.pct)}
                        onChange={(v) =>
                          setWeights((prev) =>
                            prev.map((x) =>
                              x.name === w.name
                                ? { ...x, pct: Math.max(0, Math.min(100, num(v))) }
                                : x,
                            ),
                          )
                        }
                        suffix="%"
                        width={64}
                        invalid={!weightsValid}
                        ariaLabel={`${w.name} weight`}
                      />
                    ) : (
                      <span
                        className="shrink-0 text-[14px] font-semibold"
                        style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}
                      >
                        {w.pct}%
                      </span>
                    )}
                  </span>
                  {/* The bar is the weight; the sentence is what it measures. */}
                  <span
                    className="block w-full overflow-hidden rounded-full"
                    style={{ height: 4, background: C.hair }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${w.pct * 2}%`, background: "var(--color-iris-700)" }}
                    />
                  </span>
                  <span className="text-[12px] leading-[18px]" style={{ color: C.text2 }}>
                    {w.desc}
                  </span>
                </div>
              ))}
            </div>
            {weightEdit && (
              <SectionSaveBar
                onDiscard={() => {
                  setWeights(savedWeights);
                  setWeightEdit(false);
                }}
                onSave={() => {
                  setSavedWeights(weights);
                  setWeightEdit(false);
                }}
                message={
                  !weightsValid
                    ? `Weights must total 100% — currently ${weightTotal}%`
                    : weightsDirty
                      ? undefined
                      : "No changes in this section"
                }
              />
            )}
          </ConfigCard>
        </div>
      )}

      {tab === "buying" && (
        <ConfigCard
          icon={<CurrencyCircleDollar size={16} weight="duotone" />}
          title="Buying Approval"
          subtitle="Who signs a purchase order, and what IRIS may never sign on its own"
          footer="An emergency order is placed because something already went wrong. Letting the system clear those without a human is how a bad week becomes a bad quarter, which is why this switch exists separately from the routing grid."
        >
          <div style={{ borderTop: `1px solid ${C.hair}` }}>
            <ConfigRow
              name="Emergency PO auto approval"
              desc="Emergency orders always require a human approver, regardless of value"
            >
              <Switch
                checked={emergencyOn}
                onCheckedChange={setEmergencyOn}
                label={emergencyOn ? "On" : "Off"}
                aria-label="Emergency PO auto approval"
              />
            </ConfigRow>
            <ConfigRow
              name="Value ceiling"
              desc="Any purchase order above this reaches a person however confident IRIS is"
            >
              <ValuePill>$50,000</ValuePill>
            </ConfigRow>
            <ConfigRow
              name="New vendor"
              desc="A first order on a vendor with no delivery history is always signed by a person"
            >
              <ValuePill>Always manual</ValuePill>
            </ConfigRow>
          </div>
          {emergencyDirty && (
            <SectionSaveBar
              onDiscard={() => setEmergencyOn(savedEmergency)}
              onSave={() => setSavedEmergency(emergencyOn)}
            />
          )}
        </ConfigCard>
      )}
    </div>
  );
}
