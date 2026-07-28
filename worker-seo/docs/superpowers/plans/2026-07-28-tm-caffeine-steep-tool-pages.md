# TM Caffeine + Steep Tool Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Win the high-volume, low-competition tea caffeine/steep queries (`how much caffeine in matcha` 18.1k, `green tea caffeine` 9.9k, `matcha to water ratio` 1.6k, `green tea steeping time` 720) by shipping four thick, schema-rich, interactive head-term pages on TM's existing `/learn` worker.

**Architecture:** The `worker-seo` engine already renders `/learn/<slug>` articles from KV `LEARN_PAGES` seeds via `renderArticle()` (emits Article + FAQPage + BreadcrumbList schema, product bridge, related links, and can embed a tool widget via a seed `"widget"` field). Both calculators (`caffeine-comparator`, `brew-guide`) already exist as built Vite widgets and are served + routed. So this is **author + reconcile + optimize**, not build: enrich the two widgets' data to match one canonical dataset, author four head-term seed articles that embed those widgets and carry a static comparison table (SSR fallback), wire the internal-link graph, add Dataset JSON-LD, then seed → vectorize → deploy → verify live.

**Tech Stack:** Cloudflare Worker (`src/*.js`), KV (`LEARN_PAGES`), Vite widgets (`widgets/src/*`, IIFE bundles in `widgets/dist`), Vectorize (`tm-learn-corpus`), `bun test`, seed gates (`validate:seeds`, `verify:citations`, `check:links`, `test:compliance`).

## Global Constraints

- **No-medical (mandatory):** describe published *research* / structure-function, never outcome or disease claims. L-theanine/"calm-alert" framed as research only. Add the food/dietary-supplement disclaimer line. Every seed must pass `npm run test:compliance`. Copy rules from `~/.claude/rules/common/no-medical-claims.md`.
- **No invented facts:** every numeric claim traces to a `sources[]` entry; citations pass `npm run verify:citations` (PubMed/PMC PMIDs must resolve + title-match; non-NCBI sources pass as UNVERIFIED warnings; never cite Wikipedia).
- **One canonical dataset (Appendix A):** the widget model data AND every article's comparison table use the SAME numbers. Contradictory numbers across surfaces are the exact competitor flaw we exploit — do not reintroduce it.
- **Answer-first:** the first 40–60 words of each `body_html` state the headline number with its cited range (featured-snippet / AI-Overview target).
- **SSR fallback:** each `body_html` contains the full static comparison table. The embedded widget is additive; the page must be complete and correct with JS disabled.
- **Unique `title` + `meta_description`** per seed (never reuse). One `h1`.
- **Commerce target:** `product_bridge: "/products/spice-rush-collagen-black-tea"` on all four pages (Spice Rush Collagen Black Tea — a caffeinated black-tea blend). Never a bare `/collections/all`.
- **Seed required fields:** `title`, `h1`, `meta_description`, `body_html`. `sources[].url` must match `^https?://`. `faqs[]` items need `q` and `a`.
- **Commits:** `git add` only the specific files a task creates/edits. The branch working tree has ~39 unrelated untracked sync files — never `git add -A`.

---

## Appendix A — Canonical reference data (single source of truth)

**Caffeine (per standard serving).** Sources: Healthline "Does Matcha Have Caffeine?" (19–44 mg/g matcha), USDA FoodData Central, Mayo Clinic caffeine chart.

| Drink | Serving | Caffeine (typical) | Range |
|---|---|---|---|
| Matcha | 1 tsp (2 g) whisked in 2–3 oz | **60–70 mg** | 38–88 mg (grade/serving) |
| Matcha latte | 2 tsp (4 g) | 90–140 mg | — |
| Green tea (steeped) | 8 oz | 28 mg | 25–45 mg |
| Black tea (steeped) | 8 oz | 47 mg | 40–70 mg |
| Espresso | 1 oz shot | 63 mg | — |
| Brewed coffee | 8 oz | 95–120 mg | — |

**Steep / ratio.** Sources: Tea Association of the USA brewing guidance; Japanese-tea authority brewing specs (Ippodo/Ureshino); Healthline brewing guides.

