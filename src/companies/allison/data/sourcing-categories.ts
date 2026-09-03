/**
 * The buyer's sourcing taxonomy.
 *
 * Sourcing decisions are made at L2 (the sub-category); L1 is the spend family
 * they roll up to.
 *
 * The important structural fact sits in the last family: Allison buys the
 * distributor's PART, not the OEM's design. On a sole-source spare the machine
 * tool OEM — Fanuc, Makino — owns the drawing, engineering owns the approval,
 * and procurement sees the line as a cost inside a service contract rather than
 * as a line it can lever. So the spec-locked lines below are marked as what
 * they are: carved out of addressable spend, visible to the buyer as a cost
 * driver rather than as a play.
 *
 * That is why only $11.9M of $34.1M Industrial Supplies spend is addressable,
 * and why the engine routes on winner share — 50% or more to one vendor
 * consolidates to the incumbent, less goes to competitive RFP — only after the
 * carve-out is done.
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
   * True where procurement is not the decision-maker of record — the OEM owns
   * the spec, engineering owns the deviation, and the buyer sees it as a cost
   * inside a service contract. Naming this is the difference between an
   * addressable-spend story and a wish.
   */
  viaAssembler?: boolean;
}

export const SOURCING_CATEGORIES: SourcingCategory[] = [
  /* What indirect procurement actually levers. */
  { id: "CAT-01", l1: "MRO", l2: "Machine & equipment repairs", defaultLever: "Consolidate to incumbent" },
  { id: "CAT-02", l1: "MRO", l2: "Bearings & power transmission", defaultLever: "Competitive RFP · Cross-reference" },
  { id: "CAT-03", l1: "MRO", l2: "Filters", defaultLever: "Consolidate" },
  { id: "CAT-04", l1: "MRO", l2: "Electrical & electronics", defaultLever: "Consolidate · Distributor pass-through" },
  { id: "CAT-05", l1: "MRO", l2: "Chemicals & coolants", defaultLever: "Qualify second source · RFP" },

  /* The 1,093-vendor tail the onsite crib exists to absorb. */
  { id: "CAT-06", l1: "Industrial supplies", l2: "Safety & PPE", defaultLever: "Integrated supply · Vending" },
  { id: "CAT-07", l1: "Industrial supplies", l2: "Spill control & absorbents", defaultLever: "Integrated supply" },
  { id: "CAT-08", l1: "Industrial supplies", l2: "Fasteners & hardware", defaultLever: "Integrated supply · Consolidate" },

  /* Engineering-adjacent, competitive where a cross-reference is qualified. */
  { id: "CAT-09", l1: "Cutting tools", l2: "Solid carbide rounds", defaultLever: "Competitive RFP · Cross-reference" },
  { id: "CAT-10", l1: "Cutting tools", l2: "Inserts & holders", defaultLever: "Consolidate" },

  /* Spec-locked to the OEM, not to procurement — see `viaAssembler`. */
  { id: "CAT-11", l1: "OEM sole-source spares", l2: "Controls, drives & spindles", defaultLever: "Hold to OEM service contract", viaAssembler: true },
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
 * Read off the vendor master rather than invented: the AT book is Midwest —
 * Cline and Fastenal in Indianapolis, Kirby Risk in Lafayette, Fuchs in
 * Harvey, IL, McBroom Electric down the road; the Szentgotthárd OEM spares
 * come from Germany and Italy; the Chennai book runs on India and China
 * distributors with the machine-tool OEMs in Japan.
 *
 * "Multi-region" is not offered as a choice — it is what a play IS, not a place
 * to look, and it passes every region filter for that reason.
 */
export const SOURCING_REGIONS = ["Midwest US", "Europe", "Asia", "Other"] as const;
