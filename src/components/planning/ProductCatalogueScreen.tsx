"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DownloadSimple, Factory, Image as ImageIcon, Package } from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  PageHeading,
  Pill,
  TableShell,
  type DataTableColumn,
} from "@navanta-ai/design-system";
import { SkuSwatch } from "@/components/ui/SkuSwatch";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { QtyStack } from "@/components/ui/QtyStack";
import { SwatchStack } from "@/components/ui/SwatchStack";
import { POSITIONS } from "@/data/planning";
import { CATALOGUE, SKUS, type CatalogueSku } from "@/data/catalogue";
import { productRoute } from "@/data/nav";
import { catalogueCsv } from "@/data/catalogue-csv";
import {
  colourFamily,
  consensusColour,
  distance,
  matchPct,
  rankColourways,
} from "@/lib/colour-match";
import { ImageSearchModal, type ImageMatch } from "@/components/planning/ImageSearchModal";
import {
  ImageMatchBar,
  type Facet,
  type FacetOption,
} from "@/components/planning/ImageMatchBar";

/**
 * The book, as a list.
 *
 * Every other table in this app is a work list — things that need somebody. This
 * one is a reference: it answers "what does Target sell and what is it called",
 * which is the question behind every SKU number printed anywhere else. It is
 * tabbed by style rather than filtered, because a planner looking one up knows
 * the style before they know the colour.
 */

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** How much of each SKU the book is actually holding. */
const HELD = new Map<string, number>();
for (const p of POSITIONS) HELD.set(p.sku, (HELD.get(p.sku) ?? 0) + p.onHand);


/**
 * The families this book actually carries, listed the way a person would say
 * them.
 *
 * Read off the catalogue rather than named in the heading: this was three
 * hardcoded Target brand names, so every other company's catalogue announced
 * itself as somebody else's. A one-family pack should not read "A, and"
 * either, which is why the join is spelled out rather than done with commas.
 */
