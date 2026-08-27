"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ALL_BRANDS,
  ALL_CATEGORIES,
  ALL_COUNTRIES,
  ALL_REGIONS_SCOPE,
  BRAND_LIST,
  BRANDS,
  CATALOGUE,
  CATEGORIES,
  COUNTRIES,
  REGIONS,
  REGION_LIST,
  countriesInRegion,
  categoryById,
  entityFor,
  type BrandMeta,
  type Category,
  type Country,
  type Region,
} from "@/data/catalogue";
import type { ActionRow } from "@/data/action-center";
import { usePersona } from "@/context/PersonaContext";
import type { Persona } from "@/types/persona";

/* ═══════════════════════════════════════════════════════════════
 *  Which book the app is looking at
 *
 *  Three questions, asked once, above the seat: WHOSE brand, WHICH
 *  region, WHICH state inside it. They are the same three questions
 *  on every screen, and answering them once is the point.
 *
 *  An earlier build asked category → plant → DC, because that company
 *  makes what it sells. Target does not: it buys finished, packaged
 *  goods FOB Asia and moves them through regional DCs into its own
 *  stores and site. So the middle question changed from "where
 *  is it made" — which has hundreds of answers Target does not own — to
 *  "where does it go".
 *
 *  BRAND is independent; REGION → STATE is a parent-child pair, and
 *  changing the region lands on that region's own states rather
 *  than keeping a selection belonging to a different region. That
 *  is the same mechanic the category → plant pair used to carry.
 *
 *  Every seat honours all three, because a scope that some pages
 *  ignore is worse than none — the reader stops trusting what the
 *  control says. The executive is the one exception and it carries
 *  no controls at all, for exactly that reason: its measures are
 *  computed across every brand and every region, so a narrower label
 *  would describe a cut the page does not make.
 *
 *  In memory, like the rest of this prototype's state: a reload puts
 *  it back to the default so a walkthrough starts the same way twice.
 * ═══════════════════════════════════════════════════════════════ */

export type BrandScope = typeof ALL_BRANDS | string;
export type RegionScope = typeof ALL_REGIONS_SCOPE | string;
export type CountryScope = typeof ALL_COUNTRIES | string;

/** Every sourcing sub-category, as a scope — the buyer's own second book. */
export const ALL_SOURCING = "all" as const;
export type SourcingScope = typeof ALL_SOURCING | string;

/** Every sourcing region, as a scope. Distinct from the SALES region above:
 *  China is where an item is made, the West is where it is sold. Naming
 *  them both "region" was the fastest way to filter the wrong book. */
export const ALL_SOURCING_REGIONS = "all" as const;
export type SourcingRegionScope = typeof ALL_SOURCING_REGIONS | string;

/**
 * Every brand — because brand is NOT a top-bar control any more.
 *
 * The West Priority sheet plans on Function × Region × State × Category
 * and carries no brand column, so the bar follows the sheet. Brand stays in
 * the model because the mechanics that make this app worth building are
 * per-brand — the approval clock, the royalty floor, the termination
 * threshold — and those belong on the rows.
 *
 * It defaults to ALL for the same reason it left the bar: a scope with no
 * visible control is an invisible filter, and an invisible filter silently
 * eating queue rows is the worst version of the "control asserting a scope
 * the page ignores" failure — the reader cannot even see the control to stop
 * trusting it.
 */
const DEFAULT_BRAND = ALL_BRANDS;

/**
 * West, because the priority sheet IS the West — and because that is where
 * the exposure sits: Woodland is the first inland node behind the LA/Long
 * Beach import gateway, so port dwell, chassis shortages and peak-season
 * gate cuts all land on this one node first.
 */
const DEFAULT_REGION = "west";

/**
 * Every state, not one of them.
 *
 * A seat should not open pre-narrowed to a market the reader did not choose —
 * which is the mistake an earlier build made with its category selector, opening
 * every buyer on one sub-category. The region is a default because a reader is
 * always standing somewhere; a state is a deliberate act.
 */
const DEFAULT_COUNTRY = ALL_COUNTRIES;

/** Home & Kitchen — the larger of the two priority categories in the sheet. */
const DEFAULT_CATEGORY = "home";

