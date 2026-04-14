# TMolecule Shopify Product Page Theme Bundle

A complete, paste-ready Shopify OS 2.0 product page template: buy box, editorial story, sticky CTA, announcement marquee, trust badges, ingredient grid, heritage, compare table, reviews.

## Files

```
shopify-theme/
├── assets/
│   ├── tmolecule-product.css
│   └── tmolecule-product.js
├── sections/
│   ├── announcement-bar-tmolecule.liquid
│   ├── main-product-tmolecule.liquid
│   ├── product-story-tmolecule.liquid
│   └── sticky-cta-tmolecule.liquid
└── templates/
    └── product.tmolecule.json
```

## Install (copy-paste into your live theme)

1. **Shopify Admin → Online Store → Themes → ⋮ → Edit code**

2. **Add the two assets:**
   - In `assets/` folder → **Add a new asset** → paste `tmolecule-product.css`
   - Again → paste `tmolecule-product.js`

3. **Add the four sections:**
   - In `sections/` folder → **Add a new section** → name it exactly as each file (without `.liquid`) → paste the contents
     - `announcement-bar-tmolecule`
     - `main-product-tmolecule`
     - `product-story-tmolecule`
     - `sticky-cta-tmolecule`

4. **Add the template:**
   - In `templates/` folder → **Add a new template** → For: `product`, Type: `json`, Name: `tmolecule`
   - Paste the contents of `product.tmolecule.json`

5. **Assign to a product:**
   - Go to **Products → [your product] → Theme template** → select `product.tmolecule`
   - Save

6. **Customize:**
   - **Customize → Products → `tmolecule` template** to edit copy, images, badges, CTAs, and reorder blocks in the visual editor.

## How it works

- **announcement-bar-tmolecule** — scrolling marquee at the top of the page. Add/remove message blocks in the customizer.
- **main-product-tmolecule** — hero gallery + title + variant picker + pricing + ATC + trust badges. Pulls real product data from Shopify (`product.media`, `product.variants`, `product.price`). Variant buttons update the price and hidden `id` input so clicking ATC adds the correct variant.
- **product-story-tmolecule** — the 8-block editorial story section with presets (trust marquee, tabs, ingredient grid with leaf flourish SVG, heritage, compare, two editorial blocks, reviews). Each block is optional and reorderable.
- **sticky-cta-tmolecule** — bottom-fixed bar that slides up once the main ATC scrolls out of view (IntersectionObserver).

## Customization notes

- **Fonts**: Fraunces (serif, headings) + Inter (sans, UI) loaded via Google Fonts in the announcement section's first stylesheet tag.
- **Palette**: edit CSS variables at the top of `tmolecule-product.css` (`--tm-ink`, `--tm-bg`, `--tm-accent`, `--tm-accent-dark`, `--tm-rule`).
- **Band colors**: five variants (`--cream`, `--sand`, `--honey`, `--deep-sand`, `--espresso`) — swap any block's band color in the schema.
- **Decorative leaf SVG**: embedded in the ingredient grid block, no external asset needed.
- **Subscribe toggle**: display-only (hook up to Recharge / Seal / Shopify Subscriptions app for real logic).

## What's NOT included

- The site header and footer (use your theme's existing ones). The announcement section sits above the header.
- A reviews widget (plug in Judge.me / Loox / Yotpo for real reviews).
- Upsell / cart drawer (use your theme's default).

## Preview

A static browser preview with placeholder data is at `../theme-snippets/preview.html` and live at https://tmolecule.github.io/preview/ .
