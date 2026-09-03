# Allison pack — authoring map (Fossil → Allison Transmission, finished goods)

The `allison` company pack is authored FROM the `fossil` pack (the complete,
internally consistent template) into `src/companies/allison/data/`. Same 28
modules, same TypeScript shapes, same mechanics — **finished-goods** nouns.

This map REPLACES the earlier MRO/indirect-procurement map. That premise
(bearings, coolant, cutting tools, plant cribs) is withdrawn: the pack is now
Allison's own product — automatic transmissions and electric propulsion — built
in Allison plants and moved out to OEM customers and the Authorized Distributor
channel.

Everything in "The world" below is sourced from Allison's FY2021 Form 10-K and
allisontransmission.com; the inline citations mark which. Where the company
publishes no list — its component suppliers, chiefly — the fixtures are
plausible invented names in real commodity classes, and this map says so rather
than implying otherwise.

## The process this pack models

Confirmed with the client, and the spine every module hangs off:

> Allison buys **raw, semi-finished and finished components** from suppliers →
> **manufactures and assembles** them → sells **completed transmissions and
> propulsion systems** to OEMs and other customers.

As a chain, with the link the earlier draft was missing at the end:

```
Supplier            supplies transmission components
   ↓
Allison             machining + assembly + testing
   ↓
Finished good       complete Allison automatic transmission
   ↓
Customer            truck / bus / construction-equipment OEM
   ↓
End user            operates the finished vehicle
```

That chain is the **78% OEM path**. The distributor channel is the same chain
with one link swapped — Allison → Authorized Distributor → Dealer → end user —
and the channel buys to stock rather than to a build slot. Both paths ship the
same finished good; keep them distinct, because a missed date means a line
stoppage on one and a backorder on the other.

Three stages, and the pack gives each one a seat:

| Stage | Seat | What the book is |
|---|---|---|
| Buy components | **Buyer** (Mercer) | POs on component suppliers — castings, gears, converters, controls |
| Make — **machining + assembly + testing** | **Planner** (Iris) | Build programme and finished-unit stock across plants and PDCs |
| Sell finished units | **Service desk** (Christy) + **Logistics** (Tova) | Releases to OEM lines and stock orders to the distributor channel |

The executive reads across all three. This is why the pack keeps a supply side
AND a demand side: they are two ends of one flow, not two different companies.

### Make is three steps, not one — and the third one fails differently

"Machining + assembly + testing" is worth carrying literally, because a unit
stuck at each step is a different problem with a different owner:

| Step | Consumes | A unit stuck here means |
|---|---|---|
| **Machining** | Plant capacity on semi-finished castings and blanks | Capacity is gone and does not come back — this is why a late blank compounds |
| **Assembly** | Line time, and every finished component present at once | One missing sole-sourced sensor holds a whole build; the other 400 parts do not help |
| **Testing** | Test-cell time | The unit is BUILT and still cannot ship |

**Testing gives the pack an exception type the MRO premise never had: a unit that
fails test.** It is not late — it exists, it is finished, and it is not
shippable. Nothing in the Fossil template models that, and it is the most
Allison-specific mechanic available: add `"failed-test"` to the planning and
service health unions, and a `retestBy` date to the build record. A programme
unit that fails test on the day of its build slot is the single best row in the
whole demo.

### The end user is a fifth link, and it decides the vocation

The customer is the OEM; the **end user operates the vehicle**. This settles
something the earlier draft blurred: the **vocation category is the END USER's
application, not the customer's**. A PACCAR release is not "a PACCAR vocation" —
the truck PACCAR builds around that transmission goes to a refuse fleet or a
delivery fleet, and THAT is the vocation the row carries.

Two consequences worth authoring deliberately:

- One OEM customer spans several vocations. PACCAR alone covers Distribution,
  Refuse and Construction. So the vocation cut and the account cut are genuinely
  independent axes — which is what makes both dropdowns worth having.
- **Warranty and claims originate with the end user** and travel back up the
  chain through the OEM or the distributor. That is a far better claims book
  than the MRO premise had: the party who found the fault is not the party
  Allison invoices, and the service seat has to hold both.

### The component-state axis

"Raw, semi-finished and finished" is a real distinction and the buying seat
turns on it — it decides what a shortage costs:

