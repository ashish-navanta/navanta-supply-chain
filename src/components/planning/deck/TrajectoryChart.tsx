"use client";

import { useMemo, useState } from "react";
import { TrendUp } from "@phosphor-icons/react";
import { Select } from "@navanta-ai/design-system";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import { TODAY, datePlus } from "@/data/action-center";
import { segmentPolicy, type Exception } from "@/data/planning";

/* ═══════════════════════════════════════════════════════════════
 *  Inventory trajectory — ported from the IRIS demand deck
 *
 *  Twelve weeks of actual demand and eight of forecast as bars, with
 *  projected on-hand drawn over them against three thresholds:
 *  Order-Up-To, the reorder point, and safety stock. Same layout,
 *  same palette, same series selector.
 *
 *  What differs is the data, and it differs by being real. IRIS's deck
 *  carries only the three refs, so its bars and its projected line are
 *  illustrative shapes derived from them. Target's row carries the run
 *  rate, the lead time, what is on hand and what is on order — so the
 *  bars are that run rate and the projected line is the actual burn,
 *  with the recommended quantity landing on the day the lead time is
 *  up.
 *
 *  And the clock is the fixtures' TODAY, not the system's. IRIS reads
 *  `new Date()`; this book is walked through more than once and every
 *  date in it has to be the same on the second pass.
 * ═══════════════════════════════════════════════════════════════ */

const ACTUAL_WEEKS = 12;
const FORECAST_WEEKS = 8;

type SeriesKey = "actual" | "forecast" | "projected" | "orderUpTo" | "rop" | "ss";

/* The Figma "christy" palette, which maps 1:1 onto the iris tokens. */
const COLORS: Record<SeriesKey, string> = {
  actual: "var(--color-iris-700)",
  forecast: "var(--color-iris-300)",
  projected: "#E8833A",
  orderUpTo: "var(--color-iris-500)",
  rop: "var(--color-destructive-500)",
  ss: "var(--color-warning-500)",
};

const LEGEND: { key: SeriesKey; label: string; shape: "bar" | "line" }[] = [
  { key: "actual", label: "Actual demand", shape: "bar" },
  { key: "forecast", label: "Forecast demand", shape: "bar" },
  { key: "projected", label: "Projected inventory", shape: "line" },
  { key: "orderUpTo", label: "Order-Up-To", shape: "line" },
  { key: "rop", label: "ROP", shape: "line" },
  { key: "ss", label: "Safety Stock", shape: "line" },
];

/** Deterministic wobble around the run rate, so a week is not the mean exactly. */
function weekly(sku: string, week: number, mean: number, cv2: number): number {
  let h = 2166136261;
  const seed = `${sku}|w${week}`;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 1000) / 1000;
  /* Spread with the position's own variability — an X line barely moves, a Z
     line is lumpy, which is what CV² measures. */
  const spread = Math.min(0.9, cv2 * 0.6);
  return Math.max(0, Math.round(mean * 7 * (1 + (unit - 0.5) * 2 * spread)));
}

/* The reference numbers, in the y-axis gutter and colour-matched. Nudged apart
   where two thresholds sit within a label height of each other. */
function RefNumbersLayer({ items }: { items: { value: number; color: string }[] }) {
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!yScale || !plot || items.length === 0) return null;
  const x = plot.x - 6;
  const placed = items
    .map((it) => ({ ...it, y: Number(yScale(it.value)) }))
    .sort((a, b) => a.y - b.y);
  const GAP = 13;
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].y < placed[i - 1].y + GAP) placed[i].y = placed[i - 1].y + GAP;
  }
  return (
    <g>
      {placed.map((it) => (
        <text
          key={`${it.value}-${it.color}`}
          x={x}
          y={it.y + 4}
          textAnchor="end"
          fontSize={11}
          fontWeight={600}
          fill={it.color}
        >
          {it.value}
        </text>
      ))}
    </g>
  );
}

/* "Actuals (12 wk)" / "Forecast (8 wk)", above the plot's top gridline. */
function RegionLabel(props: {
  viewBox?: { x: number; y: number; width: number };
  value?: string;
  align?: "start" | "middle";
}) {
  const { viewBox, value, align = "start" } = props;
  if (!viewBox) return null;
  const x = align === "start" ? viewBox.x + 2 : viewBox.x + viewBox.width / 2;
  return (
    <text x={x} y={viewBox.y - 22} textAnchor={align} fontSize={12} fill="var(--text-secondary)">
      {value}
    </text>
  );
}

