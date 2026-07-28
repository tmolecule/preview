# TMolecule Interactive Tool Pages + Reusable Tool-Page Template — Design

**Date:** 2026-07-26
**Repo:** `~/tmolecule/worker-seo`
**Status:** Approved design (pre-plan)
**Author:** Claude + user

---

## 1. Goal

Copy the part of `generateprompt.ai` that demonstrably works — a **free interactive tool as the ranking landing page** wrapped in a **thick, rigidly-structured, single-head-term content template** — and apply it to TMolecule, on infrastructure that *beats* generateprompt on the four technical things they skip (server-rendered content, JSON-LD schema, real internal links, unique meta).

Ship **two interactive calculators** and their supporting content clusters:

1. **Caffeine Calculator** — tea/matcha type + serving → caffeine mg.
2. **Steep / Brew Calculator** — tea type → water temp, steep time, leaf:water ratio.

Build them as a **reusable "tool-page" template variant** in the existing `worker-seo` render path so the pattern can be ported to WhollyKaw afterward.

## 2. Evidence (why these two, why now)

Validated US search demand, all **LOW** competition:

| Cluster | Lead keyword | Volume/mo | Signal |
|---|---|---|---|
| Caffeine | how much caffeine in matcha | 18,100 | avg ranking domain ~31 backlinks, rank 26 → wide open |
| Caffeine | how much caffeine in green tea | 9,900 | KD 23 |
| Steep | matcha to water ratio | 1,600 | no backlink moat |
| Steep | green tea steeping time | 720 | KD 6, **transactional** intent |
| Steep | tea to water ratio / temperature | 320 / 170 | — |

