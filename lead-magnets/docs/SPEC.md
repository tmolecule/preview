# TMolecule Lead Magnets — Spec

**Goal:** Programmatic lead magnet system on Cloudflare Pages, anchored by a Collagen Bioavailability Calculator (Phase 1) and templated content pages (Phase 2+).

**Domain:** `wellness.tmolecule.com` (Cloudflare Pages). `learn.tmolecule.com` remains the Workers SEO site - the two are separate properties on the same root domain.

**Funnels:**
- Skin / energy / collagen → Spice Rush (`/products/spice-rush-collagen-black-tea`)
- Immunity / adaptogens / herbal → Immunitea (`/products/immunitea-defense-tea`)

---

## Phase 1 — Collagen Bioavailability Calculator

### Inputs
| Field | Type | Options |
|---|---|---|
| `collagen_type` | enum | `peptides`, `gelatin`, `undenatured_type_ii` |
| `daily_dose_g` | number | 5–30 |
| `time_of_day` | enum | `morning`, `afternoon`, `evening` |
| `current_beverage` | enum | `coffee`, `tea_black`, `tea_green`, `water`, `juice`, `none` |
| `vitamin_c_source` | bool | yes/no |
| `email` | string | gated input — required for full PDF |

### Calculation logic (deterministic)
Bioavailability score (0–100) starts at 50, modified by:

| Factor | Adjustment | Rationale |
|---|---|---|
| Vitamin C present | +20 | Required cofactor for collagen synthesis |
| Daily dose 10–20g | +10 | Studies (Proksch et al.) show 10g+ for skin endpoints |
| Daily dose <5g | −15 | Sub-clinical |
| Daily dose >25g | −5 | Diminishing returns |
| Coffee w/in 30 min | −10 | Tannins bind peptides |
| Black/green tea w/in 30 min | −5 | Mild tannin interference |
| Morning + empty stomach | +10 | Faster absorption |
| Evening (sleep window) | +5 | GH pulse synergy |
| Brewing temp >90°C (warned in tip) | 0 | Display tip only |

### Outputs
1. **Score** (0–100) with grade (A/B/C/D)
2. **Optimal pairing** — recommended tea + spice + brew temp + timing
3. **3 personalized tips** (text)
4. **CTA**: Spice Rush product link
5. **Email-gated**: 7-day printable PDF protocol (delivered via Brevo DOI link → R2 signed URL)

### UX flow
```
[Form] -> [/api/calculate POST] -> [Result card visible immediately]
                                 ->
                          [Email opt-in form (inline)]
                                 ->
                   [/api/subscribe POST -> Brevo list_id]
                                 ->
                   [DOI confirmation email w/ {{ doubleoptin }}]
                                 ->
                   [Confirmation page -> R2 PDF download]
```

### Dependencies
- Brevo API key (stored as `BREVO_API_KEY` Pages secret)
- Brevo list ID for "Collagen Calculator" segment
- Brevo DOI template ID (HTML mode, uses `{{ doubleoptin }}` per existing reference memory)
- R2 bucket `tmolecule-lead-magnets` with `collagen-protocol-v1.pdf`

---

## Phase 2 — Templated Goal Stacks (14 pages)

Routes: `/stack/[goal]/index.html`

Goals: `better-sleep`, `glowing-skin`, `sustained-energy`, `daily-immunity`, `joint-comfort`, `gut-balance`, `weight-support`, `stress-relief`, `hormone-balance`, `mental-focus`, `heart-health`, `blood-sugar-balance`, `hair-and-nails`, `gentle-detox`

Each page renders from `data/goals.json`:
- H1 + lede (brand voice — bridge structure)
- Morning blend recipe
- Evening blend recipe
- "Add this" — top 3 supportive spices/nutraceuticals
- "Avoid" — interfering substances/timings
- 7-day mini protocol table
- FAQ (3 questions)
- Email gate -> full 30-day protocol PDF
- Funnel CTA based on `goals.json` `funnel_product`

## Phase 3 — Ingredient Pair Guides (22 pages)

Routes: `/pair/[ingredient]/index.html`

Same template engine, different schema. Source: `data/ingredients.json`.

## Phase 4 — Find Your Ritual quiz

Single-page interactive (vanilla JS). Outputs from `data/ritual-matrix.json` (3 doshas x 14 goals x 3 caffeine tolerances = 126 unique rituals).

---

## Build conventions
- Match existing `worker-seo/src/template.js` design tokens (Fraunces serif, Inter sans, earth palette `--color-button: 122,90,43`)
- (R) mark on every logo (per `feedback_logos_registered_mark.md`)
- Brevo DOI uses `{{ doubleoptin }}` lowercase merge tag (per `reference_brevo_doi_merge_tag.md`)
- One Brevo list per Phase 1 magnet, segmented by goal in Phase 2+
- All form data validated server-side
- No console.log, no hardcoded secrets

## Deployment
- Cloudflare Pages project `tmolecule-lead-magnets`
- Custom domain `wellness.tmolecule.com`
- Same Cloudflare account ID as worker-seo: `6766841fb403fe06a6e2c1f2ea3b5ea0`
