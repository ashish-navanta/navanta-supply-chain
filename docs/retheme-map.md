# Fossil → Target re-theme map

The app is Navanta's supply-chain product, demo-themed for a pitch to **Target**.
The world: a mass-market retailer (Target-shaped) that designs owned brands, buys
finished goods FOB Asia through its sourcing arm, lands them at US regional
distribution centres (RDCs), and flows them to stores. `src/data/catalogue.ts` is
already rewritten and is the source of truth — every other file must agree with it.

## Rules

1. **Mechanics stay, nouns change.** Every queue, play, claim, approval clock,
   exception and dollar figure keeps its shape; only the domain vocabulary moves.
2. **IDs must match the map exactly** — SKUs, brand ids, factory keys, region ids,
   DC names. A missed ID is a runtime `undefined`, not a cosmetic bug.
3. Keep the file's voice: long design-note comments stay, rewritten to the retail
   world (or trimmed where they argue watch facts that no longer apply).
4. Unit economics: keep magnitudes unless absurd for the item (a watch FOB of
   $91.50 becomes ~$21.50 for a dinnerware set — shift the unit price, keep the
   exposure math roughly consistent).
5. Never claim Target-confidential facts. Public shape only (RDC cities, owned
   brands, CVS pharmacy exit, Minneapolis HQ, Target Sourcing Services).

## SKU / style map (colour-variant numbers are unchanged)

| Old style | New style | New product | Brand |
|---|---|---|---|
| MK5605 | HH5605 | Stoneware Dinnerware Set 16pc | Hearth & Hand with Magnolia |
| MK7108 | HH7108 | Chunky Knit Throw Blanket | Hearth & Hand with Magnolia |
| MK2980 | HH2980 | Acacia Serving Board | Hearth & Hand with Magnolia |
| MK3192 | HH3192 | Ceramic Bud Vase 8in | Hearth & Hand with Magnolia |
| FS4735 | GG4735 | Organic Granola Clusters 12oz | Good & Gather |
| ES3843 | GG3843 | Cold Brew Concentrate 32oz | Good & Gather |
| ME3184 | TH3184 | Performance Bath Towel | Threshold |
| ZO9204 | TH9204 | Quick-Dry Bath Rug | Threshold |

Old product names → new: Bradshaw Chronograph 43 → Stoneware Dinnerware Set 16pc ·
Runway 38 → Chunky Knit Throw Blanket · Parker Leather 39 → Acacia Serving Board ·
Darci 33 → Ceramic Bud Vase 8in · Grant Chronograph 44 → Organic Granola Clusters
12oz · Jacqueline 36 → Cold Brew Concentrate 32oz · Neutra Automatic 44 →
Performance Bath Towel · Super Sea Wolf 53 Compression → Quick-Dry Bath Rug.

Colourway names changed per style (numbers did not). Key ones seen in fixtures:
- HH5605: 5605 Cream · 5799 Terracotta · 5952 Sage · 6099 Slate · 6134 Stone ·
  6266 Matte Black · 6473 Navy · 6555 Wheat
- HH7108: 7110 Honey · 7112 Blush · 7325 Heather Grey · 7331 Charcoal
- HH2980: 2980 Natural Acacia · 3116 Ebonized · 3222 Whitewashed · 3365 Walnut Stain
- HH3192: 3190 Matte White · 3192 Honey Gold · 3298 Dusty Rose
- GG4735: 4735 Maple Pecan · 4812 Dark Chocolate Sea Salt · 5061 Honey Almond ·
  5151 Berry Harvest · 5210 Peanut Butter
- GG3843: 3843 Signature Black · 3988 Vanilla · 4045 Mocha · 4126 Oat Latte
- TH3184: 3184 Ochre · 3227 Washed Black · 3255 Indigo
- TH9204: 9204 Charcoal · 9268 Deep Navy · 9290 Sea Foam · 9349 Ivory

## Brands (`id` → `id`, name → name)

- michael-kors → hearth-hand · Michael Kors → Hearth & Hand with Magnolia
  (licensed, 20-day clock, royalty floor, termination risk — the anchor partner)
- licensor-b → disney · Licensor B → Disney at Target
- licensor-c → ulta-beauty · Licensor C → Ulta Beauty at Target (15-day clock)
- licensor-d → fao-schwarz · Licensor D → FAO Schwarz (30-day clock)
- licensor-e → levis-target · Licensor E → Levi's for Target (no floor)
- licensor-f → kendra-scott · Licensor F → Kendra Scott at Target (termination risk)
- fossil → good-gather · Fossil → Good & Gather (owned grocery flagship)
- zodiac → threshold · Zodiac → Threshold (owned home flagship)
- "licensor" as a word → "partner" or "licensor" (both fine; licensed programs are real)
- The COMPANY "Fossil" / "Fossil Group" → **Target** (the retailer whose team uses the app)
- "Fossil (East) Ltd" / HK trading entity → **Target Sourcing Services** (the sourcing arm)

