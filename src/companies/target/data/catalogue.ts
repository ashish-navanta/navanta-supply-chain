import type { ProductForm, ProductSpec, SpecGroup } from "@/types/product";

/* ═══════════════════════════════════════════════════════════════
 *  The product catalogue, and the scopes above it
 *
 *  This build is themed for a mass-market retailer of the Target
 *  shape: a design-led, owned-brand-heavy general merchandiser that
 *  buys finished, packaged goods FOB Asia through its own sourcing
 *  arm, moves them through regional distribution centres, and sells
 *  them in its own stores and site. The retailer designs and owns
 *  the brands; the factories are contract suppliers.
 *
 *  WHY THE SCOPES ARE BRAND / REGION / STATE
 *  - BRAND first, because an owned-brand retailer plans by brand:
 *    every design gate, licensing clock and margin floor is
 *    per-brand. Owned brands (Good & Gather, Threshold) have no
 *    licensor to wait on; partner programs (Hearth & Hand with
 *    Magnolia, Disney, Ulta Beauty) carry real approval clocks,
 *    royalty floors and termination thresholds.
 *  - REGION is the DC network: one regional distribution centre
 *    anchors each region in this prototype, so the geography and
 *    the network are the same question and the bar asks it once.
 *  - STATE is the third cut — the level a routing guide, a store
 *    delivery promise and a state compliance rule actually attach
 *    to. The entity a seat works from is DERIVED from seat + state,
 *    not chosen: merchandising and planning sit at Minneapolis HQ,
 *    the logistics seat sits at the DC. See `entityFor`.
 *
 *  WHAT REPLACED THE FOSSIL BOOK
 *  Same mechanics, retail nouns: the licensed-brand approval clock
 *  became the partner-brand approval clock, the HTS strap-vs-
 *  bracelet duty swing became the China-vs-domestic sourcing lane
 *  (Section 301 exposure rides on the lane), and the watch swatch
 *  became a drawn product thumbnail plus a colourway dot.
 * ═══════════════════════════════════════════════════════════════ */

/* ─── The brands ──────────────────────────────────────────────────
 * The first cut, and the one a person actually picks first.
 *
 * Two roster kinds. OWNED brands are the retailer's outright —
 * no approval clock, no royalty floor. PARTNER (licensed) programs
 * are a different object to own: the licensor approves designs at
 * its discretion, silence past the clock counts as disapproval,
 * guaranteed minimum royalties are owed regardless of sales, and
 * some partners can terminate on missed net-sales thresholds.
 * Every code path those mechanics exercise is real in this app.
 * ─────────────────────────────────────────────────────────────── */

export type BrandKind = "owned" | "licensed";

export interface BrandMeta {
  /** Slug — the scope value. */
  id: string;
  /** What it is called out loud, and what every table prints. */
  name: string;
  kind: BrandKind;
  /** Phosphor glyph name, resolved where it is drawn. */
  icon: string;
  /**
   * The deemed-disapproval clock, in days. Silence past it counts as a NO —
   * which is why a slow partner costs a season rather than a fortnight.
   * Owned brands have none: there is nobody to wait for.
   */
  approvalDays: number | null;
  /** Guaranteed minimum royalty, owed regardless of sales, sat in cost of
   *  sales — so a shortfall lands on gross margin directly. */
  minimumRoyalty: string | null;
  /** True where the partner can terminate on missed net-sales thresholds. */
  terminationRisk: boolean;
  note: string;
}

/** The one that means "no cut at all". */
export const ALL_BRANDS = "all" as const;