/* The pill atop the vertical "now" divider. */
function NowPill(props: { viewBox?: { x: number; y: number }; value?: string }) {
  const { viewBox, value } = props;
  if (!viewBox) return null;
  const w = 82;
  return (
    <g transform={`translate(${viewBox.x}, ${viewBox.y - 26})`}>
      <line
        x1={0}
        x2={0}
        y1={10}
        y2={26}
        stroke="var(--ds-border-default)"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <rect
        x={-w / 2}
        y={-10}
        width={w}
        height={20}
        rx={10}
        fill="#FFFFFF"
        stroke="var(--ds-border-default)"
      />
      <text x={0} y={4} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
        {value}
      </text>
    </g>
  );
}

function SeriesSwatch({ item }: { item: { key: SeriesKey; shape: "bar" | "line" } }) {
  return item.shape === "bar" ? (
    <span style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[item.key] }} />
  ) : (
    <span style={{ width: 12, height: 2, background: COLORS[item.key] }} />
  );
}

function CursorLine(props: { points?: { x: number; y: number }[] }) {
  const { points } = props;
  if (!points || points.length < 1) return null;
  const x = points[0].x;
  return (
    <line
      x1={x}
      x2={x}
      y1={points[0].y}
      y2={points[1]?.y ?? points[0].y}
      stroke="var(--ds-border-default)"
      strokeDasharray="4 4"
      strokeWidth={1}
    />
  );
}

function ChartTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: { dataKey?: string; value?: number | null }[];
}) {
  const { active, label, payload } = props;
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && p.value !== 0);
  if (!rows.length) return null;
  return (
    <div
      style={{
        background: "#18181B",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "var(--shadow-menu)",
      }}
    >
      <div style={{ color: "#A1A1AA", fontSize: 12, marginBottom: 4 }}>{`Wk of ${label}`}</div>
      {rows.map((r) => {
        const meta = LEGEND.find((l) => l.key === r.dataKey);
        return (
          <div key={r.dataKey} className="flex items-center" style={{ gap: 6, marginTop: 2 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: COLORS[r.dataKey as SeriesKey],
              }}
            />
            <span style={{ color: "#FFFFFF", fontSize: 12 }}>
              {`${meta?.label ?? r.dataKey}: ${r.value}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param compact The agent panel's version.
 *
 * The full chart is built for the deck's 971px card: a series selector, a
 * six-item legend, twelve weeks of bars and twenty x-axis ticks. In the panel's
 * ~380px it collapses — the legend wraps to three rows, the tick labels print on
 * top of each other and the selector is squeezed to nothing.
 *
 * So the panel gets the part that answers its question. The transcript has just
 * said what was approved; the chart is there to show the line recovering, which
 * is the projected inventory against the thresholds it has to clear. The demand
 * bars, the selector and the region captions are context for deciding, and the
 * deciding already happened.
 */
export function TrajectoryChart({
  row,
  compact = false,
  bare = false,
}: {
  row: Exception;
  compact?: boolean;
  /** No frame — the panel is a tab inside a card that has one. */
  bare?: boolean;
}) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    actual: true,
    forecast: true,
    projected: true,
    orderUpTo: true,
    rop: true,
    ss: true,
  });
  const visibleKeys = LEGEND.filter((l) => visible[l.key]).map((l) => l.key);
  const setVisibleKeys = (keys: string[]) =>
    setVisible(
      LEGEND.reduce(
        (acc, l) => ({ ...acc, [l.key]: keys.includes(l.key) }),
        {} as Record<SeriesKey, boolean>,
      ),
    );

  const { data, refs, nowLabel, actualEnd, forecastStart, maxY } = useMemo(() => {
    /* The three thresholds, properly derived rather than passed in.
       ROP is lead-time demand plus the buffer — which is what this app calls
       target stock. Order-Up-To adds one review cycle of demand on top, because
       a periodic policy orders up to a level that has to survive until the next
       review. Safety stock is the floor. */
    const ss = row.safetyStock;
    const rop = Math.round(row.demandMean * row.leadTimeDays + ss);
    const orderUpTo = Math.round(rop + row.demandMean * segmentPolicy(row.classification).reviewDays);

    const total = ACTUAL_WEEKS + FORECAST_WEEKS;
    const leadWeek = ACTUAL_WEEKS + Math.round(row.leadTimeDays / 7);

    /* On hand walks forward from today at the run rate, and receives what is on
       order plus what is being approved on the week the lead time is up.
       A plain loop, not `Array.from` with a running accumulator: the compiler
       rejects reassigning a variable from inside a callback that outlives the
       render, and it is right to — the state belongs to this walk, not to the
       closure. */
    const rows: {
      label: string;
      actual: number | null;
      forecast: number | null;
      projected: number | null;
    }[] = [];
    let stock = row.onHand;
    for (let i = 0; i < total; i++) {
      const demand = weekly(row.sku, i, row.demandMean, row.cv2);
      const isForecast = i >= ACTUAL_WEEKS;

      let projected: number | null = null;
      if (i >= ACTUAL_WEEKS - 1) {
        if (i > ACTUAL_WEEKS - 1) {
          stock = Math.max(0, stock - demand);
          if (i === leadWeek) stock += row.incoming + row.requestedQty;
        }
        projected = Math.round(stock);
      }

      rows.push({
        label: datePlus((i - ACTUAL_WEEKS) * 7),
        actual: isForecast ? null : demand,
        forecast: isForecast ? demand : null,
        projected,
      });
    }

    const projMax = Math.max(...rows.map((r) => r.projected ?? 0));
    const step = Math.max(5, Math.ceil(Math.max(orderUpTo, projMax) / 40) * 5);
    const maxY = Math.ceil(Math.max(orderUpTo, projMax) / step) * step + step;

    return {
      data: rows,
      refs: { ss, rop, orderUpTo, step },
      nowLabel: rows[ACTUAL_WEEKS].label,
      actualEnd: rows[ACTUAL_WEEKS - 1].label,
      forecastStart: rows[ACTUAL_WEEKS].label,
      maxY,
    };
  }, [row]);

  /* Standard ticks, minus any a visible reference number would print on top of —
     the coloured figure takes that slot in the gutter instead. */
  const refTickValues = [
    visible.orderUpTo && refs.orderUpTo,
    visible.rop && refs.rop,
    visible.ss && refs.ss,
  ].filter((v): v is number => typeof v === "number");
  /* How close a standard tick may sit to a reference number before it is
     dropped. Wider in the panel, where the plot is shorter and two labels a few
     pixels apart print on top of each other — 563 and 525 were doing exactly
     that. */
  const collide = maxY / (compact ? 9 : 18);
  const yTicks = Array.from({ length: Math.floor(maxY / refs.step) + 1 }, (_, i) => i * refs.step)
    .filter((t) => !refTickValues.some((rv) => Math.abs(rv - t) < collide));

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[12px]"
      style={{
        background: "#FFFFFF",
        border: bare ? undefined : "1px solid var(--ds-border-subtle)",
        /* A gutter even when bare.
           The evidence tabs drop their own so the calculation's total row can
           reach the card's edges — that row is a filled block and looks wrong
           floating 12px inside one. A chart is the opposite: its axis labels
           and its last plotted point are ink, and ink pressed against the card
           edge reads as clipped. The date row along the base is the same
           argument: it sat on the card's bottom edge with nothing under it. So
           the trajectory brings a gutter back on three sides, and the
           calculation beside it keeps none. */
        padding: bare ? "4px 12px 12px" : compact ? "10px 12px 12px" : "0 12px 12px",
        gap: compact ? 8 : 16,
      }}
    >
      {!compact && (
      <div className="flex items-center justify-between" style={{ gap: 8, padding: "12px 0" }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <TrendUp size={16} weight="regular" color="#181A1B" />
          <span className="type-body-medium" style={{ color: "#181A1B" }}>
            Demand, forecast &amp; projected inventory
          </span>
        </div>
        <div style={{ width: 150 }}>
          <Select multiple value={visibleKeys} onValueChange={setVisibleKeys}>
            <Select.Trigger size="sm">
              <span className="inline-flex items-center gap-1.5">
                {visibleKeys.length === 0
                  ? "No series shown"
                  : visibleKeys.length === LEGEND.length
                    ? "All series"
                    : `${visibleKeys.length} of ${LEGEND.length} series`}
              </span>
            </Select.Trigger>
            <Select.Content>
              {LEGEND.map((item) => (
                <Select.Item key={item.key} value={item.key}>
                  <span className="flex items-center" style={{ gap: 8 }}>
                    <SeriesSwatch item={item} />
                    {item.label}
                  </span>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>
      )}

      {/* The compact key names only what it draws. */}
      <div
        className="flex flex-wrap items-center"
        style={{ gap: compact ? 12 : 16, justifyContent: compact ? "flex-start" : "flex-end" }}
      >
        {LEGEND.filter((item) => visible[item.key] && (!compact || item.shape === "line")).map((item) => (
          <span key={item.key} className="flex items-center" style={{ gap: 6 }}>
            <SeriesSwatch item={item} />
            <span
              className="type-caption whitespace-nowrap font-normal"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.label}
            </span>
          </span>
        ))}
      </div>

      {/* 168 squeezed the plot into a band — the line had nowhere to fall and
          the axis labels crowded the reference numbers. */}
      <div style={{ width: "100%", height: compact ? 232 : 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={compact ? { top: 12, right: 4, bottom: 0, left: 0 } : { top: 44, right: 4, bottom: 4, left: 4 }}
          >
            <ReferenceArea
              x1={forecastStart}
              x2={data[data.length - 1].label}
              fill="var(--color-iris-50)"
              fillOpacity={0.6}
              ifOverflow="extendDomain"
              label={compact ? undefined : <RegionLabel value={`Forecast (${FORECAST_WEEKS} wk)`} align="middle" />}
            />
            <ReferenceArea
              x1={data[0].label}
              x2={actualEnd}
              fill="transparent"
              label={compact ? undefined : <RegionLabel value={`Actuals (${ACTUAL_WEEKS} wk)`} align="start" />}
            />

            <CartesianGrid vertical={false} stroke="var(--ds-border-subtle)" />
            <XAxis
              dataKey="label"
              interval={compact ? 6 : 1}
              tickLine={false}
              axisLine={{ stroke: "var(--ds-border-default)" }}
              tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              tickMargin={8}
            />
            <YAxis
              domain={[0, maxY]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              width={compact ? 30 : 36}
              tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            />

            <Tooltip
              cursor={<CursorLine />}
              content={<ChartTooltip />}
              wrapperStyle={{ outline: "none" }}
            />

            {visible.orderUpTo && (
              <ReferenceLine y={refs.orderUpTo} stroke={COLORS.orderUpTo} strokeDasharray="4 4" />
            )}
            {visible.rop && <ReferenceLine y={refs.rop} stroke={COLORS.rop} strokeDasharray="4 4" />}
            {visible.ss && <ReferenceLine y={refs.ss} stroke={COLORS.ss} strokeDasharray="4 4" />}
            <RefNumbersLayer
              items={[
                visible.orderUpTo && { value: refs.orderUpTo, color: COLORS.orderUpTo },
                visible.rop && { value: refs.rop, color: COLORS.rop },
                visible.ss && { value: refs.ss, color: COLORS.ss },
              ].filter((x): x is { value: number; color: string } => Boolean(x))}
            />

            <ReferenceLine
              x={nowLabel}
              stroke="var(--ds-border-default)"
              strokeDasharray="4 4"
              label={compact ? undefined : <NowPill value={`Now · ${TODAY}`} />}
            />

            {/* One stack, so each week's bar sits at the band centre and lines up
                with the cursor and the "now" divider. */}
            {visible.actual && !compact && (
              <Bar
                dataKey="actual"
                stackId="demand"
                fill={COLORS.actual}
                barSize={12}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            )}
            {visible.forecast && !compact && (
              <Bar
                dataKey="forecast"
                stackId="demand"
                fill={COLORS.forecast}
                barSize={12}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            )}

            {visible.projected && (
              <Line
                type="linear"
                dataKey="projected"
                stroke={COLORS.projected}
                strokeWidth={2}
                dot={{ r: 3, stroke: COLORS.projected, strokeWidth: 1.5, fill: "#FFFFFF" }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