interface ScopeValue {
  /**
   * Whose book. Not in the top bar — see `DEFAULT_BRAND`. Held here so the
   * rows, the licensor clocks and the royalty maths have one source.
   */
  brand: BrandMeta | null;
  brandScope: BrandScope;
  setBrand: (id: string) => void;
  brands: BrandMeta[];

  /** Where it is held, which is also which DC. Null when the scope is every region. */
  region: Region | null;
  regionScope: RegionScope;
  setRegion: (id: string) => void;
  regions: Region[];

  /** Which market. Null when the scope is every state. */
  country: Country | null;
  countryScope: CountryScope;
  setCountry: (id: string) => void;
  /** The states this region runs, for the second dropdown. */
  countriesInScope: Country[];

  /** What is being sold — the sheet's third planning dimension. */
  category: Category;
  categoryScope: string;
  setCategory: (id: string) => void;
  categories: Category[];

  /**
   * The entity this seat works from, derived from persona × state rather than
   * chosen. The same state resolves to Minneapolis HQ for the commercial seats
   * and to a distribution node for logistics — see `entityFor`. Null outside the
   * West, where the priority sheet says nothing.
   */
  entity: string | null;

  /** The buyer's sourcing cuts, which are a different book entirely. */
  sourcing: SourcingScope;
  setSourcing: (next: SourcingScope) => void;
  sourcingRegion: SourcingRegionScope;
  setSourcingRegion: (next: SourcingRegionScope) => void;
  /**
   * Whether a play is inside the buyer's scope.
   *
   * Unknown passes on both cuts: a play with no sub-category is not a play
   * belonging to none of them, it is one the book has not classified yet, and
   * hiding it would be the filter deciding a row does not exist because the
   * data has not caught up. Multi-region passes every region for the same
   * reason it reads that way — a play spanning three regions is in scope for
   * each of them.
   */
  inSourcing: (play: { subCategory?: string; region?: string }) => boolean;

  /** True where the chosen category has no book in this prototype. */
  empty: boolean;
  /** Whether a row belongs to the brand, region and state in scope. */
  inScope: (row: ActionRow) => boolean;
}

const Ctx = createContext<ScopeValue | undefined>(undefined);

/** Style name → its brand, so a row can be placed by its product. */
const BRAND_BY_STYLE = new Map(CATALOGUE.map((s) => [s.name, s.brand]));

/**
 * The brand a row belongs to.
 *
 * Via the product, because at Target the brand IS a property of the style — a
 * partner program's product family belongs to one licensor and one calendar. A row whose
 * product is not in the catalogue belongs to no brand and shows in every scope:
 * hiding it would be the filter quietly deciding a row does not exist because
 * the book has not caught up with it.
 */
export function brandOfRow(row: ActionRow): BrandMeta | null {
  const name = BRAND_BY_STYLE.get(row.product);
  if (!name) return null;
  return BRAND_LIST.find((b) => b.name === name) ?? null;
}

/**
 * The state a row is destined for, if it is destined for one.
 *
 * Only rows about goods going somewhere have one — a store order, an
 * allocation, a shipment. A purchase order on a Tier 1 factory is about a
 * counterparty upstream and belongs to no state, which is why "unknown passes"
 * matters more here than it did on the earlier build's DC cut: most of the buyer's book has
 * no destination yet.
 */
export function countryOfRow(row: ActionRow): Country | null {
  return Object.values(COUNTRIES).find((c) => c.name === row.party) ?? null;
}

/**
 * The region a row sits in — via its state, or via the DC named as its party.
 *
 * Two ways in, and the state wins: a row addressed to Washington is a West
 * row whether or not it also names the Woodland RDC.
 */