## Regions / DCs / states

- Region ids: americas → west · europe → central · asia → east
- Region names: Americas → West · Europe → Central · Asia → East
- DC names (exact strings): Dallas DC → Woodland RDC · Eggstätt DC → Cedar Falls RDC ·
  Hong Kong DC → Wilton RDC
- Cities: Dallas, TX → Woodland, CA · Eggstätt, Germany → Cedar Falls, IA ·
  Hong Kong (as DC city) → Wilton, NY
- "Americas Priority" → "West Priority"
- FTZ 39 / Sunnyvale relocation story → the LA/Long Beach import-gateway story:
  Woodland is the first inland node behind the port; port dwell, chassis shortage
  and peak gate cuts are the West exceptions.
- The scope's third cut is now a **US state**, not a country. Scope map:
  us → california · canada → washington · mexico → arizona · germany → iowa ·
  uk → minnesota · france → texas · italy → illinois · spain → missouri ·
  netherlands → wisconsin · hong-kong → new-york · japan → new-jersey ·
  china → florida · india → georgia · australia → virginia · singapore → north-carolina
  **BUT sourcing origins stay countries**: goods are made in China / Vietnam / the US.
  Only the selling-scope vocabulary becomes states. Use judgment: "the German
  subsidiary" (selling) → the Central region; "made in China" (origin) stays China.
- Commercial seats sit at **Minneapolis HQ**; the logistics seat sits at the RDC.

## Suppliers (factory keys)

- qi-guang → luen-hing · "Qi Guang Watch" → "Luen Hing Housewares" · Dongguan, China ·
  independent · 56-day production (the capacity-capped anchor supplier)
- renley → vinh-phat · "Renley Watch Mfg" → "Vinh Phat Textiles" · Ho Chi Minh City,
  Vietnam · independent · 56-day (the 301-diversification lane)
- solan → cedar-mills · "Solan" / "Fossil India" → "Cedar Mills Co-Pack" ·
  River Falls, WI · dedicated/owned lines · 35-day (domestic grocery co-manufacturer)

## Categories

- watches → home · "Watches" → "Home & Kitchen" (the loaded priority book)
- jewelry → grocery · "Jewelry" → "Grocery & Essentials" (priority; dating/shelf-life)
- leather-goods → apparel · "Leather goods" → "Apparel & Softlines"
- smartwatches → pharmacy · "Smartwatches" → "Pharmacy & Clinic" (exited — run by a
  pharmacy partner in-store since 2015; keep "exited category" mechanics)
- fixtures-packaging stays fixtures-packaging

## Vocabulary & mechanics translations

- watch/watches → item/units (or the specific product)
- dial / case finish / strap / bracelet → glaze / colour / fabric / finish per item
- construction "bracelet" → "import" · "strap" → "domestic" (the sourcing lane —
  `Construction` type in catalogue.ts is now "import" | "domestic")
- The HTS strap-vs-bracelet duty swing (14% vs 2.8%) → **Section 301 exposure**:
  China-origin home goods carry List 3 +25% on top of the Chapter 69/63 base;
  the domestic lane carries none. Same "one field changes landed cost" story.
- Movement warranty / 11-year warranty → the owned-brand quality guarantee and
  the Good & Gather freshness promise (shelf-life dating at the DC)
- Hong Kong consolidation leg → origin consolidation at **Yantian** (Luen Hing) and
  **Cai Mep/HCMC** (Vinh Phat); ocean lanes land at LA/Long Beach → Woodland RDC;
  East Coast diversion via Savannah/Port Newark → Wilton RDC
- Navision/SAP seam → legacy WMS / order-management seam (keep the two-systems tension)
- Royalty floor / deemed-disapproval clock / termination threshold → unchanged
  mechanics, now attached to the partner programs above
- Season calendar (nine months vs eight-week production) → set/reset calendar
  (spring set, holiday set) — same tension
- Page titles: "… · Fossil Supply Chain" → "… · Navanta Supply Chain"
- Personas keep their names and seats; their employer is Target.

## Do not touch

- `src/data/catalogue.ts` (done), logo/theme files, package.json, tokens.css,
  globals.css (already re-themed).
- Type/export names and data-structure shapes: only string content changes,
  never interfaces or keys — with the single exception of ids named in this map.