export const BRANDS: Record<string, BrandMeta> = {
  "hearth-hand": {
    id: "hearth-hand",
    name: "Hearth & Hand with Magnolia",
    kind: "licensed",
    icon: "Armchair",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: true,
    note: "The flagship partner program, and the one that can terminate on missed net-sales thresholds — so a shortfall here is not only a margin question. Every design passes the partner's approval clock.",
  },
  disney: {
    id: "disney",
    name: "Disney at Target",
    kind: "licensed",
    icon: "FilmSlate",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "Shop-in-shop program. A 20-day character-approval clock and a royalty floor; the calendar is the licensor's, not the retailer's.",
  },
  "ulta-beauty": {
    id: "ulta-beauty",
    name: "Ulta Beauty at Target",
    kind: "licensed",
    icon: "Sparkle",
    approvalDays: 15,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "The shortest clock in the book — which is what makes the shared reset calendar queue badly against everyone else's.",
  },
  "fao-schwarz": {
    id: "fao-schwarz",
    name: "FAO Schwarz",
    kind: "licensed",
    icon: "PuzzlePiece",
    approvalDays: 30,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "The longest clock in the book — approvals land late and land on top of everyone else's, straight into the holiday set.",
  },
  "levis-target": {
    id: "levis-target",
    name: "Levi's for Target",
    kind: "licensed",
    icon: "TShirt",
    approvalDays: 20,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "No floor, which makes it the only partner program where cutting the buy is simply cheaper.",
  },
  "kendra-scott": {
    id: "kendra-scott",
    name: "Kendra Scott at Target",
    kind: "licensed",
    icon: "Diamond",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: true,
    note: "Second program carrying a termination threshold.",
  },
  "good-gather": {
    id: "good-gather",
    name: "Good & Gather",
    kind: "owned",
    icon: "ForkKnife",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Owned. The multi-billion-dollar grocery flagship — no licensor, no clock, no floor, and a freshness promise that is a brand asset and a shelf-life obligation at once.",
  },
  threshold: {
    id: "threshold",
    name: "Threshold",
    kind: "owned",
    icon: "House",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Owned home flagship. Design in-house, sourcing through the retailer's own sourcing offices — the margin the owned-brand model exists to capture.",
  },
};

/** In the order the top bar lists them: partner programs first, because that is
 *  where the gates and the floors are, then the owned flagships. */
export const BRAND_LIST: BrandMeta[] = [
  BRANDS["hearth-hand"],
  BRANDS.disney,
  BRANDS["ulta-beauty"],
  BRANDS["fao-schwarz"],
  BRANDS["levis-target"],
  BRANDS["kendra-scott"],
  BRANDS["good-gather"],
  BRANDS.threshold,
];

/** The names, for the fixtures that hold a brand as a string. */
export const BRAND_NAMES: string[] = BRAND_LIST.map((b) => b.name);

export function brandById(id: string): BrandMeta | undefined {
  return BRAND_LIST.find((b) => b.id === id);
}

/** A style's brand, as a string union over the roster above. */
export type Brand = string;

/* ─── The regions, which are the DCs ──────────────────────────────
 * Three in this prototype, each anchored on a real regional
 * distribution centre: Woodland CA for the West (the closest RDC to
 * the LA/Long Beach import gateway, so de-consolidation rides on
 * it), Cedar Falls IA for the Central network, Wilton NY for the
 * East. The full network is ~50 facilities — RDCs, food DCs and
 * flow centers — and the prototype loads one node per region rather
 * than pretending to load them all.
 * ─────────────────────────────────────────────────────────────── */

export interface Region {
  id: string;
  /** What it is called out loud. */
  name: string;
  /** The DC serving it — the node where the retailer's inventory sits. */
  dc: string;
  location: string;
  /** State keys in this region, for the second dropdown. */
  countries: string[];
  /** In the West Priority scope — see the sheet. */
  priority: boolean;
  note: string;
}

export const ALL_REGIONS_SCOPE = "all" as const;

export const REGIONS: Record<string, Region> = {
  west: {
    id: "west",
    name: "West",
    dc: "Woodland RDC",
    location: "Woodland, CA",
    countries: ["california", "washington", "arizona"],
    priority: true,
    note: "The priority region. Woodland is the first inland node behind the LA/Long Beach gateway, so every import exception in this book lands here first — port dwell, chassis shortages and peak-season gate cuts all ride on this one node.",
  },
  central: {
    id: "central",
    name: "Central",
    dc: "Cedar Falls RDC",
    location: "Cedar Falls, IA",
    countries: ["iowa", "minnesota", "texas", "illinois", "missouri", "wisconsin"],
    priority: false,
    note: "Out of the West Priority scope. The deepest store footprint per DC, and therefore the most routing guides per unit shipped. Shares its region with Minneapolis HQ.",
  },
  east: {
    id: "east",
    name: "East",
    dc: "Wilton RDC",
    location: "Wilton, NY",
    countries: ["new-york", "new-jersey", "florida", "georgia", "virginia", "north-carolina"],
    priority: false,
    note: "Out of the West Priority scope. The region where East Coast port diversions land when the Pacific gateway congests — the reroute lever the logistics seat pulls.",
  },
};

export const REGION_LIST: Region[] = [REGIONS.west, REGIONS.central, REGIONS.east];

/** The DC names, for the fixtures that hold one as a string. */
export const DC_NAMES: string[] = REGION_LIST.map((r) => r.dc);

export function regionById(id: string): Region | undefined {
  return REGION_LIST.find((r) => r.id === id);
}