function familiesInBook(): string {
  const names = [...new Set(CATALOGUE.map((s) => s.brand))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function ProductCatalogueScreen() {
  const [q, setQ] = useState("");
  /* A colour sampled from a photograph, when somebody has searched by image.
     Held as a hex because that is all that leaves the browser — see
     `dominantColour`. */
  const [sampled, setSampled] = useState<string | null>(null);
  /* What the reader uploaded, so the result bar can show it back to them. Held
     beside the colour rather than inside it: one is the answer, the other is the
     question, and the bar shows both. */
  const [match, setMatch] = useState<ImageMatch | null>(null);
  /* The three axes the result bar narrows on. Null is "All" — the absence of a
     cut, which is a different thing from an empty string. */
  const [family, setFamily] = useState<string | null>(null);
  const [texture, setTexture] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  /* Whether the image-search modal is open — see ImageSearchModal, which owns the
     dropzone, the accepted formats and the note about where the photograph goes. */
  const [picking, setPicking] = useState(false);
  const [page, setPage] = useState(1);
  /* 50, because the book is 35 — one page rather than several. */
  const [pageSize, setPageSize] = useState(50);

  /* On "All styles", a row is a STYLE. It was a row per colourway, which meant
     the dinnerware set printed its style number, brand, construction and size
     eight times — four columns of the same four answers — while the one thing
     that differs between those rows, the colour, was a 32px chip. A style is one
     row and the colourways are a stack; picking a style tab drills into them. */
  /* Every product, one row each — the book is 35 variants and this is the page
     that lists them. It was eight style rows for a while, which killed the
     column repetition but also killed the thing the page is for: a reader here
     is looking up a PRODUCT, and HH5605-5952 is a product where HH5605 is a
     family. The repetition is answered by the columns that stayed rather than by
     folding the rows. */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const named = SKUS.filter((sk) =>
      needle
        ? [sk.sku, sk.style.name, sk.style.brand, sk.colourway.name, sk.colourway.number]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        : true,
    );
    /* The facets cut before the colour ranks, so "closest sage stoneware"
       ranks within the sage stoneware rather than ranking everything and
       then hiding most of it — which would leave the reader on page one of a
       list whose top rows had been filtered out from under them. */
    const faceted = named.filter(
      (sk) =>
        (family === null || colourFamily(sk.colourway.hex) === family) &&
        (texture === null || sk.style.spec.construction === texture) &&
        (size === null || sk.style.size === size),
    );
    if (!sampled) return faceted;
    /* With a colour in hand the order IS the answer: closest first, and only the
       ones that come near it. A list ending in the ninety furthest matches has
       not answered the question. */
    return faceted
      .map((sk) => ({ sk, delta: distance(sampled, sk.colourway.hex) }))
      .filter((m) => matchPct(m.delta) > 0)
      .sort((a, b) => a.delta - b.delta)
      .map((m) => m.sk);
  }, [q, sampled, family, texture, size]);

  /* One place to undo an image search, because there are three ways to ask for
     it — the bar's X, a replacement, and a fresh search — and three copies of
     this would leave a facet set behind on one of them. */
  function clearMatch() {
    /* Release the object URLs the modal handed over. They are a document-lifetime
       allocation, and the modal deliberately does not revoke them — by the time
       it unmounts the bar is still drawing them. See ImageSearchModal. */
    match?.urls.forEach((u) => URL.revokeObjectURL(u));
    setMatch(null);
    setSampled(null);
    setFamily(null);
    setTexture(null);
    setSize(null);
    setPage(1);
  }

  /* The chips, from the catalogue rather than from the design's HMTX values.
     Colour offers the family the photographs landed in plus the next nearest, so
     a reader who thinks their piece is browner than we read it has somewhere to
     go. Construction and size offer what the book is actually made in — a filter
     listing a size nothing is made in is worse than no filter. */
  const facets: Facet[] = useMemo(() => {
    /* Every family in the book, nearest the photograph first. Ordered rather than
       alphabetical because the top of the list is the answer and the rest is the
       reader disagreeing with it — a dropdown has room for all of them, which the
       chip row did not.
       The swatch is a real colourway from that family, not a nominal beige: the
       chip is a promise about what the filter returns, and a colour mixed by hand
       would be a different beige from anything in the book. The one chosen is the
       family's medoid — the member closest to all the others — so it is the most
       typical of them rather than whichever happened to sort first. */
    const byFamily = new Map<string, string[]>();
    for (const sk of SKUS) {
      const fam = colourFamily(sk.colourway.hex);
      byFamily.set(fam, [...(byFamily.get(fam) ?? []), sk.colourway.hex]);
    }
    const order = sampled
      ? [...new Set(
          [...SKUS]
            .sort((a, b) => distance(sampled, a.colourway.hex) - distance(sampled, b.colourway.hex))
            .map((sk) => colourFamily(sk.colourway.hex)),
        )]
      : [...byFamily.keys()].sort();

    const colours: FacetOption[] = [
      { value: null },
      ...order.map((fam) => ({
        value: fam,
        swatch: consensusColour(byFamily.get(fam) ?? []),
      })),
    ];
    const textures: FacetOption[] = [
      { value: null },
      ...[...new Set(CATALOGUE.map((st) => st.spec.construction))]
        .sort()
        .map((v) => ({ value: v })),
    ];
    const sizes: FacetOption[] = [
      { value: null },
      ...[...new Set(CATALOGUE.map((st) => st.size))].map((v) => ({ value: v })),
    ];
    return [
      { label: "Colour", value: family, options: colours, onChange: setFamily },
      { label: "Construction", value: texture, options: textures, onChange: setTexture },
      { label: "Size", value: size, options: sizes, onChange: setSize },
    ];
  }, [sampled, family, texture, size]);

  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  /* Brand and Backing & fibre came out. Both are the same answer on nearly every
     row — three brands and two backings across ninety-nine products — so they
     were width spent on something that does not distinguish one line from
     another. Both are on the record page and in the CSV, which is where a reader
     who wants the spec goes. */
  const columns: DataTableColumn<CatalogueSku>[] = [
    {
      key: "sku",
      /* Reference on top, name underneath — the same stack and the same format
         Planner Review uses, because it is the same question. */
      label: "Product SKUs",
      minWidth: 244,
      cell: (sk) => (
        <span className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <SkuSwatch sku={sk.sku} />
          <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
            {/* Straight to the record. On the planner's table a SKU opens the
                demand deck, because there a SKU is a position being decided on;
                here it is a product being looked up, and the record page is the
                answer to that. */}
            <Link
              href={productRoute(sk.sku)}
              title={`Open ${sk.sku}`}
              className="truncate hover:underline"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--link-color)", ...numeric }}
            >
              {sk.sku}
            </Link>
            <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
              {`${sk.style.name} · ${sk.colourway.name}`}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "colourways",
      /* Other colourways in this style — the substitution question, on the row
         it is asked about. A account who cannot have this one wants to know what
         else the same style comes in, and that used to mean scrolling to find
         the style's other seventeen rows. */
      label: "Other variants",
      /* The stack is three 26px chips overlapped plus a counter — about 90px. */
      minWidth: 132,
      cell: (sk) => {
        const others = sk.style.colourways.filter((c) => c.number !== sk.colourway.number);
        if (!others.length) {
          return <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>Only one</span>;
        }
        return (
          <span className="flex min-w-0 items-center" style={{ gap: 8 }}>
            <SwatchStack
              style={sk.style}
              order={sampled ? rankColourways(sk.style, sampled).filter((c) => c.number !== sk.colourway.number) : others}
            />
            {sampled && (
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)", ...numeric }}>
                {`${matchPct(distance(sampled, sk.colourway.hex))}% match`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "construction",
      /* Size and construction together: one answer about the product's shape,
         and a border between "24 × 24" and "textured patterned loop" was
         separating a sentence. */
      label: "Construction",
      minWidth: 200,
      cell: (sk) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span className="truncate" style={{ fontSize: 14 }}>
            {sk.style.size}
          </span>
          <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
            {sk.style.spec.construction}
          </span>
        </span>
      ),
    },
    {
      key: "plant",
      /* "Supplier", as the planner's table calls it — a plant that replenishes a
         centre is the supplier of that stock. */
      label: "Supplier",
      minWidth: 148,
      cell: (sk) => (
        <Pill variant="info" size="sm" icon={<Factory weight="duotone" />}>
          {sk.style.plant.name}
        </Pill>
      ),
    },
    {
      key: "leadDays",
      /* Its own column: a lead time is a figure a reader compares down the page,
         and stacked under a plant name it could not be compared with anything. */
      label: "Lead time",
      minWidth: 96,
      cell: (sk) => <QtyStack value={sk.style.plant.leadDays} unit="days" />,
    },
    {
      key: "held",
      label: "On hand",
      minWidth: 104,
      /* Only where the book is holding some. Most of a catalogue is orderable
         rather than stocked, and "0 units" against thirty-five variants would
         read as thirty-five stock-outs. */
      cell: (sk) => {
        const held = HELD.get(sk.sku);
        return held ? (
          <QtyStack value={held} />
        ) : (
          <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>Orderable</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title="Product catalogue"
          subtitle={`${SKUS.length} variants across ${CATALOGUE.length} styles — ${familiesInBook()}`}
        />
        {/* Built in the browser from the live catalogue rather than served as a
            file, so the download cannot be a stale copy of the book it claims to
            be. `npm run catalogue:csv` writes the same bytes to public/ for
            anyone who wants it without opening the app. */}
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<DownloadSimple size={14} weight="bold" />}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([catalogueCsv()], { type: "text/csv;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "product-catalogue.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download CSV
        </Button>
      </div>

      <TableShell
        title="The book"
        icon={Package}
        customize={false}
        /* Pairs the image-search button with the field beside it — see the rule
           in globals.css. The DS filter slot is right-aligned, which is correct
           for a row of filter dropdowns and wrong for a control asking the same
           question as the search field. */
        className="ts-search-adjacent"
        /* No tabs. They were one per style — nine across the top, each one a
           row of the table below, so the strip and the table were two copies of
           one list and the strip had to scroll to hold them. The book is eight
           rows; it does not need filtering into eight views of one row. Search
           covers the rest. */
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search by SKU, style, variant or brand"
        /* Beside the search, because it IS a search — the other way of asking
           the same question. A account rings about an existing piece and wants to
           know what is closest to it; typing a colourway name only works if you
           already know which one. See `dominantColour`: the image is sampled in
           the browser and thrown away, and one hex value is what the page keeps. */
        /* Beside the search, because it IS a search — the other way of asking
           the same question. A account rings about an existing piece and wants to
           know what is closest to it; typing a colourway name only works if you
           already know which one.
           The button is all that lives here now. It used to be the button OR a
           "Matching #7C6A56" chip, which put the result of the search inside the
           control that starts one — the result has its own bar above the table,
           where it has room to show the photographs and what was read. */
        filters={
          <Button
            /* Medium, matching the search field beside it — a small button next
               to a 32px input read as a secondary afterthought when it is the
               other half of the same question. */
            size="md"
            variant="outline"
            iconLeft={<ImageIcon size={14} weight="bold" />}
            onClick={() => setPicking(true)}
          >
            {match ? "New image search" : "Search by image"}
          </Button>
        }
        isFiltered={q.trim().length > 0 || sampled !== null}
        totalItems={rows.length}
        currentPage={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        /* No reordering. `ts-search-below` pushed the search under the tab strip
           — which was the right place while there was a strip to sit under; with
           the tabs gone it pushed the search under the whole TABLE, so the way
           to filter a list sat at the bottom of it. `ts-scroll-tabs` went with
           them. */
        noResultsState={
          <span className="type-cell" style={{ padding: 24, color: "var(--ds-text-secondary)" }}>
            Nothing in the book matches that.
          </span>
        }
      >
        {/* Inside the shell, under the toolbar — the search field and the image
            search are the same question asked two ways, so their results belong
            in the same frame rather than in a card floating above it. Present
            only once something has been read, so the page opens on the book
            rather than on an empty explanation of a search nobody ran. */}
        <div className="px-4 pt-4">
        {match && (
          <ImageMatchBar
            urls={match.urls}
            /* What was actually read. The design says "No SKU detected" and this
               prototype never detects one — the sampler reads colour, not text — so
               the sentence says what it did instead of asserting a capability. */
            read={`No SKU detected · matched on colour across ${match.count} ${match.count === 1 ? "photo" : "photos"} · further filter below`}
            onReplace={() => setPicking(true)}
            onClear={clearMatch}
            facets={facets}
          />
        )}
        </div>

        <DataTable<CatalogueSku>
          {...SHAW_TABLE_PROPS}
          data={paged}
          columns={columns}
          rowKey={(sk) => sk.sku}
        />
      </TableShell>

      {picking && (
        <ImageSearchModal
          onClose={() => setPicking(false)}
          onMatched={(m) => {
            /* A second search replaces the first, so the first search's URLs are
               released here rather than leaking one set per attempt. */
            match?.urls.forEach((u) => URL.revokeObjectURL(u));
            setMatch(m);
            setSampled(m.hex);
            setPicking(false);
            /* Back to page one: the list is re-ranked by closeness now, and
               staying on page two would show the reader the middle of a ranking
               they have not seen the top of. */
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
