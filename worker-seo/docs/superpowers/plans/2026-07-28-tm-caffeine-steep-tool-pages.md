# TM Caffeine + Steep Tool Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Win the high-volume, low-competition tea caffeine/steep queries (`how much caffeine in matcha` 18.1k, `green tea caffeine` 9.9k, `matcha to water ratio` 1.6k, `green tea steeping time` 720) by shipping four thick, schema-rich, interactive head-term pages on TM's existing `/learn` worker.

**Architecture:** The `worker-seo` engine already renders `/learn/<slug>` articles from KV `LEARN_PAGES` seeds via `renderArticle()` (emits Article + FAQPage + BreadcrumbList schema, product bridge, related links, and can embed a tool widget via a seed `"widget"` field). Both calculators (`caffeine-comparator`, `brew-guide`) already exist as built Vite widgets and are served + routed. So this is **author + reconcile + optimize**, not build: enrich the two widgets' data to match one canonical dataset, author four head-term seed articles that embed those widgets and carry a static comparison table (SSR fallback), wire the internal-link graph, add Dataset JSON-LD, then seed → vectorize → deploy → verify live.

**Tech Stack:** Cloudflare Worker (`src/*.js`), KV (`LEARN_PAGES`), Vite widgets (`widgets/src/*`, IIFE bundles in `widgets/dist`), Vectorize (`tm-learn-corpus`), `bun test`, seed gates (`validate:seeds`, `verify:citations`, `check:links`, `test:compliance`).

## Global Constraints

- **No-medical (mandatory):** describe published *research* / structure-function, never outcome or disease claims. L-theanine/"calm-alert" framed as research only. Add the food/dietary-supplement disclaimer line. Every seed must pass `npm run test:compliance`. Copy rules from `~/.claude/rules/common/no-medical-claims.md`.
- **No invented facts:** every numeric claim traces to a `sources[]` entry; citations pass `npm run verify:citations` (PubMed/PMC PMIDs must resolve + title-match; non-NCBI sources pass as UNVERIFIED warnings; never cite Wikipedia).
- **Citation-coverage self-check (mandatory before commit):** `verify:citations` only checks that URLs/PMIDs *resolve* — it does NOT check that every claim is covered. Before committing any seed, re-read your own prose and FAQs, list every numeric or authoritative-guidance claim (caffeine mg, brew temps, steep times, agency guidance figures), and confirm each has a matching `sources[]` entry. Tasks 3 and 4 both shipped with uncovered claims caught only in review (FDA 400 mg/day; brew temp/time) — this is the project's most common defect.
- **One canonical dataset (Appendix A):** the widget model data AND every article's comparison table use the SAME numbers. Contradictory numbers across surfaces are the exact competitor flaw we exploit — do not reintroduce it.
- **Answer-first:** the first 40–60 words of each `body_html` state the headline number with its cited range (featured-snippet / AI-Overview target).
- **SSR fallback:** each `body_html` contains the full static comparison table. The embedded widget is additive; the page must be complete and correct with JS disabled.
- **Unique `title` + `meta_description`** per seed (never reuse). One `h1`.
- **Commerce target:** `product_bridge: "/products/spice-rush-collagen-black-tea"` on all four pages (Spice Rush Collagen Black Tea — a caffeinated black-tea blend). Never a bare `/collections/all`.
- **Seed required fields:** `title`, `h1`, `meta_description`, `body_html`. `sources[].url` must match `^https?://`. `faqs[]` items need `q` and `a`.
- **Commits:** `git add` only the specific files a task creates/edits. The branch working tree has ~39 unrelated untracked sync files — never `git add -A`.

---

## Appendix A — Canonical reference data (single source of truth)

**Caffeine (per standard serving).** **Canonical source = the built widget's `DRINKS` table** (`widgets/src/caffeine-comparator/model.js`, sourced from USDA / Mayo Clinic / infusion studies). Article tables must match it exactly — do not reintroduce the SERP-scraped variants below the widget's values. Reconciled figures:

| Drink | Serving | Typical | Range (low–high) |
|---|---|---|---|
| Matcha | 1 tsp (2 g) whisked in 2–3 oz | **~65–70 mg** | 60–80 mg |
| Matcha latte | 2 tsp (4 g) | ~130 mg | 120–160 mg |
| Green tea (steeped) | 8 oz | **~35 mg** | **30–50 mg** (corrected 2026-07-28) |
| Black tea (steeped) | 8 oz | ~50 mg | 40–70 mg |
| Oolong | 8 oz | ~40 mg | 30–50 mg |
| White | 8 oz | ~25 mg | 15–30 mg |
| Espresso | 1 oz shot | ~63 mg | 60–80 mg |
| Brewed coffee | 8 oz | ~95 mg | 80–100 mg |
| Rooibos / herbal | 8 oz | 0 mg | caffeine-free |