/* ─── The states, and the entity each seat works from ─────────────
 * The third cut is a STATE, not a named facility: a state is what
 * the network plans by, and it is the level a routing guide, a
 * store delivery promise and a state compliance rule (Prop 65 in
 * California, bottle bills in the Northeast) actually attach to.
 *
 * The entity is DERIVED, not chosen. The same state resolves to a
 * different place depending on which seat is asking: a buyer, a
 * planner and a CSR all work out of Minneapolis HQ, while the
 * logistics coordinator works the region's DC. Same state,
 * different building, because the question is different — so the
 * entity is displayed rather than selected. See `entityFor`.
 * ─────────────────────────────────────────────────────────────── */

export interface Country {
  id: string;
  /** The name the sheet uses, which is what a table prints. */
  name: string;
  /** Region key this state reports into. */
  region: string;
  /** In the West Priority scope. */
  priority: boolean;
  note?: string;
}

export const ALL_COUNTRIES = "all" as const;

export const COUNTRIES: Record<string, Country> = {
  /* West — the priority scope. */
  california: { id: "california", name: "California", region: "west", priority: true, note: "The gateway state: LA/Long Beach clears the bulk of the import book, and Prop 65 labeling attaches at this line." },
  washington: { id: "washington", name: "Washington", region: "west", priority: true },
  arizona: { id: "arizona", name: "Arizona", region: "west", priority: true },

  /* Out of priority scope. Kept because the network exists and a control that
     silently omits it would misdescribe the company, not simplify it. */
  iowa: { id: "iowa", name: "Iowa", region: "central", priority: false, note: "Shares the region with the Cedar Falls RDC." },
  minnesota: { id: "minnesota", name: "Minnesota", region: "central", priority: false, note: "HQ state — merchandising, planning and the sourcing organisation all sit in Minneapolis." },
  texas: { id: "texas", name: "Texas", region: "central", priority: false },
  illinois: { id: "illinois", name: "Illinois", region: "central", priority: false },
  missouri: { id: "missouri", name: "Missouri", region: "central", priority: false },
  wisconsin: { id: "wisconsin", name: "Wisconsin", region: "central", priority: false, note: "Home of the dedicated Good & Gather co-manufacturing lines in this book." },

  "new-york": { id: "new-york", name: "New York", region: "east", priority: false, note: "Also the Wilton RDC's state, and a bottle-bill state — deposit rules attach to the beverage book here." },
  "new-jersey": { id: "new-jersey", name: "New Jersey", region: "east", priority: false, note: "Port Newark is the East Coast diversion gateway when the Pacific congests." },
  florida: { id: "florida", name: "Florida", region: "east", priority: false },
  georgia: { id: "georgia", name: "Georgia", region: "east", priority: false, note: "Savannah is the fastest-growing import gateway on the East Coast book." },
  virginia: { id: "virginia", name: "Virginia", region: "east", priority: false },
  "north-carolina": { id: "north-carolina", name: "North Carolina", region: "east", priority: false },
};

export const COUNTRY_LIST: Country[] = Object.values(COUNTRIES);

/** The states in one region, for the second dropdown. */
export function countriesInRegion(regionId: string): Country[] {
  return COUNTRY_LIST.filter((c) => c.region === regionId);
}

export function countryById(id: string): Country | undefined {
  return COUNTRIES[id];
}

/* ─── Where each seat actually sits ───────────────────────────────
 * The split that matters: the commercial seats work out of
 * Minneapolis HQ whatever state is scoped, the logistics seat works
 * out of a distribution node. Those are never the same building,
 * which is exactly why this is derived and displayed rather than
 * offered as a fourth dropdown nobody would know how to answer.
 * ─────────────────────────────────────────────────────────────── */

/** Seat → state → the entity that seat works from. */
const ENTITIES: Record<string, Record<string, string>> = {
  commercial: { california: "Minneapolis HQ", washington: "Minneapolis HQ", arizona: "Minneapolis HQ" },
  logistics: { california: "Woodland RDC", washington: "Lacey RDC", arizona: "Phoenix RDC" },
};

/**
 * The entity a seat works from in a state, or null where the sheet does not
 * cover it.
 *
 * Null rather than a guess: outside the West the priority sheet says nothing,
 * and inventing a facility for Atlanta would put a building in the app that no
 * source claims exists.
 */
export function entityFor(persona: string, countryId: string | null): string | null {
  if (!countryId) return null;
  const table = persona === "logistics" ? ENTITIES.logistics : ENTITIES.commercial;
  return table[countryId] ?? null;
}

