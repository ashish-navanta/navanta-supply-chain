import type { ProductForm, ProductSpec, SpecGroup } from "@/types/product";

/* ═══════════════════════════════════════════════════════════════
 *  The product catalogue, and the scopes above it
 *
 *  Fossil is not a watch manufacturer. It is a design, brand-
 *  licensing and distribution company that buys finished, cased,
 *  packaged watches FOB Asia through a title-taking Hong Kong
 *  trading subsidiary, and moves them through three regional DCs
 *  into a mostly-wholesale channel book.
 *
 *  That sentence decides the whole shape of this file, and of the
 *  top bar that reads it.
 *
 *  WHY THE SCOPES ARE BRAND / REGION / BRANCH
 *  The Shaw build scoped on category → plant → DC, because Shaw
 *  makes what it sells. Fossil does not, so two of those three
 *  stop meaning anything:
 *
 *  - PLANT is gone. There are ~91 Tier 1 factories and exactly one
 *    owned plant. Nobody starts the day by picking a factory; POs
 *    go out across 32 watch factories Fossil does not own, on POs
 *    with no long-term contracts. Factory is a column on the
 *    supplier book, not a scope.
 *  - CATEGORY is gone from the global bar for the reason the Shaw
 *    build had already half-admitted about carpet tile: the book is
 *    watch-heavy, so the control would be a label over a book of
 *    one. It earns a dropdown on exactly one seat — Tova's — where
 *    HTS chapter IS the duty regime.
 *  - SEASON was considered and rejected. The bar answers whose book
 *    and where; the page answers when and what kind. A season is a
 *    time wave, so it lands as a column and a filter on the rows.
 *
 *  What replaces them is BRAND (Fossil is a licensing company —
 *  every approval gate, royalty floor and termination threshold is
 *  per-brand), then REGION → BRANCH: the DC is where Fossil's title
 *  sits, the branch is where it goes. Upstream node, downstream
 *  node — the same distinction the plant/DC pair used to carry.
 *
 *  WHAT IS NOT HERE
 *  No photographs, and none are coming from this file: Fossil's
 *  product photography is Fossil's. A dial carries its colour and
 *  the case finish is drawn over it.
 *
 *  No SKU count either, anywhere. Fossil has never disclosed one,
 *  before or after the smartwatch exit, so this file does not
 *  invent a number that reads as sourced.
 * ═══════════════════════════════════════════════════════════════ */

/* ─── The brands ──────────────────────────────────────────────────
 * The first cut, and the one a person actually picks first.
 *
 * Two are owned outright — Fossil itself, which carries the 11-year
 * movement warranty, and Zodiac, which still markets in-house
 * Swiss-made STP movements. The rest are licensed, and a licence is
 * a very different object to own: the licensor approves the design
 * at its sole and subjective discretion, silence past the clock
 * counts as disapproval, guaranteed minimum royalties are owed
 * regardless of sales, and at least one licensor can terminate on
 * missed net-sales thresholds.
 *
 * NAMING: only Michael Kors is named in the source research, so
 * only Michael Kors is named here. The other five licensed
 * calendars are real — six licensed brands each run an independent
 * calendar into one shared factory capacity pool — but the roster
 * is not in the research, and guessing brand names into the most
 * visible control in the app is the one thing worth refusing.
 * They are placeholders with real MECHANICS: distinct royalty
 * floors, clocks and thresholds, so every code path is exercised.
 * Swapping the five `name` strings is the whole change.
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
   * which is why a slow licensor costs a season rather than a fortnight.
   * Owned brands have none: there is nobody to wait for.
   */
  approvalDays: number | null;
  /** Guaranteed minimum royalty, owed regardless of sales, sat in cost of
   *  sales — so a shortfall lands on gross margin directly. */
  minimumRoyalty: string | null;
  /** True where the licensor can terminate on missed net-sales thresholds. */
  terminationRisk: boolean;
  note: string;
}

/** The one that means "no cut at all". */
export const ALL_BRANDS = "all" as const;

