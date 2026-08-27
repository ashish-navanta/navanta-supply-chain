"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Armchair,
  Diamond,
  FirstAid,
  Globe,
  Package,
  ShoppingCart,
  SquaresFour,
  Storefront,
  Tag,
  TShirt,
  Warehouse,
  type Icon,
} from "@phosphor-icons/react";
import { Breadcrumbs, Select } from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";

import {
  SOURCING_CATEGORIES,
  SOURCING_L1,
  SOURCING_REGIONS,
  l2Under,
} from "@/data/sourcing-categories";
import { ALL_COUNTRIES, ALL_REGIONS_SCOPE } from "@/data/catalogue";
import {
  ALL_SOURCING,
  ALL_SOURCING_REGIONS,
  useScope,
} from "@/context/ScopeContext";
import { BUYING_ROUTES, activeEntry } from "@/data/nav";

/**
 * The bar above the work. The rail owns navigation and the profile; this
 * carries the toggle that expands it and the seat and page you are on.
 *
 * No actions. The agent has its own collapsed rail down the side of every
 * page, so a "Chat Mercer" button here was a second door to a room already
 * standing open.
 */
/**
 * The glyph for each scope option, resolved here rather than in the data.
 *
 * The catalogue names the icon and this owns the import — a data file that
 * imported React components would drag the whole icon set into anything that
 * reads a product, and the server bundles read products.
 */
function CategoryGlyph({ icon }: { icon: string }) {
  const Glyph = CATEGORY_ICON[icon] ?? Package;
  return (
    <Glyph
      size={15}
      weight="duotone"
      className="shrink-0"
      style={{ color: "var(--text-secondary)" }}
    />
  );
}

const CATEGORY_ICON: Record<string, Icon> = {
  Globe,
  SquaresFour,
  Package,
  Tag,
  Armchair,
  ShoppingCart,
  TShirt,
  Diamond,
  FirstAid,
};

/* `onToggleNav` is still accepted and deliberately unused: the portal layout
   owns the rail's expanded state and passes its setter here, and dropping the
   prop would mean editing that layout to remove an argument it is right to keep
   offering. The bar simply no longer draws a control for it. */