| Tea | Water temp | Time | Leaf : water |
|---|---|---|---|
| Green (sencha) | 160–180 °F (70–82 °C) | 1–3 min | 1 tsp (2 g) / 8 oz |
| Matcha (usucha, thin) | ~175 °F (80 °C) | whisk 15 s | 2 g (1 tsp) / 2 oz (60 ml) |
| Matcha (koicha, thick) | ~175 °F | whisk 30 s | 4 g / 1 oz (30 ml) |
| Black | 200–212 °F (93–100 °C) | 3–5 min | 1 tsp / 8 oz |
| Oolong | 185–205 °F | 3–5 min | 1 tsp / 8 oz |
| White | 175–185 °F | 2–5 min | 1 tsp / 8 oz |

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
- `meta_description`: unique, ≤155 chars, e.g. `A standard 1 tsp (2 g) serving of matcha has about 60–70 mg of caffeine. See matcha vs coffee, green tea, and latte amounts — with a calculator.`
- `keywords`: `["how much caffeine in matcha","matcha caffeine","matcha vs coffee caffeine","matcha latte caffeine","caffeine in matcha per gram","is matcha high in caffeine"]`
- `widget`: `"caffeine-comparator"`
- `product_bridge`: `"/products/spice-rush-collagen-black-tea"`, `product_bridge_label`: `"Shop Spice Rush Black Tea"`, `product_bridge_blurb`: `"Want steady tea energy without a matcha whisk? Spice Rush is a caffeinated black-tea blend."`
- `pillar`: `"blends"`, `cluster`: `"matcha"`, `intent`: `"informational"`
- `related`: `["matcha-vs-green-tea","what-is-matcha","green-tea-caffeine","l-theanine-and-caffeine-in-tea"]`
- `body_html` (answer-first, ~1,100–1,300 words). Required structure:
  1. **Answer-first paragraph** (verbatim opening): `A standard serving of matcha — 1 teaspoon (about 2 grams) whisked into 2–3 oz of water — contains roughly <strong>60–70 mg of caffeine</strong>. Depending on grade and how much powder you use, a serving ranges from about 38 mg to 88 mg. That's more than a cup of steeped green tea (~28 mg) but less than an 8 oz coffee (~95–120 mg).`
  2. `<h2>Matcha caffeine by serving size</h2>` — a `<table>` with rows: 1/2 tsp (~1 g) 30–40 mg; 1 tsp (2 g) 60–70 mg; strong latte (2 tsp / 4 g) 90–140 mg. (From Appendix A.)
  3. `<h2>Matcha vs coffee, green tea, and espresso</h2>` — the full Appendix A caffeine comparison `<table>` (matcha, matcha latte, green tea, black tea, espresso, coffee). **This is the SSR fallback for the widget.**
  4. `<h2>Why matcha's caffeine feels different</h2>` — L-theanine research framing (cite Kelly 2008), no outcome claims.
  5. `<h2>How to control your matcha caffeine</h2>` — usucha vs koicha, grade, serving (ties to `matcha-to-water-ratio`, link it).
  6. `<h2>Is matcha too much caffeine?</h2>` — reference the FDA general 400 mg/day adult figure as published guidance (cite), structure-function only.
  7. Closing links to `what-is-matcha`, `matcha-vs-green-tea`.
  8. Disclaimer line: `This describes published research and general information, not medical or dietary advice.`
- `sources`: at least — Healthline `https://www.healthline.com/nutrition/does-matcha-have-caffeine`; USDA FoodData Central `https://fdc.nal.usda.gov/`; Kelly 2008 `https://pubmed.ncbi.nlm.nih.gov/18641209/`.
- `faqs` (verbatim, from live PAA/related searches):
  - `{"q":"Is matcha higher in caffeine than coffee?","a":"No. A 1 tsp (2 g) serving of matcha has about 60–70 mg of caffeine; an 8 oz coffee has about 95–120 mg. Matcha has more than steeped green tea but less than brewed coffee."}`
  - `{"q":"How much caffeine is in a matcha latte?","a":"Most cafés use 1.5–2 tsp (3–4 g) of matcha, so a latte typically has about 90–140 mg of caffeine, similar to a small coffee."}`
  - `{"q":"Is 2 tsp of matcha a lot of caffeine?","a":"Two teaspoons (~4 g) is about 90–140 mg — roughly one strong cup of coffee. Published guidance puts a general adult ceiling around 400 mg/day."}`
  - `{"q":"How much caffeine is in matcha per gram?","a":"Published measurements put matcha at roughly 19–44 mg of caffeine per gram, so a 2 g serving lands around 38–88 mg, typically 60–70 mg."}`
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
  - `meta_description`: `An 8 oz cup of steeped green tea has about 25–45 mg of caffeine (typically ~28 mg) — less than black tea, matcha, or coffee. Full comparison inside.`
  - `keywords`: `["how much caffeine in green tea","green tea caffeine","green tea vs coffee caffeine","green tea caffeine vs black tea","does green tea have caffeine"]`
  - `widget`: `"caffeine-comparator"`; `product_bridge` + labels as global constraint.
  - `pillar`: `"blends"`, `cluster`: `"green-tea"`, `intent`: `"informational"`
  - `related`: `["matcha-caffeine","green-tea-vs-black-tea","matcha-vs-green-tea","l-theanine-and-caffeine-in-tea"]`
  - `body_html` answer-first opening (verbatim): `An 8 oz cup of steeped green tea contains about <strong>25–45 mg of caffeine</strong> — typically around 28 mg. That's roughly a third of a cup of coffee (~95–120 mg) and about half a cup of black tea (~47 mg).` Then H2s: by-factors (steep time/temp raises caffeine — link `green-tea-steeping-time`), full Appendix A comparison table (SSR fallback), decaf/low-caffeine options, L-theanine research note, disclaimer.
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
- Consumes: `brew-guide` widget (Task 2); Appendix A steep table.
- Produces: KV slug `matcha-to-water-ratio`.