export const BRANDS: Record<string, BrandMeta> = {
  "michael-kors": {
    id: "michael-kors",
    name: "Michael Kors",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: true,
    note: "The largest licensed calendar, and the one that can terminate on missed net-sales thresholds — so a shortfall here is not only a margin question.",
  },
  "licensor-b": {
    id: "licensor-b",
    name: "Licensor B",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "PLACEHOLDER NAME. Mechanics are real: a 20-day clock and a royalty floor.",
  },
  "licensor-c": {
    id: "licensor-c",
    name: "Licensor C",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 15,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "PLACEHOLDER NAME. A shorter clock than the others, which is what makes the shared capacity pool queue badly.",
  },
  "licensor-d": {
    id: "licensor-d",
    name: "Licensor D",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 30,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: false,
    note: "PLACEHOLDER NAME. The longest clock in the book — approvals land late and land on top of everyone else's.",
  },
  "licensor-e": {
    id: "licensor-e",
    name: "Licensor E",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 20,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "PLACEHOLDER NAME. No floor, which makes it the only licensed brand where cutting the buy is simply cheaper.",
  },
  "licensor-f": {
    id: "licensor-f",
    name: "Licensor F",
    kind: "licensed",
    icon: "Watch",
    approvalDays: 20,
    minimumRoyalty: "guaranteed minimum",
    terminationRisk: true,
    note: "PLACEHOLDER NAME. Second brand carrying a termination threshold.",
  },
  fossil: {
    id: "fossil",
    name: "Fossil",
    kind: "owned",
    icon: "Watch",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Owned. No licensor, no clock, no floor — and an 11-year warranty on movement, hands and dial, which is a brand asset and a long-tail parts obligation at once.",
  },
  zodiac: {
    id: "zodiac",
    name: "Zodiac",
    kind: "owned",
    icon: "Watch",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Owned, Swiss-positioned. Still markets in-house Swiss-made STP movements, though the Glovelier factory closed in January 2025 — which is a live question, not a settled fact.",
  },
};

/** In the order the top bar lists them: licensed first, because that is where
 *  the gates and the floors are, then the two owned brands. */
export const BRAND_LIST: BrandMeta[] = [
  BRANDS["michael-kors"],
  BRANDS["licensor-b"],
  BRANDS["licensor-c"],
  BRANDS["licensor-d"],
  BRANDS["licensor-e"],
  BRANDS["licensor-f"],
  BRANDS.fossil,
  BRANDS.zodiac,
];

/** The names, for the fixtures that hold a brand as a string. */
export const BRAND_NAMES: string[] = BRAND_LIST.map((b) => b.name);

export function brandById(id: string): BrandMeta | undefined {
  return BRAND_LIST.find((b) => b.id === id);
}

/** A style's brand, as a string union over the roster above. */
export type Brand = string;

/* ─── The regions, which are the DCs ──────────────────────────────
 * Three, and that is the whole list — Fossil runs three
 * distribution centres, one per region, so the geography and the
 * network are the same question and the bar asks it once.
 *
 * The Americas entry is the interesting one: Dallas is an ACTIVE
 * FTZ subzone (FTZ 39, Subzone 00E), which defers duty until goods
 * leave, pays zero US duty on re-exports and exempts zone inventory
 * from Texas property tax. Designation is site-specific, and the
 * operation is relocating to Sunnyvale. Whether the new site has
 * been sequenced for a fresh activation with the FTZ Board and CBP
 * is not publicly evidenced either way — so this file holds it as
 * an OPEN question rather than resolving it in fixtures.
 * ─────────────────────────────────────────────────────────────── */

export interface Region {
  id: string;
  /** What it is called out loud. */
  name: string;
  /** The DC serving it — the node where Fossil's title sits. */
  dc: string;
  location: string;
  /** Country keys in this region, for the second dropdown. */
  countries: string[];
  /** In the Americas Priority scope — see the sheet. */
  priority: boolean;
  note: string;
}

export const ALL_REGIONS_SCOPE = "all" as const;

export const REGIONS: Record<string, Region> = {
  americas: {
    id: "americas",
    name: "Americas",
    dc: "Dallas DC",
    location: "Dallas, TX",
    countries: ["us", "canada", "mexico"],
    priority: true,
    note: "The priority region. Still Dallas: the move to Sunnyvale has not happened, and it lands into peak. Dallas holds an active FTZ subzone; designation is site-specific and Sunnyvale's re-activation is unevidenced — three benefits ride on it.",
  },
  europe: {
    id: "europe",
    name: "Europe",
    dc: "Eggstätt DC",
    location: "Eggstätt, Germany",
    countries: ["germany", "uk", "france", "italy", "spain", "netherlands"],
    priority: false,
    note: "Out of the Americas Priority scope. The deepest subsidiary footprint, and therefore the most routing guides per unit shipped.",
  },
  asia: {
    id: "asia",
    name: "Asia",
    dc: "Hong Kong DC",
    location: "Hong Kong",
    countries: ["hong-kong", "japan", "china", "india", "australia", "singapore"],
    priority: false,
    note: "Out of the Americas Priority scope. Shares a city with Fossil (East) Ltd and the global supply-planning hub — so the DC, the title-taking entity and the supply plan all sit on the Navision side of the seam.",
  },
};

export const REGION_LIST: Region[] = [REGIONS.americas, REGIONS.europe, REGIONS.asia];

/** The DC names, for the fixtures that hold one as a string. */
export const DC_NAMES: string[] = REGION_LIST.map((r) => r.dc);

export function regionById(id: string): Region | undefined {
  return REGION_LIST.find((r) => r.id === id);
}

