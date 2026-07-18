# TMolecule STORM /learn pages — performance tracker

STORM (Stanford-OVAL) → compliance-gated transform → publish pipeline, ported from WhollyKaw.
Success metric = **LLM citations** (Perplexity / ChatGPT / Claude / Google AIO), not GSC clicks.
Baseline: TM was **0/8** cited on a live Perplexity sweep 2026-06-24 (see below).

| Page | Topic | Published | Pillar/Intent | Sources | First re-check | Cited? |
|------|-------|-----------|---------------|---------|----------------|--------|
| `l-theanine-and-caffeine-in-tea` | "l-theanine and caffeine in tea" (mechanism, calm-focus) | 2026-06-24 | ingredients / mechanism | 5 ScholarlyArticle (PMID 18641209, 18006208, 18681988; PMC9014247, PMC4787341) | ~2026-08-03 | TBD |
| `what-is-masala-chai` | "what is masala chai made of" (composition) | 2026-06-24 | blends / definition | 0 — compositional; this query is won by a clean structured answer, not citations (Perplexity winners were Wikipedia/recipe sites/a brand store, none research-cited) | ~2026-08-03 | TBD |
| `is-rooibos-caffeine-free` | "is rooibos caffeine free" (question) | 2026-06-24 | blends / question | 2 ScholarlyArticle (PMC10774856 rooibos review, PMC4787341 tea-caffeine contrast) | ~2026-08-03 | TBD |

Note: masala chai + rooibos built via STORM-**model** (research+draft directly, no Stanford rig) — chosen because both are compositional/definitional, not research-paper-dense. l-theanine used the full rig.

## Why this topic
2026-06-24 Perplexity sonar-pro sweep, TM cited in **0/8** queries. The winnable lane is
**definitional / mechanism** queries (competitor tea brands ARE cited there — ArtfulTea, Hugo,
Bigelow on "l-theanine in tea"; chaiguys.shop on "what is masala chai"). "best-X" and
health-efficacy queries are won off-site (roundups) / by medical authorities (Harvard, Mayo) —
do NOT build owned /learn pages for those.

## Batch-2 — BUILT & LIVE 2026-06-24
- `what is masala chai made of` → `what-is-masala-chai` (live)
- `is rooibos caffeine free` → `is-rooibos-caffeine-free` (live)

## Batch-3 candidates (not yet built)
- Mine the next round from a fresh definitional/mechanism sweep at the ~2026-08-03 re-check.

## Provenance
STORM raw output (polished article + url_to_info.json) saved alongside this file under
`storm-provenance/l-theanine-and-caffeine-in-tea/`.

## Re-check protocol (~2026-08-03)
Re-run the fixed Perplexity query set via `mcp__dataforseo__ai_optimization_llm_response`
(llm_type=perplexity, sonar-pro, web_search=true). Confirm Bing has indexed the page first
(Perplexity/ChatGPT lean on Bing); IndexNow already fired 2026-06-24.