- [ ] **Step 1: Write the seed** with:
  - `title`: `Matcha to Water Ratio: How Much Water for Perfect Matcha`
  - `h1`: `The right matcha-to-water ratio`
  - `meta_description`: `Use 1 tsp (2 g) matcha to 2 oz (60 ml) water for thin (usucha), or 4 g to 1 oz for thick (koicha). Latte and troubleshooting ratios inside.`
  - `keywords`: `["matcha to water ratio","how much water for matcha","matcha ratio","matcha powder to water","matcha latte ratio"]`
  - `widget`: `"brew-guide"`; `product_bridge` + labels; `intent`: `"how-to"`, `cluster`: `"matcha"`, `pillar`: `"blends"`
  - `related`: `["what-is-matcha","matcha-caffeine","green-tea-steeping-time","tea-brewing-temperature-guide"]`
  - `body_html` answer-first (verbatim): `For a standard bowl of thin matcha (usucha), use <strong>1 teaspoon (2 g) of matcha to about 2 oz (60 ml) of water at ~175 °F</strong>. For thick matcha (koicha), use 4 g to about 1 oz (30 ml). For a latte, whisk 2 g into 2 oz water, then add 6 oz of milk.` H2s: usucha vs koicha vs latte `<table>` (SSR fallback from Appendix A), water temperature (link `tea-brewing-temperature-guide`), grams-vs-teaspoons conversion, troubleshooting (clumpy/bitter/weak), disclaimer.
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
- Consumes: `brew-guide` widget; Appendix A.
- Produces: KV slug `green-tea-steeping-time`.

- [ ] **Step 1: Write the seed** with:
  - `title`: `Green Tea Steeping Time & Temperature (Without the Bitterness)`
  - `h1`: `How long to steep green tea`
  - `meta_description`: `Steep green tea 1–3 minutes at 160–180 °F (70–82 °C). Longer or hotter turns it bitter. Times by green-tea type, plus a brew calculator.`
  - `keywords`: `["green tea steeping time","how long to steep green tea","green tea steep temperature","green tea brewing time","how to brew green tea"]`
  - `widget`: `"brew-guide"`; `product_bridge` + labels; `intent`: `"how-to"`, `cluster`: `"green-tea"`, `pillar`: `"blends"`
  - `related`: `["how-to-brew-green-tea","tea-brewing-temperature-guide","matcha-to-water-ratio","green-tea-caffeine"]`
  - `body_html` answer-first (verbatim): `Steep green tea for <strong>1 to 3 minutes at 160–180 °F (70–82 °C)</strong>, using about 1 teaspoon (2 g) of leaf per 8 oz cup. Water hotter than ~185 °F or steeping past 3 minutes pulls out bitter tannins.` H2s: time by green-tea type (sencha/gyokuro/genmaicha) `<table>`, temperature `<table>` (Appendix A, SSR fallback), multiple infusions, does longer steeping add caffeine (link `green-tea-caffeine`), disclaimer.
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

- [ ] **Step 1: Full gate**

Run: `npm run validate:seeds && npm run verify:citations && npm run test:compliance`
Expected: all exit 0.

- [ ] **Step 2: Seed KV (preview namespace first)**

Run: `npm run kv:seed-preview`
Then spot-check a preview render if a preview URL/`wrangler dev` is available; confirm the four pages render with answer-first text, the comparison table (JS off), the embedded widget mount, and the Spice Rush bridge button.

- [ ] **Step 3: Seed KV (production)**

Run: `npm run kv:seed`
Expected: `verify:citations` re-runs (via the script) then the four slugs upload to `LEARN_PAGES`.

- [ ] **Step 4: Rebuild the semantic index**

Run: `CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run build:vectors`
Expected: the four new pages embedded into `tm-learn-corpus` (so the RAG advisor + vector related-links see them).

- [ ] **Step 5: Deploy the worker**

Run: `npm run deploy`
Expected: new `BUILD_VERSION`; deploy succeeds.

- [ ] **Step 6: Live content-level verification (per website-build-baseline — content, not status)**

```bash
for s in matcha-caffeine green-tea-caffeine matcha-to-water-ratio green-tea-steeping-time; do
  echo "== $s =="
  curl -s "https://tmolecule.com/learn/$s" | grep -oE '(60.70 mg|25.45 mg|2 oz|160.180)' | head -1
  curl -s "https://tmolecule.com/learn/$s" | grep -c 'caffeine-comparator\|brew-guide'   # widget embed present
  curl -s "https://tmolecule.com/learn/$s" | grep -c 'spice-rush-collagen-black-tea'      # product bridge present
done
curl -s "https://tmolecule.com/learn/sitemap.xml" | grep -c -E 'matcha-caffeine|green-tea-caffeine|matcha-to-water-ratio|green-tea-steeping-time'
```
Expected: each page returns its answer-first number in raw HTML (proves SSR, not JS-only), the widget script reference, the Spice Rush bridge, and all four appear in the sitemap.

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