| State | Example | On arrival | When it is late |
|---|---|---|---|
| **Raw** | Aluminium ingot, steel bar | Goes to the die caster or the forge | Absorbed — days of buffer, commodity-priced, re-sourceable |
| **Semi-finished** | Rough casting, forged gear blank | Needs machining, heat treat, grinding in-plant | The dangerous one — a late blank burns plant capacity that cannot be recovered, so the slip compounds |
| **Finished** | Bearing, sensor, TCM, fastener | Goes straight to the assembly line | Straight line-stop risk, and usually sole-sourced |

Carry it on the component as `componentState: "raw" | "semi-finished" | "finished"`.
It drives lead time, the make/buy argument, and which slips are worth a person's
morning — the same job `classification` does on the planning book.

## The world

Allison Transmission — Indianapolis, IN. The book is **finished units**: 1000
through 4000 Series automatics, the 9-Speed, xFE variants and eGen Power
electric axles, built to order against OEM build programs and stocked through
regional distribution for the channel.

**This is not a parts business, and the fixtures must not read like one.** FY2021
net sales of $2,402M split: North America On-Highway $1,177M (49%), Outside
North America On-Highway $381M (16%), Defense $186M (8%), North America
Off-Highway $58M (2%), Outside North America Off-Highway $83M (3%) — so
**78% is finished units** — against Service Parts, Support Equipment & Other at
$517M (22%). The website foregrounds Parts + Service because that is where
distributors and fleet operators go; the revenue is in the units. Weight every
book accordingly: the priority category is a vocation full of complete
transmissions, and service parts are a real but secondary line.

**Two demand streams, and they behave differently — that is the pack's whole
tension:**

1. **OEM line-side programs** (the priority book). ~300 OEM customers; the
   named ones in the 10-K are BAE Systems, Blue Bird, Daimler, Dennis Eagle,
   Hino, Iveco, Isuzu, MAN, Navistar, New Flyer, Oshkosh, PACCAR, Scania, Terex
   and Volvo. Releases are scheduled against a build slot; a miss is a line
   stoppage, not a backorder.
2. **The Authorized Distributor channel.** A two-tier network — dealers buy
   through distributors, not from Allison — of ~1,600 distributor and dealer
   locations and 6,200 certified technicians. Real named distributors:
   **W.W. Williams** (50+ year partner) and **Penn Power Group**. Channel demand
   is stocking and allocation, not a slot.

**Supply side**, for the buyer's seat: Allison bought **~$851M of direct
materials and components** from outside suppliers in 2021; **~75% of component
spend came from ~40 suppliers, many of them sole sources**; aluminium and steel
raw material is **~20% of direct material cost**. That concentration — a sole
source on a casting feeding a program with a build slot — is the buying seat's
argument, and it is a documented fact rather than a device.

The copilot stays **Mercer**. Lever routing carries over unchanged in shape:
winner share ≥ 50% → consolidate to the incumbent, else competitive RFP; but
**sole-source components are carved out first**, exactly as OEM spares were
carved out of the MRO map. The carve-out is the same mechanic pointed at a
truer fact.

## Rules

1. Mechanics stay, nouns change. Shapes, exports, keys, interfaces untouched.
2. IDs below must match EXACTLY across all 28 files — a miss is a runtime undefined.
3. Keep each file's design-note voice; argue finished-goods facts instead of MRO facts.
4. Unit economics: a finished transmission is a **four-to-five-figure** unit, not
   a $9 bearing. 2000 Series ≈ $4,800; 3000 Series ≈ $9,600; 4000 Series ≈
   $16,400; eGen Power 100D ≈ $42,000. Order quantities fall accordingly —
   tens and hundreds of units, not thousands. **Every fixture quantity and value
   in the pack has to be re-scaled; this is the single largest source of
   nonsense if it is skipped.**
5. Pack-internal imports are RELATIVE (`./catalogue`), never `@/data/...`.
6. `catalogue.ts` must conform to `src/types/product.ts`.
7. Two shared-type changes this pivot genuinely needs (additive, no pack breaks):
   - `ProductForm` in `src/types/product.ts` gains `"transmission"` and `"e-axle"`.
   - `SkuSwatch.tsx` gains an illustration for each — it is the only consumer.