/* ─── The countries, and the entity each seat works from ─────────
 * Read off Fossil_Americas_Priority_Supply_Chain.xlsx, which is the
 * authoritative shape: Function × Region × Country × Category, with
 * a Location / Entity per combination.
 *
 * Two things in that sheet changed this file.
 *
 * First, the third cut is a COUNTRY, not a named subsidiary. That is
 * a better control than the market-named branch list this file
 * carried before: a country is what the sheet plans by, and it is
 * the level a routing guide, a duty rate and a service obligation
 * all actually attach to.
 *
 * Second — and this is the part no scope control usually models —
 * the entity is DERIVED, not chosen. The same country resolves to a
 * different place depending on which seat is asking: a buyer, a
 * planner and a CSR in the United States all work out of Dallas,
 * while the logistics coordinator works the Dallas DC. Same country,
 * different building, because the question is different. So the
 * entity is displayed rather than selected — see `entityFor`.
 *
 * The sheet is Americas-only and titled "Americas Priority", so
 * Americas is the region that carries `priority`. Europe and Asia
 * keep their countries and are marked out of priority scope, which
 * is the truthful state rather than pretending the coverage exists.
 * ─────────────────────────────────────────────────────────────── */

export interface Country {
  id: string;
  /** The name the sheet uses, which is what a table prints. */
  name: string;
  /** Region key this country reports into. */
  region: string;
  /** In the Americas Priority scope. */
  priority: boolean;
  note?: string;
}

export const ALL_COUNTRIES = "all" as const;

export const COUNTRIES: Record<string, Country> = {
  /* Americas — the priority scope, verbatim from the sheet. */
  us: { id: "us", name: "United States", region: "americas", priority: true, note: "One of only two markets where Fossil handles its own repair." },
  canada: { id: "canada", name: "Canada", region: "americas", priority: true },
  mexico: { id: "mexico", name: "Mexico", region: "americas", priority: true },

  /* Out of priority scope. Kept because the network exists and a control that
     silently omits it would misdescribe the company, not simplify it. */
  germany: { id: "germany", name: "Germany", region: "europe", priority: false, note: "Shares the region with the Eggstätt DC." },
  uk: { id: "uk", name: "United Kingdom", region: "europe", priority: false },
  france: { id: "france", name: "France", region: "europe", priority: false },
  italy: { id: "italy", name: "Italy", region: "europe", priority: false },
  spain: { id: "spain", name: "Spain", region: "europe", priority: false },
  netherlands: { id: "netherlands", name: "Netherlands", region: "europe", priority: false },

  "hong-kong": { id: "hong-kong", name: "Hong Kong", region: "asia", priority: false, note: "Also the DC, the title-taking trading entity and the global supply-planning hub." },
  japan: { id: "japan", name: "Japan", region: "asia", priority: false },
  china: { id: "china", name: "China", region: "asia", priority: false, note: "61 of ~91 Tier 1 factories sit here, including 29 of the 32 that make watches — a selling market sat on top of the supply base." },
  india: { id: "india", name: "India", region: "asia", priority: false, note: "The only owned plant, and the only market outside the US where Fossil handles its own repair." },
  australia: { id: "australia", name: "Australia", region: "asia", priority: false },
  singapore: { id: "singapore", name: "Singapore", region: "asia", priority: false },
};

export const COUNTRY_LIST: Country[] = Object.values(COUNTRIES);

/** The countries in one region, for the second dropdown. */
export function countriesInRegion(regionId: string): Country[] {
  return COUNTRY_LIST.filter((c) => c.region === regionId);
}

export function countryById(id: string): Country | undefined {
  return COUNTRIES[id];
}

/* ─── Where each seat actually sits ───────────────────────────────
 * The sheet's Location / Entity column, which resolves on Function
 * AND Country rather than on either alone.
 *
 * The split that matters: the commercial seats work out of a city
 * office, the logistics seat works out of a distribution node. In
 * the United States those are both in Dallas and are still not the
 * same place — which is exactly why this is derived and displayed
 * rather than offered as a fourth dropdown nobody would know how to
 * answer.
 *
 * Note the DC is named DALLAS, not Sunnyvale. The relocation has not
 * happened, so the sheet is right and the FTZ re-activation stays
 * the open exposure it is rather than being quietly resolved here.
 * ─────────────────────────────────────────────────────────────── */

/** Seat → country → the entity that seat works from. */
const ENTITIES: Record<string, Record<string, string>> = {
  commercial: { us: "Dallas", canada: "Toronto", mexico: "Mexico City" },
  logistics: { us: "Dallas DC", canada: "Canadian Distribution", mexico: "Mexican Distribution" },
};

/**
 * The entity a seat works from in a country, or null where the sheet does not
 * cover it.
 *
 * Null rather than a guess: outside the Americas the priority sheet says
 * nothing, and inventing an office for Osaka would put a place in the app that
 * no source claims exists.
 */
export function entityFor(persona: string, countryId: string | null): string | null {
  if (!countryId) return null;
  const table = persona === "logistics" ? ENTITIES.logistics : ENTITIES.commercial;
  return table[countryId] ?? null;
}

