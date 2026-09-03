/* ═══════════════════════════════════════════════════════════════
 *  The catalogue as a CSV
 *
 *  One row per SKU, every field the catalogue holds. Generated from
 *  `CATALOGUE` rather than maintained beside it, because a second copy
 *  of a product book is a second thing to get wrong.
 *
 *  Pack-agnostic: the fixed columns are the fields every company's
 *  book carries, and the spec groups are flattened into one column per
 *  distinct field label across the book — so a watch book exports its
 *  gauge and a retail book its case pack from the same function.
 *
 *  Used twice: the download on the catalogue page builds it in the
 *  browser, and `npm run catalogue:csv` writes the same bytes to
 *  `public/product-catalogue.csv`.
 * ═══════════════════════════════════════════════════════════════ */

import { CATALOGUE } from "./catalogue";
import { BRAND } from "./brand";

/**
 * One field, escaped.
 *
 * Many values contain a comma (certifications, placements) and sizes carry
 * inch marks — the double quote CSV uses for quoting. Unescaped, one such
 * field would end the quoted run early and shift every column after it by
 * one, which is the classic way a product export arrives in a spreadsheet
 * looking almost right.
 */
function cell(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole book, one row per SKU. */
export function catalogueCsv(): string {
  /* Every spec label in the book, in first-seen order — the dynamic columns. */
  const specLabels: string[] = [];
  for (const style of CATALOGUE) {
    for (const g of style.spec.groups) {
      for (const f of g.fields) if (!specLabels.includes(f.label)) specLabels.push(f.label);
    }
  }

  const headers = [
    "SKU",
    "Style number",
    "Style",
    ...(BRAND.itemCodeLabel ? [BRAND.itemCodeLabel] : []),
    "Brand",
    BRAND.constructionLabel,
    "Size",
    "Supplier",
    "Supplier location",
    "Production lead time (days)",
    "Variant number",
    "Variant",
    "Colour hex",
    "Form",
    "Material",
    "Receives as",
    ...specLabels,
  ];

  const rows = CATALOGUE.flatMap((style) => {
    const spec = new Map<string, string>();
    for (const g of style.spec.groups) for (const f of g.fields) spec.set(f.label, f.value);
    return style.colourways.map((c) =>
      [
        `${style.style}-${c.number}`,
        style.style,
        style.name,
        ...(BRAND.itemCodeLabel ? [style.itemCode ?? ""] : []),
        style.brand,
        BRAND.constructionLabels[style.construction] ?? style.construction,
        style.size,
        style.plant.id,
        style.plant.location,
        style.plant.leadDays,
        c.number,
        c.name,
        c.hex,
        style.spec.construction,
        style.fibre,
        style.backing,
        ...specLabels.map((l) => spec.get(l) ?? ""),
      ]
        .map(cell)
        .join(","),
    );
  });
  /* CRLF and a trailing newline: RFC 4180, and it is what stops Excel treating
     the last row as a fragment. */
  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}
