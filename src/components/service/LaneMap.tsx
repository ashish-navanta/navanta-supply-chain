"use client";

import { MapPin } from "@phosphor-icons/react";
import { STAGE_LABEL, type OrderStage, type ServiceOrder } from "@/data/service";

/**
 * Where the load actually is, drawn on its lane.
 *
 * A schematic, not a map, and deliberately: the fixture knows an origin DC, a
 * destination city and a stage — it does not know a GPS trace, and a real map
 * tile would imply a precision behind the dot that does not exist. What a CSR
 * needs when a account rings is the shape of the answer — how far along, how much
 * is left — which a line between two named points gives exactly.
 *
 * Geometry rather than an asset, so it needs no key and no network: the page is
 * self-contained, and a tile that fails to load is worse than no map at all.
 *
 * The labels sit BELOW the drawing in ordinary flow, not overlaid on it. An
 * earlier version pulled them up with negative margins to hug the route, which
 * held at 720px and collapsed into itself in the 4-column rail this actually
 * lives in.
 */

/** How far along the lane each stage sits, 0–1. */
const PROGRESS: Record<OrderStage, number> = {
  placed: 0.04,
  "in-process": 0.18,
  "in-transit": 0.62,
  delivered: 1,
};

const W = 320;
const H = 64;

export function LaneMap({ order }: { order: ServiceOrder }) {
  const [origin, destination] = order.lane.split("→").map((s) => s.trim());
  const at = PROGRESS[order.stage];
  const moving = order.stage === "in-transit";
  const arrived = order.stage === "delivered";
  const tone = arrived ? "#0D9467" : "#2b58a1";

  const x0 = 14;
  const x1 = W - 14;
  const y = 46;
  const lift = 26;
  const path = `M ${x0} ${y} Q ${(x0 + x1) / 2} ${y - lift} ${x1} ${y}`;

  /* The point at `t` on that quadratic — where the truck sits. */
  const mx = (x0 + x1) / 2;
  const my = y - lift;
  const tx = (1 - at) ** 2 * x0 + 2 * (1 - at) * at * mx + at ** 2 * x1;
  const ty = (1 - at) ** 2 * y + 2 * (1 - at) * at * my + at ** 2 * y;

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-[8px]"
      style={{ background: "#F8FAFC", border: "1px solid var(--ds-border-subtle)" }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${order.id} — ${STAGE_LABEL[order.stage]} on ${order.lane}`}
      >
        {/* The whole lane, then the part already run. `pathLength={1}` lets the
            dash carry the progress without splitting the curve. */}
        <path d={path} fill="none" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" />
        <path
          d={path}
          fill="none"
          stroke={tone}
          strokeWidth={2.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${at} 1`}
        />

        <circle cx={x0} cy={y} r={5} fill="#0D9467" />
        <circle
          cx={x1}
          cy={y}
          r={5}
          fill={arrived ? "#0D9467" : "#FFFFFF"}
          stroke="#CBD5E1"
          strokeWidth={1.5}
        />

        {/* The load. A filled marker with a white ring so it stays legible over
            the route it sits on. */}
        <g className={moving ? "lane-truck" : undefined}>
          <circle cx={tx} cy={ty} r={7} fill="#FFFFFF" />
          <circle cx={tx} cy={ty} r={5.5} fill={tone} />
        </g>
      </svg>

      <div
        className="flex items-start justify-between gap-2 px-3 pb-2.5"
        style={{ borderTop: "1px solid var(--ds-border-subtle)", paddingTop: 8 }}
      >
        <span className="flex min-w-0 flex-col" style={{ maxWidth: "42%" }}>
          <span className="flex items-center gap-1">
            <MapPin size={11} weight="fill" className="shrink-0" style={{ color: "#0D9467" }} />
            <span
              className="truncate"
              style={{ fontSize: 11, fontWeight: 500, color: "var(--ds-text-primary)" }}
            >
              {origin}
            </span>
          </span>
          <span style={{ fontSize: 11, color: "#71767A" }}>{`Left ${order.orderedOn}`}</span>
        </span>

        <span
          className="shrink-0 whitespace-nowrap rounded-[4px] px-1.5"
          style={{ fontSize: 11, fontWeight: 500, color: tone, background: "#FFFFFF" }}
        >
          {STAGE_LABEL[order.stage]}
        </span>

        <span className="flex min-w-0 flex-col items-end" style={{ maxWidth: "42%" }}>
          <span className="flex items-center gap-1">
            <MapPin
              size={11}
              weight="fill"
              className="shrink-0"
              style={{ color: arrived ? "#0D9467" : "#94A3B8" }}
            />
            <span
              className="truncate"
              style={{ fontSize: 11, fontWeight: 500, color: "var(--ds-text-primary)" }}
            >
              {destination}
            </span>
          </span>
          <span style={{ fontSize: 11, color: "#71767A" }}>
            {arrived
              ? `Delivered ${order.deliveredOn ?? order.currentEta}`
              : `Due ${order.currentEta}`}
          </span>
        </span>
      </div>
    </div>
  );
}
