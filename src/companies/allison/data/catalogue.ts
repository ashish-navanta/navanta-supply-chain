import type { ProductForm, ProductSpec, SpecGroup } from "@/types/product";

/* ═══════════════════════════════════════════════════════════════
 *  The product catalogue, and the scopes above it
 *
 *  Allison Transmission BUILDS what it sells. The chain is five
 *  links and this file sits across the middle three: suppliers ship
 *  raw, semi-finished and finished components in; Allison machines,
 *  assembles and TESTS them into a complete automatic transmission
 *  or electric axle; the finished unit goes to a truck, bus or
 *  construction-equipment OEM, whose vehicle an end user operates.
 *
 *  That sentence decides the whole shape of this file. The book here
 *  is FINISHED UNITS — 78% of net sales, against 22% for service
 *  parts — so a style is a transmission, not a spare, and the thing
 *  a buyer works upstream of it is the component that feeds it.
 *
 *  WHY THE SCOPES ARE SERIES / REGION / VOCATION
 *  The Fossil build scoped on brand → region → country, because a
 *  licensed watch belongs to a licensor's calendar. The equivalent
 *  here is the SERIES: a 3000 Series unit is built to a rating band
 *  and, where it runs under an OEM programme, to that programme's
 *  engineering release level and take-or-pay commitment. Every
 *  clock, floor and risk in this file hangs off the series.
 *
 *  REGION is the distribution node — a customization + parts
 *  centre, and the customization half is the one that matters:
 *  a finished unit is configured there (PTO provision, retarder,
 *  cooler circuit) before it ships to the channel. A programme unit
 *  can bypass it and ship direct to the OEM line.
 *
 *  VOCATION, the third cut, is the END USER's application, not the
 *  customer's. A PACCAR release is not "a PACCAR vocation" — the
 *  truck built around that unit goes to a refuse fleet or a delivery
 *  fleet, and that is what the row carries. It is why the vocation
 *  cut and the account cut are independent axes rather than two
 *  names for one thing.
 *
 *  WHAT IS NOT HERE
 *  No photographs, and none are coming from this file: a transmission
 *  is drawn as a silhouette by `SkuSwatch`, which is honest about
 *  being a diagram rather than pretending to be a product shot.
 * ═══════════════════════════════════════════════════════════════ */

/* ─── The families, which are the product series ──────────────────
 * The first cut, and the one a person actually picks first.
 *
 * Two are outright channel families — the 1000 Series and the xFE
 * fuel-efficiency variants, built to stock, sold through Authorized
 * Distributors, no programme behind them. The rest run under OEM
 * programme agreements, and a programme unit is a very different
 * object to plan: the OEM's platform sets the engineering release
 * level, a change needs their approval inside a window, the volume
 * commitment is take-or-pay whether or not the OEM calls it off, and
 * at least one programme can be cancelled outright.
 *
 * The rating bands are Allison's published figures. The programme
 * mechanics are mechanics — every OEM agreement is confidential, so
 * the clocks and floors below are the ENGINE being exercised, not
 * numbers from a contract, and this note is here so nobody later
 * mistakes one for the other.
 * ─────────────────────────────────────────────────────────────── */

export type BrandKind = "owned" | "licensed";

export interface BrandMeta {
  /** Slug — the scope value. */
  id: string;
  /** What it is called out loud, and what every table prints. */
  name: string;
  /** "licensed" = OEM programme family; "owned" = channel family. */
  kind: BrandKind;
  /** Phosphor glyph name, resolved where it is drawn. */
  icon: string;
  /**
   * The engineering change approval window, in days. Silence past it counts
   * as a NO — which is why a slow approval costs a build slot rather than a
   * fortnight. Channel families have none: there is nobody to wait for.
   */
  approvalDays: number | null;
  /** Take-or-pay volume commitment, owed whether or not the OEM calls the
   *  volume off — so a shortfall lands on Allison's own cost directly. */
  minimumRoyalty: string | null;
  /** True where the programme itself can be cancelled, not merely reduced. */
  terminationRisk: boolean;
  note: string;
}

/** The one that means "no cut at all". */
export const ALL_BRANDS = "all" as const;

export const BRANDS: Record<string, BrandMeta> = {
  "series-3000": {
    id: "series-3000",
    name: "3000 Series",
    kind: "licensed",
    icon: "Gear",
    approvalDays: 20,
    minimumRoyalty: "Take-or-pay commitment",
    terminationRisk: true,
    note: "The volume programme family and the anchor of this book — 450 hp, 1,250 lb-ft, 98,100 lb GVW, running under refuse and transit programmes at once. A cancelled programme here is the largest single exposure on the sheet.",
  },
  "series-4000": {
    id: "series-4000",
    name: "4000 Series",
    kind: "licensed",
    icon: "Gear",
    approvalDays: 20,
    minimumRoyalty: "Take-or-pay commitment",
    terminationRisk: false,
    note: "The heavy end — 800 hp, 2,360 lb-ft, 242,550 lb GVW. Lower volume, longer build, and every unit is spoken for before it is started.",
  },
  "egen-power": {
    id: "egen-power",
    name: "eGen Power",
    kind: "licensed",
    icon: "Lightning",
    approvalDays: 15,
    minimumRoyalty: "Take-or-pay commitment",
    terminationRisk: true,
    note: "Fully electric axles out of Auburn Hills. The shortest approval window and the newest line, so there is no built stock to hide a schedule miss behind — which is exactly why it reads worst on the board.",
  },
  "series-2000": {
    id: "series-2000",
    name: "2000 Series",
    kind: "licensed",
    icon: "Gear",
    approvalDays: 30,
    minimumRoyalty: "Take-or-pay commitment",
    terminationRisk: false,
    note: "Medium duty, up to 365 hp and 700 lb-ft. The longest approval window in the book, so a change here lands late and lands on top of everyone else's.",
  },
  "nine-speed": {
    id: "nine-speed",
    name: "9-Speed",
    kind: "licensed",
    icon: "Gear",
    approvalDays: 20,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "No take-or-pay, which makes it the only programme family where cutting build volume is simply cheaper rather than a contractual argument.",
  },
  defense: {
    id: "defense",
    name: "Defense Programs",
    kind: "licensed",
    icon: "Shield",
    approvalDays: 20,
    minimumRoyalty: "Take-or-pay commitment",
    terminationRisk: true,
    note: "Tracked and tactical wheeled platforms, 8% of net sales. Cancellation risk here is a budget line rather than a commercial decision, which is a different kind of exposure and worth reading separately.",
  },
  "series-1000": {
    id: "series-1000",
    name: "1000 Series",
    kind: "owned",
    icon: "Package",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Channel. No programme, no clock, no floor — built to stock and configured at the PDC for whichever distributor calls for it.",
  },
  xfe: {
    id: "xfe",
    name: "xFE Fuel-Efficiency",
    kind: "owned",
    icon: "Lightning",
    approvalDays: null,
    minimumRoyalty: null,
    terminationRisk: false,
    note: "Channel, and the one families cross into: an xFE variant exists inside the 2000 and 3000 books too, so a unit can belong to this family and to a programme's rating band at once.",
  },
};

