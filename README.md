# Navanta Supply Chain — Target retail demo

Navanta's supply-chain product, demo-themed for a Target-shaped mass-market
retailer: a design-led, owned-brand-heavy general merchandiser that buys
finished goods FOB Asia through its own sourcing arm, lands them at US
regional distribution centres and flows them to stores. The four seats a
supply-chain workshop follows through a single partner-brand order: the
**Buyer / Sourcing Manager**, the **Deployment Planner**, the **Customer
Service Rep** and the **Logistics Coordinator** — plus an executive dashboard
reading across all of them.

The translation map that governs every fixture — the SKU/brand/DC/region
renames, the vocabulary, the anchor event — is in
[docs/retheme-map.md](docs/retheme-map.md); `src/data/catalogue.ts` is the
source of truth every other file agrees with.

Built on `@navanta-ai/design-system` with `@phosphor-icons/react`.

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run lint     # eslint
```

## Seats and agents

Four seats, each with its own named agent. The agent's name appears wherever
its work shows up — the insight column header, the chat panel, the modal footer.

| Seat | Page | Agent |
| :-- | :-- | :-- |
| Buyer / Sourcing Manager | Buying | **Mercer** |
| Deployment Planner | Planning | **Iris** |
| Customer Service Rep | Service | **Christy** |
| Logistics Coordinator | Logistics | **Tova** |

Switch seats from the side-nav user block → **Switch profile** (persisted in a
`navanta_persona` cookie).

## The scope model

The top bar asks three questions from the West Priority planning sheet
— **Region → State → Category** — and derives the seat's working entity from
persona × state (`entityFor`): the commercial seats resolve to Minneapolis HQ,
logistics to the region's distribution node. Brand is held in the model
(approval clocks, royalty floors, termination thresholds live per-brand) but
is not a control, because the priority sheet does not plan by it.

## The order we follow

2,880 units of a partner-brand stoneware dinnerware set against a committed
floor-set date, hit by a **geopolitical lead-time increase** — the Dongguan
supplier's lead time jumps 10 days for three months — and arriving with
**two cartons crushed** in the consolidation. Mercer catches the change and
informs the account; Iris replans cover and raises the requisitions; Christy
drafts alternate-or-wait and settles the claim; Tova reconciles one ETA and
warns the customer early.

Every row carries a `cause` and routes its advisory line through one
`insightText()` in [action-center.ts](src/data/action-center.ts) —
deterministic, a pure function of cause plus a small numeric context, so the
copy is reviewable.

## Data honesty rules

Grounded in the public shape of a Target-scale retailer, never its
confidential facts:

- **Public shape only** — RDC cities, owned brands (Good & Gather, Threshold),
  named partner programs (Hearth & Hand with Magnolia, Disney, and so on),
  the 2015 pharmacy exit, Minneapolis HQ and the retailer-owned sourcing arm.
- **Suppliers are fixtures** — Luen Hing Housewares, Vinh Phat Textiles and
  Cedar Mills Co-Pack are invented names, marked `FIXTURE NAME` in comments.
- **No invented SKU count** — the catalogue loads eight styles because that is
  what the prototype derives, not because anyone disclosed a figure.
- Voice recordings from earlier builds are detached (they name the wrong
  company out loud); the live-call wiring (Twilio/ElevenLabs, `.env.local`)
  is intact and **dials real numbers** when configured.

## Deploying to Vercel

`@navanta-ai/design-system` is a **private package on GitHub Packages**, and
[.npmrc](.npmrc) resolves it with:

```
//npm.pkg.github.com/:_authToken=${NPM_PACKAGE_TOKEN}
```

**The variable is `NPM_PACKAGE_TOKEN`.** Not `GITHUB_TOKEN` — that name is
deliberately avoided, because GitHub Actions injects a `GITHUB_TOKEN` of its
own that cannot read packages from another repository, and a workflow would
silently pick the wrong one up. If a build fails with

```
npm error 401 Unauthorized - GET https://npm.pkg.github.com/download/@navanta-ai/design-system/...
npm error unauthenticated: User cannot be authenticated with the token provided.
```

the first thing to check is the variable's NAME, not the token's validity: with
`NPM_PACKAGE_TOKEN` unset, npm sends the unexpanded string and GitHub reports it
as an authentication failure rather than as a missing variable.

### Setting it

A GitHub **classic** personal access token with the `read:packages` scope, from
<https://github.com/settings/tokens>. Fine-grained tokens do not currently
cover GitHub Packages reads. If the Navanta org uses SAML SSO the token must
also be **authorised for the organisation** — GitHub shows a "Configure SSO"
button next to the token after you create it, and until you use it every
request 401s.

| Name | Value | Environments |
|---|---|---|
| `NPM_PACKAGE_TOKEN` | the classic PAT | Production, **Preview**, **Development** |

**All three environments, not Production only.** `npm install` runs at build
time for every deployment, and a Preview build — which is what any branch or
pull-request deploy is — cannot see a Production-only variable. This is the
second most common cause of the 401 above.

It also has to exist **before** the build that needs it. Adding it after a
failed deploy works, but you then have to redeploy: Vercel does not re-run a
failed install against new variables on its own.

```bash
vercel env add NPM_PACKAGE_TOKEN   # paste the PAT, tick all three environments
vercel --prod
```

### Check the token before redeploying

One command, no deploy needed. If this prints a version, the token is good:

Run it from the project root, so this repo's `.npmrc` applies. It prompts for
the token rather than taking it inline — an inline secret lands in your shell
history, and `<...>` placeholders are shell redirection operators, so a pasted
`<token>` fails before npm ever runs:

```bash
printf 'Paste token: ' && read -rs TOKEN && echo && NPM_PACKAGE_TOKEN="$TOKEN" npm view @navanta-ai/design-system version
```

`401` means the token is wrong, expired, not a classic PAT with
`read:packages`, or not SSO-authorised. `404` means the token is valid but its
account cannot see the package — check the org's package permissions.

Everything else is a stock Next.js deploy: no database, no runtime secrets,
every figure a deterministic fixture, so a preview deployment shows exactly
what localhost shows.

### Local development

The same variable, exported in your shell — `npm ci` reads the identical
`.npmrc`:

```bash
printf 'Paste token: ' && read -rs TOKEN && echo && export NPM_PACKAGE_TOKEN="$TOKEN"
npm ci
```

The voice-call features additionally need `.env.local` (Twilio + ElevenLabs).
It is gitignored and not in this repo; without it the app runs fine and the
call CTAs stay inert. **With it, they place real outbound calls** — worth
knowing before clicking a "Contact" action during a demo.
