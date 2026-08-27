"use client";

import { useState, type ReactNode } from "react";
import { AiStar, Button } from "@navanta-ai/design-system";
import { CaretDown, NotePencil, type Icon } from "@phosphor-icons/react";

/**
 * The agent's summary card — a measured port of the Allison procurement review
 * deck's `MercerSummaryCard`, itself the IRIS DemandDeck SummaryCard chrome.
 *
 * Every number here is the reference's, not an approximation of it: the card is
 * flat `#F5EFFF` at a 12px radius, its body is `gap-2 p-3`, and the tiles are
 * white at an 8px radius with a **1px #E3D2FF** border — a lavender hairline,
 * not the neutral one a generic card would take. An earlier version of this
 * screen reused the app's own summary component and eyeballed the rest, which
 * is why it read as "close to" the reference rather than as it.
 *
 * The card carries no narrative paragraph. That is deliberate in the original:
 * the reasoning hides behind a "Why? · N signals" toggle beside the title, so
 * the default state is four figures and a decision rather than four figures and
 * an essay. The paragraph was the largest thing on my earlier version and the
 * first thing a reader had to scroll past.
 */

/* ─── Metrics row ────────────────────────────────────────────────────────────
 * White tiles with a 1px lavender border inside the summary card.
 *   Label — 12/18 regular · Value — 14/22 medium
 * ─────────────────────────────────────────────────────────────────────────── */

export interface SummaryTile {
  label: string;
  value: string;
  /** Top-right affordance on the tile — an "Override" link. */
  action?: ReactNode;
  /** Hover text, so a derived figure can always be justified. */
  hint?: string;
}

function SummaryMetricsRow({ tiles }: { tiles: SummaryTile[] }) {
  return (
    <div className="mt-2 flex w-full flex-wrap gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          title={t.hint}
          className="flex min-w-[104px] flex-1 flex-col gap-1 rounded-[8px] p-2"
          style={{ background: "#fff", border: "1px solid #E3D2FF" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="whitespace-nowrap text-[12px] leading-[18px]"
              style={{ color: "#1E1E1E" }}
            >
              {t.label}
            </span>
            {t.action}
          </div>
          <span
            className="whitespace-nowrap text-[14px] font-medium leading-[22px]"
            style={{ color: "#181A1B", fontVariantNumeric: "tabular-nums" }}
          >
            {t.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The small purple text+icon affordance used inside the summary. */
export function SummaryLink({
  label,
  icon: LinkIcon,
  onClick,
}: {
  label: string;
  icon: Icon;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 text-[12px] font-medium"
      style={{ color: "#59349C" }}
    >
      {label}
      <LinkIcon size={13} weight="bold" />
    </button>
  );
}

/**
 * The summary's footer band — the gradient strip carrying "Add more context".
 *
 * Flush to the card's edges, which is what makes it read as the card's own base
 * rather than as a panel dropped inside it.
 */
export function AddContextBand({
  onAddContext,
  contextOpen = false,
  children,
}: {
  onAddContext?: () => void;
  contextOpen?: boolean;
  /** Anything the caller wants beside the button — a confidence line. */
  children?: ReactNode;
}) {
  return (
    <div
      className="flex w-full items-center justify-start gap-3 p-3"
      style={{ background: "linear-gradient(to right, #EBDFFF 72%, #F3ECFE 100%)" }}
    >
      {onAddContext && (
        <Button
          variant="outline"
          size="sm"
          iconLeft={<NotePencil size={14} />}
          onClick={onAddContext}
        >
          {contextOpen ? "Hide context" : "Add more context"}
        </Button>
      )}
      {children}
    </div>
  );
}

export function MercerSummaryCard({
  agent,
  tiles,
  rationale,
  band,
}: {
  agent: string;
  tiles: SummaryTile[];
  /** The agent's reasoning, revealed by the header's "Why?" toggle. */
  rationale?: string[];
  /** The swappable footer — omit to end the card after the tiles. */
  band?: ReactNode;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const hasWhy = Boolean(rationale && rationale.length);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-[12px]"
      style={{ background: "#F5EFFF" }}
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AiStar size={16} variant="small" />
            <span className="text-[14px] font-medium" style={{ color: "#181A1B" }}>
              {`${agent} Summary`}
            </span>
            {hasWhy && (
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                aria-expanded={whyOpen}
                className="flex items-center gap-1 text-[12px] font-medium"
                style={{ color: "#59349C" }}
              >
                <CaretDown
                  size={12}
                  weight="bold"
                  style={{
                    transform: whyOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
                {whyOpen ? "Hide reasoning" : `Why? · ${rationale!.length} signals`}
              </button>
            )}
          </div>
        </div>

        {hasWhy && whyOpen && (
          <ul className="flex flex-col gap-1 pl-4">
            {rationale!.map((bullet) => (
              <li
                key={bullet}
                className="list-disc text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {bullet}
              </li>
            ))}
          </ul>
        )}

        <SummaryMetricsRow tiles={tiles} />
      </div>

      {band}
    </div>
  );
}