/** In the order the top bar lists them: programme families first, because that
 *  is where the clocks and the commitments are, then the two channel families. */
export const BRAND_LIST: BrandMeta[] = [
  BRANDS["series-3000"],
  BRANDS["series-4000"],
  BRANDS["egen-power"],
  BRANDS["series-2000"],
  BRANDS["nine-speed"],
  BRANDS.defense,
  BRANDS["series-1000"],
  BRANDS.xfe,
];

/** The names, for the fixtures that hold a family as a string. */
export const BRAND_NAMES: string[] = BRAND_LIST.map((b) => b.name);

export function brandById(id: string): BrandMeta | undefined {
  return BRAND_LIST.find((b) => b.id === id);
}

/** A style's family, as a string union over the roster above. */
export type Brand = string;

/* ─── The regions, which are the distribution nodes ───────────────
 * Three, and that is the whole list — Allison runs one customization
 * and parts distribution centre per region, so the geography and the
 * network are the same question and the bar asks it once.
 *
 * "PDC" undersells what these do for a finished-goods book. The
 * customization half is the one that matters here: a unit is
 * configured to a customer's specification at this node — PTO
 * provision, retarder, cooler circuit — before it ships onward. That
 * is why a channel unit routes through it at all, and why a
 * programme unit going direct to an OEM line does not.
 *
 * The North America entry is the interesting one: Indianapolis is
 * six plants and the PDC on one 4.6M sq ft campus, so the node that
 * builds and the node that ships are the same address, and every
 * escalation in this book lands there first. Whether the Auburn
 * Hills eGen Power ramp is stocked through Indianapolis or ships
 * direct is not settled — this file holds it OPEN rather than
 * resolving it in fixtures.
 * ─────────────────────────────────────────────────────────────── */

export interface Region {
  id: string;
  /** What it is called out loud. */
  name: string;
  /** The distribution node serving it — where Allison's finished stock sits. */
  dc: string;
  location: string;
  /** Country keys in this region, for the second dropdown. */
  countries: string[];
  /** In the NA Priority scope — see the sheet. */
  priority: boolean;
  note: string;
}

export const ALL_REGIONS_SCOPE = "all" as const;

export const REGIONS: Record<string, Region> = {
  "north-america": {
    id: "north-america",
    name: "North America",
    dc: "Indianapolis PDC",
    location: "Indianapolis, IN",
    countries: ["us", "canada", "mexico", "brazil"],
    priority: true,
    note: "The priority region and 49% of net sales on its own. Six plants and the PDC share one campus, so the node that builds a unit and the node that ships it are the same address — every escalation reaches it first.",
  },
  europe: {
    id: "europe",
    name: "Europe",
    dc: "Szentgotthárd PDC",
    location: "Szentgotthárd, Hungary",
    countries: ["hungary", "netherlands", "germany", "uk", "france", "italy"],
    priority: false,
    note: "Out of the NA Priority scope. High-volume on-highway build feeding the European OEM programmes directly, with the Netherlands centre carrying the channel stock behind it.",
  },
  asia: {
    id: "asia",
    name: "Asia",
    dc: "Shanghai PDC",
    location: "Shanghai, China",
    countries: ["china", "india", "japan", "singapore", "australia", "south-korea"],
    priority: false,
    note: "Out of the NA Priority scope. Shanghai is sales office, customization centre and parts hub at once, and the Chennai plant builds behind it — so in this region the building and the configuring genuinely are different addresses.",
  },
};

export const REGION_LIST: Region[] = [REGIONS["north-america"], REGIONS.europe, REGIONS.asia];

/** The stores names, for the fixtures that hold one as a string. */
export const DC_NAMES: string[] = REGION_LIST.map((r) => r.dc);

export function regionById(id: string): Region | undefined {
  return REGION_LIST.find((r) => r.id === id);
}

