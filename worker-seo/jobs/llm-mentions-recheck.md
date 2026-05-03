# LLM mentions re-check (TMolecule)

**Due:** 2026-05-16 (≈2 weeks after AI-SEO improvements deployed 2026-05-02)
**Owner:** PGP Iyer
**Cadence:** Run on the 16th of each month, alongside any rank-tracking snapshot.

## Why this job exists

On 2026-05-02 a batch of AI-SEO changes deployed to learn.tmolecule.com:

- Article schema author switched from Organization → Person ("PGP Iyer")
- Article.image fallback to logo
- Article.citation[] populated on 6 of 10 articles (matcha-for-weight-loss, what-is-matcha, oolong-tea-benefits, rooibos-tea-benefits, green-tea-vs-black-tea, matcha-vs-green-tea)
- FAQPage.speakable selectors for voice search
- robots.txt now emits IETF Content-Signal `ai-train=no, search=yes, ai-input=yes` and explicit Allow for 11 AI bots
- /llms.txt with per-article TL;DR
- Tradition + Science (`<aside class="trad-sci">`) callout pattern, demoed on what-is-matcha (Eisai's Kissa Yōjōki + Kelly et al. 2008 alpha-band EEG study)

This job measures whether those structural changes moved AI-citation visibility for tmolecule.com.

## Baseline (2026-05-02, from project_tmolecule_llm_mentions_baseline.md)

| Platform | Mentions | AI Search Volume | Impressions |
|---|---|---|---|
| Google AI Overviews | 2 | 280 | 560 |
| ChatGPT | 1 | 19 | 19 |
| **Total** | **3** | **299** | **897** |

**Top co-citing sources (when tmolecule.com appears):** tmolecule.com (self), instagram.com, eatthismuch.com, menus.princeton.edu, nutritionguide.specialolympics.ca, workwell.usc.edu, summeryule.com, athidhi.de, maxprotein.in, verka.coop, facebook.com.

**Pattern:** Brand currently cited via nutrition / calorie databases, not via tea-knowledge sites. The Learn site deploy targets the tea-knowledge gap.

**Category keywords (matcha, masala chai, chai concentrate, oolong tea, rooibos tea):** ALL returned empty in the 2026-05-02 baseline. Zero LLM citations for tmolecule.com on category queries. This is the entire opportunity.

**Competitor benchmark — vahdamteas.com:** also returned empty. Swap to a different competitor for the next snapshot.

## Queries (run all three via DataForSEO AI Optimization API)

Tool: `mcp__dataforseo__ai_opt_llm_ment_agg_metrics`. Location: United States. Language: en. Run as **separate** requests.

### 1. Brand domain — tmolecule.com

```json
{ "target": [{ "domain": "tmolecule.com" }], "location_name": "United States", "language_code": "en" }
```

### 2. Category keywords (word_match)

```json
{ "target": [
  { "keyword": "matcha", "match_type": "word_match" },
  { "keyword": "masala chai", "match_type": "word_match" },
  { "keyword": "chai concentrate", "match_type": "word_match" },
  { "keyword": "oolong tea", "match_type": "word_match" },
  { "keyword": "rooibos tea", "match_type": "word_match" }
], "location_name": "United States", "language_code": "en" }
```

### 3. Competitor benchmark — try a more visible brand

Vahdam Teas returned empty in the baseline. For this run, try one of:
- `meileaf.com` (UK educational tea brand)
- `harney.com` (Harney & Sons)
- `adagio.com` (Adagio Teas)
- `ippodotea.com` (matcha-specific)

```json
{ "target": [{ "domain": "meileaf.com" }], "location_name": "United States", "language_code": "en" }
```

If that one is also empty, fall through to the next candidate. Note which competitor produced the most useful benchmark and update the spec for the next monthly run.

## Known API behaviors (don't waste cycles on these)

- Mixing `{domain}` and `{keyword}` targets in a single request intersects them — returns empty unless the domain is actually cited for those keywords. Run as separate requests.
- `partial_match` returns fewer results than `word_match` for broad terms.
- `ai_opt_llm_ment_search` requires items to already have citations; use `agg_metrics` first to confirm data exists.

## Report format

Write findings to:
`~/.claude/projects/-Users-voicecalls-tmolecule/memory/project_tmolecule_llm_mentions_2026-05-16.md`

Use this exact structure (the email script depends on the section headings):

```markdown
# TMolecule LLM mentions re-check — 2026-05-16

## Headline numbers
| Platform | 2026-05-02 (baseline) | 2026-05-16 (now) | Δ |
|---|---|---|---|
| Google AI Overviews | 2 mentions | ... | ... |
| ChatGPT | 1 mention | ... | ... |

## What moved
Narrative summary: which queries gained citations, what changed in the co-citing source mix, what the data suggests about the 2026-05-02 deploy.

## Co-citing sources delta
- New sources citing tmolecule.com (not present in baseline)
- Sources from baseline that disappeared
- Has the source mix shifted from nutrition databases toward tea-knowledge sites?

## Category keyword status
Per-query: did matcha / masala chai / chai concentrate / oolong tea / rooibos tea move from empty to populated? Which queries did the deploy unlock?

## Competitor benchmark
Whichever competitor target the spec used. Numbers + commentary on whether they're a useful long-term benchmark.

## Action Items
- [ ] Specific, dated, owner-tagged actions based on what the data shows
- [ ] Each action should be concrete

## Raw data
Full JSON dump of each agg_metrics response, fenced as ```json blocks.
```

Then update `~/.claude/projects/-Users-voicecalls-tmolecule/memory/MEMORY.md` with a one-line pointer to the new report file.

## Send the report by email

After the markdown report is written, send it via Resend using the helper at `<this-repo>/jobs/send-report-email.py`:

```bash
python3 <REPO>/jobs/send-report-email.py \
  ~/.claude/projects/-Users-voicecalls-tmolecule/memory/project_tmolecule_llm_mentions_2026-05-16.md \
  "TMolecule LLM mentions re-check — 2026-05-16" \
  "This is the post-deploy LLM mentions check for tmolecule.com. On 2026-05-02 a batch of AI-SEO improvements deployed to learn.tmolecule.com (Person author 'PGP Iyer', peer-reviewed citations on 6 of 10 articles, IETF Content-Signal opt-in, speakable FAQ markup, /llms.txt with per-article TL;DR, and the Tradition+Science callout pattern demoed on what-is-matcha). This report compares today's snapshot against the 2026-05-02 baseline (Google AIO: 2 mentions, ChatGPT: 1 mention) and flags movement, new co-citing sources, category-keyword unlocks, and competitor changes. Action items are highlighted in yellow."
```

The script:
- Converts markdown to HTML
- Highlights any "Action Items" section in a yellow callout
- Sends via Resend transactional API to `support@tmolecule.com`
- Requires `RESEND_API_KEY` in env (the runner sources `~/.env.resend`)

If `RESEND_API_KEY` isn't set, the email step will fail loudly but the report will still be written to disk — log the error and continue.
