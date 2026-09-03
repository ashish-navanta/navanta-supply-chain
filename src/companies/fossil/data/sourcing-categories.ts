/**
 * The buyer's sourcing taxonomy.
 *
 * Sourcing decisions are made at L2 (the sub-category); L1 is the spend family
 * they roll up to.
 *
 * The important structural fact sits in the first family: Fossil buys the
 * FINISHED, cased, packaged watch, not the parts of one. The assembler buys the
 * movement — bought complete, never made — and the case and bracelet, which are
 * the largest cost block at 35–50% of BOM. So the component lines below are
 * marked as what they are: somebody else's purchase, visible to Fossil as a
 * cost driver inside a FOB price rather than as a line Fossil places.
 *
 * That is why only $15.6M of $151.8M inventory is components and parts, and why
 * the 10-K ties that component system to after-sales service rather than to
 * production.
 */
export interface SourcingCategory {
  id: string;
  /** L1 spend family. */
  l1: string;
  /** L2 sub-category — the decision level. */
  l2: string;
  /** The lever(s) the category defaults to. */
  defaultLever: string;
  /**
   * True where Fossil is not the buyer of record — the assembler buys it and
   * Fossil sees it as a cost driver inside a FOB price. Naming this is the
   * difference between a leverage story and a wish.
   */
  viaAssembler?: boolean;
}

export const SOURCING_CATEGORIES: SourcingCategory[] = [
  /* What Fossil actually places POs for. */
  { id: "CAT-01", l1: "Finished goods (FOB)", l2: "Watches — cased & packaged", defaultLever: "Dual-source · RFP" },
  { id: "CAT-02", l1: "Finished goods (FOB)", l2: "Leather goods", defaultLever: "Consolidate · Country of origin" },
  { id: "CAT-03", l1: "Finished goods (FOB)", l2: "Jewelry", defaultLever: "RFP" },

  /* Bought by the assembler, not by Fossil — see `viaAssembler`. */
  { id: "CAT-04", l1: "Components (via assembler)", l2: "Movements", defaultLever: "Qualify second source", viaAssembler: true },
  { id: "CAT-05", l1: "Components (via assembler)", l2: "Cases & bracelets", defaultLever: "Index / hedge · RFP", viaAssembler: true },
  { id: "CAT-06", l1: "Components (via assembler)", l2: "Dials, hands & crystals", defaultLever: "Consolidate", viaAssembler: true },
  { id: "CAT-07", l1: "Components (via assembler)", l2: "Straps & batteries", defaultLever: "Country of origin", viaAssembler: true },

  /* Roughly 37 of the ~91 Tier 1 factories make only this. */
  { id: "CAT-08", l1: "Fixtures & packaging", l2: "Store display units", defaultLever: "Consolidate" },
  { id: "CAT-09", l1: "Fixtures & packaging", l2: "Tins & gift boxes", defaultLever: "RFP" },
  { id: "CAT-10", l1: "Fixtures & packaging", l2: "Printing & collateral", defaultLever: "Consolidate" },

  /* The service tail the 11-year warranty funds. */
  { id: "CAT-11", l1: "Service parts", l2: "Movements, hands & dials", defaultLever: "Hold to warranty tail" },
];

/** The distinct L1 families, in order. */
export const SOURCING_L1 = [...new Set(SOURCING_CATEGORIES.map((c) => c.l1))];

/** The L2 sub-categories under one L1. */
export function l2Under(l1: string): SourcingCategory[] {
  return SOURCING_CATEGORIES.filter((c) => c.l1 === l1);
}

/**
 * The regions the sourcing book buys from, in the order they matter.
 *
 * Read off the published Tier 1 list rather than invented: 61 of ~91 factories
 * are in China, including 29 of the 32 that make watches; 11 entries are in
 * India, which holds the only owned plant; the leather-goods footprint runs
 * across Cambodia, Bangladesh, Myanmar, the Philippines and Guatemala.
 *
 * "Multi-region" is not offered as a choice — it is what a play IS, not a place
 * to look, and it passes every region filter for that reason.
 */
export const SOURCING_REGIONS = ["China", "India", "Southeast Asia", "Other"] as const;