## Scope trio → SERIES (product family) / REGION (distribution) / COUNTRY

The first dropdown is the **product family** a buyer works — the equivalent of a
brand calendar. `kind: "licensed"` = **OEM program family** (built to a named
OEM platform under a program agreement: `approvalDays` = engineering change
approval window; `minimumRoyalty` = take-or-pay volume commitment;
`terminationRisk` = program cancellation risk). `kind: "owned"` = **channel
family**, stocked and sold through distributors with no program commitment.

| Fossil brand id → name | Allison id → name | kind | clock/floor/risk |
|---|---|---|---|
| michael-kors → Michael Kors | series-3000 → 3000 Series | licensed | 20d · take-or-pay · risk TRUE (the anchor: the refuse/transit program) |
| licensor-b → Licensor B | series-4000 → 4000 Series | licensed | 20d · take-or-pay · false |
| licensor-c → Licensor C | egen-power → eGen Power | licensed | 15d · take-or-pay · risk TRUE (new programme, Auburn Hills) |
| licensor-d → Licensor D | series-2000 → 2000 Series | licensed | 30d · take-or-pay · false |
| licensor-e → Licensor E | nine-speed → 9-Speed | licensed | 20d · no floor · false |
| licensor-f → Licensor F | defense → Defense Programs | licensed | 20d · take-or-pay · risk TRUE |
| fossil → Fossil | series-1000 → 1000 Series | owned | — |
| zodiac → Zodiac | xfe → xFE Fuel-Efficiency | owned | — |

Region ids/names/DCs (exact strings). The DC is a **customization + parts
distribution centre** — and the customization half is the one that matters
here: a finished unit is configured to a customer's specification at that node
(PTO provision, retarder, cooler circuit) before it ships, which is why a
finished-goods book routes through it at all. The 10-K places these operations
in the US, Netherlands, Brazil, China, Hungary, India and Japan, and
Indianapolis carries the Parts Distribution Center on the main 4.6M sq ft
campus. Note the two paths out of a plant, because the pack needs both: a
programme unit can ship **direct to the OEM line**, while a channel unit routes
**through the PDC** for configuration and stocking.

- americas → north-america · "Americas" → "North America" · "Dallas DC" → **"Indianapolis PDC"** · Dallas, TX → Indianapolis, IN · countries us, canada, mexico, brazil (priority TRUE — "NA Priority")
- europe → europe · "Europe" · "Eggstätt DC" → **"Szentgotthárd PDC"** · Eggstätt, Germany → Szentgotthárd, Hungary · countries hungary, netherlands, germany, uk, france, italy
- asia → asia · "Asia" · "Hong Kong DC" → **"Shanghai PDC"** · Hong Kong → Shanghai, China · countries china, india, japan, singapore, australia, south-korea
- "Americas Priority" → "NA Priority". Commercial seats sit at **Indianapolis HQ**; the logistics seat sits at the **Indianapolis PDC**.
- FTZ / Sunnyvale story → the **Auburn Hills eGen Power ramp**: a new plant feeding a new programme, where every schedule miss is visible because there is no built stock to hide behind.

## Categories (third dropdown = vocation / end market)

The vocations are Allison's own, from the applications book:

- watches → distribution · "Watches" → **"Distribution"** (the loaded priority book — box trucks and delivery fleets) · hts → "—" (no duty story; use the field for the vocation code, e.g. "V-01")
- jewelry → refuse · "Jewelry" → **"Refuse"** (priority)
- leather-goods → transit-bus · "Transit & School Bus"
- fixtures-packaging → construction · "Construction"
- smartwatches → defense-vocation · "Defense" (restricted programme — the "exited"-style mechanic: visible, not workable by this seat)

## Suppliers (factory keys) — the buyer's counterparties

The buying seat buys the **components that build a transmission**, which is what
an Allison commodity manager actually does. Only the first two are real; the
rest are invented names in real commodity classes, and no public Allison
supplier list was used because none is published.