FDA general adult reference: `DAILY_REF = 400 mg/day` (already in the widget model).

> ⚠️ **GREEN TEA RANGE CORRECTED 2026-07-28.** This table originally said 25–45 mg. A final pre-deploy review found **no source anywhere stated that range** — the citation propping it up was the bare `fdc.nal.usda.gov` search homepage, which substantiates nothing (Mayo Clinic 403s; USDA FDC offers only a single ~28 mg point, and its record deep-links 404). The range was corrected to **30–50 mg (avg ~35)**, which Healthline states verbatim at `https://www.healthline.com/nutrition/caffeine-in-green-tea`. This propagated to 9 seed files, the `caffeine-comparator` widget `DRINKS`, its rebuilt bundle, and the widget host page's SSR list in `src/template.js`.
>
> **Lesson for the WhollyKaw port:** a figure can pass `verify:citations`, survive several scoped reviews, and still have no source that states it. Check claim COVERAGE, not just that URLs resolve. Changing a canonical range also silently falsifies comparative prose written against the old numbers ("overlaps with", "half of", "more than") — sweep for that language whenever a canonical value moves.

**Steep / ratio.**

> ⚠️ **VERIFICATION STATUS (corrected 2026-07-28).** This table was originally drafted from SERP research and was NOT source-verified. A Task 4 review caught a figure that no cited source supported. **As of Task 2R (2026-07-28) ALL rows are now verified** against real, resolving authorities, with every URL recorded in `widgets/src/steep-guide/model.js` (the canonical source of truth for steep data). Several original draft figures were WRONG and were corrected — see the corrections note below. Never quote a steep figure that is not traceable to that model file.

**Green tea — VERIFIED:**

| Source | URL | Temp | Time |
|---|---|---|---|
| Tea Association of the USA | `https://www.teausa.org/` (brewing tea) | 165–185 °F | ~1 min |
| Ippodo (Japanese sencha standard) | `https://ippodotea.com/` | 176 °F (80 °C) | 60 s |
| Healthline (generic Western guidance) | `https://www.healthline.com/nutrition/how-to-steep-tea` | 175 °F (79 °C) | 3–4 min |

**Genuine variance — do not paper over it.** Japanese sencha convention (Ippodo, TAUSA) is a brief ~1-minute steep; generic Western guidance is 3–4 minutes. Both are real and sourced. Pages should present the short steep as the Japanese-tea convention and note the longer generic guidance, citing each — this honest treatment is a differentiator versus competitors who publish one unsourced number.

Canonical Green row: **165–185 °F (74–85 °C)**, **~1 min** (Japanese convention; note 3–4 min generic guidance), 1 tsp (2 g) / 8 oz.

**Remaining rows — NOW VERIFIED (Task 2R, 2026-07-28).** All source URLs confirmed HTTP 200 and recorded in `widgets/src/steep-guide/model.js`, which is the **canonical source of truth** for steep data (it ships the provenance with the values). Quote these, not the earlier draft:

| Tea | Water temp | Time | Leaf : water | Source |
|---|---|---|---|---|
| Matcha (usucha, thin) | 176 °F (80 °C) | whisk 15 s | 2 g / 2 oz (60 ml) | Ippodo (usucha spec) |
| Matcha (koicha, thick) | 176 °F (80 °C) | mix 15 s | 4 g / 1 oz (30 ml) | Ippodo (koicha spec) |
| Black | 195–212 °F | 3–5 min | 1 tsp / 8 oz | TAUSA + Healthline |
| Oolong | 180–195 °F | 3–7 min | 1 tsp / 8 oz | TAUSA + Healthline |
| White | 175–190 °F | 3–5 min | 1 tsp / 8 oz | TAUSA + Healthline |

**Corrections against the original SERP-drafted draft** (evidence the draft was unreliable): koicha whisk time was 30 s, actually **15 s**; black low-end was 200 °F, actually **195 °F**; oolong was 185–205 °F / 3–5 min, actually **180–195 °F / 3–7 min**; white was 175–185 °F / 2–5 min, actually **175–190 °F / 3–5 min**.

**Genuine TAUSA-vs-Healthline disagreement** exists for black, oolong and white and is recorded per-tea in the widget model. Pages must present the variance with both attributions rather than silently picking one number.

**L-theanine / calm-alert (research framing only, reuse already-verified PMIDs):**
- Kelly et al. 2008, *J Nutrition* — `https://pubmed.ncbi.nlm.nih.gov/18641209/` (L-theanine + caffeine on attention).

---

## Task 1: Reconcile `caffeine-comparator` widget data to Appendix A

