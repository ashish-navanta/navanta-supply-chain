"use client";

import Link from "next/link";
import { ArrowSquareOut, Factory, Package, Warning } from "@phosphor-icons/react";
import { Pill } from "@navanta-ai/design-system";
import type { TrackedState } from "@/data/po-state";

/**
 * Where a line has actually got to — Figma Customer Ops, node 632:13417.
 *
 * Ported rather than copied. The design's stepper nodes and connectors come
 * back from Figma as exported SVG circles and hairlines; those are geometry
 * rather than iconography, so they are drawn in CSS here and stay crisp at any
 * width. The four real glyphs — package, truck, warning, external link — are
 * Phosphor, which is what the rest of this app already uses and what the design
 * itself is drawn from.
 *
 * The card is deliberately narrow. It lives in the 380px agent panel, which is
 * the context the design was made for — the "Not this order?" line under it in
 * Figma only makes sense when an agent has just put it in front of you.
 */

/** Figma: Sementic/Success, Icon/Active, Border/Strong. */
const DONE = "#0D9467";
const ACTIVE = "#2B58A1";
const PENDING = "#D4D6D8";

/**
 * The track alone — no stage names.
 *
 * They were tried and taken out: the status pill above already says where the
 * order is in words ("Unacknowledged", "Date moved"), so labelling the dots
 * said it twice and turned a glanceable position into a line to read. The names
 * survive on each dot's `aria-label`, which is where a screen reader needs them
 * and where sighted readers were not looking.
 */
function Stepper({ stages }: { stages: TrackedState["stages"] }) {
  return (
    <div className="flex w-full items-center" role="list" aria-label="Order progress">
      {stages.map((s, i) => {
        const colour = s.state === "done" ? DONE : s.state === "active" ? ACTIVE : PENDING;
        /* A connector belongs to the node on its right: it is only complete once
           that node has been reached, which is what makes the run of green stop
           exactly at the current stage. */
        const nextReached = i < stages.length - 1 && stages[i + 1].state !== "pending";
        return (
          <div key={s.label} className="flex min-w-0 flex-1 items-center last:flex-none">
            <span
              role="listitem"
              aria-label={`${s.label} — ${s.state === "done" ? "complete" : s.state === "active" ? "in progress" : "not started"}`}
              className="block shrink-0 rounded-full"
              style={{
                width: 12,
                height: 12,
                /* Pending reads as an outline, not a filled grey dot — the
                   design's last node is hollow because nothing has happened
                   there yet. */
                background: s.state === "pending" ? "transparent" : colour,
                border: `1.5px solid ${colour}`,
              }}
            />
            {i < stages.length - 1 && (
              <span
                aria-hidden="true"
                className="block min-w-px flex-1"
                style={{ height: 2, background: nextReached ? DONE : PENDING }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface PoStateCardProps {
  state: TrackedState;
  /** Where the full record lives. Renders the header bar when set. */
  href?: string;
  /**
   * The state just changed under the reader.
   *
   * One card that updates is right, but it means the change can happen while
   * the eye is further down reading the outcome. A brief ring says "this moved"
   * without adding a second card to compare against.
   */
  changed?: boolean;
}

/**
 * No action pair, deliberately.
 *
 * The design carries two buttons, and this card had them while the queue's own
 * control was a mute star that named nothing — the card was where the move got
 * named and agreed. Now the row button reads "Commit 42 days", so the decision
 * is taken before the panel opens and repeating it here would tell the person
 * their press did nothing.
 */
export function PoStateCard({ state, href, changed }: PoStateCardProps) {
  return (
    <div
      /* `shrink-0` is load-bearing: the transcript is a column flex container,
         so without it this card shrinks to fit and `overflow-hidden` quietly
         crops everything below the header — stepper, exception and all. */
      className={`flex w-full shrink-0 flex-col overflow-hidden rounded-[12px]${changed ? " po-card-changed" : ""}`}
      style={{ background: "var(--surface-base)", border: "1px solid #E4E5E7", boxShadow: "0 0.5px 2px rgba(0,0,0,0.15)" }}
    >
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 px-4 py-2"
          style={{ background: "#F5F5F5", borderBottom: "1px solid #E4E5E7", color: "#1D4A86" }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>View the record</span>
          <ArrowSquareOut size={14} />
        </Link>
      )}

      <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1">
            <Package size={14} weight="duotone" style={{ color: "#18181B" }} />
            <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#18181B" }}>
              {state.ref}
            </span>
          </span>
          {/* DS Pill rather than the design's hand-rolled chip: every other
              status in this app is one, and a bespoke grey capsule here would be
              the only chip in the product that is not. */}
          <Pill variant={state.etaLate ? "warning" : "neutral"} size="sm">
            {state.status}
          </Pill>
        </div>

        <Stepper stages={state.stages} />

        <div className="flex min-w-0 items-center gap-1" style={{ fontSize: 14, color: "#71767A" }}>
          <Factory size={14} weight="duotone" className="shrink-0" />
          <span className="truncate" style={{ fontWeight: 500 }}>
            {state.by}
          </span>
          {state.byRef && (
            <>
              <span aria-hidden="true" className="shrink-0 rounded-full" style={{ width: 4, height: 4, background: "#71767A" }} />
              <span className="truncate" style={{ fontWeight: 500 }}>
                {state.byRef}
              </span>
            </>
          )}
        </div>

        {state.alert && (
          <div className="flex items-start gap-2 rounded-lg p-2" style={{ background: "#FEF7EC" }}>
            <Warning size={14} weight="duotone" className="mt-0.5 shrink-0" style={{ color: "#C64A0B" }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: "#C64A0B" }}>{state.alert}</p>
          </div>
        )}

        <div className="flex items-start justify-between gap-3" style={{ fontSize: 14 }}>
          <span className="flex min-w-0 gap-1" style={{ color: "#18181B" }}>
            <span>{`${state.etaLabel}:`}</span>
            <span style={{ color: state.etaLate ? "#C64A0B" : "#18181B" }}>
              {state.eta}
              {state.etaLate ? " (moved)" : ""}
            </span>
          </span>
          <span className="shrink-0 text-right" style={{ fontWeight: 600, color: "#18181B" }}>
            {state.value}
          </span>
        </div>

        <p style={{ fontSize: 14, fontWeight: 500, color: "#71767A" }}>{state.contents}</p>

      </div>
    </div>
  );
}