/* ─── The countries, and the entity each seat works from ─────────
 * Read off the NA Priority sheet, which is the authoritative shape:
 * Function × Region × Country × Vocation, with a Location / Entity
 * per combination.
 *
 * Two things in that sheet changed this file.
 *
 * First, the third cut is a COUNTRY, not a named plant. That is a
 * better control than a plant list: a country is what a market, an
 * import duty on a finished unit and an OEM's own build footprint
 * all actually attach to.
 *
 * Second — and this is the part no scope control usually models —
 * the entity is DERIVED, not chosen. The same country resolves to a
 * different place depending on which seat is asking: a buyer, a
 * planner and a service desk in the United States all work out of
 * Indianapolis HQ, while the logistics seat works the Indianapolis
 * PDC. Same country, different building, because the question is
 * different. So the entity is displayed rather than selected — see
 * `entityFor`.
 *
 * The sheet is North America only and titled "NA Priority", which is
 * honest about where the book is: 49% of net sales sits in that one
 * region. Europe and Asia keep their countries and are marked out of
 * priority scope, which is the truthful state rather than pretending
 * the coverage exists.
 * ─────────────────────────────────────────────────────────────── */

export interface Country {
  id: string;
  /** The name the sheet uses, which is what a table prints. */
  name: string;
  /** Region key this country reports into. */
  region: string;
  /** In the NA Priority scope. */
  priority: boolean;
  note?: string;
}

export const ALL_COUNTRIES = "all" as const;