**Files:**
- Modify: `widgets/src/caffeine-comparator/model.js`
- Rebuild: `widgets/dist/caffeine-comparator.js` (generated)

**Interfaces:**
- Produces: a widget whose per-drink caffeine values equal Appendix A (consumed by the article tables in Tasks 3–4 for consistency).

- [ ] **Step 1: Read current data**

Run: `cat widgets/src/caffeine-comparator/model.js`
Confirm which drinks/values exist.

- [ ] **Step 2: Reconcile values**

Edit `model.js` so its entries for matcha, matcha latte, green tea, black tea, espresso, and brewed coffee match Appendix A exactly (typical value + range where the UI supports it). Add any missing entry; correct any that differ. Do not remove unrelated drinks already present.

- [ ] **Step 3: Rebuild the bundle**

Run: `cd widgets && npm run build:caffeine && cd ..`
Expected: `widgets/dist/caffeine-comparator.js` regenerated (newer mtime).

- [ ] **Step 4: Sanity-check the bundle contains the values**

Run: `grep -oE '(60|70|28|47|63|95)' widgets/dist/caffeine-comparator.js | head`
Expected: matcha/coffee values present.

- [ ] **Step 5: Commit**

```bash
git add widgets/src/caffeine-comparator/model.js widgets/dist/caffeine-comparator.js
git commit -m "feat(widget): reconcile caffeine-comparator data to canonical dataset"
```

## Task 2: Reconcile `brew-guide` widget data to Appendix A

**Files:**
- Modify: `widgets/src/brew-guide/model.js`
- Rebuild: `widgets/dist/brew-guide.js`

**Interfaces:**
- Produces: a widget whose temp/time/ratio values equal Appendix A (consumed by Tasks 5–6).

- [ ] **Step 1: Read current data**

Run: `cat widgets/src/brew-guide/model.js`

- [ ] **Step 2: Reconcile**

Edit so green, matcha (usucha + koicha), black, oolong, white entries match Appendix A (temp °F/°C, time, leaf:water). Add missing; correct differences.

- [ ] **Step 3: Rebuild**

Run: `cd widgets && npm run build:brew && cd ..`
Expected: `widgets/dist/brew-guide.js` regenerated.

- [ ] **Step 4: Sanity-check**

Run: `grep -oE '(160|180|175|212)' widgets/dist/brew-guide.js | head`
Expected: temp values present.

- [ ] **Step 5: Commit**

```bash
git add widgets/src/brew-guide/model.js widgets/dist/brew-guide.js
git commit -m "feat(widget): reconcile brew-guide data to canonical dataset"
```

## Task 3: Author `matcha-caffeine` lead page (targets "how much caffeine in matcha", 18.1k)

**Files:**
- Create: `seed/matcha-caffeine.json`

**Interfaces:**
- Consumes: `caffeine-comparator` widget (Task 1); Appendix A.
- Produces: KV article slug `matcha-caffeine` (referenced by Task 7 related graph).

- [ ] **Step 1: Write the seed file**

Create `seed/matcha-caffeine.json` mirroring the field set of `seed/matcha-vs-green-tea.json`, with:

- `title`: `How Much Caffeine Is in Matcha? (Per Tsp, Gram & Latte)`
- `h1`: `How much caffeine is in matcha?`
- `meta_description`: unique, ≤155 chars, e.g. `A standard 1 tsp (2 g) serving of matcha has about 65–70 mg of caffeine. See matcha vs coffee, green tea, and latte amounts — with a calculator.` (must use the Appendix A typical value, not a hybrid)
- `keywords`: `["how much caffeine in matcha","matcha caffeine","matcha vs coffee caffeine","matcha latte caffeine","caffeine in matcha per gram","is matcha high in caffeine"]`
- `widget`: `"caffeine-comparator"`
- `product_bridge`: `"/products/spice-rush-collagen-black-tea"`, `product_bridge_label`: `"Shop Spice Rush Black Tea"`, `product_bridge_blurb`: `"Want steady tea energy without a matcha whisk? Spice Rush is a caffeinated black-tea blend."`
- `pillar`: `"blends"`, `cluster`: `"matcha"`, `intent`: `"informational"`
- `related`: `["matcha-vs-green-tea","what-is-matcha","green-tea-caffeine","l-theanine-and-caffeine-in-tea"]`
- `body_html` (answer-first, ~1,100–1,300 words). Required structure:
  > All figures in this page use Appendix A (canonical widget values). The examples below already reflect them.
  1. **Answer-first paragraph** (verbatim opening): `A standard serving of matcha — 1 teaspoon (about 2 grams) whisked into 2–3 oz of water — contains roughly <strong>65–70 mg of caffeine</strong>. Depending on grade and how much powder you use, a serving ranges from about 60 to 80 mg. That's more than a cup of steeped green tea (~35 mg) but less than an 8 oz coffee (~95 mg).`
  2. `<h2>Matcha caffeine by serving size</h2>` — a `<table>` with rows: 1/2 tsp (~1 g) ~35 mg; 1 tsp (2 g) ~65–70 mg; strong latte (2 tsp / 4 g) ~130 mg. (From Appendix A.)
  3. `<h2>Matcha vs coffee, green tea, and espresso</h2>` — the full Appendix A caffeine comparison `<table>` (matcha, matcha latte, green tea, black tea, espresso, coffee). **This is the SSR fallback for the widget.**
  4. `<h2>Why matcha's caffeine feels different</h2>` — L-theanine research framing (cite Kelly 2008), no outcome claims.
  5. `<h2>How to control your matcha caffeine</h2>` — usucha vs koicha, grade, serving (ties to `matcha-to-water-ratio`, link it).
  6. `<h2>Is matcha too much caffeine?</h2>` — reference the FDA general 400 mg/day adult figure as published guidance (cite), structure-function only.
  7. Closing links to `what-is-matcha`, `matcha-vs-green-tea`.
  8. Disclaimer line: `This describes published research and general information, not medical or dietary advice.`
