/**
 * What a company pack tells the shell about itself.
 *
 * Everything the chrome needs to change company without a component edit: the
 * logos, the rail and page colours, the words the scope bar uses for its third
 * cut, and the labels the product record prints for pack-specific fields.
 */
export interface CompanyBrand {
  /** Pack id — the folder under src/companies and the value the launcher sets. */
  id: string;
  /** The client whose supply chain this is. */
  company: string;
  /** Whose product the chrome is. Navanta, unless a client wants their own. */
  product: string;
  industry: string;
  appTitle: string;
  description: string;
  /** Dark cut, for the white top bar. */
  logo: string;
  /** White cut, for the coloured rail's expanded panel. */
  logoWhite: string;
  /** The mark alone, at rail width. */
  mark: string;
  /** Rendered height of the top-bar logo, px. */
  logoHeight: number;
  /** Solid rail colour — badge numerals, the collapse arrow, the rail fallback. */
  navBrand: string;
  /** Rail background-image, or "none" for the solid colour. */
  railGradient: string;
  /** The content ground beneath the work. */
  pageGradient: string;
  /** Words for the scope bar's third cut — country for a global book, state for a domestic one. */
  scope: { placeLabel: string; allPlaces: string };
  /** Label for the product's item code (DPCI, part number), or null when the pack has none. */
  itemCodeLabel: string | null;
  /** How each `construction` value prints. */
  constructionLabels: Record<string, string>;
  /** What the construction axis is called on this book. */
  constructionLabel: string;
}
