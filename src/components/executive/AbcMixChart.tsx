"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AbcSlice } from "@/data/executive";
import { ABC_ROW_META } from "@/data/planning";

/* ═══════════════════════════════════════════════════════════════
 *  Inventory against turnover, by class
 *
 *  Two series, grouped rather than stacked. Stacking would add a
 *  share of inventory to a share of demand and draw a total that
 *  means nothing — these are two measurements of the same class,
 *  and the gap between them is the entire reading.
 *
 *  A class holding more of the stock than of the demand is capital
 *  standing still. The reverse is a class being run thin. Equal
 *  bars are the healthy case, and this book is close to it, which
 *  is worth being able to see rather than something to hide.
 *
 *  Recharts rather than the DS BarChart, which takes one series.
 * ═══════════════════════════════════════════════════════════════ */

/* Literal hex, not var(--color-iris-600).
   `fill` on an SVG shape is a presentation attribute, and presentation attributes
   do not resolve custom properties — only CSS does. The variables were resolving
   perfectly at the document root while the bars drew invisible, with the correct
   geometry and an unusable fill. These are the iris ramp's own values, kept in
   step with it by name. */
const INVENTORY = "#6a3ebd"; // --color-iris-600
const TURNOVER = "#c8abff"; // --color-iris-300

/**
 * The band each class covers, short enough to sit under a bar group.
 *
 * `ABC_ROW_META` carries these as "Top 80% Revenue" / "Next 15% Revenue" /
 * "Bottom 5% Revenue", verbatim from IRIS, and the noun is dropped here rather
 * than reproduced: the legend directly above already names what is being
 * measured, and this chart measures turnover at cost, so printing "Revenue"
 * under the bars would contradict the key two lines up. "Tail" rather than
 * "Bottom" for C, which is what the shape of the curve is called.
 */
const BAND: Record<string, string> = {
  A: "Top 80%",
  B: "Next 15%",
  C: "Tail 5%",
};

interface Row {
  name: string;
  sub: string;
  inventory: number;
  turnover: number;
  gap: number;
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div
      className="rounded-[8px] px-3 py-2"
      style={{
        background: "var(--surface-base)",
        border: "1px solid var(--ds-border-default)",
        boxShadow: "0 4px 12px rgba(10,24,48,0.12)",
        fontSize: 12,
      }}
    >
      <p style={{ fontWeight: 600, color: "var(--ds-text-primary)" }}>{`Class ${r.name}`}</p>
      <p style={{ color: "var(--ds-text-secondary)" }}>{r.sub}</p>
      <p style={{ color: "var(--ds-text-primary)", marginTop: 4 }}>
        {`Inventory ${r.inventory.toFixed(1)}% · turnover ${r.turnover.toFixed(1)}%`}
      </p>
      <p style={{ color: "var(--ds-text-secondary)" }}>
        {/* The reading, spelled out — a reader should not have to subtract two
            bars by eye to find out which way a class is leaning. */}
        {Math.abs(r.gap) < 0.5
          ? "In balance — stock tracks demand"
          : r.gap > 0
            ? `Holding ${r.gap.toFixed(1)} points more stock than demand`
            : `Running ${Math.abs(r.gap).toFixed(1)} points thinner than demand`}
      </p>
    </div>
  );
}

/** The class letter over the band it covers. */
function ClassTick(props: unknown) {
  const { x, y, payload } = props as { x?: number; y?: number; payload?: { value?: string } };
  const cls = payload?.value ?? "";
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        textAnchor="middle"
        dy={14}
        style={{ fontSize: 12, fontWeight: 600, fill: "#3f3f46" }}
      >
        {cls}
      </text>
      <text textAnchor="middle" dy={29} style={{ fontSize: 11, fill: "#71717a" }}>
        {BAND[cls] ?? ""}
      </text>
    </g>
  );
}

export function AbcMixChart({ slices, height = 232 }: { slices: AbcSlice[]; height?: number }) {
  const data: Row[] = slices.map((s) => ({
    name: s.abc,
    sub: `${s.skus} positions · ${ABC_ROW_META[s.abc].sub}`,
    inventory: Number((s.inventoryShare * 100).toFixed(1)),
    turnover: Number((s.turnoverShare * 100).toFixed(1)),
    gap: Number((s.inventoryShare * 100 - s.turnoverShare * 100).toFixed(1)),
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barGap={4}>
          {/* A hatch on the second series, so the pair is separable without
              colour. The two bars are one ramp two steps apart — legible to most
              readers and not to anyone with a blue-purple deficiency, and
              unreadable in a printed or photocopied deck, which is where a
              workshop handout ends up. Texture carries the same distinction that
              the dash carries on a line chart, and the legend draws it too. */}
          <defs>
            <pattern
              id="abc-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={TURNOVER} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2.4" opacity="0.85" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--ds-border-subtle)" />
          {/* Two lines: the class, then the band it covers. A bare "A" tells a
              reader nothing about why those bars are the tall ones — the band is
              the definition, and putting it on the axis means the chart explains
              its own classification instead of needing a caption. */}
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: "var(--ds-border-default)" }}
            height={40}
            interval={0}
            tick={ClassTick as never}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--ds-text-secondary)" }}
            tickFormatter={(v: number) => `${v}%`}
            /* Fixed to 100, so the eye compares classes against the whole book
               rather than against whichever class happens to be tallest. */
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--surface-hover)" }} />
          <Bar dataKey="inventory" name="Inventory $" fill={INVENTORY} radius={[3, 3, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.name} fill={INVENTORY} />
            ))}
            <LabelList
              dataKey="inventory"
              position="top"
              formatter={(v: unknown) => `${v}%`}
              style={{ fontSize: 11, fill: "var(--ds-text-secondary)" }}
            />
          </Bar>
          <Bar dataKey="turnover" name="Turnover" fill="url(#abc-hatch)" radius={[3, 3, 0, 0]} maxBarSize={44}>
            <LabelList
              dataKey="turnover"
              position="top"
              formatter={(v: unknown) => `${v}%`}
              style={{ fontSize: 11, fill: "var(--ds-text-secondary)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The key, as text beside the chart rather than a floating recharts legend. */
export function AbcMixLegend() {
  return (
    <span className="flex items-center" style={{ gap: 14, fontSize: 12 }}>
      {[
        { label: "Share of inventory $", colour: INVENTORY, hatched: false },
        { label: "Share of turnover", colour: TURNOVER, hatched: true },
      ].map((k) => (
        <span key={k.label} className="flex items-center" style={{ gap: 6 }}>
          {/* The swatch carries the texture as well as the colour, because the
              texture is doing half the encoding on the chart. */}
          <svg width="10" height="10" aria-hidden style={{ flexShrink: 0 }}>
            <rect width="10" height="10" rx="2" fill={k.colour} />
            {k.hatched && (
              <>
                <line x1="-2" y1="4" x2="4" y2="-2" stroke="#fff" strokeWidth="2.2" />
                <line x1="2" y1="12" x2="12" y2="2" stroke="#fff" strokeWidth="2.2" />
              </>
            )}
          </svg>
          <span style={{ color: "var(--ds-text-secondary)" }}>{k.label}</span>
        </span>
      ))}
    </span>
  );
}
