# robots.txt — Content-Signal is not live at the apex (2026-07-28)

> **RESOLVED 2026-07-29.** Added `templates/robots.txt.liquid` directly in the Shopify code
> editor (the theme-zip import route did not take — the uploaded template never appeared in
> the published theme's render path). Verified live: all three directives present inside
> `User-agent: *`, all seven Shopify default UA groups preserved, no unrendered Liquid.
> robots.txt hash moved `378ff93240bc` -> `b009b6f879b5`, 116 -> 169 lines.
>
> The Shopify `# Shopify storefront…` / `# UCP discovery…` header is now gone — it is emitted
> outside `robots.default_groups`, so its absence is the positive proof the custom template is
> rendering. `/api/ucp/mcp`, referenced in that old header, 404s anyway.
>
> The template is mirrored in this directory as `robots.txt.liquid` so a theme republish
> cannot lose it the way the 2026-05-13 version was lost.

Found while analysing the GSC coverage export `tmolecule.com-Coverage-2026-07-28.zip`.

## The actual situation

There is **no `templates/robots.txt.liquid`** in the published Shopify theme, so Shopify
serves its own default `robots.txt` at the apex.

Separately, the Cloudflare worker has a robots handler
(`worker-seo/src/sitemap.js:70`, `handleRobots`) which **does** emit:

```
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

But `wrangler.toml` binds exact-path routes only for `/agents.md`, `/llms.txt` and the
verification `.txt` — **there is no route for `/robots.txt`**. Verified 2026-07-28:

| URL | Served by | Content-Signal |
|---|---|---|
| `tmolecule.com/robots.txt` | Shopify default | **absent** |
| `tmolecule.com/learn/robots.txt` | worker | present |

Crawlers only honour `robots.txt` at the **host root**. Nothing reads `/learn/robots.txt`,
so the AI-training opt-out has effectively never been live on the apex domain.

## Do NOT fix this by routing the worker at /robots.txt

`handleRobots` emits `User-agent: * / Allow: /` with **no Disallow rules at all**. Routing it
at the apex would replace Shopify's defaults and expose `/cart`, `/checkout`, `/account`,
`/orders`, `/services`, and the `sort_by` / `filter` crawl traps. That is strictly worse than
the current state.

## The fix — create the Shopify template

Shopify admin → Themes → Edit code → Templates → Add a new template → `robots.txt`:

```liquid
{% raw %}{% for group in robots.default_groups %}
  {{- group.user_agent }}

  {%- for rule in group.rules -%}
    {{ rule }}
  {%- endfor -%}

  {%- if group.user_agent.value == '*' -%}
    {{ 'Content-Signal: ai-train=no, search=yes, ai-input=yes' }}
    {{ 'Disallow: /*?variant=' }}
    {{ 'Disallow: /*.atom$' }}
  {%- endif -%}

  {%- if group.sitemap != blank -%}
    {{ group.sitemap }}
  {%- endif -%}
{% endfor %}{% endraw %}
```

`robots.default_groups` re-emits every Shopify default rule, so nothing currently blocked
becomes crawlable — it only adds the three directives.

## Verify after publishing

```
curl -s https://tmolecule.com/robots.txt | grep -iE 'content-signal|variant|atom|UCP discovery'
```

Unknown until tested: whether Shopify's UCP/agents comment header survives once a custom
template exists (it is emitted outside `default_groups`). If it disappears and you want it,
paste those comment lines literally at the top of the template.

Note: `/api/ucp/mcp`, referenced in that header, currently **404s**. `/agents.md` and
`/.well-known/ucp` both return 200.

## The 2026-05-13 `pr_*` blocks are gone too, and are probably fine to leave out

That cleanup created a `robots.txt.liquid` from scratch and added `pr_prod_strat`,
`pr_rec_id`, `pr_ref_pid`, `pr_rec_pid`, `pr_seq`, `add_to_wishlist`, because PageFly's
recommendation engine generated param URLs resolving to deleted products. A later theme
republish lost that template.

Fetching `/products/spice-rush-collagen-black-tea` on 2026-07-28 returns **zero** occurrences
of `pagefly`, `pr_rec_id`, `pr_prod_strat` or `add_to_wishlist` — the app appears to be
uninstalled. Re-add only if the GSC 404 bucket keeps climbing:

```
Disallow: /*?*pr_prod_strat=
Disallow: /*?*pr_rec_id=
Disallow: /*?*pr_ref_pid=
Disallow: /*?*pr_rec_pid=
Disallow: /*?*pr_seq=
Disallow: /*?*add_to_wishlist=
```

`Disallow: /services/login_with_shop/` does **not** need restoring — Shopify's default
`Disallow: /services` already covers it.

## Keep the template in the repo this time

Once created, copy it to `dawn/templates/robots.txt.liquid` and commit. The May template was
lost precisely because it lived only in Shopify admin.
