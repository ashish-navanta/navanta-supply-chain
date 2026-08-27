"use client";

import { Info, Warning, WarningCircle } from "@phosphor-icons/react";
import { Tooltip } from "@navanta-ai/design-system";
import {
  ABC_ORDER,
  ABC_ROW_META,
  XYZ_COL_META,
  XYZ_ORDER,
  fillTierLabel,
  type Classification,
  type MatrixCell,
  type Severity,
} from "@/data/planning";

/**
 * ABC × XYZ portfolio matrix.
 *
 * Ported from the IRIS project's `planning/_components/ABCMatrix.tsx` — the
 * severity palette, the 85px row-label column, the 16px gaps, the 8px/12px cell
 * padding and the split tooltip are all theirs. Two behaviours are worth
 * calling out because they are easy to lose in a port:
 *
 *   Healthy cells are NOT interactive. There is nothing in them to drill into,
 *   so they take no click and no focus, and hovering explains why rather than
 *   offering a filter that would return an empty table.
 *
 *   A cell's severity is the SHARE of it in exception, not the worst thing in
 *   it. Presence alone reddened all nine boxes — see `severityForCell`. The
 *   counts on the cell face still name every critical and elevated position in
 *   the box the planner has to open.
 */

/** Per Figma — healthy cells are white with a soft neutral border-shadow;
 *  elevated/critical carry a coloured 0.5px ring over a tinted background. */
const SEV_BG: Record<Severity, string> = {
  healthy: "#FFFFFF",
  elevated: "#FFFBEA",
  critical: "#FFF1F2",
};

const SEV_SHADOW: Record<Severity, string> = {
  healthy: "0 0 0 0.5px rgba(0,0,0,0.18), 0 1px 2px 0 rgba(0,0,0,0.06)",
  elevated: "0 0 0 0.5px #FF9900",
  critical: "0 0 0 0.5px #F0000F",
};

const SEV_FOCUS: Record<Severity, string> = {
  healthy: "0 0 0 3px rgba(15, 23, 42, 0.1)",
  elevated: "0 0 0 3px rgba(255, 153, 0, 0.25)",
  critical: "0 0 0 3px rgba(240, 0, 15, 0.25)",
};

const SEV_BORDER: Record<Severity, string> = {
  healthy: "var(--ds-border-strong)",
  elevated: "#FF9900",
  critical: "#F0000F",
};

/** Row-label column width per Figma 256:1869. */
const ROW_LABEL_WIDTH = 85;
const ROW_LABEL_GAP = 16;