- `sources`: at least — Healthline `https://www.healthline.com/nutrition/does-matcha-have-caffeine`; USDA FoodData Central `https://fdc.nal.usda.gov/`; Kelly 2008 `https://pubmed.ncbi.nlm.nih.gov/18641209/`.
- `faqs` (verbatim, from live PAA/related searches):
  - `{"q":"Is matcha higher in caffeine than coffee?","a":"No. A 1 tsp (2 g) serving of matcha has about 65–70 mg of caffeine; an 8 oz brewed coffee has about 95 mg. Matcha has more than steeped green tea but less than brewed coffee."}`
  - `{"q":"How much caffeine is in a matcha latte?","a":"Most cafés use about 2 tsp (4 g) of matcha, so a latte typically has around 130 mg of caffeine (roughly 120–160 mg), similar to a small coffee."}`
  - `{"q":"Is 2 tsp of matcha a lot of caffeine?","a":"Two teaspoons (~4 g) is around 130 mg — roughly one strong cup of coffee. Published guidance puts a general adult reference at about 400 mg/day."}`
  - `{"q":"How much caffeine is in matcha per gram?","a":"A 2 g serving typically lands around 65–70 mg, with a usual range of 60–80 mg depending on grade and how much powder you use — roughly 30–40 mg per gram."}`
  - `{"q":"Does matcha give jitters like coffee?","a":"Matcha pairs caffeine with L-theanine. Research (Kelly et al., 2008) describes L-theanine plus caffeine affecting attention differently than caffeine alone; this is research description, not a promised effect."}`

- [ ] **Step 2: Validate schema**

Run: `npm run validate:seeds`
Expected: PASS (no errors for `matcha-caffeine.json`).

- [ ] **Step 3: Verify citations**

Run: `npm run verify:citations`
Expected: PMID 18641209 resolves + title-matches; non-NCBI URLs report UNVERIFIED (warning, not failure). Exit 0.

- [ ] **Step 4: Compliance gate**

Run: `npm run test:compliance`
Expected: PASS (no disease/outcome claims). If it flags a phrase, reframe to research/structure-function and re-run.

- [ ] **Step 5: Commit**

```bash
git add seed/matcha-caffeine.json
git commit -m "feat(learn): matcha-caffeine head-term page (18.1k, caffeine-comparator embed)"
```

## Task 4: Author `green-tea-caffeine` page (targets "how much caffeine in green tea", 9.9k)

**Files:**
- Create: `seed/green-tea-caffeine.json`

**Interfaces:**
- Consumes: `caffeine-comparator` widget; Appendix A.
- Produces: KV slug `green-tea-caffeine`.

