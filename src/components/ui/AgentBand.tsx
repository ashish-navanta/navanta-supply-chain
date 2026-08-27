"use client";

import { Check, PencilSimple } from "@phosphor-icons/react";
import { AiStar, Button } from "@navanta-ai/design-system";

/**
 * The agent's read and its recommended action, in one band.
 *
 * Ported from Figma `2087:3248` (W&B Shareable): a lavender panel holding what
 * the agent found, written as prose, over a gradient footer carrying the one
 * move it recommends, the confidence behind it, and the buttons that take or
 * change it.
 *
 * The prose is the point. An earlier version split the same content into an
 * alert, a row of option cards and a bulleted list of checks — three surfaces
 * saying one thing, which read as three systems talking about the same line. A
 * paragraph is what a colleague would actually send you, and the footer is the
 * only part that needs to look like a control.
 *
 * Confidence is stated rather than implied. Without it the reader treats every
 * figure as equally firm, and they are not.
 */

export function AgentBand({
  agent,
  summary,
  meta,
  confidencePct,
  actionLine,
  confirmLabel,
  onConfirm,
  override,
  secondary,
}: {
  agent: string;
  /** What the agent found — one paragraph, in its own voice. */
  summary: string;
  /**
   * The date the whole thing turns on, under the paragraph.
   *
   * It sat above the band as a bare "Revised: 2 Sep" line, which read as a
   * caption on the stepper rather than as part of the argument — and the
   * argument is entirely about that date having moved.
   */
  meta?: React.ReactNode;
  confidencePct?: number;
  /** The move, named — "Commit 40 days". */
  actionLine: string;
  confirmLabel: string;
  onConfirm: () => void;
  /**
   * Take a different figure than the agent's.
   *
   * Open, it replaces the whole footer: an override form sitting under a live
   * "Commit 40 days" gives the reader two ways to commit two different numbers
   * at the same time.
   */
  override?: { label: string; open: boolean; onOpen: () => void; panel: React.ReactNode };
  /** Anything else the row offers — a watchlist, a hand-off to another desk. */
  secondary?: React.ReactNode;
}) {
  return (
    <div
      className="flex w-full flex-col items-start overflow-hidden rounded-[12px]"
      style={{ background: "#F5EFFF" }}
    >
      <div className="flex w-full shrink-0 flex-col items-start gap-2 p-3">
        <span className="flex shrink-0 items-center gap-2">
          <AiStar size={16} variant="small" />
          <span
            className="whitespace-nowrap font-medium"
            style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
          >
            {`${agent} Summary`}
          </span>
        </span>
        <p className="w-full px-1" style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}>
          {summary}
        </p>
        {meta && <div className="w-full px-1">{meta}</div>}
      </div>

      {override?.open ? (
        <div className="w-full" style={{ background: "var(--surface-base)" }}>
          {override.panel}
        </div>
      ) : (
        <div
          className="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 p-3"
          style={{ background: "linear-gradient(90deg, #F3ECFE 0%, #EBDFFF 72.227%)" }}
        >
          <span className="flex shrink-0 flex-col items-start justify-center">
            <span style={{ fontSize: 12, lineHeight: "18px", color: "#59349C" }}>
              {confidencePct !== undefined
                ? `Recommended action · Confidence ${confidencePct}%`
                : "Recommended action"}
            </span>
            <span
              className="font-medium"
              style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
            >
              {actionLine}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            {override && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-[var(--surface-base)]"
                iconLeft={<PencilSimple size={14} weight="bold" />}
                onClick={override.onOpen}
              >
                {override.label}
              </Button>
            )}
            {secondary}
            <Button
              variant="christy"
              size="sm"
              className="h-8"
              iconLeft={<Check size={14} weight="bold" />}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}
