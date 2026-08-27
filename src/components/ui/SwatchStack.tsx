"use client";

import { skuRecord, type Colourway, type ProductStyle } from "@/data/catalogue";
import { SkuSwatch } from "@/components/ui/SkuSwatch";

/**
 * A style's colourways, overlapped, with the count on the end.
 *
 * The catalogue was one row per colourway, which meant the Stoneware Dinnerware
 * Set printed its style, brand, construction, size and backing eight times — five
 * columns of the same five answers, and the one thing that actually differs between
 * those rows, the colour, reduced to a 32px chip.
 *
 * A style is one row now and this is the column that carries the difference.
 * Overlapped rather than laid out in a line because a line of eight chips
 * is a second table; the stack says "this many, and here is what they look
 * like" in the width of five.
 */
export function SwatchStack({
  style,
  order,
  max = 3,
  size = 26,
}: {
  style: ProductStyle;
  /** Draw these instead of the book's own order — used to lead with a match. */
  order?: Colourway[];
  /** How many to draw before the counter takes over. */
  max?: number;
  size?: number;
}) {
  const all = order ?? style.colourways;
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  return (
    <span className="flex items-center" title={`${all.length} colourways`}>
      {shown.map((c, i) => {
        const sku = `${style.style}-${c.number}`;
        return (
          <span
            key={c.number}
            /* Overlapped by a third, and each one lifted above the last so the
               stack reads left-to-right rather than as a pile. */
            style={{
              marginLeft: i === 0 ? 0 : -Math.round(size / 3),
              zIndex: i,
              /* A ring in the surface colour, so an overlap reads as two chips
                 rather than one shape with a seam. */
              boxShadow: "0 0 0 1.5px var(--surface-base)",
              borderRadius: 5,
              lineHeight: 0,
            }}
            title={skuRecord(sku) ? `${c.name} · ${c.number}` : c.name}
          >
            <SkuSwatch sku={sku} size={size} />
          </span>
        );
      })}
      {rest > 0 && (
        <span
          className="flex shrink-0 items-center justify-center font-medium"
          style={{
            marginLeft: -Math.round(size / 3),
            zIndex: shown.length,
            width: size,
            height: size,
            borderRadius: 5,
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: "var(--ds-text-secondary)",
            background: "var(--surface-sunken, #F4F4F5)",
            boxShadow: "0 0 0 1.5px var(--surface-base)",
          }}
        >
          {`+${rest}`}
        </span>
      )}
    </span>
  );
}