- [ ] **Step 1: Write the seed** (mirror Task 3 structure) with:
  - `title`: `How Much Caffeine Is in Green Tea? (vs Coffee, Matcha & Black Tea)`
  - `h1`: `How much caffeine is in green tea?`
  - `meta_description`: `An 8 oz cup of steeped green tea has about 25–45 mg of caffeine (typically ~35 mg) — less than black tea, matcha, or coffee. Full comparison inside.`
  - `keywords`: `["how much caffeine in green tea","green tea caffeine","green tea vs coffee caffeine","green tea caffeine vs black tea","does green tea have caffeine"]`
  - `widget`: `"caffeine-comparator"`; `product_bridge` + labels as global constraint.
  - `pillar`: `"blends"`, `cluster`: `"green-tea"`, `intent`: `"informational"`
  - `related`: `["matcha-caffeine","green-tea-vs-black-tea","matcha-vs-green-tea","l-theanine-and-caffeine-in-tea"]`
  - `body_html` answer-first opening (verbatim): `An 8 oz cup of steeped green tea contains about <strong>25–45 mg of caffeine</strong> — typically around 35 mg. That's roughly a third of a cup of coffee (~95 mg) and about two-thirds of a cup of black tea (~50 mg).` Then H2s: by-factors (steep time/temp raises caffeine — link `green-tea-steeping-time`), full Appendix A comparison table (SSR fallback), decaf/low-caffeine options, L-theanine research note, disclaimer.
  - `sources`: Healthline green tea caffeine `https://www.healthline.com/nutrition/how-much-caffeine-in-green-tea`; USDA `https://fdc.nal.usda.gov/`; Kelly 2008 PMID.
  - `faqs` from PAA/related: green tea vs coffee; does steeping longer add caffeine; green tea before bed; green tea vs black tea caffeine; is there caffeine-free green tea. (Write 5 Q&As, answers grounded in Appendix A.)

- [ ] **Step 2:** `npm run validate:seeds` → PASS
- [ ] **Step 3:** `npm run verify:citations` → exit 0
- [ ] **Step 4:** `npm run test:compliance` → PASS
- [ ] **Step 5: Commit**

```bash
git add seed/green-tea-caffeine.json
git commit -m "feat(learn): green-tea-caffeine head-term page (9.9k)"
```

## Task 5: Author `matcha-to-water-ratio` page (targets "matcha to water ratio", 1.6k)

**Files:**
- Create: `seed/matcha-to-water-ratio.json`

**Interfaces:**
- Consumes: `steep-guide` widget (Task 2R); Appendix A steep table (verified rows).
- Produces: KV slug `matcha-to-water-ratio`.

- [ ] **Step 1: Write the seed** with:
  - `title`: `Matcha to Water Ratio: How Much Water for Perfect Matcha`
  - `h1`: `The right matcha-to-water ratio`
  - `meta_description`: `Use 1 tsp (2 g) matcha to 2 oz (60 ml) water for thin (usucha), or 4 g to 1 oz for thick (koicha). Latte and troubleshooting ratios inside.`
  - `keywords`: `["matcha to water ratio","how much water for matcha","matcha ratio","matcha powder to water","matcha latte ratio"]`
  - `widget`: `"steep-guide"`; `product_bridge` + labels; `intent`: `"how-to"`, `cluster`: `"matcha"`, `pillar`: `"blends"`
  - `related`: `["what-is-matcha","matcha-caffeine","green-tea-steeping-time","tea-brewing-temperature-guide"]`
  - `body_html` answer-first (verbatim): `For a standard bowl of thin matcha (usucha), use <strong>1 teaspoon (2 g) of matcha to about 2 oz (60 ml) of water at 176 °F (80 °C)</strong>, whisked about 15 seconds. For thick matcha (koicha), use 4 g to about 1 oz (30 ml). For a latte, Ippodo's published recipe is 3 g matcha into 3.4 oz (100 ml) water at 176 °F, whisked 15 s, plus 3.4 oz (100 ml) milk.` H2s: usucha vs koicha vs latte `<table>` (SSR fallback, verified Appendix A figures), water temperature (link `tea-brewing-temperature-guide`), grams-vs-teaspoons conversion, troubleshooting (clumpy/bitter/weak), disclaimer.
  - Figures MUST come from the verified Appendix A rows / `widgets/src/steep-guide/model.js`: usucha 176 °F, whisk 15 s, 2 g / 2 oz; koicha 176 °F, mix 15 s, 4 g / 1 oz. Cite Ippodo's usucha and koicha specs in `sources[]`.
  - `sources`: Japanese-tea authority brewing spec (e.g. `https://ippodotea.com/pages/how-to-prepare-matcha`); Healthline matcha prep `https://www.healthline.com/nutrition/what-is-matcha`.
  - `faqs`: how much matcha per cup; matcha to water ratio in grams; matcha latte ratio; why is my matcha bitter (too hot / too much powder); can I use a scale instead of a spoon. (5 Q&As.)

- [ ] **Step 2:** `npm run validate:seeds` → PASS
- [ ] **Step 3:** `npm run verify:citations` → exit 0 (non-NCBI UNVERIFIED ok)
- [ ] **Step 4:** `npm run test:compliance` → PASS
- [ ] **Step 5: Commit**

```bash
git add seed/matcha-to-water-ratio.json
git commit -m "feat(learn): matcha-to-water-ratio how-to page (1.6k, brew-guide embed)"
```

## Task 6: Author `green-tea-steeping-time` page (targets "green tea steeping time", 720, transactional)

**Files:**
- Create: `seed/green-tea-steeping-time.json`

