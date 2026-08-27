# Fossil · content substrate

Everything in `src/data` is a projection of one event chain across four seats.
Shaw's chain was *geopolitical lead-time jump → two damaged pallets*. This is
Fossil's. Nothing should be written into a fixture until this page is agreed,
because all 17,400 lines of fixture copy depend on it.

Marks: **[F]** = stated in the Fossil supply-chain research (10-Ks, Tier 1 list,
manifests, HTSUS). **[?]** = plausible, needs confirming before it ships.

---

## 1 · The anchor event

**A licensor goes quiet, and the silence is the decision.**

A sample submission for a licensed watch family sits with the licensor past the
**20-day deemed-*dis*approval clock** — silence means no **[F]**. The style
misses its line review. Because approval gates the sample, the sample gates the
line review, and the line review gates the PO, the buy commitment lands late
into a factory capacity pool **already booked by five other licensed brands
running independent calendars** **[F]**.

Recovery is air freight — which for watches is normal, not heroic, at roughly
$0.75–2.25 a unit **[F]** — but the recovery lands into two things nobody
modelled:

1. a **Chapter 99 overlay** assessed ad valorem on the entered value of the
   whole article, bypassing Chapter 91's component-by-component structure
   entirely **[F]**; and
2. the **Dallas → Sunnyvale DC move**, where FTZ designation is site-specific
   and re-activation is unevidenced **[F]**.

### Why this anchor and not a tariff shock

Because the obvious answer is wrong, and that is what makes it a workshop.

The instinct when a licensed style slips is to cut the buy. But **guaranteed
minimum royalties are owed regardless of sales and sit in cost of sales**, so
cutting *widens* the gap to a fixed floor — and the marginal royalty on the next
licensed unit is **zero** until earned royalty catches the minimum **[F]**.
Cutting the buy costs gross margin. Holding it costs working capital. There is
no clean move, which is exactly the kind of decision that deserves an agent.

This also reframes the whole app correctly, per the research: Fossil's long pole
is **not manufacturing** (~8 weeks) but the **~9-month approval sequence**, and
each gate is owned by someone outside supply chain **[F]**. That makes this a
**queueing problem, not a forecasting problem** — and Shaw's three-stage
exception pipeline is already the right shape for it.

---

## 2 · The four seats

Agent names carry over unchanged. Roles, locations and systems do not.

| Agent | Shaw seat | Fossil seat | Sits in | Reads across |
| :-- | :-- | :-- | :-- | :-- |
| **Mercer** | Buyer / Commodity Manager | Sourcing & Category Manager, Licensed Watches | Richardson, TX **[?]** | SAP ECC · Fossil East HK · licensor portals |
| **Iris** | Deployment Planner | Global Demand & Supply Planner | **Hong Kong** | **MS Dynamics NAV** · SAP APO→IBP · Excel |
| **Christy** | Customer Service Rep | Wholesale Account Operations | Richardson, TX **[?]** | Sterling OMS · SAP ECC · routing guides |
| **Tova** | Logistics Coordinator | **Trade Compliance & Duty** | Richardson, TX **[?]** | CBP entries · HTSUS · FTZ 39 · *no GTM system* **[F]** |

**Iris sitting in Hong Kong is the point.** Demand planning lives in SAP ECC;
supply and manufacturing planning lives in Navision, in Hong Kong, which "leads
operational supply planning globally" **[F]**. The demand plan and the supply
plan are in different systems with different taxonomies **on opposite sides of
the buy decision**, and the intent to close that seam has been open since the
FY2017 10-K **[F]**. Iris does not have a data problem. Iris has a seam.

**Tova replaces the fleet seat.** Fossil owns no fleet and no domestic network —
watches fly, everything else sails through Long Beach **[F]**. The research
found **no global trade management system and no transportation visibility
platform** **[F]**, so this seat's whole job is currently done in Excel against
a duty structure where 19 CFR 141.89 *requires* the invoice to break out
component values, calibre, ligne size, jewel count and battery maker **[F]**.
That is the most defensible agent in the app.