export const COUNTRIES: Record<string, Country> = {
  /* North America — the priority scope, verbatim from the sheet. */
  us: { id: "us", name: "United States", region: "north-america", priority: true, note: "Six Indianapolis plants, Auburn Hills for electric propulsion, Lewisburg for die casting, and the PDC on the Indianapolis campus. Half the company's sales." },
  canada: { id: "canada", name: "Canada", region: "north-america", priority: true, note: "New Flyer builds transit buses at Winnipeg — a programme customer whose plant is not in the same country as the units feeding it." },
  mexico: { id: "mexico", name: "Mexico", region: "north-america", priority: true },
  brazil: { id: "brazil", name: "Brazil", region: "north-america", priority: false, note: "A customization and parts operation rather than a plant — the South American channel is served from it." },

  /* Out of priority scope. Kept because the network exists and a control that
     silently omits it would misdescribe the company, not simplify it. */
  hungary: { id: "hungary", name: "Hungary", region: "europe", priority: false, note: "Szentgotthárd — high-volume on-highway build, and one of only two plants outside the United States." },
  netherlands: { id: "netherlands", name: "Netherlands", region: "europe", priority: false, note: "The European customization and parts centre sat behind the Hungarian plant." },
  germany: { id: "germany", name: "Germany", region: "europe", priority: false, note: "MAN and Daimler platforms — two programme customers in one market." },
  uk: { id: "uk", name: "United Kingdom", region: "europe", priority: false, note: "Dennis Eagle refuse chassis, and BAE Systems on the defense book." },
  france: { id: "france", name: "France", region: "europe", priority: false },
  italy: { id: "italy", name: "Italy", region: "europe", priority: false, note: "Iveco — the European programme customer with the widest vocation spread." },

  india: { id: "india", name: "India", region: "asia", priority: false, note: "Chennai — high-volume on-highway build, expanding, and the second of the two plants outside the United States." },
  china: { id: "china", name: "China", region: "asia", priority: false, note: "Shanghai is regional headquarters, sales office, customization centre and parts hub at once — the widest-scope node in the network." },
  japan: { id: "japan", name: "Japan", region: "asia", priority: false, note: "Hino and Isuzu, plus a customization and parts operation of its own." },
  singapore: { id: "singapore", name: "Singapore", region: "asia", priority: false },
  australia: { id: "australia", name: "Australia", region: "asia", priority: false, note: "Mining and heavy haul — where the 4000 Series rating band earns its keep." },
  "south-korea": { id: "south-korea", name: "South Korea", region: "asia", priority: false },
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
 * The split that matters: the commercial seats work out of the HQ
 * office, the logistics seat works out of a stores node. In the
 * United States those are both on the Indianapolis campus and are
 * still not the same building — which is exactly why this is derived
 * and displayed rather than offered as a fourth dropdown nobody
 * would know how to answer.
 *
 * Note the node is named INDIANAPOLIS PDC, not a plant. A unit is
 * built in one of six plants and shipped from the distribution
 * centre, and the logistics seat works the second of those — naming
 * a plant here would put the freight desk on an assembly floor.
 * ─────────────────────────────────────────────────────────────── */

/** Seat → country → the entity that seat works from. */
const ENTITIES: Record<string, Record<string, string>> = {
  commercial: {
    us: "Indianapolis HQ",
    canada: "Indianapolis HQ",
    mexico: "Indianapolis HQ",
    brazil: "Indianapolis HQ",
  },
  logistics: {
    us: "Indianapolis PDC",
    canada: "Indianapolis PDC",
    mexico: "Indianapolis PDC",
    brazil: "Indianapolis PDC",
  },
};

/**
 * The entity a seat works from in a country, or null where the sheet does not
 * cover it.
 *
 * Null rather than a guess: outside North America the priority sheet says
 * nothing, and inventing an office for Budapest would put a place in the app
 * that no source claims exists.
 */
export function entityFor(persona: string, countryId: string | null): string | null {
  if (!countryId) return null;
  const table = persona === "logistics" ? ENTITIES.logistics : ENTITIES.commercial;
  return table[countryId] ?? null;
}

/* ─── The vocations, which are the end user's ─────────────────────
 * A global scope after all — the NA Priority sheet carries a
 * Vocation column against every Function, so every seat plans by it
 * and this belongs above every seat rather than only on one.
 *
 * THE POINT OF THIS CUT, and it is easy to get wrong: a vocation is
 * the END USER's application, not the customer's. Allison sells to a
 * truck, bus or construction-equipment OEM; that OEM builds a
 * vehicle; somebody else operates it. A PACCAR release is not "a
 * PACCAR vocation" — the truck PACCAR builds around that unit goes
 * to a delivery fleet or a refuse fleet, and THAT is what the row
 * carries. One OEM customer therefore spans several vocations, which
 * is precisely why this cut and the account cut are independent axes
 * rather than two names for one thing.
 *
 * DISTRIBUTION and REFUSE are the priority book, verbatim from the
 * sheet. They are the two vocations where the volume and the
 * programme commitments both sit.
 *
 * "Distribution", not "Delivery & linehaul" — the vocation's own
 * label in Allison's applications book, and the one the OEMs use. A
 * control that renames the reader's own category is a control they
 * have to translate.
 *
 * Defense is listed and not workable from this seat. That is not an
 * omission to paper over: a restricted programme is genuinely
 * visible to a commercial reader and genuinely not theirs to act on,
 * and showing it greyed is more honest than pretending the 8% of net
 * sales it represents does not exist.
 * ─────────────────────────────────────────────────────────────── */

export interface Category {
  id: string;
  label: string;
  /** Phosphor glyph name, resolved where it is drawn. */
  icon: string;
  /** Vocation code, as the applications book indexes it. Kept under the field
   *  name every pack shares. */
  hts: string;
  /** Supplier keys that carry it. Empty where the book is not loaded here. */
  factories: string[];
  /** In the NA Priority scope — see the sheet. */
  priority: boolean;
  note: string;
}

export const ALL_CATEGORIES = "all" as const;

export const CATEGORIES: Category[] = [
  {
    id: ALL_CATEGORIES,
    icon: "SquaresFour",
    label: "All vocations",
    hts: "—",
    factories: ["walker-die-casting", "cr-tool", "midwest-gear"],
    priority: true,
    note: "Every application Allison builds into. Distribution and refuse are the priority book.",
  },
  {
    id: "distribution",
    icon: "Truck",
    label: "Distribution",
    hts: "V-01",
    factories: ["walker-die-casting", "cr-tool", "midwest-gear"],
    priority: true,
    note: "Box trucks, delivery vans and linehaul — the largest vocation in the book and the one the 2000 and 3000 Series volume runs into. Stop-start duty is what the automatic is sold on, so this is where the product argument is strongest.",
  },
  {
    id: "refuse",
    icon: "Recycle",
    label: "Refuse",
    hts: "V-04",
    factories: ["walker-die-casting", "midwest-gear"],
    priority: true,
    note: "The second priority vocation and the hardest duty cycle Allison ships into — a refuse packer shifts more times in a shift than a linehaul truck does in a week, which is why the 3000 Series programme commitments concentrate here.",
  },
  {
    id: "transit-bus",
    icon: "Bus",
    label: "Transit & School Bus",
    hts: "V-07",
    factories: ["walker-die-casting", "midwest-gear"],
    priority: false,
    note: "Blue Bird and New Flyer. Not in the priority scope, and the vocation where the eGen Power book will land first — a transit route is a fixed loop with a depot at the end of it, which is the easiest electrification case there is.",
  },
  {
    id: "construction",
    icon: "Wrench",
    label: "Construction",
    hts: "V-09",
    factories: ["walker-die-casting"],
    priority: false,
    note: "Terex and the off-highway book. Lower volume, heavier ratings, and the vocation most exposed to a build cycle nobody in this app controls.",
  },
  {
    id: "defense-vocation",
    icon: "Shield",
    label: "Defense",
    hts: "V-20",
    factories: [],
    priority: false,
    note: "Tracked and tactical wheeled platforms — 8% of net sales, and not workable from a commercial seat. Listed because a restricted programme a reader can see but not act on is the truth, and hiding it would understate the company by an eighth.",
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/* ─── Who supplies the components ─────────────────────────────────
 * Allison does not buy the thing it sells. It buys the components
 * that BECOME the thing it sells — raw stock, semi-finished castings
 * and forgings, and finished parts that go straight to the line —
 * and then machines, assembles and tests them into a transmission.
 * These are that supply base.
 *
 * THE COMPONENT STATE IS THE POINT. A late raw bar is absorbed; a
 * late semi-finished casting burns machining capacity that does not
 * come back, so the slip compounds; a late finished sensor stops an
 * assembly line the same afternoon. Same delay, three different
 * costs — which is why `componentState` sits on this record and not
 * in a note somewhere.
 *
 * TWO OF THESE ARE REAL AND OWNED. Walker Die Casting (Lewisburg,
 * TN) supplied Allison for twenty years before Allison acquired its
 * assets in 2019, along with C&R Tool and Engineering (Muscle
 * Shoals, AL). Vertical integration on the two most schedule-
 * critical inputs is a real strategic fact and the book should read
 * that way. Everything else here is INVENTED — Allison publishes no
 * supplier list — but each sits in a commodity class the 10-K names.
 *
 * The concentration is real and is the buying seat's whole argument:
 * roughly 75% of component spend goes to about 40 suppliers, many of
 * them sole sources, against ~$851M of direct materials a year. A
 * sole source on a casting feeding a programme with a build slot is
 * not a negotiating position, it is an exposure.
 * ─────────────────────────────────────────────────────────────── */

/** What state a component arrives in — and therefore what a delay costs. */
export type ComponentState = "raw" | "semi-finished" | "finished";

export const COMPONENT_STATE_LABEL: Record<ComponentState, string> = {
  raw: "Raw stock",
  "semi-finished": "Semi-finished",
  finished: "Finished component",
};

export interface Factory {
  /** Vendor master designation. Detail, not the label. */
  id: string;
  /** What it is called out loud. */
  name: string;
  location: string;
  /** Owned (vertically integrated) or an independent supplier. */
  ownership: "owned" | "independent";
  /** What it ships, and therefore what a slip costs downstream. */
  componentState: ComponentState;
  /** The commodity class, as the direct-material book groups it. */
  commodity: string;
  /** True where this is the only qualified source for what it ships. */
  soleSource: boolean;
  /** Days from the supplier's dock to the receiving plant. */
  leadDays: number;
  note: string;
}

export const FACTORIES: Record<string, Factory> = {
  "walker-die-casting": {
    id: "Walker Die Casting",
    name: "Walker Die Casting",
    location: "Lewisburg, TN",
    ownership: "owned",
    componentState: "semi-finished",
    commodity: "Aluminium cases & housings",
    soleSource: true,
    leadDays: 21,
    note: "Twenty years a supplier before Allison bought the assets in 2019, and the reason it did: a case casting is the longest-lead semi-finished input in the book, and every unit needs one. Owning it converts a supply risk into a capacity question — which is a better problem, not an absent one.",
  },
  "cr-tool": {
    id: "C&R Tool",
    name: "C&R Tool and Engineering",
    location: "Muscle Shoals, AL",
    ownership: "owned",
    componentState: "semi-finished",
    commodity: "Tooling & precision machining",
    soleSource: true,
    leadDays: 14,
    note: "Acquired alongside Walker in 2019. Tooling is not a part on the bill of materials — it is what makes the parts — so a slip here does not stop one build, it slows every build that tool touches.",
  },
  "midwest-gear": {
    id: "Midwest Gear",
    name: "Midwest Gear & Forge",
    location: "Fort Wayne, IN",
    ownership: "independent",
    componentState: "semi-finished",
    commodity: "Steel gears & forgings",
    soleSource: false,
    leadDays: 24,
    note: "The largest independent on the book and the one genuinely dual-sourced — gear blanks cross-reference on a dimension table the way a bearing does, which is what keeps this commodity competitive while the castings are not.",
  },
  "torqueflow": {
    id: "Torqueflow",
    name: "Torqueflow Converters Inc",
    location: "Toledo, OH",
    ownership: "independent",
    componentState: "finished",
    commodity: "Torque converters",
    soleSource: true,
    leadDays: 18,
    note: "A finished assembly that goes straight to the line, sole-sourced, on a torque converter that is the defining component of an Allison automatic. The single highest line-stop exposure in the supply base.",
  },
  kestrel: {
    id: "Kestrel Electronics",
    name: "Kestrel Electronics",
    location: "Kokomo, IN",
    ownership: "independent",
    componentState: "finished",
    commodity: "TCM controls & sensors",
    soleSource: true,
    leadDays: 30,
    note: "Transmission control modules and the sensor set. Sole-sourced, longest lead of any finished component, and the one input where a shortage cannot be machined around — the other four hundred parts do not help.",
  },
  "bremen-seal": {
    id: "Bremen Seal",
    name: "Bremen Seal & Gasket",
    location: "Bremen, IN",
    ownership: "independent",
    componentState: "finished",
    commodity: "Seals & gaskets",
    soleSource: false,
    leadDays: 9,
    note: "Low value, high count, three qualified sources. The commodity that never causes a problem, listed because a supply base of only its problems would misrepresent the shape of the spend.",
  },
  "lakeshore-heat": {
    id: "Lakeshore Heat Treat",
    name: "Lakeshore Heat Treat",
    location: "Michigan City, IN",
    ownership: "independent",
    componentState: "semi-finished",
    commodity: "Heat treat & surface finishing",
    soleSource: false,
    leadDays: 7,
    note: "A process rather than a part — gears go out and come back harder. It sits mid-route between the forge and the machining line, so a delay here is invisible on a receipt and very visible on a build schedule.",
  },
  "hoosier-fastener": {
    id: "Hoosier Fastener",
    name: "Hoosier Fastener Supply",
    location: "Indianapolis, IN",
    ownership: "independent",
    componentState: "raw",
    commodity: "Fasteners & hardware",
    soleSource: false,
    leadDays: 4,
    note: "The tail. Consumable hardware on a vendor-managed bin at the line side, four days out, and genuinely re-sourceable — which is what raw stock is supposed to look like when it is working.",
  },
  "adriatic-castings": {
    id: "Adriatic Castings",
    name: "Adriatic Castings d.o.o.",
    location: "Slovenia",
    ownership: "independent",
    componentState: "semi-finished",
    commodity: "Aluminium cases & housings",
    soleSource: false,
    leadDays: 16,
    note: "The Szentgotthárd feed. It exists because shipping a case casting from Tennessee to Hungary costs more than the casting — the European plant's second source is a geography decision before it is a commercial one.",
  },
  "chennai-forge": {
    id: "Chennai Precision Forge",
    name: "Chennai Precision Forge Pvt Ltd",
    location: "Chennai, India",
    ownership: "independent",
    componentState: "semi-finished",
    commodity: "Steel gears & forgings",
    soleSource: false,
    leadDays: 12,
    note: "Local content for the Indian plant, and the same argument as Adriatic in a different currency. As Chennai's volume expands this is the supplier whose capacity is asked about first.",
  },
};

/** Every supplier, in the order the supplier book lists them: owned first —
 *  the two vertically integrated inputs are the ones a reader should see
 *  before they see anybody's lead time. */
export const FACTORY_LIST: Factory[] = [
  FACTORIES["walker-die-casting"],
  FACTORIES["cr-tool"],
  FACTORIES["midwest-gear"],
  FACTORIES["torqueflow"],
  FACTORIES.kestrel,
  FACTORIES["bremen-seal"],
  FACTORIES["lakeshore-heat"],
  FACTORIES["hoosier-fastener"],
  FACTORIES["adriatic-castings"],
  FACTORIES["chennai-forge"],
];

/** Suppliers whose failure stops a line rather than costing a margin point. */
export const soleSourceSuppliers = (): Factory[] =>
  FACTORY_LIST.filter((f) => f.soleSource);

/** Alias retained so a style can keep saying `plant` while the scope does not.
 *  A style IS sourced somewhere; that was never the part that stopped being true. */
export type Plant = Factory;


/**
 * How the part reaches the dock — and the single most cost-sensitive fact in
 * the record: an OEM sole-source spare sits on a six-week factory lead with an
 * expedite premium when it is missed, while a distributor part lands next day
 * from a branch in Lafayette, so an otherwise identical requisition changes its
 * landed cost and its downtime exposure the moment this field changes. It is
 * also what a plant service desk's substitution rules turn on: a spec-locked
 * OEM element and a cross-referenced distributor part do not stand in for one
 * another however close the dimensions.
 */
/**
 * How a finished unit reaches its customer — the axis this book turns on.
 *
 * A programme unit is built against an OEM's release schedule and can ship
 * straight to their assembly line; a channel unit is built to stock, configured
 * at a distribution centre, and called off by an Authorized Distributor. Same
 * transmission, two different clocks: miss a programme date and an OEM line
 * stops, miss a channel date and a distributor backorders.
 */
export type Construction = "program" | "channel";

export interface Colourway {
  /** The configuration number — the second half of an ordering reference. */
  number: string;
  /** The configuration, the way a spec sheet names it. */
  name: string;
  /** The swatch colour. */
  hex: string;
}

/**
 * The technical specification, in the fields a finished-unit master carries.
 *
 * Every one of these appears on a transmission's own spec sheet under these
 * names — the rating band decides which vehicles it can go under at all, the
 * configuration block is what a customization centre actually changes, and the
 * programme block is what makes one unit un-substitutable for another that
 * looks identical. A product record without them is a model number and a price.
 *
 * `weightLb` is deliberately absent as a stored field: dry weight is a property
 * of the case and gear set, so it is declared, while anything derivable from
 * two other fields is derived. See `ratingLine`.
 */
interface UnitSpec {
  construction: string;
  /** Case and gear-set material. */
  material: string;
  /** Forward gear count. */
  gears: number;
  /** Maximum rated input power, hp. */
  inputHp: number;
  /** Maximum rated input torque, lb-ft. */
  inputTorque: number;
  /** Maximum rated gross vehicle weight, lb. */
  gvw: number;
  /** Dry weight, lb. */
  dryWeight: number;
  /** Governing standard or the OEM's platform drawing. */
  standard: string;
  /** Whether another configuration can be substituted, or the release locks it. */
  interchangeability: string;
  /** Programme-critical, channel stock, or a service exchange unit. */
  criticality: string;
  /** Where a built unit waits. */
  storage: string;
  /** Engineering release level the unit is built to. */
  releaseLevel: string;
  /** Test protocol every unit passes before it can ship. */
  testProtocol: string;
  warranty: string;
  certifications: string[];
  /** Which plants build it. */
  plants: string[];
}

/**
 * The rating headline, as a spec sheet prints it.
 *
 * Derived, never stored: it is the three rating fields in the order a reader
 * checks them. Storing it would be a fourth string that can disagree with the
 * three numbers it comes from, and the rating band is the one thing an OEM
 * engineer checks first, so it is the worst one to let drift.
 */
function ratingLine(spec: UnitSpec): string {
  return `${spec.inputHp} hp · ${spec.inputTorque.toLocaleString()} lb-ft · ${spec.gvw.toLocaleString()} lb GVW`;
}

export interface ProductStyle {
  /** The unit's style number: AL5605, AL7108, AL2980, AL3192. */
  style: string;
  name: string;
  brand: Brand;
  construction: Construction;
  /** Nominal envelope, as the installation drawing states it. */
  size: string;
  /** Which plant builds it. */
  plant: Plant;
  /** How a built unit ships. */
  backing: string;
  /** The spec headline — what the sheet leads with. */
  fibre: string;
  /** The thumbnail's silhouette family. */
  form: ProductForm;
  /** SAP material number — the build system's own key. */
  itemCode: string;
  spec: ProductSpec;
  colourways: Colourway[];
}

/* ─── Configuration colour ────────────────────────────────────────
 * One vocabulary in this book, unlike the MRO one it replaces:
 * every variant is a CONFIGURATION, not a manufacturer, because
 * Allison is the manufacturer of all of them. So the colours are
 * assigned by what the configuration DOES — retarder options warm,
 * PTO provisions green, fuel-efficiency variants blue, rebuild
 * exchange units grey — which gives the swatch a meaning a reader
 * can learn rather than a livery to memorise.
 * ─────────────────────────────────────────────────────────────── */

/** Lays the typed fields out the way the record prints them. */
function groupsOf(s: UnitSpec): SpecGroup[] {
  return [
    {
      title: "Ratings",
      fields: [
        { label: "Rating", value: ratingLine(s) },
        { label: "Forward gears", value: String(s.gears) },
        { label: "Dry weight", value: `${s.dryWeight.toLocaleString()} lb` },
        { label: "Standard", value: s.standard },
      ],
    },
    {
      title: "Build & test",
      fields: [
        { label: "Built at", value: s.plants.join(", ") },
        { label: "Case & gears", value: s.material },
        { label: "Release level", value: s.releaseLevel },
        { label: "Test protocol", value: s.testProtocol },
        { label: "Held at", value: s.storage },
      ],
    },
    {
      title: "Programme",
      fields: [
        { label: "Substitution", value: s.interchangeability },
        { label: "Criticality", value: s.criticality },
        { label: "Warranty", value: s.warranty },
        { label: "Certified", value: s.certifications.join(", ") },
      ],
    },
  ];
}

function spec(over: Partial<UnitSpec> = {}): ProductSpec {
  const s: UnitSpec = {
    construction: "Automatic transmission",
    material: "Aluminium case, carburised steel gear set",
    gears: 6,
    inputHp: 365,
    inputTorque: 700,
    gvw: 33_000,
    dryWeight: 330,
    standard: "Allison published rating",
    interchangeability: "Configuration substitution allowed",
    criticality: "Channel stock",
    storage: "Finished unit bay · Indianapolis PDC",
    releaseLevel: "Current production",
    testProtocol: "Hot test · full shift-cycle, every unit",
    warranty: "Allison standard · 24 months / unlimited miles",
    certifications: ["IATF 16949"],
    plants: ["Indianapolis"],
    ...over,
  };
  return { construction: s.construction, groups: groupsOf(s) };
}

/* ═══════════════════════════════════════════════════════════════
 *  THE BOOK
 * ═══════════════════════════════════════════════════════════════ */

export const CATALOGUE: ProductStyle[] = [
  /* ─── 3000 Series — the volume programme family the anchor event lives on ─── */
  {
    style: "AL5605",
    name: "3000 RDS Rugged Duty",
    brand: "3000 Series",
    construction: "program",
    form: "transmission",
    size: "26.4 × 21.3 × 23.1 in",
    itemCode: "MAT-30-5605",
    /* Indianapolis, because the 3000 Series volume is what the six on-highway
       plants exist to run. The capped machining line quoted against a nominal
       21-day case-casting window is the demo's own tension, kept from the
       earlier build because it is the same tension in a truer place. */
    plant: FACTORIES["walker-die-casting"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, close-ratio, output retarder available",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 450,
      inputTorque: 1_250,
      gvw: 98_100,
      dryWeight: 727,
      standard: "Allison published rating · OEM platform drawing",
      interchangeability: "Locked to release level — engineering approval required",
      criticality: "Programme-critical",
      releaseLevel: "R14.2",
      plants: ["Indianapolis"],
    }),
    /* Configurations, named the way a spec sheet names them. Nothing here is a
       manufacturer — Allison builds all of them — so the swatch colour carries
       what the configuration DOES instead. */
    colourways: [
      { number: "5605", name: "Close-ratio", hex: "#1F4E9C" },
      { number: "5799", name: "Wide-ratio", hex: "#2B3A67" },
      { number: "5952", name: "Output retarder", hex: "#E8742B" },
      { number: "6099", name: "PTO-provisioned", hex: "#2E7D32" },
      { number: "6134", name: "xFE fuel-efficiency", hex: "#1C7ED6" },
      { number: "6266", name: "Close-ratio, no PTO", hex: "#4A4E54" },
      { number: "6473", name: "Wide-ratio, retarder", hex: "#C2410C" },
      { number: "6555", name: "Rebuild exchange", hex: "#C7CBD1" },
    ],
  },

  /* ─── 4000 Series — the heavy end ───────────────────────────────────── */
  {
    style: "AL7108",
    name: "4500 RDS Rugged Duty",
    brand: "4000 Series",
    construction: "program",
    form: "transmission",
    size: "33.9 × 24.6 × 26.8 in",
    itemCode: "MAT-30-7108",
    plant: FACTORIES["walker-die-casting"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, wide-ratio, integral retarder",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 800,
      inputTorque: 2_360,
      gvw: 242_550,
      dryWeight: 1_240,
      standard: "Allison published rating · OEM platform drawing",
      interchangeability: "Locked to release level — engineering approval required",
      criticality: "Programme-critical",
      releaseLevel: "R12.8",
      testProtocol: "Hot test · extended load cycle, every unit",
      plants: ["Indianapolis"],
    }),
    colourways: [
      { number: "7108", name: "Wide-ratio", hex: "#2B3A67" },
      { number: "7240", name: "Integral retarder", hex: "#E8742B" },
      { number: "7355", name: "PTO-provisioned, dual", hex: "#2E7D32" },
      { number: "7466", name: "Close-ratio", hex: "#1F4E9C" },
      { number: "7590", name: "Off-highway cooler circuit", hex: "#8B5E34" },
      { number: "7612", name: "Rebuild exchange", hex: "#C7CBD1" },
    ],
  },

  /* ─── 2000 Series — medium duty, and the channel's volume ───────────── */
  {
    style: "AL2980",
    name: "2500 RDS Rugged Duty",
    brand: "2000 Series",
    construction: "channel",
    form: "transmission",
    size: "23.8 × 19.1 × 20.4 in",
    itemCode: "MAT-30-2980",
    plant: FACTORIES["midwest-gear"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, close-ratio, PTO provision",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 300,
      inputTorque: 660,
      gvw: 30_000,
      dryWeight: 341,
      releaseLevel: "Current production",
      criticality: "Channel stock",
      plants: ["Indianapolis", "Szentgotthárd"],
    }),
    colourways: [
      { number: "2980", name: "Close-ratio", hex: "#1F4E9C" },
      { number: "3105", name: "Wide-ratio", hex: "#2B3A67" },
      { number: "3266", name: "PTO-provisioned", hex: "#2E7D32" },
      { number: "3390", name: "xFE fuel-efficiency", hex: "#1C7ED6" },
      { number: "3477", name: "Rebuild exchange", hex: "#C7CBD1" },
    ],
  },

  /* ─── 1000 Series — pure channel, built to stock ─────────────────────── */
  {
    style: "AL3192",
    name: "1000 HS Highway",
    brand: "1000 Series",
    construction: "channel",
    form: "transmission",
    size: "22.1 × 18.4 × 19.6 in",
    itemCode: "MAT-30-3192",
    plant: FACTORIES["midwest-gear"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, highway ratio set",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 300,
      inputTorque: 560,
      gvw: 26_000,
      dryWeight: 330,
      interchangeability: "Configuration substitution allowed",
      criticality: "Channel stock",
      plants: ["Indianapolis"],
    }),
    colourways: [
      { number: "3192", name: "Highway ratio", hex: "#1F4E9C" },
      { number: "3318", name: "PTO-provisioned", hex: "#2E7D32" },
      { number: "3444", name: "xFE fuel-efficiency", hex: "#1C7ED6" },
      { number: "3560", name: "Rebuild exchange", hex: "#C7CBD1" },
    ],
  },

  /* ─── 3000 HS — the same family on a highway ratio set ───────────────── */
  {
    style: "AL4735",
    name: "3000 HS Highway",
    brand: "3000 Series",
    construction: "program",
    form: "transmission",
    size: "26.4 × 21.3 × 22.6 in",
    itemCode: "MAT-30-4735",
    plant: FACTORIES["walker-die-casting"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, highway ratio set, transit-duty cooling",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 450,
      inputTorque: 1_250,
      gvw: 66_000,
      dryWeight: 702,
      standard: "Allison published rating · OEM platform drawing",
      interchangeability: "Locked to release level — engineering approval required",
      criticality: "Programme-critical",
      releaseLevel: "R14.2",
      plants: ["Indianapolis", "Szentgotthárd"],
    }),
    colourways: [
      { number: "4735", name: "Highway ratio", hex: "#1F4E9C" },
      { number: "4812", name: "Transit-duty cooling", hex: "#0E7C86" },
      { number: "5061", name: "Output retarder", hex: "#E8742B" },
      { number: "5151", name: "PTO-provisioned", hex: "#2E7D32" },
      { number: "5210", name: "xFE fuel-efficiency", hex: "#1C7ED6" },
    ],
  },

  /* ─── 2100 HS — the tail of the channel book ─────────────────────────── */
  {
    style: "AL3843",
    name: "2100 HS Highway",
    brand: "2000 Series",
    construction: "channel",
    form: "transmission",
    size: "23.8 × 19.1 × 19.8 in",
    itemCode: "MAT-30-3843",
    plant: FACTORIES["chennai-forge"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, highway ratio set",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 300,
      inputTorque: 620,
      gvw: 29_000,
      dryWeight: 335,
      criticality: "Channel stock",
      storage: "Finished unit bay · Shanghai PDC",
      plants: ["Chennai"],
    }),
    colourways: [
      { number: "3843", name: "Highway ratio", hex: "#1F4E9C" },
      { number: "3961", name: "PTO-provisioned", hex: "#2E7D32" },
      { number: "4088", name: "xFE fuel-efficiency", hex: "#1C7ED6" },
      { number: "4190", name: "Rebuild exchange", hex: "#C7CBD1" },
    ],
  },

  /* ─── 4000 EVS — emergency vehicle, and the tightest release ─────────── */
  {
    style: "AL3184",
    name: "4000 EVS Emergency Vehicle",
    brand: "4000 Series",
    construction: "program",
    form: "transmission",
    size: "33.9 × 24.6 × 25.9 in",
    itemCode: "MAT-30-3184",
    plant: FACTORIES["walker-die-casting"],
    backing: "Single unit, returnable steel rack",
    fibre: "6-speed, emergency-vehicle calibration, integral retarder",
    spec: spec({
      construction: "Automatic transmission",
      gears: 6,
      inputHp: 600,
      inputTorque: 1_850,
      gvw: 80_000,
      dryWeight: 1_180,
      standard: "Allison published rating · NFPA 1901 vehicle application",
      interchangeability: "Locked to release level — engineering approval required",
      criticality: "Programme-critical",
      releaseLevel: "R11.6",
      testProtocol: "Hot test · pump-mode duty cycle, every unit",
      certifications: ["IATF 16949", "NFPA 1901 application"],
      plants: ["Indianapolis"],
    }),
    colourways: [
      { number: "3184", name: "EVS calibration", hex: "#B42318" },
      { number: "3299", name: "Integral retarder", hex: "#E8742B" },
      { number: "3401", name: "Pump-mode PTO", hex: "#2E7D32" },
      { number: "3522", name: "Aerial-duty cooling", hex: "#0E7C86" },
    ],
  },

  /* ─── eGen Power — the electric book, and the one with no stock behind it ── */
  {
    style: "AL9204",
    name: "eGen Power 100D e-Axle",
    brand: "eGen Power",
    construction: "program",
    form: "e-axle",
    size: "Axle centre 17.7 in · track-width dependent",
    itemCode: "MAT-30-9204",
    plant: FACTORIES.kestrel,
    backing: "Single axle, dedicated shipping frame",
    fibre: "Dual-motor electric axle, integrated two-speed gearbox",
    spec: spec({
      construction: "Electric drive axle",
      gears: 2,
      inputHp: 651,
      inputTorque: 2_213,
      gvw: 51_000,
      dryWeight: 1_015,
      material: "Aluminium housing, integrated permanent-magnet motors",
      standard: "Allison published rating · OEM platform drawing",
      interchangeability: "Locked to release level — engineering approval required",
      criticality: "Programme-critical",
      releaseLevel: "R3.1 — ramp",
      testProtocol: "Hot test · dynamometer, every unit, plus end-of-line HV isolation",
      storage: "Finished unit bay · Auburn Hills",
      certifications: ["IATF 16949", "HV safety — end-of-line isolation test"],
      plants: ["Auburn Hills"],
    }),
    colourways: [
      { number: "9204", name: "100D dual-motor", hex: "#1C7ED6" },
      { number: "9310", name: "100S single-motor", hex: "#0E7C86" },
      { number: "9422", name: "130D dual-motor", hex: "#2B3A67" },
    ],
  },
];

/* ─── Reading the book ───────────────────────────────────────── */

/** Every SKU, flattened: one row per style × variant. */
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
