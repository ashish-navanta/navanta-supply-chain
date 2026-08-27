/**
 * The buyer's sourcing taxonomy.
 *
 * Sourcing decisions are made at L2 (the sub-category); L1 is the spend family
 * they roll up to.
 *
 * The important structural fact sits in the input family: Target buys the
 * FINISHED, packaged item, not the inputs to one. The factory buys the clay
 * body and the glaze — and the mill buys the yarn — which together are the
 * largest cost block at 35–50% of the FOB price. So the input lines below are
 * marked as what they are: somebody else's purchase, visible to Target as a
 * cost driver inside a FOB price rather than as a line Target places.
 *
 * That is why only $15.6M of $151.8M inventory is consigned packaging and
 * direct-bought inputs, and why that stock ties to the Good & Gather freshness
 * promise rather than to production.
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
   * True where Target is not the buyer of record — the supplier buys it and
   * Target sees it as a cost driver inside a FOB price. Naming this is the
   * difference between a leverage story and a wish.
   */
  viaAssembler?: boolean;
}

export const SOURCING_CATEGORIES: SourcingCategory[] = [
  /* What Target actually places POs for. */
  { id: "CAT-01", l1: "Home & kitchen (FOB)", l2: "Stoneware & ceramics", defaultLever: "Dual-source · RFP" },
  { id: "CAT-02", l1: "Home & kitchen (FOB)", l2: "Wood & serveware", defaultLever: "Consolidate · Country of origin" },
  { id: "CAT-03", l1: "Textiles & softlines (FOB)", l2: "Bath — towels & rugs", defaultLever: "Country of origin" },
  { id: "CAT-04", l1: "Grocery co-manufacture", l2: "Dry grocery — bake & pack", defaultLever: "Qualify second source" },
  { id: "CAT-05", l1: "Grocery co-manufacture", l2: "Beverage — cold fill", defaultLever: "Hold to dedicated lines" },

  /* Bought by the supplier, not by Target — see `viaAssembler`. */
  { id: "CAT-06", l1: "Inputs (via supplier)", l2: "Clay bodies & glazes", defaultLever: "Index / hedge · RFP", viaAssembler: true },
  { id: "CAT-07", l1: "Inputs (via supplier)", l2: "Yarn & greige fabric", defaultLever: "Country of origin", viaAssembler: true },
  { id: "CAT-08", l1: "Inputs (via supplier)", l2: "Hardware & timber", defaultLever: "Consolidate", viaAssembler: true },

  /* Roughly 37 of the ~91 loaded Tier 1 suppliers make only this. */
  { id: "CAT-09", l1: "Fixtures & packaging", l2: "Store display units", defaultLever: "Consolidate" },
  { id: "CAT-10", l1: "Fixtures & packaging", l2: "Gift boxes & cartons", defaultLever: "RFP" },

  /* The one input bought DIRECTLY — the consigned film the freshness promise funds. */
  { id: "CAT-11", l1: "Fixtures & packaging", l2: "Film & pouches — direct buy", defaultLever: "Hold to consignment plan" },
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
 * Read off the loaded Tier 1 book rather than invented: the hardgoods anchor
 * and most of the fixtures tail sit in South China (Dongguan and Zhongshan,
 * consolidating at Yantian); the Section 301 diversification lane for textiles
 * runs out of Vietnam (Ho Chi Minh City, loading at Cai Mep); the grocery
 * co-manufacture book is US Midwest (River Falls, Cedar Rapids, Appleton);
 * softlines and the rest of the tail run wider.
 *
 * "Multi-region" is not offered as a choice — it is what a play IS, not a place
 * to look, and it passes every region filter for that reason.
 */
export const SOURCING_REGIONS = ["South China", "Vietnam", "US Midwest", "Other"] as const;
