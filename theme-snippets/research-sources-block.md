# Product → Learn "Research & sources" block

Adds a trust-building block to the TMolecule product story section that links each
PDP to the relevant `/learn` research pages — so product claims are backed by
published-research guides instead of standing in isolation.

**Where it lives:** new `sources` block in
`live-theme/sections/product-story-tmolecule.liquid` (render case + schema + preset
already added). It renders as a `tm-band` titled "The research behind this cup" with
up to 6 linked source cards + a research-framing footnote.

## Install (no CLI push — paste via Admin, per TM convention)

1. Shopify Admin → **Online Store → Themes → ⋯ → Edit code**.
2. Open `sections/product-story-tmolecule.liquid`. **Back up** the current contents first
   (copy to a scratch file) in case the live copy drifted from this repo mirror.
3. Replace with the updated `live-theme/sections/product-story-tmolecule.liquid`
   (or, additively: paste the new `{%- when 'sources' -%}` render case before the final
   `{%- endcase -%}`, and the `"sources"` schema block before the `disclaimer` block).
   Schema JSON validated; Liquid tags balanced.
4. **Customize → Products → Spice Rush template** → **Add block → Research & sources**
   (the preset also drops it in automatically, between the editorial blocks and reviews).
5. Fill the link URLs per product (labels/descriptions for Spice Rush are pre-filled as
   defaults; just paste the three URLs). For ImmuniTea, overwrite labels + URLs.

## Per-product values (all verified HTTP 200)

### Spice Rush Collagen Black Tea
| Label | URL |
|---|---|
| What collagen peptides are | https://tmolecule.com/learn/collagen-peptides |
| Does hot water destroy collagen? | https://tmolecule.com/learn/does-hot-water-destroy-collagen |
| The best collagen tea, formats ranked | https://tmolecule.com/learn/best-collagen-tea |
| _(optional)_ Does collagen tea actually work? | https://tmolecule.com/learn/does-collagen-tea-actually-work |
| _(optional)_ Is collagen tea safe? | https://tmolecule.com/learn/is-collagen-tea-safe |

### ImmuniTea Defense Tea
| Label | URL |
|---|---|
| Turmeric, by the research | https://tmolecule.com/learn/turmeric |
| The best adaptogen tea | https://tmolecule.com/learn/best-adaptogen-tea |
| What makes a tea "functional"? | https://tmolecule.com/learn/what-makes-a-tea-functional |
| _(optional)_ Tea polyphenols | https://tmolecule.com/learn/polyphenols |
| _(optional)_ The best immunity tea | https://tmolecule.com/learn/best-immunity-tea |

## Compliance
The block heading ("The research behind this cup") + intro ("published research,
described plainly. Not health claims.") + footnote (FDA non-evaluation) frame these as
research provenance, not product efficacy claims — reinforcing the no-medical-claims
posture rather than weakening it. The `/learn` targets are themselves research-framed.

## Reciprocity note
The reverse direction already exists: `/learn` pages carry a `product_bridge` back to the
PDP. This block closes the loop (PDP → research), so the trust signal is bidirectional.
