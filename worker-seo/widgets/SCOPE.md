# TMolecule Storefront Widgets — Scope

Embeddable, interactive storefront tools for the **health / wellness / functional-tea**
taxonomy. Ports the proven WhollyKaw widget pipeline (`~/whollykaw/worker-seo/widgets/`):
**Vite 6 library mode → one self-contained IIFE per widget → Shadow DOM (no theme CSS
leak) → served by `worker-seo` at `/learn/widgets/<name>.js`**.

> Status (2026-06-21): **Widget set SHIPPED & CLOSED.** Tier 1 (#1 tea-finder, #2 brew-guide,
> #3 cost-per-cup) all live at `/learn/<slug>` — indexed + IndexNow-submitted. **#4 Ingredient
> Safety: declined, NOT built** — YMYL + vendor-COI (we sell the ingredients); stays as
> research-framed articles (e.g. `/learn/is-collagen-tea-safe`). Reopen only with explicit
> human sign-off. This doc remains the reference for the build/deploy pattern.
>
> Update (2026-06-24): **Reopened for #5 — `caffeine-comparator`. Built & LIVE** at
> `/learn/caffeine-comparator`, embedded on `/learn/is-rooibos-caffeine-free` and
> `/learn/l-theanine-and-caffeine-in-tea`, in sitemap + IndexNow-submitted. Purely factual
> caffeine figures (compliance-trivial). Unlike the first three, it ships an **embed snippet**
> on its page (link-building asset — the one Vite angle that touches TM's real lever, off-site
> links; on-page calculators drive ~0 citations per WK data). Build: `WIDGET=caffeine-comparator
> vite build` → `node scripts/bundle-widgets.mjs` → routes in `src/index.js`.

---

## Grounding (what's real)

- **Products (2):**
  - `/products/spice-rush-collagen-black-tea` — collagen + black tea + warming spices. Morning / replace-coffee / collagen ritual.
  - `/products/immunitea-defense-tea` — functional wellness / seasonal-support blend.
  - Fallback bridge: `/collections/all`.
- **Pillars** (`worker-seo/src/taxonomy.js`): Ingredients · Benefits & Goals · Teas & Blends · Recipes & Rituals · Healthy Living.
- **Audience × safety framework** already in `taxonomy.js`:
  - Audiences: adults · women · pregnant · breastfeeding · children · seniors (65+).
  - Safety tones: `safe` (Generally fine) · `caution` · `consult` (Ask a provider) · `avoid`.
  - Regulatory: `permitted` · `restricted` · `banned` (the EU-cinnamon angle).
- **Existing /learn corpus** (~44 seed topics) the widgets compose with: collagen cluster, chai/spice cluster, matcha/green-tea, adaptogens (ashwagandha), gut/skin axis, sleep/immunity/energy "best tea for X", brewing how-tos, keto/paleo.

### On "fitness"
TMolecule is a tea brand, not a fitness brand — there is no fitness SKU. Fitness/active-living
is covered **obliquely and honestly**: "tea to replace coffee" (energy ritual), `collagen-for-joints`
(movement-adjacent), morning-routine framing. We do **not** build a workout tracker or a
"recovery calculator" — that would be off-brand and a claims risk. Active living shows up as
*ritual and occasion*, never as a performance promise.

---

## COMPLIANCE — read first (no-medical-claims, food/supplement tier)

TMolecule products are **ingestible foods / supplements, not drugs.** Every widget output is
gated by `~/.claude/rules/common/no-medical-claims.md`. The governing line:

> Describe *published research about an ingredient* — never claim *what the product will do for a person.*

**Hard rules for these widgets:**
- No outcome claims, even hedged. No "reduces inflammation," "boosts immunity," "improves joints,"
  "calculate your collagen needs," or result timelines — in labels, results, *or tooltip copy*.
- Goal/benefit inputs are reframed as **occasion / ritual / flavor preference**, not symptoms.
  ("Evening wind-down ritual," not "fixes insomnia." "Morning energy ritual," not "cures fatigue.")
- Any health-adjacent output carries the food/supplement disclaimer + **consult-a-professional**
  language: *"This describes published research, not medical advice. Not evaluated by the FDA;
  not intended to diagnose, treat, cure, or prevent any disease."*
- **Structure/preparation is explicitly FINE:** brewing temp/time/ratio, caffeine content,
  cost math, flavor/sensory descriptors, ingredient names & sourcing. Build freely here.

**Special gate — the Ingredient Safety Lookup (Widget #4):** surfaces guidance about ingredients
**we sell**. Per the `no-vendor-COI-YMYL` lesson, a safety tool must NOT become a green-light
machine that understates our own product's risk. It must lead with "ask a provider," never output
a bare "safe for you," and **ships only after human compliance review.** Flagged, not auto-built.

---

## Architecture (port from WK, near-verbatim)

```
worker-seo/widgets/
  package.json          # vite 6, lib-mode build:<widget> scripts, oxlint
  vite.config.js        # WIDGET=<name> → IIFE → dist/<name>.js  (copy WK config)
  src/
    shared/
      brand.css         # TM brand tokens (NOT WK's) — Fraunces/Inter per brand typography
      dom.js            # mountShadow, el, mountPoints  (port verbatim)
      cart.js           # Shopify AJAX cart; tmolecule.com host check + permalink fallback
      data.js           # ENDPOINTS → tmolecule.com /learn/*.json  (retarget ORIGIN)
    tea-finder/         # #1
    brew-guide/         # #2
    cost-per-cup/       # #3
    ingredient-safety/  # #4  (compliance-gated)
    morning-routine/    # #5  (phase 2)
  dist/                 # committed IIFE bundles, served by worker-seo
```

Serving: add a `/learn/widgets/<name>.js` route in `worker-seo/src/index.js` (mirror WK).
Each widget mounts into `<div id="tm-<name>"></div>` dropped into a `/learn/*` page or theme block.

`cart.js` retarget: host check `(^|\.)tmolecule\.com$`; off-store context returns
`https://tmolecule.com/cart/<variant>:<qty>` permalink. Same surface as WK.

---

## Build set

### Tier 1 — port-ready, highest leverage (build these first)

#### #1 — Tea / Blend Finder Quiz  ★ flagship
- **WK analog:** `scent-finder` (Typeform-style, one-question-per-screen, pill choices, back nav).
- **Mount:** `/learn/tea-finder` (and a homepage/collection block).
- **Inputs (preference, NOT medical):** when do you drink it (morning replace-coffee / afternoon / evening wind-down) · flavor (warm-spiced / earthy / bright-citrus) · caffeine tolerance (full / some / none) · ritual goal-as-occasion (energy ritual / wind-down ritual / everyday) · dietary (keto·paleo·vegan flag).
- **Output:** ranked match → **Spice Rush** (morning, spiced, replace-coffee, collagen ritual) or **ImmuniTea** (wellness/seasonal) → links to its PDP + the matching `/learn` seed page.
- **Data:** `/learn/tea-finder.json` (attribute map; see Data Contracts). Falls back to a small inline map if the endpoint 404s (mirrors WK's loadFinder fallback).
- **Compliance:** flavor/occasion/caffeine only. The caffeine-free answer routes to lower-caf options; makes no medical claim. Names verbatim from product data.

#### #2 — Brew Guide / Chai Concentrate Calculator
- **WK analog:** `cost-per-shave` model.js (pure deterministic calc).
- **Mount:** `/learn/chai-concentrate-recipe`, `/learn/masala-chai-recipe`, brew how-to pages.
- **Inputs:** servings · strength (light/standard/strong) · base (water / milk / oat) · format (hot / iced / latte).
- **Output:** temp · steep time · tea:water:milk ratio · spice amounts · (collagen note: "research on whether hot water degrades collagen" framing, sourced from `does-hot-water-destroy-collagen` seed — research-framed, optional).
- **Data:** static in-widget (preparation params). Zero network, zero claims.
- **Compliance:** ✅ pure preparation/structure — explicitly permitted. Safest widget.

#### #3 — Cost-per-Cup Calculator
- **WK analog:** `cost-per-shave` (direct port; swap units).
- **Mount:** `/learn/does-collagen-tea-actually-work`, `/learn/collagen-tea-vs-collagen-powder`, PDPs.
- **Inputs:** cups/day · current habit (coffee-shop latte / home coffee + collagen powder / nothing).
- **Output:** TM $/cup vs the comparison stack, monthly/annual delta. Pulls product price.
- **Data:** product price (inline or `/learn/products.json`). Pure math.
- **Compliance:** ✅ cost math only. Strong conversion tool, no claims surface.

### Tier 2 — taxonomy-native (reuses the safety/audience data)

#### #4 — Ingredient Safety Lookup  ⚠ compliance-gated, human-review before ship
- **WK analog:** `lather-fix` decision tree.
- **Mount:** `/learn/is-collagen-tea-safe`, `/learn/is-cinnamon-banned-in-the-eu`, ingredient pages.
- **Inputs:** ingredient (collagen · cinnamon · ashwagandha · turmeric · ginger · matcha) × audience (adults · women · pregnant · breastfeeding · children · seniors).
- **Output:** the taxonomy **safety tone** (`safe`/`caution`/`consult`/`avoid`) + research-framed note + regulatory status (EU cinnamon) + **prominent "ask a provider."**
- **Data:** `/learn/ingredient-safety.json`, generated from existing seed `safety`/`regulatory` blocks.
- **Compliance:** ⚠ HIGHEST RISK. Leads with consult-a-provider; never a bare "safe for you";
  surfaces our-own-product caveats honestly (no-vendor-COI rule). **Build last, gate behind human review.**
  High AEO/citation upside (answers a real recurring query), which is exactly why it must be exact.

### Tier 3 — phase 2 (after Tier 1 proves out)

- **#5 Morning Wellness Routine Builder** — WK `routine` analog; builds a tea + add-on ritual,
  cart-adds via `cart.js`. Bridges `morning-wellness-routine` seed. Occasion-framed, no claims.
- **#6 Caffeine-by-Cup Comparator** — matcha vs green vs black vs rooibos(0) vs coffee, mg/cup.
  Pure data. Serves the "replace coffee" intent (`best-tea-to-replace-coffee`).

---

## Data contracts (new `/learn/*.json` endpoints)

Generated by `worker-seo/scripts/*` from seed data, served with `access-control-allow-origin: *`
(mirror WK's `build-scent-routines.mjs`).

| Endpoint | Feeds | Shape |
|---|---|---|
| `/learn/tea-finder.json` | #1 | `{ product: { attrs:{occasion[],flavor,caffeine,dietary[]}, handle, variantId, price } }` |
| `/learn/products.json` | #1 #3 | `[{ handle, title, price, variantId }]` (2 products) |
| `/learn/ingredient-safety.json` | #4 | `{ ingredient: { audience: { tone, note, regulatory } } }` from seed safety blocks |
| `/learn/caffeine.json` | #6 | `[{ tea, mgPerCup, source }]` |

#2 and #3 (mostly) need no network — preparation params and price live inline.

---

## Recommended build order

1. **#2 Brew Guide** — zero compliance surface, validates the ported pipeline end-to-end.
2. **#3 Cost-per-Cup** — direct WK port, conversion-positive, no claims.
3. **#1 Tea Finder** — flagship; needs `tea-finder.json` + `products.json` built first.
4. **#4 Ingredient Safety** — only after human compliance sign-off.
5. Phase 2: #5 routine, #6 caffeine.

Tier 1 (#1–#3) reuses ~80% of the WK widget code (shared/dom, cart, the cost model, the
quiz engine). Net-new work is TM brand tokens, the two product bridges, and the data builders.

---

## What this deliberately does NOT touch
PDPs, collections, checkout, and the worker-rendered `/learn/*` KV pages stay Liquid +
worker-rendered. Widgets are *additive* interactive islands injected into those pages — not a
re-platform.