function formatShortDollars(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$${n}`;
}

/** The compact dark popover — class + products, fill rate with its tier, and an
 *  at-risk footer only where the cell has open exceptions. */
function CellTooltip({ cell }: { cell: MatrixCell }) {
  const elevDollars = cell.elevatedDollars ?? 0;
  const critDollars = cell.criticalDollars ?? 0;
  const elev = cell.elevatedCount ?? 0;
  const crit = cell.criticalCount ?? 0;
  const total = elevDollars + critDollars;
  const fillPct = cell.fillRate != null ? Math.round(cell.fillRate * 100) : null;

  const divider = "1px solid rgba(255,255,255,0.12)";
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 400, lineHeight: "18px", color: "#FFFFFF" };
  const value: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: "22px",
    color: "#FFFFFF",
    fontVariantNumeric: "tabular-nums",
  };
  const num: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "18px",
    color: "#FFFFFF",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div className="flex flex-col" style={{ gap: 8, minWidth: 196 }}>
      <div className="flex w-full items-center" style={{ gap: 4 }}>
        <span style={label}>{cell.classification}</span>
        <span style={label}>
          {cell.skuCount.toLocaleString()} {cell.skuCount === 1 ? "Product" : "Products"}
        </span>
      </div>

      <div style={{ borderTop: divider }} />

      <div className="flex w-full items-end justify-between">
        <span className="flex items-baseline" style={{ gap: 4 }}>
          <span style={value}>{fillPct != null ? `${fillPct}%` : "—"}</span>
          <span style={label}>fill rate</span>
        </span>
        <span style={label}>{fillPct != null ? fillTierLabel(fillPct) : "—"}</span>
      </div>

      {total > 0 && (
        <>
          <div style={{ borderTop: divider }} />
          <div className="flex flex-col" style={{ gap: 4 }}>
            <span style={label}>At risk</span>
            {crit > 0 && (
              <span className="flex w-full items-center justify-between" style={{ gap: 12 }}>
                <span className="flex items-center" style={{ gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 6, height: 6, borderRadius: 999, background: "#F0000F" }}
                  />
                  <span style={label}>{crit} critical</span>
                </span>
                <span style={num}>{formatShortDollars(critDollars)}</span>
              </span>
            )}
            {elev > 0 && (
              <span className="flex w-full items-center justify-between" style={{ gap: 12 }}>
                <span className="flex items-center" style={{ gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 6, height: 6, borderRadius: 999, background: "#FF9900" }}
                  />
                  <span style={label}>{elev} elevated</span>
                </span>
                <span style={num}>{formatShortDollars(elevDollars)}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export interface ABCMatrixProps {
  cells: MatrixCell[];
  selected?: Classification | null;
  onSelect?: (c: Classification | null) => void;
  skuTotal: number;
  branchCount: number;
}

export function ABCMatrix({ cells, selected, onSelect, skuTotal, branchCount }: ABCMatrixProps) {
  const map = new Map(cells.map((c) => [c.classification, c]));

  return (
    <div
      className="w-full overflow-hidden rounded-[12px]"
      style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-subtle)" }}
    >
      {/* Header — title, the span the counts cover, and the info affordance */}
      <div
        className="flex items-start justify-between gap-3 px-[16px] pt-[16px]"
      >
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span className="type-subheading font-semibold" style={{ color: "#18181B" }}>
            ABC × XYZ classification
          </span>
          <span className="type-caption font-normal" style={{ color: "#52525C" }}>
            {skuTotal.toLocaleString()} variants × {branchCount} distribution{" "}
            {branchCount === 1 ? "centre" : "centres"} — every variant is classified at every
            centre
          </span>
        </div>
        <Tooltip content="Click any cell to filter exceptions below">
          <button
            type="button"
            aria-label="About ABC × XYZ classification"
            className="flex items-center justify-center transition-opacity hover:opacity-100"
            style={{ width: 16, height: 16, opacity: 0.7 }}
          >
            <Info size={16} weight="regular" color="#52525C" />
          </button>
        </Tooltip>
      </div>

      <div className="flex w-full flex-col" style={{ padding: 16 }}>
        {/* Column header row */}
        <div className="flex w-full items-center" style={{ gap: ROW_LABEL_GAP, height: 18 }}>
          <div style={{ width: ROW_LABEL_WIDTH, flexShrink: 0 }} />
          {XYZ_ORDER.map((col) => {
            const meta = XYZ_COL_META[col];
            return (
              <div
                key={`col-${col}`}
                className="flex flex-row items-center justify-center"
                style={{ flex: "1 0 0", gap: 8, color: "#52525C" }}
              >
                <span className="type-cell font-semibold">{meta.label}</span>
                <span className="type-caption font-normal">{meta.sub}</span>
              </div>
            );
          })}
        </div>

        <div className="flex w-full flex-col" style={{ gap: 16, marginTop: 8 }}>
          {ABC_ORDER.map((row) => {
            const rowMeta = ABC_ROW_META[row];
            return (
              <div
                key={`row-${row}`}
                className="flex w-full items-stretch"
                style={{ gap: ROW_LABEL_GAP, minHeight: 64 }}
              >
                <div
                  className="flex flex-col items-center justify-center"
                  style={{
                    width: ROW_LABEL_WIDTH,
                    flexShrink: 0,
                    color: "#52525C",
                    gap: 4,
                    textAlign: "center",
                  }}
                >
                  <span className="type-cell font-semibold">{rowMeta.label}</span>
                  <span className="type-caption font-normal">{rowMeta.sub}</span>
                </div>

                {XYZ_ORDER.map((col) => {
                  const classification = `${row}${col}` as Classification;
                  const cell = map.get(classification);
                  if (!cell)
                    return <div key={classification} style={{ flex: "1 0 0", minWidth: 0 }} />;
                  const isSelected = selected === classification;
                  const elev = cell.elevatedCount ?? 0;
                  const crit = cell.criticalCount ?? 0;
                  const isHealthy = cell.severity === "healthy";
                  const fillPct = cell.fillRate != null ? Math.round(cell.fillRate * 100) : null;

                  const cellInner = (
                    <button
                      key={classification}
                      type="button"
                      onClick={
                        isHealthy ? undefined : () => onSelect?.(isSelected ? null : classification)
                      }
                      aria-pressed={isHealthy ? undefined : isSelected}
                      aria-disabled={isHealthy ? true : undefined}
                      tabIndex={isHealthy ? -1 : 0}
                      className={
                        isHealthy
                          ? "flex cursor-default flex-col text-left"
                          : "flex flex-col text-left transition-all hover:brightness-[0.98] active:scale-[0.99]"
                      }
                      style={{
                        flex: "1 0 0",
                        minWidth: 0,
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: SEV_BG[cell.severity],
                        boxShadow: isSelected
                          ? `${SEV_SHADOW[cell.severity]}, ${SEV_FOCUS[cell.severity]}`
                          : SEV_SHADOW[cell.severity],
                        border: isSelected
                          ? `1px solid ${SEV_BORDER[cell.severity]}`
                          : "1px solid transparent",
                        outline: "none",
                        width: "100%",
                      }}
                    >
                      <div className="type-caption flex w-full items-center justify-between font-normal">
                        <span>
                          <span style={{ color: "#000000" }}>{classification}</span>
                          <span style={{ color: "#52525C" }}>
                            {" · "}
                            {cell.skuCount.toLocaleString()}{" "}
                            {cell.skuCount === 1 ? "Product" : "Products"}
                          </span>
                        </span>

                        {!isHealthy && (
                          <div className="flex items-center" style={{ gap: 13 }}>
                            {elev > 0 && (
                              <span
                                className="flex items-center"
                                style={{ gap: 4 }}
                                title={`${elev} elevated`}
                              >
                                <Warning size={12} weight="duotone" color="#FF9900" />
                                <span
                                  className="type-caption font-normal"
                                  style={{ color: "#000000" }}
                                >
                                  {elev}
                                </span>
                              </span>
                            )}
                            {crit > 0 && (
                              <span
                                className="flex items-center"
                                style={{ gap: 4 }}
                                title={`${crit} critical`}
                              >
                                <WarningCircle size={12} weight="duotone" color="#F0000F" />
                                <span
                                  className="type-caption font-normal"
                                  style={{ color: "#000000" }}
                                >
                                  {crit}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full items-center justify-between">
                        <span className="flex items-baseline" style={{ gap: 4 }}>
                          <span
                            className="type-subheading font-semibold"
                            style={{ color: "#18181B" }}
                          >
                            {fillPct != null ? `${fillPct}%` : "—"}
                          </span>
                          <span className="type-caption font-normal" style={{ color: "#52525C" }}>
                            fill rate
                          </span>
                        </span>
                        {cell.dollarsAtRisk > 0 && (
                          <span className="type-caption font-normal" style={{ color: "#52525C" }}>
                            {formatShortDollars(cell.dollarsAtRisk)} at risk
                          </span>
                        )}
                      </div>
                    </button>
                  );

                  return (
                    <div
                      key={classification}
                      style={{ flex: "1 0 0", minWidth: 0, display: "flex" }}
                    >
                      <Tooltip
                        className="block w-full"
                        content={
                          <div style={{ margin: "-8px -18px -7px -16px", padding: 16 }}>
                            <CellTooltip cell={cell} />
                          </div>
                        }
                        side="top"
                      >
                        {cellInner}
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
