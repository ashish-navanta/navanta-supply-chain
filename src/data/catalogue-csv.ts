/* ═══════════════════════════════════════════════════════════════
 *  The catalogue as a CSV
 *
 *  One row per SKU, every field the catalogue holds. Generated from
 *  `CATALOGUE` rather than maintained beside it, because a second copy
 *  of a product book is a second thing to get wrong — and the whole
 *  point of the catalogue was to stop the same fact living in two
 *  places.
 *
 *  Used twice: the download on the catalogue page builds it in the
 *  browser, and `npm run catalogue:csv` writes the same bytes to
 *  `public/product-catalogue.csv` for anybody who wants the file
 *  without opening the app.
 * ═══════════════════════════════════════════════════════════════ */

import { CATALOGUE, palletQuantity } from "@/data/catalogue";

/**
 * One field, escaped.
 *
 * Half of these values contain a comma (the certifications, the merchandising
 * placements) and the size contains inch marks — 50 × 60 in — while material
 * lines carry the double quote CSV uses for quoting. Unescaped, one such field
 * would end the quoted run early and shift every column after it by one, which
 * is the classic way a product export arrives in a spreadsheet looking almost
 * right.
 */
function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "SKU",
  "Style number",
  "Style",
  "DPCI",
  "Brand",
  "Sourcing lane",
  "Size",
  "Supplier",
  "Supplier location",
  "Production lead time (days)",
  "Variant number",
  "Variant",
  "Colour hex",
  "Form",
  "Material",
  "Contents",
  "Case packaging",
  "Receives as",
  "Case pack (units)",
  "Unit weight (lb)",
  "Case cube (ft3)",
  "Pallet Ti (cases/layer)",
  "Pallet Hi (layers)",
  "Units per pallet",
  "Origin",
  "Shelf life",
  "Hazmat",
  "Regulatory",
  "Warranty",
  "Certifications",
  "Merchandising",
] as const;

/** The whole book, one row per SKU. */
export function catalogueCsv(): string {
  const rows = CATALOGUE.flatMap((style) =>
    style.colourways.map((c) =>
      [
        `${style.style}-${c.number}`,
        style.style,
        style.name,
        style.dpci,
        style.brand,
        style.construction === "import" ? "Import" : "Domestic",
        style.size,
        style.plant.id,
        style.plant.location,
        style.plant.leadDays,
        c.number,
        c.name,
        c.hex,
        style.spec.construction,
        style.spec.material,
        style.fibre,
        style.spec.packaging,
        style.backing,
        style.spec.casePack,
        style.spec.unitWeight.toFixed(1),
        style.spec.caseCube.toFixed(1),
        style.spec.palletTi,
        style.spec.palletHi,
        palletQuantity(style.spec),
        style.spec.origin,
        style.spec.shelfLife,
        style.spec.hazmat,
        style.spec.compliance,
        style.spec.warranty,
        style.spec.certifications.join("; "),
        style.spec.merchandising.join("; "),
      ]
        .map(cell)
        .join(","),
    ),
  );
  /* CRLF and a trailing newline: RFC 4180, and it is what stops Excel treating
     the last row as a fragment. */
  return [HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
}
