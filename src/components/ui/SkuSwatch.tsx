import { skuRecord, type ProductForm } from "@/data/catalogue";

/**
 * A product swatch: the item, drawn small, in its variant's colour.
 *
 * A SKU column of numbers over style names is a column of text — nothing in it
 * says whether a row is a terracotta dinner set or a navy bath towel, and those
 * are different products with different problems. A grey box would be honest
 * about the missing photograph and useless for anything else.
 *
 * So it draws the product: the silhouette family comes from the style's `form`
 * and the colour is the catalogue's own — the glaze on a dinner set, the fabric
 * on a towel, the flavour cue on a pouch. There is no photograph here and none
 * is implied — this is a depiction of what the catalogue knows, in the same
 * drawn style as the larger product illustrations.
 */

const NEUTRAL = "#8A857D";
/** The ground and the accents shared across forms. */
const TILE = "#F1EFEB";
const INK = "#3A3A3A";

/** Darken a hex a fixed amount — edges and creases come from the colour itself
 *  rather than from a flat black that fights light variants. */
function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Lighten toward white, for highlights on dark variants. */
function tint(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function Illustration({ form, colour }: { form: ProductForm; colour: string }) {
  const edge = shade(colour, 0.35);
  const hi = tint(colour, 0.3);

  switch (form) {
    case "dinnerware":
      /* A stacked place setting: two plates and a bowl, glaze carrying the colour. */
      return (
        <g>
          <ellipse cx="16" cy="23" rx="11" ry="3.4" fill={colour} stroke={edge} strokeWidth="1" />
          <ellipse cx="16" cy="19.5" rx="9" ry="2.9" fill={hi} stroke={edge} strokeWidth="0.9" />
          <path d="M9.5 15.5a6.5 3 0 0 0 13 0v-3.2a6.5 4.6 0 0 1-13 0Z" fill={colour} stroke={edge} strokeWidth="1" />
          <ellipse cx="16" cy="12.2" rx="6.5" ry="2.4" fill={hi} stroke={edge} strokeWidth="0.9" />
        </g>
      );
    case "blanket":
      /* A folded throw: three folds and a drape. */
      return (
        <g>
          <rect x="6" y="10" width="20" height="5.5" rx="2" fill={hi} stroke={edge} strokeWidth="0.9" />
          <rect x="6" y="15" width="20" height="5.5" rx="2" fill={colour} stroke={edge} strokeWidth="0.9" />
          <rect x="6" y="20" width="20" height="5.5" rx="2" fill={shade(colour, 0.15)} stroke={edge} strokeWidth="0.9" />
          <path d="M8 12.5h16M8 17.5h16M8 22.5h16" stroke={edge} strokeWidth="0.7" opacity="0.4" />
        </g>
      );
    case "board":
      /* A serving board with handle, seen face on. */
      return (
        <g transform="rotate(-18 16 16)">
          <rect x="9" y="5" width="14" height="21" rx="4.5" fill={colour} stroke={edge} strokeWidth="1" />
          <circle cx="16" cy="8.6" r="1.3" fill={TILE} stroke={edge} strokeWidth="0.8" />
          <path d="M11.5 14c3-1.4 6-1.4 9 0M11.5 18c3-1.4 6-1.4 9 0M11.5 22c3-1.4 6-1.4 9 0" stroke={edge} strokeWidth="0.7" opacity="0.5" fill="none" />
        </g>
      );
    case "vase":
      /* A bud vase with two stems. */
      return (
        <g>
          <path d="M13.5 13.5c0-2 1-3 1-4.5h3c0 1.5 1 2.5 1 4.5 1.8 1.6 2.5 3.6 2.5 6 0 4-2.5 6.5-5.5 6.5s-5.5-2.5-5.5-6.5c0-2.4.7-4.4 2.5-6Z" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M15 9c-.4-2.4.6-4 .6-4M17 9c.6-2 2.4-2.8 2.4-2.8" stroke="#6E7F5C" strokeWidth="1" fill="none" strokeLinecap="round" />
          <circle cx="15.4" cy="4.6" r="1.1" fill="#9BAF97" />
          <circle cx="19.8" cy="5.8" r="1.1" fill="#C9A165" />
        </g>
      );
    case "pouch":
      /* A stand-up pouch with a label patch. */
      return (
        <g>
          <path d="M9.5 9h13l1.5 15a3 3 0 0 1-3 3.4h-10a3 3 0 0 1-3-3.4Z" fill={colour} stroke={edge} strokeWidth="1" />
          <rect x="9.5" y="6.5" width="13" height="3.4" rx="1" fill={shade(colour, 0.25)} stroke={edge} strokeWidth="0.8" />
          <rect x="12" y="14" width="8" height="7" rx="1.4" fill={TILE} stroke={edge} strokeWidth="0.7" />
          <path d="M13.5 17h5M13.5 19h3.6" stroke={INK} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "bottle":
      /* A beverage bottle: cap, shoulder, label. */
      return (
        <g>
          <rect x="13.6" y="4.5" width="4.8" height="3" rx="0.8" fill={shade(colour, 0.3)} stroke={edge} strokeWidth="0.8" />
          <path d="M13.6 7.5h4.8c2 2.4 2.9 3.6 2.9 6v10.5a3 3 0 0 1-3 3h-4.6a3 3 0 0 1-3-3V13.5c0-2.4.9-3.6 2.9-6Z" fill={colour} stroke={edge} strokeWidth="1" />
          <rect x="12" y="14.5" width="8" height="7.5" rx="1.2" fill={TILE} stroke={edge} strokeWidth="0.7" />
          <path d="M13.5 17.5h5M13.5 19.5h3.6" stroke={INK} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "towel":
      /* A rolled towel over a folded one. */
      return (
        <g>
          <rect x="6.5" y="16" width="19" height="9" rx="2.4" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M8.5 19h15M8.5 22h15" stroke={edge} strokeWidth="0.7" opacity="0.45" />
          <circle cx="16" cy="11.2" r="5" fill={hi} stroke={edge} strokeWidth="1" />
          <path d="M16 11.2a3 3 0 0 1 3-3" stroke={edge} strokeWidth="0.9" fill="none" />
        </g>
      );
    case "rug":
      /* A bath rug at a slight perspective, pile dots carrying the texture. */
      return (
        <g>
          <path d="M7 11.5h18l2 13.5H5Z" fill={colour} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d="M9.4 14.5h13.2M8.6 18.5h14.8M7.8 22.2h16.4" stroke={hi} strokeWidth="1" opacity="0.5" strokeDasharray="1.6 2.2" />
        </g>
      );
  }
}

export function SkuSwatch({ sku, size = 32 }: { sku: string; size?: number }) {
  const rec = skuRecord(sku);
  const colour = rec?.colourway.hex ?? NEUTRAL;
  const form: ProductForm = rec?.style.form ?? "dinnerware";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={rec ? `${rec.style.name}, ${rec.colourway.name}` : "Product colour unavailable"}
      className="shrink-0"
      style={{ borderRadius: 6, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
    >
      {/* The ground — a light neutral tile, not the product's colour. The item
          is the figure; a coloured ground was the carpet swatch's logic. */}
      <rect width="32" height="32" fill={TILE} />
      <Illustration form={form} colour={colour} />
    </svg>
  );
}
