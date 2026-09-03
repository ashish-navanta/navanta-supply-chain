# Navanta Supply Chain — multi-company demo portal

One supply-chain experience — **Buying, Planning, Service, Logistics** and the **Executive**
view, each with its AI agent — that can be worn by different companies. The screens never
change; the **company pack** decides whose products, brands, DCs, suppliers, plays and
conversations appear on them.

| Pack | World | Source |
|---|---|---|
| `fossil` | Fossil Group — licensed & owned watch calendars, three regional DCs, FOB Asia | the original build (github.com/ashish-navanta/fossil-supply-chain) |
| `allison` | Allison Transmission — MRO & indirect procurement across AT/AOH plants | authored from github.com/Navanta-AI/allison-procurement |
| `target` | Target — owned & partner brands, home and grocery, three RDCs | authored for the Target pitch |

## Run

```bash
npm install
npm run dev:target      # or dev:fossil / dev:allison — selects the pack, then starts Next
```

Open <http://localhost:3000>. The front door is the **company launcher**: the active
company opens straight into the portal; in development, picking another company
regenerates the data facades and the dev server picks the new world up in a few seconds.

To switch packs without restarting: `npm run company:fossil` (or `company:allison`,
`company:target`). In production a build is one company — set the pack in the build command
(`npm run company:allison && npm run build`) and deploy one build per company; the launcher
links between deployments via `NEXT_PUBLIC_COMPANY_URL_FOSSIL|ALLISON|TARGET`.

## How a pack works

```
src/companies/<id>/data/*.ts   the 27 data modules + brand.ts — the whole company
src/companies/registry.ts      the launcher's list of companies
src/data/*.ts                  GENERATED one-line facades → the active pack (scripts/select-company.mjs)
src/types/product.ts           the product contract every pack conforms to (generic spec groups, thumbnail forms)
src/types/company.ts           the brand contract (logos, rail/page colours, scope words, item-code label)
```

- Components import `@/data/...` as they always did; the facades point those imports at the
  active pack. Packs import each other **relatively** (`./catalogue`) so an inactive pack is
  never bundled.
- `brand.ts` colours the chrome: `--nav-brand`, the rail gradient and the page ground are set
  on `<body>` from it; logos and the scope bar's "country/state" words come from it too.
- The product record, the catalogue CSV and the SKU thumbnails are pack-agnostic: a pack lays
  its spec out as titled groups of label/value pairs and names a `form` for each style
  (watch, dinnerware, bearing, drum…) that the swatch knows how to draw.
- Adding a company = a new folder under `src/companies/` conforming to the same 28 modules,
  plus a registry entry and its logos under `public/companies/<id>/`.

Authoring maps for the re-themes live in `docs/retheme-map.md` (Target) and
`docs/allison-pack.md` (Allison).

## Live calling (optional)

`.env.local` carries the ElevenLabs/Twilio keys for the service seat's live call. With any of
the required values blank the app replays the recorded fixture instead — a demo never depends
on credentials being present.