**Interfaces:**
- Consumes: `steep-guide` widget (Task 2R); Appendix A (verified rows).
- Produces: KV slug `green-tea-steeping-time`.

- [ ] **Step 1: Write the seed** with:
  - `title`: `Green Tea Steeping Time & Temperature (Without the Bitterness)`
  - `h1`: `How long to steep green tea`
  - `meta_description`: `Japanese tea guidance steeps green tea about 1 minute at 165–185 °F (74–85 °C); Western guidance says 3–4. Times by type, plus a steep calculator.`
  - `keywords`: `["green tea steeping time","how long to steep green tea","green tea steep temperature","green tea brewing time","how to brew green tea"]`
  - `widget`: `"steep-guide"`; `product_bridge` + labels; `intent`: `"how-to"`, `cluster`: `"green-tea"`, `pillar`: `"blends"`
  - `related`: `["how-to-brew-green-tea","tea-brewing-temperature-guide","matcha-to-water-ratio","green-tea-caffeine"]`
  - `body_html` answer-first (verbatim): `Steep green tea at <strong>165–185 °F (74–85 °C)</strong>, using about 1 teaspoon (2 g) of leaf per 8 oz cup. Japanese tea guidance calls for a brief steep of about <strong>1 minute</strong>; general Western guidance suggests 3–4 minutes. Hotter water or a longer steep pulls out more bitterness.` H2s: the two conventions and why they differ (attribute BOTH — Tea Association of the USA / Ippodo for the short steep, Healthline for 3–4 min), time by green-tea type (sencha/gyokuro/genmaicha) `<table>`, temperature `<table>` (verified Appendix A, SSR fallback), multiple infusions, does longer steeping add caffeine (link `green-tea-caffeine`), disclaimer.
  - **Do NOT collapse the variance to one number.** Both conventions are real and sourced; presenting both with attribution is the deliberate differentiator versus competitors who publish a single unsourced figure. Every numeral must have a `sources[]` entry that actually states it.
  - `sources`: Tea Association of the USA brewing guidance (`https://www.teausa.org/`); Healthline how to brew green tea (`https://www.healthline.com/nutrition/how-to-brew-green-tea`).
  - `faqs`: how long to steep green tea; what temperature for green tea; can you over-steep green tea; how many times can you steep green tea; why is my green tea bitter. (5 Q&As.)

- [ ] **Step 2:** `npm run validate:seeds` → PASS
- [ ] **Step 3:** `npm run verify:citations` → exit 0
- [ ] **Step 4:** `npm run test:compliance` → PASS
- [ ] **Step 5: Commit**

```bash
git add seed/green-tea-steeping-time.json
git commit -m "feat(learn): green-tea-steeping-time how-to page (720, brew-guide embed)"
```

## Task 7: Wire the internal-link graph

**Files:**
- Modify: `seed/matcha-vs-green-tea.json`, `seed/what-is-matcha.json`, `seed/tea-brewing-temperature-guide.json`, `seed/l-theanine-and-caffeine-in-tea.json` (add new slugs to each `related` array)
- Generate: `src/data/related-links.json` (via `build:related`)

**Interfaces:**
- Consumes: the four new slugs from Tasks 3–6.
- Produces: a bidirectional hub-spoke link graph (each new page links out via its `related`; neighbor pages link back).

- [ ] **Step 1: Add back-links on neighbor seeds**

In each neighbor seed's `related` array, add the relevant new slug(s):
- `matcha-vs-green-tea` → add `matcha-caffeine`, `green-tea-caffeine`
- `what-is-matcha` → add `matcha-caffeine`, `matcha-to-water-ratio`
- `tea-brewing-temperature-guide` → add `green-tea-steeping-time`, `matcha-to-water-ratio`
- `l-theanine-and-caffeine-in-tea` → add `matcha-caffeine`, `green-tea-caffeine`

- [ ] **Step 2: Regenerate vector related-links top-ups**

Run: `CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run build:related`
Expected: `src/data/related-links.json` updated (new slugs appear as neighbours). If credentials are unavailable in this environment, skip and note it — manual `related` already provides the spine.

- [ ] **Step 3: Validate the link graph**

Run: `npm run validate:seeds && npm run check:links`
Expected: PASS; no broken internal `related`/`<a>` targets. (`check:links` resolves internal hrefs — every new slug must exist as a seed.)

- [ ] **Step 4: Commit**

```bash
git add seed/matcha-vs-green-tea.json seed/what-is-matcha.json seed/tea-brewing-temperature-guide.json seed/l-theanine-and-caffeine-in-tea.json src/data/related-links.json
git commit -m "feat(learn): hub-spoke internal links for caffeine/steep cluster"
```

## Task 8: Add `Dataset` JSON-LD for caffeine pages