---

## 3 · Vocabulary map

Every fixture rewrite uses this table. Left column is a find; right is not a
blind replace, because several change meaning.

| Shaw | Fossil | Note |
| :-- | :-- | :-- |
| 120 pallets | units / a buy quantity | watches ship in cartons, not pallets |
| committed install date | floor-set / on-shelf date | retail calendar, not a jobsite |
| dealer | wholesale account · distributor | 21 sales subsidiaries, 74 distributors **[F]** |
| mill · plant | Tier 1 factory | ~91 factories, 14 countries; 32 make watches, 29 of those in China **[F]** |
| Ringgold, GA (owned plant) | Solan, Himachal Pradesh | the **only** owned plant; casing-up and packaging **[F]** |
| 49 distribution nodes | **3 DCs** | Dallas→Sunnyvale, Eggstätt DE, Hong Kong **[F]** |
| 43,000 SKUs / 3,800 styles | never disclosed | do **not** invent a SKU count — mark it unknown **[F]** |
| dye lot · roll width | case · dial · strap variant | the substitution-integrity rule, re-based |
| carpet tile · LVP · SPC | watch · leather goods · jewellery | ~37 of the Tier 1 list is fixtures & packaging **[F]** |
| private fleet · truckload lane | air vs ocean mode | "FOSSIL EAST LTD AIR" / "…OCEAN" run as standing parallel programmes **[F]** |
| OMP · Oracle Fusion · Manhattan · Project44 | SAP ECC · Navision · APO→IBP · SAP WM · Sterling OMS · SFCC · NewStore | straight swap **[F]** |
| geopolitical lead-time increase | licensor approval lapse | the new anchor |
| damaged pallets | Ch. 99 overlay + FTZ re-activation | the new sting in the tail |

---

## 4 · Signal taxonomy

The existing `Cause` union (`supply`, `shortfall`, `excess`, `awaiting`, `cost`,
`status`, `damage`) survives almost intact — `damage` becomes **`duty`**, which
is Fossil's equivalent of value destroyed in transit. `Signal` needs the
Fossil-specific gates added:

```
licensor-silent      20-day clock expired, deemed disapproval        [F]
gate-missed          style missed line review
capacity-requeued    late buy against a booked capacity pool
royalty-floor        cut widens the gap to guaranteed minimum        [F]
overlay-applied      Ch. 99 ad valorem on full entered value        [F]
classification       strap material moves the HTSUS line            [F]
first-sale           valuation through Fossil East HK               [F]
ftz-unactivated      Sunnyvale designation unevidenced              [F]
```

Retained from Shaw with no change of meaning: `silent-po`, `capacity`, `replan`,
`safety-stock`, `pr-limit`, `options-drafted`, `awaiting-customer`, `overstock`,
`aging`, `second-source-quote`, `rebalanced`, `settled`.

Dropped: `carrier-choice`, `pickup-window`, `backhaul`, `dispatched` — all
private-fleet mechanics with no Fossil analogue.

---

## 5 · Two things we must not assert

The research is explicit that these are unknowable from outside, and the app
should say so rather than fabricate a number **[F]**:

- **SKU count** — never disclosed, before or after the smartwatch exit.
  Anywhere Shaw showed 43,000, Fossil shows a range or an explicit unknown.
- **Whether Sunnyvale gets FTZ designation** — no public evidence either way.
  This is a *live question* in the app, not a settled fact. It is also the best
  single unresolved item in the whole model, so Tova's seat should surface it as
  an open exposure rather than resolve it.

Licensed brand roster: only **Michael Kors** is named in the research (it can
terminate on missed net-sales thresholds **[F]**), and **Fossil** and **Zodiac**
appear as owned brands **[F]**. The other five licensed calendars are real **[F]**
but unnamed — either confirm the roster or keep them as "Licensor B…F". Do not
guess brand names into fixtures.

