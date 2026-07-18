# TMolecule /learn — content-gap scope (2026-06-06)

Same exercise run on WhollyKaw, adapted to TM. TM has **no declared-but-empty axis** like WK's CONCERN/SKIN. Its structural gap is different and arguably worse: **two high-value page templates were built and then used exactly once.**

Intent coverage across 41 pages:
`benefits 11 · use-case 8 · definition 7 · comparison 5 · recipe 3 · question 3 · mechanism 1 · safety 1 · eu-status 1 · routine 1`

The `safety` and `eu-status` templates — the most AI-citation-friendly and most food/supplement-compliance-native formats TM has — are nearly empty (`is-collagen-tea-safe`, `is-cinnamon-banned-in-the-eu`). That's the hole. Volumes US, DataForSEO, 2026-06-06.

⚠️ **No-medical-claims (food/supplement variant) governs all of this.** "Is X safe during pregnancy" pages border on medical advice. They are defensible ONLY as: research-framed + population-aware + *every* row defers to a healthcare provider, never asserting "safe to drink." The existing population-aware `safety` template (statuses: "Ask a provider" / "Use caution") is the right vehicle — keep the consult-a-professional language mandatory and the general-info disclaimer top + bottom.

---

## BUILD 1 — Safety cluster (the real gap: template exists, demand is high, competition low)

All `safety` intent. Low KD, on-brand (every ingredient is already a TM page), and exactly the question LLMs get asked and cite.

| Page | Primary kw | Vol | KD | Notes |
|---|---|---|---|---|
| `is-ashwagandha-safe` | is ashwagandha safe | **12,100** | 43 | Biggest. Pair the general page with the pregnancy angle below. Trending up. |
| `is-green-tea-safe-during-pregnancy` | is green tea safe during pregnancy | **2,400** | 15 | TM has green-tea pages already — strong internal-link support. |
| `is-matcha-safe-during-pregnancy` | is matcha safe during pregnancy | **1,900** | low | Very weak SERP backlink profile (rank ~16) → winnable. TM sells matcha. |
| `is-turmeric-safe-during-pregnancy` | is turmeric safe during pregnancy | **1,300** | 18 | Links to existing `turmeric`. |
| `is-ginger-safe-during-pregnancy` | is ginger safe during pregnancy | **1,000** | 15 | Links to existing `ginger`. |
| `is-collagen-safe-during-pregnancy` | is collagen safe during pregnancy | **720** | low | **CPC $14.82** — highest commercial value on the list; collagen is TM's core SKU. |
| `is-ashwagandha-safe-during-pregnancy` | …during pregnancy | **720** | 12 | +83% YoY trend. |
| `is-cinnamon-safe-during-pregnancy` | is cinnamon safe during pregnancy | **590** | ~0 | Links to existing `cinnamon` + the EU page. |
| `is-rooibos-tea-safe-during-pregnancy` | is rooibos tea safe during pregnancy | **590** | **3** | Trivially easy; rescues the thin rooibos cluster (1 page). |

A single "is-this-tea-safe-in-pregnancy" hub linking all of the above would also help — pregnancy is a strong topical entity to own as a cluster.

## BUILD 2 — Missing high-volume listicle (format already proven)

| Page | Primary kw | Vol | KD | Notes |
|---|---|---|---|---|
| `best-tea-for-sleep` | best tea for sleep | **6,600** | **1** | **Easiest high-value win in the whole audit.** TM already has the best-of listicle format (best-collagen-tea, best-immunity-tea, etc.). No sleep page exists. Build it. |
| `best-tea-for-bloating` | best tea for bloating | 2,900 | — | Pairs with existing `best-tea-for-gut-health` (sibling, not dup — bloating is the symptom query). |

## BUILD 3 — Cheap cluster top-ups (low effort, fills thin clusters)

| Page | Primary kw | Vol | KD | Notes |
|---|---|---|---|---|
| `turmeric-tea-benefits` | turmeric tea benefits | 5,400 | 12 | Benefits intent; thin `functional-botanicals` cluster; links to `turmeric`. |
| `oolong-vs-green-tea` | oolong vs green tea | 1,600 | — | Comparison; rescues thin `oolong` cluster (2 pages). |
| `ashwagandha-tea-benefits` | ashwagandha tea benefits | 3,600 | 39 | Higher KD; build after the safety pages establish ashwagandha authority. |
| `how-much-green-tea-is-too-much` | …too much | 590 | 15 | Question intent; natural sibling to the green-tea safety page. |

---

## DO NOT over-invest — low demand (the "orphan it" set)

- **`eu-status` beyond cinnamon.** "is ashwagandha banned in the eu" / "green tea extract banned in eu" returned no meaningful volume. Ashwagandha *is* restricted in parts of the EU, but nobody's searching it. Keep the one cinnamon page; don't build a row of EU pages chasing zero demand. (This is TM's version of WK's "don't fill all 20.")
- **`rooibos vs green tea`** (140) — too thin; fold a comparison paragraph into the rooibos page instead of a standalone.
- **`is matcha safe`** (110) — fold into the matcha pregnancy page.

---

## Recommended order (≈11 pages, demand-ranked, compliance-gated)

1. `best-tea-for-sleep` — 6,600 vol, KD 1. Do first; no compliance risk, proven format.
2. `is-ashwagandha-safe` — 12,100 vol; anchors the safety cluster.
3. Pregnancy-safety set: green tea → matcha → turmeric → ginger → collagen → ashwagandha → cinnamon → rooibos (descending vol). Ship behind the consult-a-provider disclaimer pattern.
4. `turmeric-tea-benefits`, `best-tea-for-bloating`, `oolong-vs-green-tea` — cluster top-ups.

After shipping, **run `npm run build:related`** so new pages get vector-resolved internal links and the safety cluster cross-links (the pregnancy pages should interlink as a set).

## Why this differs from WK's scope
WK's gap was a *declared* axis with zero pages and the discipline was restraint (build 6 of 20). TM's gap is *capacity it already built and abandoned* — the `safety` template — sitting on low-competition, high-citation demand. Here the discipline is the opposite: **use the machine you already built**, behind the food/supplement compliance guardrails.