**Files:**
- Modify: `src/template.js` (in `renderArticle`, near the FAQPage schema block ~line 330)
- Test: `test/template.test.ts` (create if absent)

**Interfaces:**
- Consumes: an optional seed field `dataset` (`{name, description, variableMeasured: [{name, value, unitText, ...}]}`).
- Produces: an extra `Dataset` node in the article's JSON-LD graph when `data.dataset` is present. No change when absent.

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from "bun:test";
import { renderArticle } from "../src/template.js";
const ENV = { SITE_NAME:"TMolecule", SHOP_ORIGIN:"https://tmolecule.com", LOGO_URL:"https://tmolecule.com/logo.png" };
test("renderArticle emits a Dataset node when seed.dataset present", () => {
  const seed = { title:"t", h1:"t", meta_description:"m", body_html:"<p>x</p>",
    dataset:{ name:"Matcha caffeine", description:"mg per serving",
      variableMeasured:[{ name:"Matcha 2g", value:"60-70", unitText:"mg" }] } };
  const html = renderArticle(seed, "matcha-caffeine", "https://tmolecule.com", ENV, "/learn");
  expect(html).toContain('"@type":"Dataset"');
  expect(html).toContain("Matcha caffeine");
});
test("no Dataset node when seed.dataset absent", () => {
  const seed = { title:"t", h1:"t", meta_description:"m", body_html:"<p>x</p>" };
  const html = renderArticle(seed, "s", "https://tmolecule.com", ENV, "/learn");
  expect(html).not.toContain('"@type":"Dataset"');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun test test/template.test.ts`
Expected: FAIL (Dataset not emitted).

- [ ] **Step 3: Implement minimal support in `renderArticle`**

In `src/template.js`, where the JSON-LD graph/scripts are assembled in `renderArticle`, add (guarded):

```js
const datasetLd = data.dataset ? {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: data.dataset.name,
  description: data.dataset.description,
  variableMeasured: (data.dataset.variableMeasured || []).map(v => ({
    '@type': 'PropertyValue', name: v.name, value: v.value, unitText: v.unitText
  }))
} : null;
```

Then render `datasetLd` as an extra `<script type="application/ld+json">` (follow the exact pattern the function already uses for the Article/FAQPage scripts — match its `JSON.stringify` + escaping).

- [ ] **Step 4: Run tests to confirm pass**

Run: `bun test test/template.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Add `dataset` to the two caffeine seeds**

Add a `dataset` field to `seed/matcha-caffeine.json` and `seed/green-tea-caffeine.json` capturing the Appendix A caffeine values (name/description/variableMeasured rows in mg). Re-run `npm run validate:seeds` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/template.js test/template.test.ts seed/matcha-caffeine.json seed/green-tea-caffeine.json
git commit -m "feat(schema): Dataset JSON-LD for caffeine pages"
```

## Task 9: Ship — seed, vectorize, deploy, verify live

**Files:** none created; runs the pipeline.

- [ ] **Step 0: Clean the working tree (MANDATORY — `npm run deploy` ships the WORKING TREE, not HEAD)**

The tree carries unrelated in-flight work (`src/template.js` +196 lines of "Ask Ayurveda" header modal + A/B test, `widgets/src/advisor/index.js`, `widgets/dist/advisor.js`). It is **half-built** — `src/widget-bundles.js` does not contain the new advisor bundle, so deploying now would ship the modal WITHOUT its matching widget. Per user decision (2026-07-28): **stash it, deploy clean, restore after.**

```bash
git stash push -m "advisor modal WIP (pre-deploy)" -- worker-seo/src/template.js worker-seo/widgets/src/advisor/index.js worker-seo/widgets/dist/advisor.js
git status --porcelain | grep -E 'template.js|advisor' || echo "tree clean of advisor WIP"
# ... run the deploy steps below ...
# afterwards:  git stash pop
```

- [ ] **Step 1: Full gate**

Run: `npm run validate:seeds && npm run verify:citations && npm run test:compliance && npm run check:links && bun test`
Expected: all exit 0; `check:links` 0 broken; `bun test` 207 pass. (The original step omitted `check:links` and `bun test` — including the new `template.test.ts`.)

- [ ] **Step 2: Seed KV (preview namespace first)**

Run: `npm run kv:seed-preview`
Then spot-check a preview render if a preview URL/`wrangler dev` is available; confirm the four pages render with answer-first text, the comparison table (JS off), the embedded widget mount, and the Spice Rush bridge button.

- [ ] **Step 3: Seed KV (production)**

> ⚠️ **SCOPE WARNING (found in final review).** `scripts/seed-kv.sh` loops over `seed/*.json` and overwrites **all 85 KV keys**, not just the ones changed here. It cannot delete keys, so the other pages are structurally safe — but any live-KV → repo drift gets silently clobbered in the repo's favour. **Before running, diff repo seeds against live KV** (`npm run kv:list`, spot-check a few unrelated keys) and confirm no live-only edits would be lost. This run touches far more than 4 pages: the green-tea caffeine correction propagated to 9 seeds, plus 3 reconciled legacy pages.

Run: `npm run kv:seed`
Expected: `verify:citations` re-runs (via the script) then the changed slugs upload to `LEARN_PAGES`.

- [ ] **Step 4: Rebuild the semantic index**

Run: `CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run build:vectors`
Expected: the four new pages embedded into `tm-learn-corpus` (so the RAG advisor + vector related-links see them).

- [ ] **Step 5: Deploy the worker**

Run: `npm run deploy`
Expected: new `BUILD_VERSION`; deploy succeeds.

- [ ] **Step 6: Live content-level verification (per website-build-baseline — content, not status)**

> ⚠️ **Corrected 2026-07-28.** The original version of this step was broken in two ways that would have made it "pass" while proving nothing: it grepped for `brew-guide` (two of the four pages embed `steep-guide`), and for `60.70 mg` when the matcha copy uses an en-dash `65–70 mg`. Both fixed below. Figures also updated for the corrected green-tea range (30–50 mg).

```bash
# Per-page: answer-first figure present in RAW HTML (proves SSR, not JS-only)
declare -A EXPECT=(
  [matcha-caffeine]='65–70 mg'
  [green-tea-caffeine]='30–50 mg'
  [matcha-to-water-ratio]='176 °F'
  [green-tea-steeping-time]='165–185 °F'
)
for s in "${!EXPECT[@]}"; do
  echo "== $s =="
  html=$(curl -s "https://tmolecule.com/learn/$s")
  echo "$html" | grep -c -- "${EXPECT[$s]}"                        # answer-first figure (expect >=1)
  echo "$html" | grep -c 'caffeine-comparator\|steep-guide'        # widget embed (expect >=1)
  echo "$html" | grep -c 'spice-rush-collagen-black-tea'           # product bridge (expect >=1)
  echo "$html" | grep -c 'application/ld+json'                     # schema blocks (expect >=3)
done
# Dataset JSON-LD should appear on the two caffeine pages ONLY
for s in matcha-caffeine green-tea-caffeine; do
  echo "$s Dataset: $(curl -s "https://tmolecule.com/learn/$s" | grep -c '"@type":"Dataset"')"   # expect 1
done
# Sitemap contains all four
curl -s "https://tmolecule.com/learn/sitemap.xml" | grep -c -E 'matcha-caffeine|green-tea-caffeine|matcha-to-water-ratio|green-tea-steeping-time'   # expect 4
```
Expected: every count ≥1 (schema ≥3), Dataset exactly 1 on each caffeine page, sitemap count 4. A zero anywhere means the page did not render as intended — investigate before declaring done.

- [ ] **Step 7: Validate structured data**

Manually paste each URL into Google Rich Results Test (or confirm the JSON-LD blocks: Article, FAQPage, BreadcrumbList, and Dataset on the two caffeine pages).

- [ ] **Step 8: Final commit (if any tracked artifacts changed)**

```bash
git add -p   # stage only plan-related changes
git commit -m "chore(learn): ship caffeine/steep tool-page cluster"
```

---

## Self-Review

**Spec coverage:** Two calculators reused (Tasks 1–2); thick head-term template pages with answer-first + comparison table + FAQ (Tasks 3–6, spec §5); SEO — unique title/meta, canonical (inherent), Dataset/FAQPage/Breadcrumb schema (Tasks 3–6, 8, spec §6); internal linking — hub-spoke + Spice Rush funnel + vector back-links, real anchors (Tasks 3–7, spec §7); compliance no-medical (every seed task, spec §8); progressive-enhancement SSR fallback (Global Constraints + Task 9 Step 6, spec §4); phasing/verification (Task 9, spec §9–10). WK port is explicitly a later separate plan (spec §12) — out of scope here. **No gaps.**

**Placeholder scan:** Numbers, titles, metas, FAQ Q&As, sources, and slugs are all concrete (Appendix A + per-task fields). Body prose is expanded from a fully-specified outline with verbatim answer-first openings and exact table data — not a "write appropriate content" placeholder.

**Type/name consistency:** Widget slugs (`caffeine-comparator`, `brew-guide`) and seed slugs (`matcha-caffeine`, `green-tea-caffeine`, `matcha-to-water-ratio`, `green-tea-steeping-time`) are used identically across Tasks 1–9. `dataset` seed field defined in Task 8 matches its `renderArticle` consumer. `product_bridge` path identical across Tasks 3–6.
