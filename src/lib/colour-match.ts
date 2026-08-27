"use client";

import { CATALOGUE, type Colourway, type ProductStyle } from "@/data/catalogue";

/* ═══════════════════════════════════════════════════════════════
 *  Matching a photograph to the book
 *
 *  An account rings with an existing room and asks what is closest to
 *  it. Today that is a person holding a colour card up to a phone
 *  screen. The catalogue already carries every colourway's colour, so
 *  the match is arithmetic rather than a guess — and this does the
 *  arithmetic rather than pretending to.
 *
 *  Nothing is uploaded. The image is drawn to a canvas in the browser,
 *  sampled, and thrown away; what leaves this function is one hex
 *  value. A photograph of somebody's building is not ours to keep.
 * ═══════════════════════════════════════════════════════════════ */

/** sRGB → CIE L*a*b*, so "close" means close to an eye rather than close in bytes. */
function toLab(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  /* D65 */
  const [r, g, b] = srgb;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * How far apart two colours look, 0 = identical.
 *
 * Plain ΔE76 in Lab. Not ΔE2000 — the extra precision decides between two
 * near-identical greys, and this list has to rank a few dozen colourways a person
 * will then look at with their own eyes.
 */
export function distance(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

/** ΔE as a percentage a reader can act on. 0 → 100%, ~40 and up → nothing. */
export function matchPct(delta: number): number {
  return Math.max(0, Math.round(100 - (delta / 45) * 100));
}

/**
 * The dominant colour of an image file.
 *
 * Not the average — averaging a photograph of a throw with a wall and
 * a shadow in it returns a colour that is in none of them. Pixels are bucketed
 * into a coarse RGB grid and the most populous bucket wins, which is what a
 * person means by "the colour of that blanket".
 *
 * Near-white and near-black are dropped first: a photograph taken indoors is
 * mostly blown-out window and shadow, and neither is the item.
 */
export async function dominantColour(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  /* 64px is plenty — this is looking for a bulk colour, not an edge. */
  const side = 64;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#8A857D";
  ctx.drawImage(bitmap, 0, 0, side, side);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, side, side);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 240 || lum < 18) continue;
    /* 24 levels per channel: coarse enough to group a pile's variation, fine
       enough to keep two greys apart. */
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += r;
    cur.g += g;
    cur.b += b;
    buckets.set(key, cur);
  }

  let best = { n: 0, r: 138, g: 133, b: 125 };
  for (const b of buckets.values()) if (b.n > best.n) best = b;
  const hex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v / Math.max(1, best.n))))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}

/**
 * The colour a set of photographs agrees on.
 *
 * Somebody photographing a room takes three or four frames — one by the window,
 * one in shadow, one at an angle — and each samples to a different hex. Using the
 * first is arbitrary; averaging them lands between the readings and can produce a
 * colour that is in none of the photographs, which is the same mistake averaging
 * a single image makes (see `dominantColour`).
 *
 * So the winner is the reading closest to all the others: the medoid. It is an
 * actual sample from an actual photograph, and it is the one the outliers agree
 * with most.
 */
export function consensusColour(hexes: string[]): string {
  if (hexes.length === 0) return "#8A857D";
  if (hexes.length === 1) return hexes[0];
  let best = hexes[0];
  let bestTotal = Number.POSITIVE_INFINITY;
  for (const a of hexes) {
    const total = hexes.reduce((sum, b) => sum + distance(a, b), 0);
    if (total < bestTotal) {
      bestTotal = total;
      best = a;
    }
  }
  return best;
}

/**
 * The colour family a hex falls in, in the words a account uses on the phone.
 *
 * Cut on hue and chroma in Lab rather than on RGB thresholds, because "is this
 * beige or grey" is a question about how far the colour sits from neutral, and in
 * RGB that answer changes with brightness. A home-goods book lives in a narrow
 * band — warm neutrals, cool neutrals and a few accents — so the families are
 * few and named for that band rather than for a colour wheel.
 */
export function colourFamily(hex: string): string {
  const [l, a, b] = toLab(hex);
  const chroma = Math.sqrt(a * a + b * b);
  /* Near-neutral first. Most of a home-goods book sits here, and asking
     "what hue is it" of a colour with almost no chroma returns noise. */
  if (chroma < 6) return l < 35 ? "Charcoal" : l < 70 ? "Grey" : "Off-white";
  /* Normalised to 0–360. The first version cut on the raw atan2 range, which runs
     −180 to 180 — so every blue, which sits near −110°, fell through every branch
     to the last one and a third of the colourways came back "Plum". */
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (hue < 45) return l < 45 ? "Brown" : "Terracotta";
  if (hue < 100) return l < 45 ? "Brown" : "Beige";
  if (hue < 190) return "Green";
  if (hue < 300) return "Blue";
  return "Plum";
}

export interface StyleMatch {
  style: ProductStyle;
  /** The colourway of this style that comes closest. */
  closest: Colourway;
  delta: number;
}

/** Every style, ranked by its own closest colourway. */
export function rankStyles(target: string): StyleMatch[] {
  return CATALOGUE.map((style) => {
    let closest = style.colourways[0];
    let delta = Number.POSITIVE_INFINITY;
    for (const c of style.colourways) {
      const d = distance(target, c.hex);
      if (d < delta) {
        delta = d;
        closest = c;
      }
    }
    return { style, closest, delta };
  }).sort((a, b) => a.delta - b.delta);
}

/** A style's colourways, closest first — so the stack leads with the match. */
export function rankColourways(style: ProductStyle, target: string): Colourway[] {
  return [...style.colourways].sort(
    (a, b) => distance(target, a.hex) - distance(target, b.hex),
  );
}