/* ─── What Fossil sells ───────────────────────────────────────────
 * A global scope after all — the Americas Priority sheet carries a
 * Category column against every Function, so every seat plans by it
 * and this belongs above every seat rather than only on Tova's.
 *
 * WATCHES and JEWELRY are the priority book, verbatim from the
 * sheet. Leather goods is not in it, which is a real finding rather
 * than an omission to paper over: the priority scope is the two
 * categories where Chapter 91's component-level assessment and the
 * smelter question live.
 *
 * "Jewelry", not "Jewellery" — the sheet's own spelling, and the
 * right one for a Richardson, Texas company. A control that renames
 * the reader's own category is a control they have to translate.
 *
 * It still matters most on the trade seat: on a watch, HTS Chapter 91 is
 * assessed component by component and only the case, strap and
 * battery are ad valorem, while a handbag under 4202.22 is assessed
 * flat on full value and swings 6.3% to 17.6% on strap material
 * alone. The category IS the duty regime, which is why it belongs
 * on that seat rather than above every seat.
 *
 * Only the watch book is loaded. The rest are listed because the
 * shape of the business is part of what the prototype explains —
 * and because ~37 of the ~91 Tier 1 factories make no product at
 * all, only fixtures and packaging.
 * ─────────────────────────────────────────────────────────────── */

