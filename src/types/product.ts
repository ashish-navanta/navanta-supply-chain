/**
 * The product contract every company pack conforms to.
 *
 * The screens draw a product record generically: a thumbnail family, an item
 * code, and a spec laid out as titled groups of label/value pairs. A watch
 * pack fills the groups with gauge and movement, a retail pack with case pack
 * and shelf life, an MRO pack with thread pitch and torque class — the
 * components never learn the difference, which is what lets the same UI serve
 * every company.
 */

/** One row of a spec group, as the product record prints it. */
export interface SpecField {
  label: string;
  value: string;
}

/** A titled block of fields on the product record. */
export interface SpecGroup {
  title: string;
  fields: SpecField[];
}

/** The generic spec: a form word the catalogue filters on, plus the groups. */
export interface ProductSpec {
  /** Product form — "Reactive-glaze stoneware", "Chronograph quartz". Also the
   *  catalogue's construction/texture facet. */
  construction: string;
  groups: SpecGroup[];
}

/** What the thumbnail draws — the product's silhouette family. */
export type ProductForm =
  // retail
  | "dinnerware"
  | "blanket"
  | "board"
  | "vase"
  | "pouch"
  | "bottle"
  | "towel"
  | "rug"
  // watches & accessories
  | "watch"
  // industrial / MRO
  | "bearing"
  | "drum"
  | "filter"
  | "carton"
  | "tool"
  | "gloves"
  // finished driveline goods
  | "transmission"
  | "e-axle";
