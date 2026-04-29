# Patch: Add robots.txt.liquid to live theme (Content-Signal opt-in)

**Date:** 2026-04-29
**Why:** tmolecule.com's robots.txt currently uses Shopify's default and does NOT include the IETF Content-Signal directive. Adding it explicitly tells GPTBot, Google-Extended, Claude-Bot, Perplexity, etc. they're welcome to index for search/RAG, and that you opt out of model training. Free AI-visibility hygiene win.

The matching Dawn reference already has this template; the live theme just doesn't have a `robots.txt.liquid` override. We're adding the file (not editing an existing one).

## What this template does

Compared to Shopify's default robots.txt, it adds three lines under `User-agent: *`:

```
Content-Signal: ai-train=no, search=yes, ai-input=yes
Disallow: /*?variant=
Disallow: /services/login_with_shop/
Disallow: /*.atom$
```

- **Content-Signal** — the IETF / Cloudflare-supported standard that lets you opt in to AI search indexing while opting out of model training
- **/*?variant=** — prevents Google from indexing every variant URL as a separate page (real SEO duplicate-content fix)
- **/services/login_with_shop/** — Shopify backend endpoint, no SEO value
- **/*.atom$** — old Atom feeds, deprecated

All other Shopify defaults (cart, checkout, account, faceted collection URLs, etc.) are preserved via the `{%- for rule in group.rules -%}` loop that emits Shopify's standard rules.

## How to apply (LIVE theme)

1. Open Shopify Admin → Online Store → Themes → **LIVE theme** → **Edit code**
2. In the file tree on the left, scroll to the **Templates** folder
3. Click **Add a new template** → choose `robots` from the dropdown → click **Done**
   - This creates `templates/robots.txt.liquid` with Shopify's default content
4. Replace the entire file content with the contents of `templates/robots.txt.liquid` from this patch directory
5. Click **Save**

## Verify after deploy

```bash
curl -s -A "Mozilla/5.0" https://tmolecule.com/robots.txt | grep -i 'Content-Signal'
# Expected output:
# Content-Signal: ai-train=no, search=yes, ai-input=yes
```

If you see the Content-Signal line, you're done. AI crawlers will see the new policy on their next crawl (typically within hours to a few days).