/* ─── What the retailer sells ─────────────────────────────────────
 * A global scope: every seat plans by category, so it belongs above
 * every seat rather than only on the trade desk.
 *
 * HOME & KITCHEN and GROCERY are the priority book — the two
 * categories where the owned-brand margin story and the import
 * exposure story both live. The category still matters most on the
 * trade seat: a stoneware dinner set from China carries Section 301
 * List 3 exposure on top of its Chapter 69 base rate, while the
 * same shelf slot filled from a domestic co-packer carries neither.
 * The category IS the duty regime.
 *
 * Only the home and grocery books are loaded. The rest are listed
 * because the shape of the business is part of what the prototype
 * explains.
 * ─────────────────────────────────────────────────────────────── */

export interface Category {
  id: string;
  label: string;
  /** Phosphor glyph name, resolved where it is drawn. */
  icon: string;
  /** HTSUS chapter or heading — the reason this taxonomy matters on trade. */
  hts: string;
  /** Supplier keys that make it. Empty where the book is not loaded here. */
  factories: string[];
  /** In the West Priority scope — see the sheet. */
  priority: boolean;
  note: string;
}

export const ALL_CATEGORIES = "all" as const;

export const CATEGORIES: Category[] = [
  {
    id: ALL_CATEGORIES,
    icon: "SquaresFour",
    label: "All categories",
    hts: "—",
    factories: ["luen-hing", "vinh-phat", "cedar-mills"],
    priority: true,
    note: "Everything on the shelf. Home & kitchen and grocery are the priority book.",
  },
  {
    id: "home",
    icon: "Armchair",
    label: "Home & Kitchen",
    hts: "Ch. 69/94",
    factories: ["luen-hing", "vinh-phat"],
    priority: true,
    note: "The owned-brand margin engine, and the import-heavy half of the priority book: stoneware under Chapter 69, textiles under 63, furniture under 94 — with Section 301 exposure riding on every China origin.",
  },
  {
    id: "grocery",
    icon: "ShoppingCart",
    label: "Grocery & Essentials",
    hts: "Ch. 19–21",
    factories: ["cedar-mills"],
    priority: true,
    note: "The second priority category. Domestic co-manufactured, shelf-life-governed — the freshness promise is a dating discipline the DC has to keep, not a slogan.",
  },
  {
    id: "apparel",
    icon: "TShirt",
    label: "Apparel & Softlines",
    hts: "Ch. 61–63",
    factories: [],
    priority: false,
    note: "Not in the West Priority scope. Flat ad valorem on full value, and the line moves on fibre content — a cotton tee and a visually identical polyester one sit chapters apart.",
  },
  {
    id: "fixtures-packaging",
    icon: "Package",
    label: "Fixtures & packaging",
    hts: "mixed",
    factories: [],
    priority: false,
    note: "Store displays, endcap trays, gift boxes, printing. It sails alongside the merchandise, which is why free trade data reads packaging-heavy and understates unit volume.",
  },
  {
    id: "pharmacy",
    icon: "FirstAid",
    label: "Pharmacy & Clinic",
    hts: "Ch. 30",
    factories: [],
    priority: false,
    note: "Exited — operated by a pharmacy partner inside the stores since 2015. Listed because the exit is why several of this app's baselines break at a known date, not because there is a book to work.",
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/* ─── Where it is made ────────────────────────────────────────────
 * The retailer buys the finished, packaged good. The supplier buys
 * the raw material — so the MOQ and the working-capital exposure
 * sit at the factory, not here. That is what PO-only with no
 * long-term contracts buys, and the price is less leverage over
 * capacity than a vertically integrated manufacturer has.
 *
 * Three named suppliers, which is all this prototype loads out of a
 * Tier 1 book that runs to the hundreds. Two import lanes — Dongguan
 * for hardgoods, Ho Chi Minh City for textiles, the diversification
 * every retailer has been running since the 301 lists landed — and
 * one dedicated domestic co-manufacturer for the grocery flagship.
 *
 * Lead time is production, and production is the SHORT pole: about
 * eight weeks against a nine-month season calendar. Every screen
 * that quotes a lead time here should make that gap visible rather
 * than hide it.
 * ─────────────────────────────────────────────────────────────── */

export interface Factory {
  /** Tier 1 list designation. Detail, not the label. */
  id: string;
  /** What it is called out loud. */
  name: string;
  location: string;
  /** Dedicated (owned lines) or an independent contract supplier. */
  ownership: "owned" | "independent";
  /** Production days. ~8 weeks is the category norm. */
  leadDays: number;
  note: string;
}

export const FACTORIES: Record<string, Factory> = {
  "luen-hing": {
    id: "Luen Hing",
    name: "Luen Hing Housewares",
    location: "Dongguan, China",
    ownership: "independent",
    leadDays: 56,
    note: "The largest hardgoods supplier in this book, and independent — stoneware, acacia and ceramics on shared lines, with Section 301 exposure on every unit that ships.",
  },
  "vinh-phat": {
    id: "Vinh Phat",
    name: "Vinh Phat Textiles",
    location: "Ho Chi Minh City, Vietnam",
    ownership: "independent",
    leadDays: 56,
    note: "The Vietnam lane — where the towel and rug book moved when the China tariff lists landed. Independent, and capacity-constrained in peak because everyone else moved too.",
  },
  "cedar-mills": {
    id: "Cedar Mills",
    name: "Cedar Mills Co-Pack",
    location: "River Falls, WI",
    ownership: "owned",
    leadDays: 35,
    note: "The ONLY dedicated lines in this book — co-manufacturing for the grocery flagship, run against the retailer's own recipes and dating rules. Domestic, so the lane carries no tariff and half the lead time.",
  },
};

/** Read by the supplier book and by a style's own record. */
export const FACTORY_LIST: Factory[] = [FACTORIES["luen-hing"], FACTORIES["vinh-phat"], FACTORIES["cedar-mills"]];

/** Alias retained so a style can keep saying `plant` while the scope does not.
 *  A style IS made somewhere; that was never the part that stopped being true. */
export type Plant = Factory;

/**
 * The sourcing lane — and the single most duty-sensitive fact in the record:
 * an import lane carries the ocean leg, the port dwell and (on China origin)
 * Section 301 exposure, while a domestic lane carries none of them and half
 * the lead time. It is also what a CSR's substitution rules turn on: an
 * imported SKU and a domestic one do not recover the same way when a week
 * goes missing.
 */
export type Construction = "import" | "domestic";

export interface Colourway {
  /** The variant number — the second half of an ordering reference. */
  number: string;
  /** The finish or flavour, the way the shelf listing names it. */
  name: string;
  /** The variant colour, which is what the swatch draws. */
  hex: string;
}

/**
 * The item specification, in the fields a retail item-setup sheet carries.
 *
 * Case pack, cube and pallet pattern are what a DC slot and a truck plan are
 * arithmetic over; origin and compliance are what the trade desk checks before
 * a lane will accept it. A product record without them is a colour and a price.
 *
 * Typed here so the fixtures are checked; emitted to the screens as the generic
 * `ProductSpec` groups every company pack shares — see `groupsOf`.
 */
interface RetailSpec {
  /** Product form — "Reactive-glaze stoneware", "Baked granola clusters". */
  construction: string;
  /** Primary material or contents. */
  material: string;
  /** Units per shipping case. */
  casePack: number;
  /** Weight per unit, lb. */
  unitWeight: number;
  /** Cube per case, ft³ — what a slot and a container plan hold. */
  caseCube: number;
  /** Cases per pallet layer. */
  palletTi: number;
  /** Layers per pallet. */
  palletHi: number;
  /** Case packaging. */
  packaging: string;
  /** Regulatory posture — food-contact, CPSIA, Prop 65. */
  compliance: string;
  /** Shelf life from production, or "—" where dating does not apply. */
  shelfLife: string;
  /** Country of origin, which is what the duty and the lane read. */
  origin: string;
  /** Hazmat class, or "None". */
  hazmat: string;
  warranty: string;
  certifications: string[];
  /** Where it may be merchandised — the planogram placements. */
  merchandising: string[];
}

/**
 * Units per pallet.
 *
 * Derived, never stored: it is `case pack × ti × hi`, and storing it would be
 * a fourth number that can disagree with the three it comes from — and units
 * per pallet is the one a DC slot plan compares, so it is the worst one to
 * let drift.
 */
function palletQuantity(spec: RetailSpec): number {
  return spec.casePack * spec.palletTi * spec.palletHi;
}

/** Lays the typed fields out the way the record prints them. */
function groupsOf(s: RetailSpec): SpecGroup[] {
  return [
    {
      title: "Packaging",
      fields: [
        { label: "Material", value: s.material },
        { label: "Case packaging", value: s.packaging },
        { label: "Merchandising", value: s.merchandising.join(", ") },
      ],
    },
    {
      title: "Case & pallet",
      fields: [
        { label: "Case pack", value: `${s.casePack} units` },
        { label: "Unit weight", value: `${s.unitWeight.toFixed(1)} lb` },
        { label: "Case cube", value: `${s.caseCube.toFixed(1)} ft³` },
        { label: "Units / pallet", value: palletQuantity(s).toLocaleString() },
        { label: "Pallet Ti", value: `${s.palletTi} cases/layer` },
        { label: "Pallet Hi", value: `${s.palletHi} layers` },
      ],
    },
    {
      title: "Compliance",
      fields: [
        { label: "Origin", value: s.origin },
        { label: "Shelf life", value: s.shelfLife },
        { label: "Hazmat", value: s.hazmat },
        { label: "Regulatory", value: s.compliance },
        { label: "Warranty", value: s.warranty },
        { label: "Certified", value: s.certifications.join(", ") },
      ],
    },
  ];
}

export interface ProductStyle {
  /** The style number — first half of the ordering reference. */
  style: string;
  name: string;
  brand: Brand;
  construction: Construction;
  /** Retail size/count, as the shelf listing states it. */
  size: string;
  /** DPCI — department-class-item, the retailer's own item key. */
  itemCode: string;
  /** Which supplier makes it. */
  plant: Plant;
  /** Case packaging — what the DC receives. */
  backing: string;
  /** Contents or primary material — what the shelf listing leads with. */
  fibre: string;
  /** The thumbnail's silhouette family. */
  form: ProductForm;
  /** Product illustration, drawn for this catalogue — /products/<style>.svg */
  image: string;
  spec: ProductSpec;
  colourways: Colourway[];
}

/**
 * The specification, with the item-setup defaults filled in.
 *
 * The compliance block, the warranty and the certifications are the same
 * across most of these lines — they are properties of the program, not of the
 * pattern — so they are stated once here and each style declares only the
 * measurements that differ.
 */
function spec(over: Partial<RetailSpec> = {}): ProductSpec {
  const s: RetailSpec = {
    construction: "Cased consumer goods",
    material: "Mixed",
    casePack: 6,
    unitWeight: 2.0,
    caseCube: 1.2,
    palletTi: 10,
    palletHi: 4,
    packaging: "Corrugated RSC case",
    compliance: "CPSIA / Prop 65 reviewed",
    shelfLife: "—",
    origin: "China",
    hazmat: "None",
    warranty: "90-day return · 1-year quality guarantee",
    certifications: ["BSCI audited"],
    merchandising: ["Shelf", "Endcap"],
    ...over,
  };
  return { construction: s.construction, groups: groupsOf(s) };
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK
 * ═══════════════════════════════════════════════════════════════ */

export const CATALOGUE: ProductStyle[] = [
  /* ─── Hearth & Hand — the partner calendar the anchor event lives on ── */
  {
    style: "HH5605",
    name: "Stoneware Dinnerware Set 16pc",
    brand: "Hearth & Hand with Magnolia",
    construction: "import",
    size: "16 pc · service for 4",
    itemCode: "097-02-5605",
    /* Luen Hing, because volume reactive-glaze stoneware is exactly what the
       largest Dongguan hardgoods supplier exists to run. The 42 days a capped
       line quotes against its nominal 56-day production window is the demo's
       own tension. */
    plant: FACTORIES["luen-hing"],
    backing: "Die-cut foam-cell case, 2 sets",
    fibre: "Reactive-glaze stoneware",
    form: "dinnerware",
    image: "/companies/target/products/hh5605.svg",
    spec: spec({
      construction: "Reactive-glaze stoneware",
      material: "Stoneware clay body",
      casePack: 2,
      unitWeight: 18.4,
      caseCube: 2.6,
      palletTi: 6,
      palletHi: 3,
      packaging: "Die-cut foam-cell case",
      compliance: "FDA food-contact · Prop 65 labeled",
    }),
    /* Glaze variants, named the way the shelf listing names them — the glaze
       carries the colour, which is what the swatch draws. */
    colourways: [
      { number: "5605", name: "Cream", hex: "#E8E0D0" },
      { number: "5799", name: "Terracotta", hex: "#B76E58" },
      { number: "5952", name: "Sage", hex: "#97A98B" },
      { number: "6099", name: "Slate", hex: "#4A4E54" },
      { number: "6134", name: "Stone", hex: "#C7CBD1" },
      { number: "6266", name: "Matte Black", hex: "#23252A" },
      { number: "6473", name: "Navy", hex: "#1F2A44" },
      { number: "6555", name: "Wheat", hex: "#D8C49A" },
    ],
  },
  {
    style: "HH7108",
    name: "Chunky Knit Throw Blanket",
    brand: "Hearth & Hand with Magnolia",
    construction: "import",
    size: "50 × 60 in",
    itemCode: "067-04-7108",
    plant: FACTORIES["luen-hing"],
    backing: "Poly-bagged, 8 per case",
    fibre: "Cotton-acrylic chunky knit",
    form: "blanket",
    image: "/companies/target/products/hh7108.svg",
    spec: spec({
      construction: "Chunky knit textile",
      material: "60% cotton / 40% acrylic",
      casePack: 8,
      unitWeight: 3.1,
      caseCube: 3.4,
      palletTi: 8,
      palletHi: 4,
      packaging: "Poly bag in RSC case",
      compliance: "16 CFR flammability · Prop 65 reviewed",
      certifications: ["BSCI audited", "OEKO-TEX Standard 100"],
    }),
    colourways: [
      { number: "7110", name: "Honey", hex: "#C9A165" },
      { number: "7112", name: "Blush", hex: "#C99B94" },
      { number: "7325", name: "Heather Grey", hex: "#C7CBD1" },
      { number: "7331", name: "Charcoal", hex: "#2A2C30" },
    ],
  },
  {
    style: "HH2980",
    name: "Acacia Serving Board",
    brand: "Hearth & Hand with Magnolia",
    construction: "import",
    size: "18 × 9 in",
    itemCode: "097-06-2980",
    plant: FACTORIES["luen-hing"],
    backing: "Shrink-banded, 6 per case",
    fibre: "Oiled acacia hardwood",
    form: "board",
    image: "/companies/target/products/hh2980.svg",
    /* The lane story in one row: the same shelf slot filled from the domestic
       co-packer would carry no 301 exposure and half the lead time — the
       retail cousin of the old strap-vs-bracelet duty swing. */
    spec: spec({
      construction: "Solid hardwood serveware",
      material: "Acacia, food-safe oil finish",
      casePack: 6,
      unitWeight: 2.8,
      caseCube: 1.1,
      compliance: "FDA food-contact · Lacey Act declared",
      certifications: ["BSCI audited", "FSC mix"],
    }),
    colourways: [
      { number: "2980", name: "Natural Acacia", hex: "#8B5A3C" },
      { number: "3116", name: "Ebonized", hex: "#26221F" },
      { number: "3222", name: "Whitewashed", hex: "#D3C4B4" },
      { number: "3365", name: "Walnut Stain", hex: "#5E3B2B" },
    ],
  },
  {
    style: "HH3192",
    name: "Ceramic Bud Vase 8in",
    brand: "Hearth & Hand with Magnolia",
    construction: "import",
    size: "8 in",
    itemCode: "097-08-3192",
    plant: FACTORIES["luen-hing"],
    backing: "Partitioned case, 12 per case",
    fibre: "Matte-glaze ceramic",
    form: "vase",
    image: "/companies/target/products/hh3192.svg",
    spec: spec({
      construction: "Matte-glaze ceramic",
      material: "Ceramic",
      casePack: 12,
      unitWeight: 1.2,
      caseCube: 0.9,
    }),
    colourways: [
      { number: "3190", name: "Matte White", hex: "#D9DBDE" },
      { number: "3192", name: "Honey Gold", hex: "#C9A44C" },
      { number: "3298", name: "Dusty Rose", hex: "#B76E79" },
    ],
  },

  /* ─── Good & Gather — the owned grocery flagship, and the dating rules ── */
  {
    style: "GG4735",
    name: "Organic Granola Clusters 12oz",
    brand: "Good & Gather",
    construction: "domestic",
    size: "12 oz",
    itemCode: "212-05-4735",
    /* Cedar Mills — the dedicated co-pack lines. The grocery book runs
       domestic, which is what the freshness promise costs. */
    plant: FACTORIES["cedar-mills"],
    backing: "Case of 12 pouches",
    fibre: "Baked oat clusters",
    form: "pouch",
    image: "/companies/target/products/gg4735.svg",
    spec: spec({
      construction: "Baked granola clusters",
      material: "Organic oats, honey, nuts",
      casePack: 12,
      unitWeight: 0.75,
      caseCube: 0.7,
      palletTi: 12,
      palletHi: 5,
      packaging: "Stand-up pouch in RSC case",
      compliance: "FDA 21 CFR 117 · organic handling plan",
      shelfLife: "270 days from bake",
      origin: "United States",
      warranty: "Freshness guaranteed to date on bag",
      certifications: ["USDA Organic", "SQF Level 2"],
      merchandising: ["Shelf", "Endcap", "Checklane"],
    }),
    /* Flavour variants — the flavour carries the colour, which is what the
       swatch draws. */
    colourways: [
      { number: "4735", name: "Maple Pecan", hex: "#A9713F" },
      { number: "4812", name: "Dark Chocolate Sea Salt", hex: "#3A2A20" },
      { number: "5061", name: "Honey Almond", hex: "#D9B36A" },
      { number: "5151", name: "Berry Harvest", hex: "#7A3B4E" },
      { number: "5210", name: "Peanut Butter", hex: "#B98A4A" },
    ],
  },
  {
    style: "GG3843",
    name: "Cold Brew Concentrate 32oz",
    brand: "Good & Gather",
    construction: "domestic",
    size: "32 oz",
    itemCode: "212-11-3843",
    plant: FACTORIES["cedar-mills"],
    backing: "Case of 6 bottles",
    fibre: "Cold brew coffee concentrate",
    form: "bottle",
    image: "/companies/target/products/gg3843.svg",
    spec: spec({
      construction: "Cold-filled beverage",
      material: "Arabica cold brew concentrate",
      casePack: 6,
      unitWeight: 2.4,
      caseCube: 0.6,
      palletTi: 14,
      palletHi: 5,
      packaging: "PET bottle in tray-shrink case",
      compliance: "FDA 21 CFR 117 · bottle-bill states labeled",
      shelfLife: "180 days refrigerated",
      origin: "United States",
      warranty: "Freshness guaranteed to date on bottle",
      certifications: ["Rainforest Alliance", "SQF Level 2"],
      merchandising: ["Cooler", "Endcap"],
    }),
    colourways: [
      { number: "3843", name: "Signature Black", hex: "#2E2724" },
      { number: "3988", name: "Vanilla", hex: "#C9A96E" },
      { number: "4045", name: "Mocha", hex: "#6B4A38" },
      { number: "4126", name: "Oat Latte", hex: "#C6AD92" },
    ],
  },

  /* ─── Threshold — the owned home flagship, on the Vietnam lane ───────── */
  {
    style: "TH3184",
    name: "Performance Bath Towel",
    brand: "Threshold",
    construction: "import",
    size: "30 × 54 in",
    itemCode: "464-09-3184",
    /* Vinh Phat — the towel book moved to Vietnam when the 301 lists landed,
       so the HCMC consolidation leg has an origin of its own. */
    plant: FACTORIES["vinh-phat"],
    backing: "Poly-bagged, 12 per case",
    fibre: "Combed cotton terry, 600 GSM",
    form: "towel",
    image: "/companies/target/products/th3184.svg",
    spec: spec({
      construction: "Combed cotton terry",
      material: "100% combed cotton",
      casePack: 12,
      unitWeight: 1.4,
      caseCube: 1.8,
      origin: "Vietnam",
      certifications: ["BSCI audited", "OEKO-TEX Standard 100"],
    }),
    colourways: [
      { number: "3184", name: "Ochre", hex: "#C08A3E" },
      { number: "3227", name: "Washed Black", hex: "#2A2C30" },
      { number: "3255", name: "Indigo", hex: "#33445C" },
    ],
  },
  {
    style: "TH9204",
    name: "Quick-Dry Bath Rug",
    brand: "Threshold",
    construction: "import",
    size: "20 × 34 in",
    itemCode: "464-12-9204",
    plant: FACTORIES["vinh-phat"],
    backing: "Roll-packed, 8 per case",
    fibre: "Microfibre pile, non-slip back",
    form: "rug",
    image: "/companies/target/products/th9204.svg",
    spec: spec({
      construction: "Tufted microfibre pile",
      material: "Polyester microfibre, TPR backing",
      casePack: 8,
      unitWeight: 1.9,
      caseCube: 1.5,
      origin: "Vietnam",
      compliance: "16 CFR flammability · Prop 65 reviewed",
    }),
    colourways: [
      { number: "9204", name: "Charcoal", hex: "#2E3238" },
      { number: "9268", name: "Deep Navy", hex: "#173A5E" },
      { number: "9290", name: "Sea Foam", hex: "#5FA48F" },
      { number: "9349", name: "Ivory", hex: "#E8E6DF" },
    ],
  },
];

/* ─── Reading the book ───────────────────────────────────────── */

/** Every SKU, flattened: one row per style × colourway. */
export interface CatalogueSku {
  /** The ordering reference: style number, dash, variant number. */
  sku: string;
  style: ProductStyle;
  colourway: Colourway;
}

export const SKUS: CatalogueSku[] = CATALOGUE.flatMap((style) =>
  style.colourways.map((colourway) => ({
    sku: `${style.style}-${colourway.number}`,
    style,
    colourway,
  })),
);

const BY_SKU = new Map(SKUS.map((s) => [s.sku, s]));

export function skuRecord(sku: string): CatalogueSku | undefined {
  return BY_SKU.get(sku);
}

export function styleByNumber(style: string): ProductStyle | undefined {
  return CATALOGUE.find((s) => s.style === style);
}

/** How a SKU reads to a person: the style, then the variant. */
export function skuLabel(sku: string): string {
  const rec = BY_SKU.get(sku);
  return rec ? `${rec.style.name} · ${rec.colourway.name}` : sku;
}