- qi-guang → walker-die-casting · "Qi Guang Watch" → **"Walker Die Casting"** · Lewisburg, TN · ownership **"owned"** (Allison acquired it in 2019 — 20 years a supplier before that) · leadDays 21 · aluminium cases and housings. The capacity-capped anchor.
- renley → cr-tool · "Renley Watch Mfg" → **"C&R Tool and Engineering"** · Muscle Shoals, AL · ownership **"owned"** (acquired 2019) · leadDays 14 · tooling and precision machining.
- solan → midwest-gear · "Solan"/"Fossil India" → **"Midwest Gear & Forge"** · Fort Wayne, IN · independent · leadDays 24 · steel gears and forgings (invented).
- Other invented vendors for rosters/benchmarks, each in a real commodity class:
  Torqueflow Converters Inc (Toledo, OH — torque converters), Kestrel Electronics
  (Kokomo, IN — TCM controls and sensors), Bremen Seal & Gasket (Bremen, IN),
  Hoosier Fastener Supply (Indianapolis, IN), Lakeshore Heat Treat (Michigan
  City, IN), Adriatic Castings d.o.o. (Slovenia — Szentgotthárd feed),
  Chennai Precision Forge Pvt Ltd (Chennai — India feed), Sakura Bearing KK
  (Japan), Rhine Valve GmbH (Germany — hydraulic control valves).

**Producing plants** (all real, from the 10-K) — these are the origins on the
logistics seat, not buyer counterparties:
Indianapolis, IN (six plants, ~2.3M sq ft — on-highway and defense) ·
Auburn Hills, MI (fully electric propulsion) · Lewisburg, TN (aluminium die
casting) · Szentgotthárd, Hungary (high-volume on-highway) · Chennai, India
(high-volume on-highway).

## Accounts → OEM customers and Authorized Distributors

The service seat's book. Fossil's eight wholesale accounts map to a deliberate
mix: five OEM programme customers and three channel distributors, so both
demand streams are present on the same screen and behave visibly differently.

| Fossil account | Allison account | segment |
|---|---|---|
| Peachtree Jewelers | **PACCAR · Denton TX** | OEM programme |
| Gulf Coast Jewelers | **Oshkosh Corporation · Oshkosh WI** | OEM programme |
| Blue Ridge Jewelers | **Blue Bird Corporation · Fort Valley GA** | OEM programme |
| Summit Department Stores | **New Flyer Industries · Winnipeg MB** | OEM programme |
| Piedmont Jewelers | **W.W. Williams · Columbus OH** | Authorized Distributor |
| Lowcountry Watch & Gift | **Penn Power Group · Pittsburgh PA** | Authorized Distributor |
| Cascade Department Stores | **Iveco S.p.A. · Turin, Italy** | OEM programme |
| Lone Star Jewelers | **Rush Truck Centers · San Antonio TX** | Authorized Distributor |

`DealerSegment` becomes `"OEM programme" | "Authorized Distributor" | "Dealer" | "Defense"`.
`LoyaltyTier` stays Platinum/Gold/Silver/Bronze — it is the Performance Rewards
Program, which Allison genuinely runs for distributors and direct dealers.

## Products (style map — variant NUMBERS unchanged from Fossil)

| Fossil | Allison style | Product | Series (family) | form | route |
|---|---|---|---|---|---|
| MK5605 Bradshaw Chronograph 43 | AL5605 | 3000 RDS Rugged Duty | 3000 Series | transmission | program |
| MK7108 Runway 38 | AL7108 | 4500 RDS Rugged Duty | 4000 Series | transmission | program |
| MK2980 Parker Leather 39 | AL2980 | 2500 RDS Rugged Duty | 2000 Series | transmission | channel |
| MK3192 Darci 33 | AL3192 | 1000 HS Highway | 1000 Series | transmission | channel |
| FS4735 Grant Chronograph 44 | AL4735 | 3000 HS Highway | 3000 Series | transmission | program |
| ES3843 Jacqueline 36 | AL3843 | 2100 HS Highway | 2000 Series | transmission | channel |
| ME3184 Neutra Automatic 44 | AL3184 | 4000 EVS Emergency Vehicle | 4000 Series | transmission | program |
| ZO9204 Super Sea Wolf 53 | AL9204 | eGen Power 100D e-Axle | eGen Power | e-axle | program |

`Construction` type → `"program" | "channel"` — how the unit reaches its
customer, which is the axis this book actually turns on. `constructionLabel` =
"Route to customer"; `constructionLabels` = `{ program: "OEM programme",
channel: "Distributor channel" }`.

