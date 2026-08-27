"use client";

import { Export, X } from "@phosphor-icons/react";
import { Select } from "@navanta-ai/design-system";
import { ThumbStack } from "@/components/planning/ThumbStack";
import { HMTX_LINK } from "@/components/planning/ImageSearchModal";

/* ═══════════════════════════════════════════════════════════════
 *  What the photographs matched — HMTX Portal 1682:1335
 *
 *  Sits above the table once a search has run: the reader's own
 *  photographs, what was read from them, and the facets they can
 *  narrow the result with.
 *
 *  The facet values are the catalogue's, not the design's. The
 *  design shows Beige / Brown, Wood-look / Stone-look, 7x7 / 9x9,
 *  which is the HMTX book — Target's home book comes in 16-pc sets
 *  and 30"×54" towels, and its constructions are stoneware and
 *  terry, so the chips read from what this catalogue actually holds.
 *  A filter offering a size nothing is made in is worse than no
 *  filter.
 * ═══════════════════════════════════════════════════════════════ */

/* The sentinel for "no cut on this axis". A Select needs a string value and null
   is not one — kept as a named constant so the mapping in and out of null happens
   in exactly two places. */
const ALL = "__all__";

export interface FacetOption {
  /** `null` is All: no cut on this axis. */
  value: string | null;
  /** A colour to draw beside the name, where the axis has one. */
  swatch?: string;
}

export interface Facet {
  /** Which axis this is — the label before the control. */
  label: string;
  value: string | null;
  options: FacetOption[];
  onChange: (next: string | null) => void;
}

/**
 * A colour family, as a chip.
 *
 * Drawn from an actual colourway in that family rather than a nominal "beige" —
 * the swatch is a promise about what the filter will return, and a swatch mixed
 * by hand would be a different beige from anything in the book.
 *
 * Renders nothing where the axis has no colour, which keeps texture and size
 * aligned with each other instead of indented by a gap they do not fill.
 */
function Swatch({ hex }: { hex?: string }) {
  if (!hex) return null;
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: 12,
        height: 12,
        borderRadius: 3,
        background: hex,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.16)",
      }}
    />
  );
}

export function ImageMatchBar({
  urls,
  /** What the read found, in the reader's words. */
  read,
  facets,
  onReplace,
  onClear,
}: {
  urls: string[];
  read: string;
  facets: Facet[];
  onReplace: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="flex w-full flex-col items-start"
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--ds-border-subtle, #e4e4e7)",
        background: "var(--surface-sunken, #fafafa)",
      }}
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex min-w-0 flex-1 items-start" style={{ gap: 16 }}>
          <ThumbStack urls={urls} />

          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 8 }}>
            <div className="flex w-full items-center justify-between">
              <span style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}>{read}</span>
              {/* The dismiss sits on the text row rather than the card corner,
                  which is where the design puts it — level with the sentence it
                  is dismissing. */}
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear the image search"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center"
                style={{ color: "#52525c" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex w-full flex-wrap items-start" style={{ gap: 12 }}>
              <button
                type="button"
                onClick={onReplace}
                className="inline-flex shrink-0 cursor-pointer items-center"
                style={{ gap: 4, fontSize: 14, lineHeight: "22px", color: HMTX_LINK }}
              >
                <Export size={12} />
                Replace Image
              </button>

              {/* Dropdowns, not chip rows. Chips were the design's shape and they
                  worked while every axis had two short values — construction's
                  real values are "Reactive-glaze stoneware" and "Chunky knit
                  textile", which pushed the row past the card and left Size
                  falling off the right edge. A select also holds the whole list
                  rather than the two that fit, so a reader can reach every
                  construction in the book instead of the two nearest their
                  photograph. */}
              {facets.map((f) => (
                <span key={f.label} className="flex shrink-0 items-center" style={{ gap: 6 }}>
                  <span style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}>
                    {`${f.label}:`}
                  </span>
                  <Select
                    value={f.value ?? ALL}
                    onValueChange={(v: string) => f.onChange(v === ALL ? null : v)}
                  >
                    <Select.Trigger size="sm" aria-label={f.label} className="w-[168px]">
                      <span className="flex min-w-0 items-center" style={{ gap: 7 }}>
                        {/* The chosen swatch on the trigger too, so a reader can
                            see which family is in force without opening the menu. */}
                        <Swatch hex={f.options.find((o) => o.value === f.value)?.swatch} />
                        <Select.Value placeholder="All" />
                      </span>
                    </Select.Trigger>
                    <Select.Content>
                      {f.options.map((opt) => (
                        <Select.Item key={opt.value ?? ALL} value={opt.value ?? ALL}>
                          <span className="flex items-center" style={{ gap: 7 }}>
                            <Swatch hex={opt.swatch} />
                            {opt.value ?? "All"}
                          </span>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
