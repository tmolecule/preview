# TMolecule Product Story Section

Drop-in Shopify OS 2.0 section that renders a Lineage-Provisions-style editorial product page below the default buy box.

## Install

1. Shopify Admin → **Online Store → Themes → ⋯ → Edit code**.
2. In the `sections/` folder, click **Add a new section** → name it `product-story-tmolecule` → **Done**.
3. Delete the default Liquid + schema, paste the contents of `product-story-tmolecule.liquid`, **Save**.
4. Go to **Customize → Products → Default product template** (or a specific product template).
5. Click **Add section** → find **"TMolecule product story"** → add.
6. The preset drops in all blocks (trust row, tabs, ingredient grid, heritage, compare table, two editorial blocks, reviews). Reorder and fill in copy/images in the customizer.

## Structure (matches Lineage inspiration, adapted for tea)

1. **Trust row** — six badges (since 1935, single-origin, etc.)
2. **Tabs accordion** — Overview / Tasting Notes / Brewing / FAQs
3. **Ingredient spotlight grid** — 6 cards highlighting tea varietals or ingredients
4. **Heritage story** — image + eyebrow "Family tea, since 1935" + founder signature
5. **Us vs Them table** — TMolecule vs. typical tea
6. **Editorial image-text blocks** — repeatable, alternating layouts
7. **Featured reviews** — 3-up blockquotes

## Styling notes

- Scoped CSS variables at the top of the `<style>` block: `--tm-ink`, `--tm-bg`, `--tm-accent`, `--tm-rule`. Tune these to match brand palette.
- Uses Georgia serif for headings/body, system-ui sans for UI chrome. Swap font stacks if the theme loads custom fonts.
- Fully responsive; collapses to single column under 750px.

## Not included (use the theme's existing sections)

- Product gallery, title, price, variant picker, ATC button — keep these as the default product template's main-product section above this story section.
- Review aggregation widget — plug in Judge.me / Loox / Yotpo section after launch.