export function regionOfRow(row: ActionRow): Region | null {
  const country = countryOfRow(row);
  if (country) return REGIONS[country.region] ?? null;
  return REGION_LIST.find((r) => r.dc === row.party) ?? null;
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [brandId, setBrandId] = useState<BrandScope>(DEFAULT_BRAND);
  const [regionId, setRegionId] = useState<RegionScope>(DEFAULT_REGION);
  const [countryId, setCountryId] = useState<CountryScope>(DEFAULT_COUNTRY);
  const [categoryId, setCategoryId] = useState<string>(DEFAULT_CATEGORY);
  /* Everything, first — a seat should not open pre-narrowed. */
  const [sourcing, setSourcing] = useState<SourcingScope>(ALL_SOURCING);
  const [sourcingRegion, setSourcingRegion] = useState<SourcingRegionScope>(ALL_SOURCING_REGIONS);

  /**
   * The executive opens on every brand; every other seat opens on the anchor's.
   *
   * The executive is the only seat that genuinely reads across — its measures
   * are computed over the whole book, and a narrower label there would describe
   * a cut the page does not make. Applied on the persona CHANGE rather than
   * every render, so a reader who widens or narrows it themselves keeps their
   * choice. A default is where a seat starts, not somewhere it is held.
   */
  const { persona } = usePersona();
  const lastPersona = useRef<Persona | null>(null);
  useEffect(() => {
    if (lastPersona.current === persona) return;
    lastPersona.current = persona;
    setBrandId(persona === "executive" ? ALL_BRANDS : DEFAULT_BRAND);
    setCategoryId(persona === "executive" ? ALL_CATEGORIES : DEFAULT_CATEGORY);
  }, [persona]);

  const value = useMemo<ScopeValue>(() => {
    const category = categoryById(categoryId) ?? CATEGORIES[0];
    /* A category with no factories has no book here, and nothing in the app
       belongs to it — so everything empties, which is the truthful answer
       rather than a filter that silently does nothing. */
    const empty = category.factories.length === 0;

    const brand = brandId === ALL_BRANDS ? null : (BRANDS[brandId] ?? null);
    const region = regionId === ALL_REGIONS_SCOPE ? null : (REGIONS[regionId] ?? null);
    const countriesInScope = region ? countriesInRegion(region.id) : [];
    const country = countryId === ALL_COUNTRIES ? null : (COUNTRIES[countryId] ?? null);

    return {
      brand,
      brandScope: brandId,
      setBrand: setBrandId,
      brands: BRAND_LIST,

      region,
      regionScope: regionId,
      setRegion: (id) => {
        setRegionId(id);
        /* Land on every state rather than keeping one that belongs to a
           different region. Widening, not guessing: the region changed, so
           the reader's state choice no longer refers to anything. */
        setCountryId(ALL_COUNTRIES);
      },
      regions: REGION_LIST,

      country,
      countryScope: countryId,
      setCountry: setCountryId,
      countriesInScope,

      category,
      categoryScope: categoryId,
      setCategory: setCategoryId,
      categories: CATEGORIES,

      entity: entityFor(persona, country?.id ?? null),

      sourcing,
      setSourcing,
      sourcingRegion,
      setSourcingRegion,
      inSourcing: (play) => {
        const catOk =
          sourcing === ALL_SOURCING ||
          play.subCategory === undefined ||
          play.subCategory === sourcing;
        const regionOk =
          sourcingRegion === ALL_SOURCING_REGIONS ||
          play.region === undefined ||
          play.region === sourcingRegion ||
          play.region === "Multi-region";
        return catOk && regionOk;
      },

      empty,
      inScope: (row) => {
        if (empty) return false;
        /* Three cuts, and every one of them is "unknown passes". A row whose
           product is not in the catalogue belongs to no brand; a purchase order
           on a factory belongs to no state and no region. Hiding either would
           be the filter quietly deciding a row does not exist because the book
           has not caught up with it. */
        if (brand) {
          const rowBrand = brandOfRow(row);
          if (rowBrand !== null && rowBrand.id !== brand.id) return false;
        }
        if (region) {
          const rowRegion = regionOfRow(row);
          if (rowRegion !== null && rowRegion.id !== region.id) return false;
        }
        if (country) {
          const rowCountry = countryOfRow(row);
          if (rowCountry !== null && rowCountry.id !== country.id) return false;
        }
        return true;
      },
    };
  }, [brandId, regionId, countryId, categoryId, sourcing, sourcingRegion, persona]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScope(): ScopeValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScope must be used inside a ScopeProvider");
  return ctx;
}