export default function TopBar({ onToggleNav: _onToggleNav }: { onToggleNav?: () => void }) {
  const {
    regionScope,
    setRegion,
    regions,
    countryScope,
    setCountry,
    countriesInScope,
    category,
    categoryScope,
    setCategory,
    categories,
    sourcing,
    setSourcing,
    sourcingRegion,
    setSourcingRegion,
  } = useScope();
  const { persona } = usePersona();
  const pathname = usePathname();
  /* The buyer's chosen sourcing sub-category (L2), from the seed taxonomy. */
  const [sourcingL1, setSourcingL1] = useState(SOURCING_CATEGORIES[0].l1);

  const profile = PERSONAS[persona];
  /* Seat first, then the page inside it. On a seat with one page the two would
     read as "Planning · Action center", which says nothing twice — so the page
     name only appears where the rail actually offers a choice. */
  const entry = activeEntry(persona, pathname);

  /* A record inside a page — /service/orders/SO-4471 — gets a third crumb.
     `activeEntry` matches the list page by prefix, so whatever is left of the
     path after it IS the record, and there is no second lookup to keep in step
     with the routes. The list crumb becomes the way back, which is the only
     reason a trail beats a title: it is the one thing the reader wants after
     they have read the record. */
  const leaf =
    entry && pathname.startsWith(`${entry.key}/`)
      ? decodeURIComponent(pathname.slice(entry.key.length + 1).split("/")[0])
      : null;

  /* On a seat whose landing page IS the page, "Buying · Action center" says
     nothing twice — so the page name normally stays off. It comes back the
     moment there is a record below it, because then the middle crumb is not a
     label, it is the way back. */
  const showPage = entry && (leaf !== null || entry.key !== profile.route);

  return (
    <header
      className="relative z-10 flex shrink-0 items-center justify-between"
      style={{
        background: "var(--surface-chrome)",
        borderBottom: "1px solid var(--ds-border-default)",
        height: 48,
        /* Even inset now that the left edge is an icon button rather than a
           wordmark — the 20px was there to give the logo air. */
        padding: "0 16px",
      }}
    >
      {/* Left: the wordmark, then where you are.
          No toggle. The rail carries both halves of that control now — the
          expand button in its collapsed top slot, and the DS's own collapse
          handle on the expanded panel's edge — so a third control in the bar was
          a second way to do a thing the column already offers, sitting where it
          could not show which state it would produce.
          The wordmark is back, and it is the navy cut, matching the
          manufacturing app's bar — the two products share their chrome now. It
          reads here rather than in the rail because the rail is teal at both
          widths and its collapsed state is 48px of icons; a brand that
          disappears when a column narrows is not carrying the brand.
          The two-logos problem this note used to describe is solved the other
          way round instead: the collapsed rail no longer sets the name, so there
          is exactly one wordmark on screen at every width. */}
      <div className="flex items-center" style={{ gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/navanta-logo.svg"
          alt="Navanta"
          style={{ height: 18, width: "auto" }}
        />
        {/* A rule between the brand and where-you-are.
            Without it the wordmark and the first crumb read as one phrase —
            "FOSSIL Executive dashboard" — because they sit at the same size on
            the same baseline with nothing but a gap between them. The rule says
            the two are different kinds of thing: one is whose app this is, the
            other is which page you are on. Short of the bar's full height, so
            it separates the text rather than dividing the chrome, and
            aria-hidden because it carries no meaning a screen reader needs —
            the nav landmark already does that job. */}
        <span
          aria-hidden="true"
          style={{
            width: 1,
            height: 18,
            background: "var(--ds-border-default)",
            flex: "none",
          }}
        />
        {/* The DS component rather than spans and mid-dots. The hand-rolled
            version had no nav landmark, no aria-current on the leaf and its own
            separator colour — three things the design system already decided,
            and the kind of divergence that shows up as a slightly-wrong dot. */}
        <Breadcrumbs
          items={[
            { label: profile.pageTitle, href: profile.route },
            ...(showPage && entry
              ? [{ label: entry.label, ...(leaf ? { href: entry.key } : {}) }]
              : []),
            ...(leaf ? [{ label: leaf }] : []),
          ]}
        />
      </div>

      {/* Scope, on the right and in three levels: WHOSE brand, WHICH region,
          WHICH branch inside it. A person at Fossil chooses a brand before
          anything else — the company is a design, brand-licensing and
          distribution business, so every approval gate, royalty floor and
          termination threshold is per-brand and nothing below it means much
          until the brand is settled.
          Then geography, in two different kinds of place: the region IS the DC,
          which is where Fossil's title sits, and the branch is the sales
          subsidiary it goes on to. Upstream node, downstream node — the same
          distinction Fossil's plant/DC pair carried, re-based onto a company that
          does not make what it sells.
          What is NOT here: a plant, because ~91 Tier 1 factories and one owned
          plant is not a scope; a product category, because the book is
          watch-heavy and the control would label a book of one; and a season,
          because the bar answers whose and where while the page answers when. */}
      <div className="flex items-center" style={{ gap: 8 }}>
        {/* Which trio the bar carries is decided by the PAGE, not only the seat.
            Mercer works two different books: the opportunities feed, the
            supplier book and the value ledger are the sourcing book, where the
            L1/L2 taxonomy and the sourcing region are the only cuts that mean
            anything — a sales region and a branch are where a watch is sold, not
            where it is assembled. The action center is the other way round: its
            rows are POs and approvals against a brand calendar, so the
            brand/region/branch trio applies there, exactly as on every other
            seat. */}
        {/* The executive carries exactly ONE control: category. Its measures
            are genuinely computed across every country — so region and country
            stay off — but the page reads the company at two scales, the whole
            book vs the watch book, and `scaleFor` needs the reader to be able
            to say which. One control, and the page honours it everywhere. */}
        {persona === "executive" ? (
          <Select value={categoryScope} onValueChange={(v: string) => setCategory(v)}>
            <Select.Trigger size="sm" aria-label="Category" className="w-[176px]">
              <span
                className="min-w-0 items-center"
                style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
              >
                <CategoryGlyph icon={category.icon} />
                <Select.Value placeholder="Category" />
              </span>
            </Select.Trigger>
            <Select.Content>
              {categories.map((c) => (
                <Select.Item key={c.id} value={c.id}>
                  <span className="flex items-center" style={{ gap: 8 }}>
                    <CategoryGlyph icon={c.icon} />
                    {c.label}
                  </span>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        ) : persona === "buyer" &&
          !pathname.startsWith(BUYING_ROUTES.actionCenter) ? (
          /* The buyer's own three cuts. All three default to everything: the
             Fossil build opened this seat pre-narrowed to one of seven families
             before the reader had chosen anything. */
          <>
            <Select
              value={sourcingL1}
              onValueChange={(v: string) => {
                setSourcingL1(v);
                /* A family change drops the sub-category back to All rather than
                   keeping one that belongs to a different family. */
                setSourcing(ALL_SOURCING);
              }}
            >
              <Select.Trigger size="sm" aria-label="Spend family" className="w-[196px]">
                <span
                  className="min-w-0 items-center"
                  style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
                >
                  <CategoryGlyph icon="Package" />
                  <Select.Value placeholder="Spend family" />
                </span>
              </Select.Trigger>
              <Select.Content>
                {SOURCING_L1.map((l1) => (
                  <Select.Item key={l1} value={l1}>
                    {l1}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>

            <Select value={sourcing} onValueChange={(v: string) => setSourcing(v)}>
              {/* A different glyph from the family beside it, so the two are told
                  apart at a glance rather than by reading them. */}
              <Select.Trigger size="sm" aria-label="Sourcing category" className="w-[204px]">
                <span
                  className="min-w-0 items-center"
                  style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
                >
                  <CategoryGlyph icon="Tag" />
                  <Select.Value placeholder="All categories" />
                </span>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL_SOURCING}>All categories</Select.Item>
                {l2Under(sourcingL1).map((c) => (
                  <Select.Item key={c.id} value={c.l2}>
                    {c.l2}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>

            <Select
              value={sourcingRegion}
              onValueChange={(v: string) => setSourcingRegion(v)}
            >
              <Select.Trigger size="sm" aria-label="Sourcing region" className="w-[168px]">
                <span
                  className="min-w-0 items-center"
                  style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
                >
                  <CategoryGlyph icon="Globe" />
                  <Select.Value placeholder="All regions" />
                </span>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL_SOURCING_REGIONS}>All regions</Select.Item>
                {SOURCING_REGIONS.map((r) => (
                  <Select.Item key={r} value={r}>
                    {r}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </>
        ) : (
          /* Region — the first cut, and the first column of the priority
             sheet. It is also the DC: Fossil runs one distribution centre per
             region, so the geography and the network are the same question and
             the bar asks it once. */
          <Select value={regionScope} onValueChange={(v: string) => setRegion(v)}>
            {/* A warehouse, because the region IS the DC — the place where
                Fossil's title actually sits.
                The glyph is inside the trigger, not beside it: `Select.Value`
                renders the selected item's label alone, so an icon set on the
                option disappears the moment it is chosen — the one state where
                it does the most work, because a closed control is what the
                reader looks at all day. */}
            <Select.Trigger size="sm" aria-label="Region" className="w-[168px]">
              <span
                className="min-w-0 items-center"
                style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
              >
                <Warehouse
                  size={15}
                  weight="duotone"
                  className="shrink-0"
                  style={{ color: "var(--text-secondary)" }}
                />
                <Select.Value placeholder="All regions" />
              </span>
            </Select.Trigger>
            <Select.Content>
              {regions.map((r) => (
                <Select.Item key={r.id} value={r.id}>
                  {r.name}
                </Select.Item>
              ))}
              {regions.length > 1 && (
                <Select.Item value={ALL_REGIONS_SCOPE}>All regions</Select.Item>
              )}
            </Select.Content>
          </Select>
        )}

        {/* Country + category complete the sheet's trio. Both are dropped on
            the buyer's sourcing pages and on the executive, for opposite
            reasons.
            The buyer's sourcing book is upstream: a selling country is where a
            watch goes, not where it is assembled, so that seat gets its own
            three cuts above.
            The executive is the other end — every measure on the command center
            is computed across every country and both priority categories,
            because that is the only place those measures exist. A bar reading
            "Canada · Watches" over company-wide numbers is a control asserting
            a scope the page ignores, which is worse than no control, because
            the reader stops trusting what it says. */}
        {persona !== "executive" &&
          (persona !== "buyer" || pathname.startsWith(BUYING_ROUTES.actionCenter)) && (
          <>
            <Select
              /* Empty rather than the scope's value when the region is "all" and
                 there are no countries to list: with no item to match it, the
                 trigger prints the raw value — "all" — where the placeholder
                 should be. */
              value={countriesInScope.length ? countryScope : ""}
              onValueChange={(v: string) => setCountry(v)}
              disabled={countriesInScope.length === 0}
            >
              {/* A storefront, not a warehouse — the glyph is the fastest way to
                  tell this control apart from the one beside it, and the two mean
                  genuinely different places: one is where stock is held, the
                  other is the market it is sold into. */}
              <Select.Trigger size="sm" aria-label="State" className="w-[176px]">
                <span
                  className="min-w-0 items-center"
                  style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
                >
                  <Storefront
                    size={15}
                    weight="duotone"
                    className="shrink-0"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <Select.Value placeholder="All states" />
                </span>
              </Select.Trigger>
              <Select.Content>
                {/* All countries FIRST here, unlike the region control: a reader
                    lands on a region and works all of it, and narrowing to one
                    market is the deliberate act. */}
                <Select.Item value={ALL_COUNTRIES}>All states</Select.Item>
                {countriesInScope.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>

            <Select value={categoryScope} onValueChange={(v: string) => setCategory(v)}>
              <Select.Trigger size="sm" aria-label="Category" className="w-[176px]">
                <span
                  className="min-w-0 items-center"
                  style={{ display: "flex", gap: 7, whiteSpace: "nowrap" }}
                >
                  <CategoryGlyph icon={category.icon} />
                  <Select.Value placeholder="Category" />
                </span>
              </Select.Trigger>
              <Select.Content>
                {categories.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {/* The label alone. Every category Fossil sells is listed
                        and none of them are annotated: `priority` still marks
                        which book is loaded and the page says so when a reader
                        lands on an empty one, but a scope control is not the
                        place to caveat its own options. */}
                    <span className="flex items-center" style={{ gap: 8 }}>
                      <CategoryGlyph icon={c.icon} />
                      {c.label}
                    </span>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </>
        )}
      </div>
    </header>
  );
}