Variant names are **configurations**, not colours — the number stays, the name
becomes what a spec sheet would call it. AL5605: 5605 Close-ratio · 5799 Wide-ratio ·
5952 With output retarder · 6099 PTO-provisioned · 6134 xFE · 6266 Close-ratio,
no PTO · 6473 Wide-ratio, retarder · 6555 Rebuild exchange.
AL9204 eGen Power: 9204 100D dual-motor · 9310 100S single-motor · 9422 130D.

`itemCode` = SAP material number, e.g. "MAT-30-5605".

Spec groups on the product record become **Ratings** (input power, input torque,
GVW rating, gear count), **Configuration** (PTO provision, retarder, cooler
circuit) and **Programme** (OEM platform, build slot, engineering release level).

## Vocabulary

- watch → unit / transmission · dial/strap/case → ratings / configuration / build level · colourway → configuration
- licensor → OEM programme customer · royalty floor → take-or-pay volume commitment · deemed-disapproval clock → engineering change approval window · termination threshold → programme cancellation risk
- the HTS duty swing → the **build-slot premium**: a unit pulled forward into an earlier slot against one that waits for the scheduled release; one field changes premium freight and line-stoppage exposure
- ocean lane / HK consolidation → **plant → PDC → distributor** (Indianapolis PDC → W.W. Williams Columbus, two days) and **plant → OEM line-side** (Indianapolis → PACCAR Denton, sequenced to the build slot)
- DC → PDC (parts + customization centre) · account / customer → OEM programme customer or Authorized Distributor · order → **build release** (OEM) or **stock order** (channel)
- season calendar → **build programme calendar** (model-year changeover, plant shutdown weeks)
- Fossil / Fossil Group → Allison Transmission · Fossil (East) Ltd → Allison Global Logistics · Navision/SAP seam → **SAP ECC ↔ the OEM's EDI release schedule** seam
- Page titles "… · Fossil Supply Chain" → "… · Allison Supply Chain"
- Personas keep their names and seats; employer is Allison Transmission, Indianapolis.

## Module order for authoring

Dependency order, leaves first. Each module compiles against the ones above it:

1. `brand`, `countries`, `sourcing-categories` — no pack-internal imports
2. `catalogue` → `catalogue-csv` — the style/series/region/vocation book everything keys off
3. `action-center` — the row engine; `buying`, `planning`, `service` all key to its refs
4. `buying`, `planning`, `service` — the three seat books
5. `logistics` — imports `action-center` + `service`
6. `agent-actions` — the flow engine
7. `planning-flows`, `service-flows`, `feed-flows`, `logistics-flows`, `executive-flows` — per-seat flows
8. `executive` — imports planning, buying, logistics, action-center, service
9. `answers`, `chat-prompts` — import nearly everything; author last
10. `demand-deck`, `customer-notice`, `personas`, `nav`, `play-drafts`, `po-state`, `planning-approval`, `supplier-drafts`, `value-tracking` — leaf content

## Resolved: how a buying row names its subject

This was an open question and the client has answered it — Allison buys
components, builds units, sells units. The buying seat is therefore a
**manufacturer's** component book, not a distributor's resale book.

That leaves one structural decision, taken here rather than left implicit.
A buying row's `product` field is the key the scope bar filters on: `brandOfRow`
resolves it through `CATALOGUE` to a family, and the product peek opens on it.
If a PO named a raw casting, that lookup would find nothing and the buyer's
family cut would quietly stop working.

So a buying row names **both**:

- `product` — the finished style the component feeds (e.g. `3000 RDS Rugged Duty`).
  Keeps the family cut, the product peek and the SKU mechanics intact, and is how
  a commodity manager actually thinks: a casting shortage IS a 3000 RDS problem.
- `refSub` and the row's lines — the **component itself**, with its
  `componentState`, its supplier and its own lead time. This is where the truth
  of "what did we actually buy" lives.

One consequence to honour when authoring: a component usually feeds MORE than
one style, so the same shortage can surface against several families. Do not
flatten that — it is the most interesting thing on the buying seat, and the
`inScope` "unknown passes" rule already handles a row whose component spans
families.
