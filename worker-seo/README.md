# tmolecule-seo (Cloudflare Worker)

Programmatic SEO worker for **learn.tmolecule.com**. Serves educational tea content from Cloudflare KV at the edge — no Shopify pages, no theme, no CMS.

## Why a subdomain (not `tmolecule.com/learn/*`)

Shopify uses **Cloudflare for SaaS** to manage custom domains on stores. Even with our own CF zone proxied, traffic to `tmolecule.com` is intercepted by Shopify's CF account before our Worker can fire. The subdomain `learn.tmolecule.com` is outside Shopify's claimed hostnames, so our Worker owns it cleanly.

Trade-off: subdomain SEO authority is ~70% of subdirectory authority. Mitigated by adding internal links from `tmolecule.com` → `learn.tmolecule.com`.

## URL routes

| Path | Behavior |
|---|---|
| `/` | Index page listing all Learn articles. |
| `/<slug>` | Article page rendered from KV (e.g. `/what-is-matcha`). 404 if slug not in KV. |
| `/sitemap.xml` | Auto-generated sitemap of all Learn URLs. |
| `/robots.txt` | Allows all bots, points to sitemap. |

Each article ships with `Article` + `BreadcrumbList` JSON-LD; pages with FAQs also get `FAQPage` schema.

## File map

```
worker-seo/
├── wrangler.toml          # CF config (account, KV, route, env vars)
├── package.json
├── src/
│   ├── index.js           # main fetch handler / router
│   ├── learn.js           # /<slug> article + / index
│   ├── template.js        # HTML template, nav, JSON-LD
│   └── sitemap.js         # /sitemap.xml + /robots.txt
├── seed/                  # source-of-truth content (one JSON per page)
│   ├── what-is-matcha.json
│   ├── green-tea-vs-black-tea.json
│   └── how-to-brew-oolong-tea.json
└── scripts/
    └── seed-kv.sh         # bulk upload seed/*.json → KV
```

## Setup (already done — for reference)

```bash
cd /Users/voicecalls/tmolecule/worker-seo
npm install
npx wrangler login
npx wrangler kv namespace create LEARN_PAGES
npx wrangler kv namespace create LEARN_PAGES --preview
# IDs go into wrangler.toml
npm run kv:seed
npm run deploy
```

DNS setup (one-time, in Cloudflare dashboard):
- CNAME `learn` → `tmolecule-seo.whollykaww.workers.dev` — Proxied (orange cloud)

## Editing content

Workflow:

1. Edit a JSON file in `seed/`
2. Run `npm run kv:seed`
3. Page is live globally within ~60 seconds

```bash
# Edit a page
$EDITOR seed/what-is-matcha.json

# Push to production KV
npm run kv:seed

# Or push to preview KV (for `wrangler dev`)
npm run kv:seed-preview
```

## Adding a new page

1. Create `seed/<slug>.json` matching the schema below.
2. Run `npm run kv:seed`.
3. Live at `https://learn.tmolecule.com/<slug>`.

### Page JSON shape

```json
{
  "title": "Page title (used in <title>)",
  "h1": "On-page H1 (defaults to title if omitted)",
  "meta_description": "1–2 sentence meta description.",
  "image_url": "https://tmolecule.com/cdn/shop/files/...",
  "published_at": "2026-04-30T08:00:00Z",
  "updated_at": "2026-04-30T08:00:00Z",
  "keywords": ["keyword 1", "keyword 2"],
  "body_html": "<p>Trusted HTML — rendered as-is.</p>",
  "faqs": [
    { "q": "Question?", "a": "Plain-text answer." }
  ]
}
```

`body_html` is **not** escaped — only put trusted HTML there. `faqs[].a` is escaped by default; pass `a_html` instead for rich answers.

## Local development

```bash
# Seed local KV (one-time)
for f in seed/*.json; do
  slug=$(basename "$f" .json)
  npx wrangler kv key put --binding=LEARN_PAGES --local --preview "$slug" --path="$f"
done

# Run dev server
npm run dev
# → http://localhost:8788
```

## Deploy

```bash
npm run deploy
```

Live in ~5 seconds. Rollback: `npx wrangler rollback`.

### Watch logs

```bash
npm run tail
```

## Deleting a page

```bash
# Remove local seed
rm seed/<slug>.json

# Remove from production KV
npx wrangler kv key delete --binding=LEARN_PAGES --preview false <slug>

# Remove from preview KV
npx wrangler kv key delete --binding=LEARN_PAGES --preview <slug>
```

If the page was indexed by Google, also add a 301 redirect for the URL (or accept the 410 Gone the Worker now serves).

## Environment variables

Set in `wrangler.toml` `[vars]`:

| Var | Purpose |
|---|---|
| `SITE_NAME` | Brand name in nav, schema, footer |
| `SHOP_ORIGIN` | Absolute URL of the main Shopify store (used for cross-domain nav links and schema) |
| `LOGO_URL` | Logo image used in `Organization` schema |
| `GSC_VERIFICATION` | Google Search Console verification token (renders as `<meta>`) |

## What this Worker does NOT do

- ❌ Schema injection on Shopify pages — not possible from a subdomain Worker (Shopify's CF for SaaS owns `tmolecule.com`).
- ❌ Edit, proxy, or modify Shopify content — fully separate surface.
- ❌ Personalization, A/B testing, cart logic — out of scope.

## Indexation strategy

Subdomain SEO is harder than subdirectory unless you actively build authority signals:

1. **Internal links from tmolecule.com**: footer/nav link to `https://learn.tmolecule.com`, plus contextual links from blog posts to specific articles.
2. **Cross-link Learn articles**: every article should link to 1–2 related articles.
3. **Link to Shopify products**: each Learn article should link to relevant products on `tmolecule.com` (helps users + product page authority).
4. **GSC**: sitemap submitted to both the Domain property (`tmolecule.com`) and the URL prefix property (`learn.tmolecule.com`).