---

## 6 · The scope model (top bar)

**Superseded by `Fossil_Americas_Priority_Supply_Chain.xlsx`.** That sheet is
the authoritative shape and it is not what section 6 originally proposed. It
plans on:

```
Function × Region × Country × Category  →  Location / Entity
```

### What the sheet changed

**Brand comes out of the bar.** There is no brand column. Brand stays in the
model — `BRANDS` keeps every licensor's approval clock, royalty floor and
termination threshold, because those mechanics are the reason this app is worth
building — but it is not a scope control. A control the source data does not plan
by is a control that filters against nothing.

**Category goes back in.** Section 6 demoted it to the trade seat on the grounds
that the book is watch-heavy. Wrong: the sheet carries a Category column against
*every* Function, so every seat plans by it. **Watches and Jewelry** are the
priority book; leather goods is absent, which is a finding rather than an
omission. Spelling follows the sheet — "Jewelry", not "Jewellery".

**Country replaces branch.** The third cut is a country, which is better than
the market-named subsidiary list: a country is what the sheet plans by, and it is
the level a routing guide, a duty rate and a service obligation all attach to.

**Season stays out.** Still no season column, so the earlier reasoning holds —
the bar answers whose and where, the page answers when.

### The trio

**Region → Country → Category**, with region → country as the parent-child pair.

| Slot | Values |
| :-- | :-- |
| **Region** | Americas *(priority)* · Europe · Asia · *All regions* |
| **Country** | United States · Canada · Mexico *(Americas)* · *All countries* |
| **Category** | Watches · Jewelry *(priority)* · others marked **not in scope** |

Out-of-scope categories stay listed and stay labelled. Hiding them would make the
priority book look like the whole company; listing them unmarked would make the
reader discover the gap by finding an empty page.

### The entity is derived, not chosen

The sheet's most interesting column, and the one a scope control usually does not
model: **the same country resolves to a different place depending on which seat
is asking.**

| Seat | United States | Canada | Mexico |
| :-- | :-- | :-- | :-- |
| Buyer · Planner · CSR | Dallas | Toronto | Mexico City |
| Logistics Coordinator | Dallas **DC** | Canadian Distribution | Mexican Distribution |

In the United States those are both in Dallas and still not the same place,
because the question is different. So `entityFor(persona, country)` derives it and
the page displays it — a fourth dropdown nobody would know how to answer would be
the wrong shape. It returns null outside the Americas, where the sheet says
nothing, rather than inventing an office.

Note the DC is named **Dallas**, not Sunnyvale: the relocation has not happened,
so the sheet is right and the FTZ re-activation stays the open exposure it is.

### The buyer's second trio

Unchanged and still separate, because the sourcing book is upstream: a selling
country is where a watch goes, not where it is assembled.

- spend family → `Finished goods (FOB) · Components (via assembler) · Fixtures & packaging · Service parts`
- region → `China · India · Southeast Asia · Other`

The `viaAssembler` flag matters here: Fossil buys the finished, cased watch, so
movements, cases and bracelets are the assembler's purchase, visible only as cost
drivers inside a FOB price. Naming that is the difference between a leverage
story and a wish.

### Executive carries exactly one control: category

Its measures are genuinely computed across every country — so region and
country stay off. But the page reads the company at two scales, and `scaleFor`
needs the reader to say which: **All categories** is the whole company (the
loaded book × `categoryMultiple`), **Watches** is the derived book itself at
×1, any unloaded category reads zero. Counts and dollars scale **together** —
the Shaw build scaled dollars only, and a reader dividing $41M at risk by 13
products got a row that refuted itself.

### Unresolved

- **Europe and Asia coverage.** The sheet is Americas-only. Their countries are
  modelled and flagged `priority: false`; a second sheet would replace the
  guesses.
- **Store counts.** 176 total vs 111 outlet + 88 full-price = 199. Carrying the
  split, dropping the total.
