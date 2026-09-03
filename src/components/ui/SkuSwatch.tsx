import { skuRecord } from "@/data/catalogue";
import type { ProductForm } from "@/types/product";

/**
 * A product swatch: the item, drawn small, in its variant's colour.
 *
 * A SKU column of numbers over style names is a column of text — nothing in it
 * says whether a row is a terracotta dinner set, a gold chronograph or a navy
 * bath towel, and those are different products with different problems. A grey
 * box would be honest about the missing photograph and useless for anything
 * else.
 *
 * So it draws the product: the silhouette family comes from the style's `form`
 * and the colour is the catalogue's own — the glaze on a dinner set, the case
 * finish on a watch, the fabric on a towel. Forms cover every company pack the
 * portal wears (retail, watches, industrial MRO); a pack picks one per style.
 * There is no photograph here and none is implied — this is a depiction of what
 * the catalogue knows.
 */

const NEUTRAL = "#8A857D";
const TILE = "#F1EFEB";
const INK = "#3A3A3A";
const STEEL = "#B9BDC4";

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
    /* ── retail ─────────────────────────────────────────────────────── */
    case "dinnerware":
      return (
        <g>
          <ellipse cx="16" cy="23" rx="11" ry="3.4" fill={colour} stroke={edge} strokeWidth="1" />
          <ellipse cx="16" cy="19.5" rx="9" ry="2.9" fill={hi} stroke={edge} strokeWidth="0.9" />
          <path d="M9.5 15.5a6.5 3 0 0 0 13 0v-3.2a6.5 4.6 0 0 1-13 0Z" fill={colour} stroke={edge} strokeWidth="1" />
          <ellipse cx="16" cy="12.2" rx="6.5" ry="2.4" fill={hi} stroke={edge} strokeWidth="0.9" />
        </g>
      );
    case "blanket":
      return (
        <g>
          <rect x="6" y="10" width="20" height="5.5" rx="2" fill={hi} stroke={edge} strokeWidth="0.9" />
          <rect x="6" y="15" width="20" height="5.5" rx="2" fill={colour} stroke={edge} strokeWidth="0.9" />
          <rect x="6" y="20" width="20" height="5.5" rx="2" fill={shade(colour, 0.15)} stroke={edge} strokeWidth="0.9" />
          <path d="M8 12.5h16M8 17.5h16M8 22.5h16" stroke={edge} strokeWidth="0.7" opacity="0.4" />
        </g>
      );
    case "board":
      return (
        <g transform="rotate(-18 16 16)">
          <rect x="9" y="5" width="14" height="21" rx="4.5" fill={colour} stroke={edge} strokeWidth="1" />
          <circle cx="16" cy="8.6" r="1.3" fill={TILE} stroke={edge} strokeWidth="0.8" />
          <path d="M11.5 14c3-1.4 6-1.4 9 0M11.5 18c3-1.4 6-1.4 9 0M11.5 22c3-1.4 6-1.4 9 0" stroke={edge} strokeWidth="0.7" opacity="0.5" fill="none" />
        </g>
      );
    case "vase":
      return (
        <g>
          <path d="M13.5 13.5c0-2 1-3 1-4.5h3c0 1.5 1 2.5 1 4.5 1.8 1.6 2.5 3.6 2.5 6 0 4-2.5 6.5-5.5 6.5s-5.5-2.5-5.5-6.5c0-2.4.7-4.4 2.5-6Z" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M15 9c-.4-2.4.6-4 .6-4M17 9c.6-2 2.4-2.8 2.4-2.8" stroke="#6E7F5C" strokeWidth="1" fill="none" strokeLinecap="round" />
          <circle cx="15.4" cy="4.6" r="1.1" fill="#9BAF97" />
          <circle cx="19.8" cy="5.8" r="1.1" fill="#C9A165" />
        </g>
      );
    case "pouch":
      return (
        <g>
          <path d="M9.5 9h13l1.5 15a3 3 0 0 1-3 3.4h-10a3 3 0 0 1-3-3.4Z" fill={colour} stroke={edge} strokeWidth="1" />
          <rect x="9.5" y="6.5" width="13" height="3.4" rx="1" fill={shade(colour, 0.25)} stroke={edge} strokeWidth="0.8" />
          <rect x="12" y="14" width="8" height="7" rx="1.4" fill={TILE} stroke={edge} strokeWidth="0.7" />
          <path d="M13.5 17h5M13.5 19h3.6" stroke={INK} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "bottle":
      return (
        <g>
          <rect x="13.6" y="4.5" width="4.8" height="3" rx="0.8" fill={shade(colour, 0.3)} stroke={edge} strokeWidth="0.8" />
          <path d="M13.6 7.5h4.8c2 2.4 2.9 3.6 2.9 6v10.5a3 3 0 0 1-3 3h-4.6a3 3 0 0 1-3-3V13.5c0-2.4.9-3.6 2.9-6Z" fill={colour} stroke={edge} strokeWidth="1" />
          <rect x="12" y="14.5" width="8" height="7.5" rx="1.2" fill={TILE} stroke={edge} strokeWidth="0.7" />
          <path d="M13.5 17.5h5M13.5 19.5h3.6" stroke={INK} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "towel":
      return (
        <g>
          <rect x="6.5" y="16" width="19" height="9" rx="2.4" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M8.5 19h15M8.5 22h15" stroke={edge} strokeWidth="0.7" opacity="0.45" />
          <circle cx="16" cy="11.2" r="5" fill={hi} stroke={edge} strokeWidth="1" />
          <path d="M16 11.2a3 3 0 0 1 3-3" stroke={edge} strokeWidth="0.9" fill="none" />
        </g>
      );
    case "rug":
      return (
        <g>
          <path d="M7 11.5h18l2 13.5H5Z" fill={colour} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d="M9.4 14.5h13.2M8.6 18.5h14.8M7.8 22.2h16.4" stroke={hi} strokeWidth="1" opacity="0.5" strokeDasharray="1.6 2.2" />
        </g>
      );

    /* ── watches & accessories ──────────────────────────────────────── */
    case "watch":
      /* A case, a dial, a crown, and the band in the variant's finish — hands
         at ten past ten, the way every watch is photographed. */
      return (
        <g>
          <rect x="11" y="1.5" width="10" height="29" rx="3" fill={colour} />
          <path d="M11 6.5h10M11 26h10M13 2.5v27M19 2.5v27" stroke={edge} strokeWidth="1" opacity="0.55" />
          <rect x="24.5" y="14.5" width="2.5" height="3" rx="1" fill={edge} />
          <circle cx="16" cy="16" r="9" fill={colour} stroke={edge} strokeWidth="1" />
          <circle cx="16" cy="16" r="6.5" fill="#F4F2ED" />
          <path d="M16 16L13 12.8" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M16 16l3.8-2.4" stroke={INK} strokeWidth="1" strokeLinecap="round" />
          <circle cx="16" cy="16" r="0.9" fill={INK} />
        </g>
      );

    /* ── industrial / MRO ───────────────────────────────────────────── */
    case "bearing":
      return (
        <g>
          <circle cx="16" cy="16" r="11" fill={colour} stroke={edge} strokeWidth="1" />
          <circle cx="16" cy="16" r="7.5" fill={TILE} stroke={edge} strokeWidth="0.9" />
          <circle cx="16" cy="16" r="4" fill={STEEL} stroke={edge} strokeWidth="0.9" />
          <g fill={hi} stroke={edge} strokeWidth="0.6">
            <circle cx="16" cy="6.8" r="1.4" /><circle cx="25.2" cy="16" r="1.4" /><circle cx="16" cy="25.2" r="1.4" /><circle cx="6.8" cy="16" r="1.4" />
            <circle cx="22.5" cy="9.5" r="1.4" /><circle cx="22.5" cy="22.5" r="1.4" /><circle cx="9.5" cy="22.5" r="1.4" /><circle cx="9.5" cy="9.5" r="1.4" />
          </g>
        </g>
      );
    case "drum":
      return (
        <g>
          <rect x="8" y="5" width="16" height="22" rx="2.5" fill={colour} stroke={edge} strokeWidth="1" />
          <ellipse cx="16" cy="5.5" rx="8" ry="2.2" fill={hi} stroke={edge} strokeWidth="0.9" />
          <path d="M8 11.5h16M8 21h16" stroke={edge} strokeWidth="1.2" opacity="0.6" />
          <rect x="12" y="13.5" width="8" height="5.5" rx="1" fill={TILE} stroke={edge} strokeWidth="0.6" />
        </g>
      );
    case "filter":
      return (
        <g>
          <rect x="9" y="6" width="14" height="20" rx="3" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M11 9.5v13M13.5 9.5v13M16 9.5v13M18.5 9.5v13M21 9.5v13" stroke={hi} strokeWidth="1" opacity="0.7" />
          <rect x="9" y="4" width="14" height="3" rx="1" fill={shade(colour, 0.3)} stroke={edge} strokeWidth="0.8" />
          <rect x="9" y="25" width="14" height="3" rx="1" fill={shade(colour, 0.3)} stroke={edge} strokeWidth="0.8" />
        </g>
      );
    case "carton":
      return (
        <g>
          <path d="M5 11l11-5 11 5v11l-11 5-11-5Z" fill={colour} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d="M5 11l11 5 11-5M16 16v11" stroke={edge} strokeWidth="1" opacity="0.7" fill="none" />
          <path d="M16 16l11-5" stroke={hi} strokeWidth="0.8" opacity="0.6" />
        </g>
      );
    case "tool":
      return (
        <g transform="rotate(35 16 16)">
          <rect x="14" y="8" width="4" height="19" rx="1.6" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M12 4.5h8v4.2l-2 1.8h-4l-2-1.8Z" fill={STEEL} stroke={edge} strokeWidth="0.9" />
          <path d="M15 12h2M15 15h2M15 18h2" stroke={edge} strokeWidth="0.8" opacity="0.6" />
        </g>
      );
    case "gloves":
      return (
        <g>
          <path d="M10 27V15.5c0-1.4 1-2.3 2.2-2.3s2.2.9 2.2 2.3V9.8c0-1.4 1-2.3 2.2-2.3s2.2.9 2.2 2.3v5.7c0-1.4 1-2.3 2.2-2.3s2 .9 2 2.3V27Z" fill={colour} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d="M10 22h13" stroke={edge} strokeWidth="0.8" opacity="0.5" />
          <rect x="9.5" y="24.5" width="14" height="3" rx="1" fill={shade(colour, 0.25)} stroke={edge} strokeWidth="0.7" />
        </g>
      );

    /* ── finished driveline goods ───────────────────────────────────── */
    /* Drawn in side profile, input on the left, because that is how every
       spec sheet and every installation drawing shows a transmission — the
       bellhousing is the end a reader recognises it by. */
    case "transmission":
      return (
        <g>
          {/* Bellhousing — the flange the engine bolts to. */}
          <path
            d="M4 8.5c0-1 .8-1.8 1.8-1.8h4.7v18.6H5.8A1.8 1.8 0 0 1 4 23.5Z"
            fill={shade(colour, 0.28)} stroke={edge} strokeWidth="1" strokeLinejoin="round"
          />
          {/* Main case. */}
          <path
            d="M10.5 8.2h9.2c1 0 1.8.8 1.8 1.8v12c0 1-.8 1.8-1.8 1.8h-9.2Z"
            fill={colour} stroke={edge} strokeWidth="1" strokeLinejoin="round"
          />
          {/* Output shaft. */}
          <rect x="21.4" y="13.5" width="5.2" height="5" rx="1" fill={STEEL} stroke={edge} strokeWidth="0.9" />
          <circle cx="27" cy="16" r="1.5" fill={hi} stroke={edge} strokeWidth="0.7" />
          {/* Sump pan. */}
          <path
            d="M11 23.8h8.4v2.3c0 .6-.4 1-1 1h-6.4c-.6 0-1-.4-1-1Z"
            fill={shade(colour, 0.38)} stroke={edge} strokeWidth="0.9" strokeLinejoin="round"
          />
          {/* Case ribs and the bellhousing bolt line. */}
          <path d="M10.5 8.2v16.6" stroke={edge} strokeWidth="0.8" opacity="0.6" />
          <path d="M13.5 11.4v9M16.2 11.4v9M18.9 11.4v9" stroke={hi} strokeWidth="0.9" opacity="0.55" />
          <circle cx="7.2" cy="10.6" r="0.8" fill={TILE} stroke={edge} strokeWidth="0.5" />
          <circle cx="7.2" cy="21.4" r="0.8" fill={TILE} stroke={edge} strokeWidth="0.5" />
        </g>
      );
    /* An eGen Power axle is symmetrical about the motor, which is the whole
       visual difference from the case above — a reader tells the electric
       book from the automatic book at thumbnail size without reading a word. */
    case "e-axle":
      return (
        <g>
          <rect x="3" y="14.6" width="26" height="2.8" rx="1.4" fill={STEEL} stroke={edge} strokeWidth="0.8" />
          {/* Motor housing. */}
          <rect x="11" y="9" width="10" height="14" rx="2.2" fill={colour} stroke={edge} strokeWidth="1" />
          <path d="M13.4 11.6v8.8M16 11.6v8.8M18.6 11.6v8.8" stroke={hi} strokeWidth="0.9" opacity="0.6" />
          {/* Wheel ends. */}
          <rect x="2.6" y="11" width="3.6" height="10" rx="1.2" fill={shade(colour, 0.32)} stroke={edge} strokeWidth="0.9" />
          <rect x="25.8" y="11" width="3.6" height="10" rx="1.2" fill={shade(colour, 0.32)} stroke={edge} strokeWidth="0.9" />
          <circle cx="4.4" cy="16" r="1.1" fill={TILE} stroke={edge} strokeWidth="0.6" />
          <circle cx="27.6" cy="16" r="1.1" fill={TILE} stroke={edge} strokeWidth="0.6" />
        </g>
      );
  }
}

export function SkuSwatch({ sku, size = 32 }: { sku: string; size?: number }) {
  const rec = skuRecord(sku);
  const colour = rec?.colourway.hex ?? NEUTRAL;
  const form: ProductForm = rec?.style.form ?? "carton";

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