**Competitor teardown (`how much caffeine in matcha`, #1 organic = Chamberlain Coffee, also top AI-Overview citation):** 856 words, **no comparison table, no JSON-LD, no interactive tool**, numbers conflict wildly across the whole page-1 field (48 / 60-70 / 32-per-g / 76-176 / 19-44-per-g mg). Position 1 is an **AI Overview** citing 5 sources.

**Implication:** TM's `/learn` success metric is *AI/LLM citations*. A data-dense, cited, schema-marked, server-rendered page with an interactive calculator out-structures every current winner and is far more AIO-citable. This is a genuine generateprompt-shaped opening.

WhollyKaw's equivalent tool queries top out at ~320/mo — too thin to justify bespoke calculators. **WK reuses only the thick-content template half, later (§12).**

## 3. Non-goals / YAGNI

- **No D1 / new CMS.** Content stays in the existing KV `LEARN_PAGES` seed pipeline. Calculator reference numbers live as static, version-controlled JSON.
- **No new `/tools/*` route.** Tool pages live under `/learn/` — `sitemap.js` already declares a `tools` mount and the slugs `caffeine-comparator` and `brew-guide`.
- **No admin UI** (generateprompt's `/rai/*`). The existing seed + compliance + deploy scripts are the pipeline.
- **Date-Syrup Substitution calculator: deferred** (1k/mo; revisit after the pair proves out).
- **"matcha + pregnancy" sibling: deferred** on compliance grounds.

## 4. Architecture — extend `worker-seo`

TM's `worker-seo` already provides: SSR `/learn/*` render (`index.js`, `learn.js`, `template.js`), KV content store (`LEARN_PAGES`), a Vite widget pipeline (`widgets/` → `scripts/bundle-widgets.mjs` → `src/widget-bundles.js`), Workers AI + Vectorize (`tm-learn-corpus`), a rate-limiter Durable Object, the no-medical compliance gate (`scripts/compliance.mjs`), `renderRelated()` + vector internal-link pass (`scripts/build-related-links.mjs`), and `sitemap.js`.

New pieces:

1. **Two Vite widgets** in `widgets/src/`: `CaffeineCalculator`, `SteepCalculator`. Bundled by the existing bundler, served by `widget-bundles.js`.
2. **Progressive enhancement (hard requirement).** The worker SSRs a **static default answer + full comparison table** in HTML; the widget hydrates for interactivity. The page must be complete, correct, crawlable, and AI-citable **with JavaScript disabled**. No layout shift on hydrate (reserve the widget's box via `aspect-ratio`/min-height).
3. **Static reference data** — `src/data/tea-caffeine.json`, `src/data/tea-steep.json`. Each numeric value carries a `source` citation and a range (low/typical/high). Single source of truth for both the SSR table and the widget.
4. **Tool-page template variant** in `template.js` — the §5 section skeleton + §6 schema. Selected by a page field (e.g. `type: "tool"`, `widget: "caffeine"`).
5. **Content** authored as KV seeds via the existing seed pipeline, passed through `compliance.mjs`, then vectorized into `tm-learn-corpus` (so the RAG advisor also learns them).

## 5. On-page template (per tool page, ~1,000-1,300 words)

Fixed block order, single head-term per page:

1. **H1** — head term front-loaded (e.g. "How Much Caffeine Is in Matcha?").
2. **Answer-first paragraph** — direct answer in the first 40-60 words (featured-snippet / AIO target), with the cited range.
3. **Interactive calculator** (widget island; SSR static fallback = default table).
4. **Comparison table** (matcha vs coffee vs green tea vs espresso; or steep params by tea type) — AIO loves tables.
5. "What is …" definition (entity coverage).
6. "How it's measured / how to brew" (numbered `HowTo`).
7. Use-case / by-type grid (per-gram, 1 tsp, latte, etc.).
8. Sibling cross-links (contextual, in-body).
9. Product CTA → relevant TM PDP.
10. **FAQ** (10-14 Q&As, worded verbatim from PAA + related searches).
11. Research/compliance note + disclaimer.

## 6. SEO optimization (explicit)

**On-page**
- Unique, front-loaded **`<title>`** and **unique `<meta name=description>`** per page (avoid generateprompt's sitewide-duplicate-description mistake).
- Exactly one `H1`; keyword-variant `H2`/`H3` tree; sequential heading levels.
- Entity coverage from SERP: matcha, ceremonial/culinary grade, L-theanine, catechins, serving size, gram, tsp, mg, oz, latte.
- Self-referential `<link rel=canonical>`; `updated_at` bump only on meaningful change (per TM `/learn` convention).
- Image `alt`; `loading=lazy` below fold; explicit dimensions (no CLS).

**AEO / AIO (the primary metric)**
- Self-contained sections (each answers one question standalone — extractable).
- Cited numeric ranges (not single hand-waved numbers) → higher trust + citability.
- `Dataset` schema exposing the cited caffeine/steep values.

**Technical**
- Server-rendered content in initial HTML (no SPA shell).
- Core Web Vitals: lazy-hydrate the widget, reserve its box, keep bundle small.
- Added to `sitemap.js` (reuse existing `tools` entries; set `changefreq`/`priority`, real `lastmod`).
- `hreflang` only if/when a locale variant ships (not now).

## 7. Internal-linking architecture (explicit)

Reuse the existing machinery; author the link graph deliberately. **All links are real `<a href>` (server-rendered)** — the explicit anti-generateprompt requirement.

- **Hub-and-spoke.** Two hubs: `caffeine-comparator` (Caffeine Calculator overview) and `brew-guide` (Steep Calculator overview). Each hub links to **all** its spokes; each spoke links back to its hub + 2-3 sibling spokes contextually in-body.
- **Highest-volume head term is the strongest page.** The lead spoke `matcha-caffeine` (targets "how much caffeine in matcha", 18.1k) embeds the same widget as the hub — like generateprompt's model pages embedding one tool.
- **Cross-cluster** links where relevant (e.g. `matcha-caffeine` ↔ the matcha steep/ratio page).
- **Commerce funnel.** Every tool page links to the **Spice Rush Collagen Black Tea** PDP (`https://tmolecule.com/products/spice-rush-collagen-black-tea`) with descriptive, context-relevant anchors (it is a caffeinated black-tea blend, so it fits both the caffeine and steep clusters). This is the single commerce target for the initial build.
- **Corpus back-links.** Existing `/learn` articles link **into** the new pages: author `related` slug lists on neighbours + run `scripts/build-related-links.mjs` (Vectorize gap-filler → `src/data/related-links.json`) so semantic neighbours top up automatically. Manual `related` stays authoritative; the vector pass only adds.
- **Breadcrumbs.** Visible breadcrumb (Home › Learn › Tools › X) + `BreadcrumbList` JSON-LD.

Proposed slugs (reconciled to existing `sitemap.js` entries):

| Type | Slug | Targets |
|---|---|---|
| Hub | `caffeine-comparator` | caffeine calculator + cluster index |
| Spoke (lead) | `matcha-caffeine` | how much caffeine in matcha (18.1k) |
| Spoke | `green-tea-caffeine` | how much caffeine in green tea (9.9k) |
| Spoke | `matcha-vs-coffee-caffeine` | matcha vs coffee |
| Spoke | `matcha-latte-caffeine` | matcha latte caffeine |
| Hub | `brew-guide` | steep calculator + cluster index |
| Spoke (lead) | `matcha-to-water-ratio` | matcha to water ratio (1.6k) |
| Spoke | `green-tea-steeping-time` | green tea steeping time (720) |
| Spoke | `tea-water-ratio` | tea to water ratio / temperature |

(Exact spoke set finalized in the plan; lead pages first.)

## 8. Compliance (no-medical, mandatory)

- L-theanine / "energy" / "focus" framed as **research / structure-function only** ("matcha contains L-theanine; published studies describe…"), never outcome claims.
- Food/dietary-supplement disclaimer banner (top + short bottom reminder) per the no-medical rule.
- Every page passes `scripts/compliance.mjs` before seed. Caffeine *content*, brewing *parameters*, and culinary framing are factual/structure-function and safe.

## 9. Phasing

0. Cited reference-data tables (`tea-caffeine.json`, `tea-steep.json`) — factual backbone.
1. Two Vite widgets + SSR static fallback, wired into the worker.
2. Tool-page template variant + JSON-LD (`FAQPage`, `Dataset`, `HowTo`, `WebApplication`, `BreadcrumbList`) in `template.js`.
3. Author + compliance-gate + seed the **caffeine lead page (`matcha-caffeine`) first**, then its cluster + hub.
4. Steep cluster + hub.
5. Internal links (author `related`, run vector pass), sitemap, vectorize, deploy, **content-level live verification** (`curl` + grep per website-build-baseline).
6. *(Separate later plan)* port the tool-page template to WhollyKaw.

## 10. Testing & acceptance

- Unit tests: calculator math (`mg = grams × per-gram-range`), steep lookups by tea type.
- Compliance gate passes on every seeded page.
- Schema validates (Rich Results / schema.org).
- **SSR fallback renders complete, correct content with JS disabled.**
- No CLS on widget hydrate.
- Post-deploy: content-level `curl` fetch of each live URL confirms body content (not just 200) — hosts can 200 an SPA/404 fallback.
- Internal links resolve (run `scripts/check-links.mjs`).

## 11. Open decisions (carried to plan)

- Final spoke set per cluster (start with lead pages, expand by demand).
- ~~Exact PDP target for the commerce CTA~~ **Resolved:** Spice Rush Collagen Black Tea (`/products/spice-rush-collagen-black-tea`) is the sole commerce target for the initial build.

## 12. Reusable-engine → WhollyKaw port (later, separate plan)

The tool-page template variant + widget-island + static-data + server-schema pattern is brand-generic. WK's `worker-seo` is a near-identical mirror. WK reuses the **thick-content template half** (its tool-query demand is too thin for its own calculators); the port is template + schema + internal-linking conventions, not new tools.