export interface Category {
  id: string;
  label: string;
  /** Phosphor glyph name, resolved where it is drawn. */
  icon: string;
  /** HTSUS chapter or heading — the reason this taxonomy matters on trade. */
  hts: string;
  /** Factory keys that make it. Empty where the book is not loaded here. */
  factories: string[];
  /** In the Americas Priority scope — see the sheet. */
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
    factories: ["qi-guang", "renley", "solan"],
    priority: true,
    note: "Everything Fossil sells. Watches and jewelry are the priority book.",
  },
  {
    id: "watches",
    icon: "Watch",
    label: "Watches",
    hts: "Ch. 91",
    factories: ["qi-guang", "renley", "solan"],
    priority: true,
    note: "Assessed component by component: 40¢ each, plus 8.5% on the case, 2.8–14% on the strap and 5.3% on the battery. Movement, dial, hands, crystal and packaging bear no ad valorem duty at all.",
  },
  {
    id: "leather-goods",
    icon: "Handbag",
    label: "Leather goods",
    hts: "4202",
    factories: [],
    priority: false,
    note: "Not in the Americas Priority scope. Flat ad valorem on full value, and the line moves on material: 6.3% for a cotton tote, 17.6% for a visually near-identical polyester one.",
  },
  {
    id: "jewelry",
    icon: "Diamond",
    label: "Jewelry",
    hts: "Ch. 71",
    factories: ["qi-guang", "solan"],
    priority: true,
    note: "The second priority category. Carries the smelter question — 219 of 471 smelters unassured on the last count.",
  },
  {
    id: "fixtures-packaging",
    icon: "Package",
    label: "Fixtures & packaging",
    hts: "mixed",
    factories: [],
    priority: false,
    note: "Roughly 37 of the ~91 Tier 1 factories make only this — store displays, tins, gift boxes, printing. It sails, which is why free trade data reads packaging-heavy and understates watch volume.",
  },
  {
    id: "smartwatches",
    icon: "DeviceMobile",
    label: "Smartwatches",
    hts: "8517",
    factories: [],
    priority: false,
    note: "Exited. Listed because the exit is why several of this app's baselines break at a known date, not because there is a book to work.",
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/* ─── Where it is assembled ───────────────────────────────────────
 * Fossil buys the finished, cased, packaged watch. The assembler
 * buys the components — the movement is bought complete and never
 * made, the case and bracelet are the largest cost block at 35–50%
 * of BOM — so the MOQ and the working-capital exposure sit at the
 * factory, not here. That is what PO-only with no long-term
 * contracts buys, and the price is less leverage over movement
 * supply than a vertically integrated watchmaker has, because
 * Fossil is not the movement buyer of record.
 *
 * Three named factories, which is all the research names out of
 * ~91. Inventing the other 88 would put addresses in a demo that
 * the published list does not carry — it has no city-level detail,
 * no Tier 2 and no Switzerland entry.
 *
 * Lead time is production, and production is the SHORT pole: about
 * eight weeks against a nine-month calendar. Every screen that
 * quotes a lead time here should make that gap visible rather than
 * hide it.
 * ─────────────────────────────────────────────────────────────── */

export interface Factory {
  /** Tier 1 list designation. Detail, not the label. */
  id: string;
  /** What it is called out loud. */
  name: string;
  location: string;
  /** Owned, majority-owned, or an independent contract assembler. */
  ownership: "owned" | "independent";
  /** Production days. ~8 weeks is the category norm. */
  leadDays: number;
  note: string;
}

export const FACTORIES: Record<string, Factory> = {
  "qi-guang": {
    id: "Qi Guang",
    name: "Qi Guang Watch",
    location: "Dongguan, China",
    ownership: "independent",
    leadDays: 56,
    note: "The largest identified assembler on the published Tier 1 list, and independent — 29 of the 32 watch factories are in China.",
  },
  renley: {
    id: "Renley",
    name: "Renley Watch Mfg",
    location: "Hong Kong",
    ownership: "independent",
    leadDays: 56,
    note: "The only Hong Kong entry on the watch list, and independent — not Fossil, despite sharing a city with Fossil (East) Ltd.",
  },
  solan: {
    id: "Fossil India",
    name: "Solan",
    location: "Solan district, Himachal Pradesh, India",
    ownership: "owned",
    leadDays: 35,
    note: "The ONLY owned plant on the list. Casing-up and packaging rather than full assembly. As recently as FY2019 Fossil assembled 47% of its own global watch production; that disclosure was dropped in FY2020 and this is what is left.",
  },
};

/** Kept as `PLANTS` nowhere: the scope no longer has a plant. Factories are
 *  read by the supplier book and by a style's own record. */
export const FACTORY_LIST: Factory[] = [FACTORIES["qi-guang"], FACTORIES.renley, FACTORIES.solan];

/** Alias retained so a style can keep saying `plant` while the scope does not.
 *  A style IS made somewhere; that was never the part that stopped being true. */
export type Plant = Factory;


/**
 * What the watch is worn on — and the single most duty-sensitive fact in the
 * record: HTSUS assesses the strap line at 14% on a steel bracelet and 2.8% on
 * leather, so an otherwise identical watch changes its landed cost the moment
 * this field changes. It is also what a swatch has to draw and what a CSR's
 * substitution rules turn on: a bracelet and a strap do not stand in for one
 * another however close the dial.
 */
export type Construction = "bracelet" | "strap";

export interface Colourway {
  /** The colour/finish number — the second half of an ordering reference. */
  number: string;
  /** The finish and dial, the way the retail listing names them. */
  name: string;
  /** The finish colour, which is what the swatch draws. */
  hex: string;
}

/**
 * The technical specification, in the fields Shaw's own spec sheets carry.
 *
 * Every one of these appears on a Shaw carpet tile sheet under these names —
 * gauge and stitches describe how tightly the yarn is set, tufted weight how
 * much of it there is, the two thicknesses how far it stands off the floor, and
 * the performance block is what a specifier checks before a building will accept
 * it. A product record without them is a colour and a price.
 *
 * `averageDensity` is deliberately absent: it is arithmetic on three of these,
 * not a fourth measurement. See below.
 */
/** The pack's own typed fields; emitted to the screens as generic spec groups. */
interface WatchSpec {
  construction: string;
  dyeMethod: string;
  /** Needle spacing across the width, as a fraction of an inch: 1/10, 1/12. */
  gauge: string;
  /** Tufts per inch along the length. */
  stitchesPerInch: number;
  /** Face yarn, oz/yd². */
  tuftedWeight: number;
  /** Finished pile thickness, inches — the pile alone. */
  pileThickness: number;
  /** Total thickness, inches — pile plus backing, which is what a transition
   *  strip and a door undercut have to clear. */
  totalThickness: number;
  primaryBacking: string;
  /** Soil and stain treatment. */
  protection: string;
  /** Flammability: ASTM E648 radiant panel class. */
  radiantPanel: string;
  /** ASTM E662 smoke density. */
  nbsSmoke: string;
  /** AATCC 134 electrostatic propensity. */
  staticPropensity: string;
  warranty: string;
  certifications: string[];
  /** How the tiles may be laid — the quarter-turn rules. */
  installation: string[];
}

/**
 * Average density, oz/yd³.
 *
 * Derived, never stored: it is `tufted weight × 36 ÷ pile thickness`, and both
 * published sheets checked against this come out exact — 17.0 oz over 0.092 in
 * gives 6652, 18.0 over 0.098 gives 6612. Storing it would be a fourth number
 * that can disagree with the three it comes from, and density is the one a
 * specifier uses to compare two tiles, so it is the worst one to let drift.
 */
function averageDensity(spec: WatchSpec): number {
  return Math.round((spec.tuftedWeight * 36) / spec.pileThickness);
}

export interface ProductStyle {
  /** Shaw's style number: 59575, 5T478, 54844, I0204. */
  style: string;
  name: string;
  brand: Brand;
  construction: Construction;
  /** Face dimensions, as the product page states them. */
  size: string;
  /** Which of Shaw's three tile plants makes it. */
  plant: Plant;
  /** Secondary backing — the tile's own, which is what EcoWorx names. */
  backing: string;
  fibre: string;
  /** The thumbnail's silhouette family — every style in this book is a watch. */
  form: ProductForm;
  /** No item code on this book: the style number is the whole reference. */
  itemCode?: string;
  spec: ProductSpec;
  colourways: Colourway[];
}

/* ─── Colour, from the colourway's own name ───────────────────────
 * Two vocabularies in this book. The Color styles are organised into
 * Cool and Warm families over a fixed set of hues, which is a colour
 * system and reads directly. The rest are named for places and
 * movement — Road Trip, Water Rail, Magnetic Fields — where the name
 * carries a temperature rather than a hue, so those are set by hand
 * against the family they sit in.
 * ─────────────────────────────────────────────────────────────── */

/** The hue axis both Color styles share, cool cast and warm cast. */
const COOL: Record<string, string> = {
  "": "#8C949B",
  White: "#DCDFE2",
  Lime: "#8FA659",
  Green: "#4E7A5E",
  Navy: "#33445C",
  Teal: "#3E6E73",
  Blue: "#4C6F94",
  Purple: "#645A7C",
  Burgundy: "#6E3B47",
  Gold: "#A98F4E",
  Orange: "#B5703F",
  "Burnt Orange": "#93502F",
  Red: "#8E3B39",
};

const WARM: Record<string, string> = {
  "": "#9A9086",
  White: "#E4DED3",
  Lime: "#9BA855",
  Green: "#5C7A4F",
  Navy: "#3B4356",
  Teal: "#4A716D",
  Blue: "#566E88",
  Purple: "#6E5F73",
  Burgundy: "#7A4044",
  Gold: "#B4954A",
  Orange: "#C0743A",
  "Burnt Orange": "#9C5329",
  Red: "#98403A",
};

/**
 * The Cool/Warm colourway set, which 5T478 and 5T479 share exactly.
 *
 * Built rather than typed twice: the two styles are the same colour system on
 * different patterns, and the numbers are identical across them, so writing the
 * list out twice would be two places for one fact to go wrong.
 */
function colorFamily(): Colourway[] {
  const cool: [string, string][] = [
    ["", "78506"], ["White", "78516"], ["Lime", "78517"], ["Green", "78518"],
    ["Navy", "78519"], ["Teal", "78520"], ["Blue", "78521"], ["Purple", "78522"],
    ["Burgundy", "78523"], ["Gold", "78524"], ["Orange", "78525"],
    ["Burnt Orange", "78526"], ["Red", "78527"],
  ];
  const warm: [string, string][] = [
    ["", "78706"], ["White", "78716"], ["Lime", "78717"], ["Green", "78718"],
    ["Navy", "78719"], ["Teal", "78720"], ["Blue", "78721"], ["Purple", "78722"],
    ["Burgundy", "78723"], ["Gold", "78724"], ["Orange", "78725"],
    ["Burnt Orange", "78726"], ["Red", "78727"],
  ];
  return [
    ...cool.map(([hue, number]) => ({
      number,
      name: `Cool${hue ? ` ${hue}` : ""}`,
      hex: COOL[hue],
    })),
    ...warm.map(([hue, number]) => ({
      number,
      name: `Warm${hue ? ` ${hue}` : ""}`,
      hex: WARM[hue],
    })),
  ];
}

/**
 * The specification, with Shaw's own defaults filled in.
 *
 * The performance block, the warranty and the certifications are the same across
 * these lines — they are properties of EcoWorx and of Shaw's nylon, not of the
 * pattern — so they are stated once here and each style declares only the
 * measurements that differ.
 *
 * SOURCED against Shaw's published sheets: the 9"×36" values below are Undertone
 * 5T157's exactly (1/10 gauge, 10.0 stitches, 17.0 oz, 0.092 pile, 0.267 total),
 * and the 24"×24" default matches a published tile sheet (1/12, 10.0, 18.0,
 * 0.098). The remaining styles vary inside the range those two establish rather
 * than being read off their own sheets — a fixture should say which of its
 * numbers are quoted and which are plausible.
 */
/** Lays the typed fields out the way the record prints them. */
function groupsOf(s: WatchSpec): SpecGroup[] {
  return [
    {
      title: "Construction",
      fields: [
        { label: "Dye method", value: s.dyeMethod },
        { label: "Primary backing", value: s.primaryBacking },
        { label: "Installation", value: s.installation.join(", ") },
      ],
    },
    {
      title: "Measurements",
      fields: [
        { label: "Gauge", value: s.gauge },
        { label: "Stitches / inch", value: s.stitchesPerInch.toFixed(1) },
        { label: "Tufted weight", value: `${s.tuftedWeight.toFixed(1)} oz/yd²` },
        { label: "Average density", value: `${averageDensity(s).toLocaleString()} oz/yd³` },
        { label: "Pile thickness", value: `${s.pileThickness.toFixed(3)}"` },
        { label: "Total thickness", value: `${s.totalThickness.toFixed(3)}"` },
      ],
    },
    {
      title: "Performance",
      fields: [
        { label: "Radiant panel", value: s.radiantPanel },
        { label: "NBS smoke", value: s.nbsSmoke },
        { label: "Static", value: s.staticPropensity },
        { label: "Protection", value: s.protection },
        { label: "Warranty", value: s.warranty },
        { label: "Certified", value: s.certifications.join(", ") },
      ],
    },
  ];
}

function spec(over: Partial<WatchSpec> = {}): ProductSpec {
  const s: WatchSpec = {
    construction: "Multi-level pattern loop",
    dyeMethod: "100% solution dyed",
    gauge: "1/12",
    stitchesPerInch: 10.0,
    tuftedWeight: 18.0,
    pileThickness: 0.098,
    totalThickness: 0.24,
    primaryBacking: "Synthetic",
    protection: "SSP Shaw Soil Protection",
    radiantPanel: "Class I",
    nbsSmoke: "Less than 450",
    staticPropensity: "Less than 3.5 kV",
    warranty: "Lifetime commercial limited",
    certifications: ["NSF/ANSI 140 Gold", "Cradle to Cradle v3.1 Silver"],
    installation: ["Monolithic", "Quarter turn", "Brick ashlar"],
    ...over,
  };
  return { construction: s.construction, groups: groupsOf(s) };
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK
 * ═══════════════════════════════════════════════════════════════ */

export const CATALOGUE: ProductStyle[] = [
  /* ─── Michael Kors — the licensed calendar the anchor event lives on ── */
  {
    style: "MK5605",
    name: "Bradshaw Chronograph 43",
    brand: "Michael Kors",
    construction: "bracelet",
    form: "watch",
    size: "43 mm",
    /* Qi Guang, because the volume steel-bracelet chronographs are exactly what
       the largest identified Dongguan assembler exists to run. The 42 days a
       capped line quotes against its nominal 56-day production window is the
       demo's own tension, kept from the Shaw build because it is the same
       tension. */
    plant: FACTORIES["qi-guang"],
    backing: "Stainless steel case",
    fibre: "Quartz chronograph",
    spec: spec({ construction: "Chronograph quartz", tuftedWeight: 20.0, pileThickness: 0.105, totalThickness: 0.245 }),
    /* Finish-and-dial variants, named the way the retail listing names them —
       the finish carries the colour, which is what the swatch draws. */
    colourways: [
      { number: "5605", name: "Gold", hex: "#C9A44C" },
      { number: "5799", name: "Rose Gold", hex: "#B76E79" },
      { number: "5952", name: "Two-Tone", hex: "#A99B6E" },
      { number: "6099", name: "Gunmetal", hex: "#4A4E54" },
      { number: "6134", name: "Silver", hex: "#C7CBD1" },
      { number: "6266", name: "Black IP", hex: "#23252A" },
      { number: "6473", name: "Navy Dial", hex: "#1F2A44" },
      { number: "6555", name: "Champagne Dial", hex: "#D8C49A" },
    ],
  },
  {
    style: "MK7108",
    name: "Runway 38",
    brand: "Michael Kors",
    construction: "bracelet",
    form: "watch",
    size: "38 mm",
    plant: FACTORIES["qi-guang"],
    backing: "Stainless steel case",
    fibre: "Three-hand quartz",
    spec: spec({ construction: "Three-hand quartz", tuftedWeight: 16.0, pileThickness: 0.09, totalThickness: 0.2 }),
    colourways: [
      { number: "7110", name: "Gold", hex: "#C9A44C" },
      { number: "7112", name: "Rose Gold", hex: "#B76E79" },
      { number: "7325", name: "Silver", hex: "#C7CBD1" },
      { number: "7331", name: "Black Dial", hex: "#1C1E22" },
    ],
  },
  {
    style: "MK2980",
    name: "Parker Leather 39",
    brand: "Michael Kors",
    construction: "strap",
    form: "watch",
    size: "39 mm",
    plant: FACTORIES["qi-guang"],
    backing: "Stainless steel case",
    fibre: "Quartz chronograph",
    /* The strap version of the same platform — and the duty story in one row:
       an identical watch moves from 14% to 2.8% on the strap line the moment
       the bracelet becomes leather. HTSUS 9102.11.25 vs .45. */
    spec: spec({ construction: "Chronograph quartz", tuftedWeight: 14.0, pileThickness: 0.09, totalThickness: 0.2 }),
    colourways: [
      { number: "2980", name: "Luggage Leather", hex: "#8B5A3C" },
      { number: "3116", name: "Black Leather", hex: "#26221F" },
      { number: "3222", name: "Blush Leather", hex: "#C9A296" },
      { number: "3365", name: "Merlot Leather", hex: "#5E2B33" },
    ],
  },
  {
    style: "MK3192",
    name: "Darci 33",
    brand: "Michael Kors",
    construction: "bracelet",
    form: "watch",
    size: "33 mm",
    plant: FACTORIES["qi-guang"],
    backing: "Stainless steel case",
    fibre: "Three-hand quartz",
    spec: spec({ construction: "Three-hand quartz", tuftedWeight: 12.0, pileThickness: 0.08, totalThickness: 0.18 }),
    colourways: [
      { number: "3190", name: "Silver Pavé", hex: "#D3D6DB" },
      { number: "3192", name: "Gold Pavé", hex: "#C9A44C" },
      { number: "3298", name: "Rose Pavé", hex: "#B76E79" },
    ],
  },

  /* ─── Fossil — the owned book, and the 11-year warranty ─────────────── */
  {
    style: "FS4735",
    name: "Grant Chronograph 44",
    brand: "Fossil",
    construction: "strap",
    form: "watch",
    size: "44 mm",
    plant: FACTORIES["qi-guang"],
    backing: "Stainless steel case",
    fibre: "Quartz chronograph",
    spec: spec({ construction: "Chronograph quartz", tuftedWeight: 18.0, pileThickness: 0.1, totalThickness: 0.22 }),
    colourways: [
      { number: "4735", name: "Blue Dial · Brown Leather", hex: "#29527A" },
      { number: "4812", name: "Black Dial · Black Leather", hex: "#1C1E22" },
      { number: "5061", name: "Cream Dial · Tan Leather", hex: "#E4D6B8" },
      { number: "5151", name: "Green Dial · Amber Leather", hex: "#2F4A3E" },
      { number: "5210", name: "Smoke Dial · Grey Leather", hex: "#4A4E54" },
    ],
  },
  {
    style: "ME3184",
    name: "Neutra Automatic 44",
    brand: "Fossil",
    construction: "bracelet",
    form: "watch",
    size: "44 mm",
    /* Renley — the one Hong Kong entry on the watch list. The automatics sit
       there in this book so the HK consolidation leg has an origin of its own. */
    plant: FACTORIES.renley,
    backing: "Stainless steel case",
    fibre: "Automatic, exhibition caseback",
    spec: spec({ construction: "Automatic", tuftedWeight: 22.0, pileThickness: 0.11, totalThickness: 0.26 }),
    colourways: [
      { number: "3184", name: "Whisky Dial", hex: "#9A6A3F" },
      { number: "3227", name: "Black Dial", hex: "#1C1E22" },
      { number: "3255", name: "Blue Dial", hex: "#1F2A44" },
    ],
  },
  {
    style: "ES3843",
    name: "Jacqueline 36",
    brand: "Fossil",
    construction: "strap",
    form: "watch",
    size: "36 mm",
    /* Solan — the owned plant, casing-up and packaging. The India-market book
       cases up in India, which is what the plant exists to do. */
    plant: FACTORIES.solan,
    backing: "Stainless steel case",
    fibre: "Three-hand quartz, date",
    spec: spec({ construction: "Three-hand quartz", tuftedWeight: 12.0, pileThickness: 0.08, totalThickness: 0.18 }),
    colourways: [
      { number: "3843", name: "Rose · Grey Leather", hex: "#8C8489" },
      { number: "3988", name: "Gold · Tan Leather", hex: "#B08D57" },
      { number: "4045", name: "Silver · Navy Leather", hex: "#2C3A55" },
      { number: "4126", name: "Rose · Blush Leather", hex: "#C9A296" },
    ],
  },

  /* ─── Zodiac — owned, Swiss-positioned, and the STP question ────────── */
  {
    style: "ZO9204",
    name: "Super Sea Wolf 53 Compression",
    brand: "Zodiac",
    construction: "bracelet",
    form: "watch",
    size: "40 mm",
    /* Assembled at Renley in this book. Deliberately NOT Switzerland: no Swiss
       factory appears on the published Tier 1 list, owned Swiss assembly was
       exited in FY2024, and whether "Swiss-made STP movements" are still made
       anywhere is one of the genuinely open questions — the fixture should not
       quietly answer it. */
    plant: FACTORIES.renley,
    backing: "Stainless steel case",
    fibre: "Automatic, STP calibre",
    spec: spec({ construction: "Automatic", tuftedWeight: 24.0, pileThickness: 0.12, totalThickness: 0.28 }),
    colourways: [
      { number: "9204", name: "Black Dial", hex: "#1C1E22" },
      { number: "9268", name: "Deep Blue", hex: "#173A5E" },
      { number: "9290", name: "Sea Foam", hex: "#5FA48F" },
      { number: "9349", name: "White Dial", hex: "#E8E9EB" },
    ],
  },
];

/* ─── Reading the book ───────────────────────────────────────── */

/** Every SKU, flattened: one row per style × colourway. */
export interface CatalogueSku {
  /** The ordering reference: style number, dash, colour number. */
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

/** How a SKU reads to a person: the style, then the colourway. */
export function skuLabel(sku: string): string {
  const rec = BY_SKU.get(sku);
  return rec ? `${rec.style.name} · ${rec.colourway.name}` : sku;
}
