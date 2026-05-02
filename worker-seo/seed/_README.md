# Seed directory

Drop one JSON file per article. Filename (without `.json`) becomes the URL slug — e.g. `seed/how-to-brew-oolong-tea.json` ships as `https://learn.tmolecule.com/how-to-brew-oolong-tea`.

## JSON shape

```json
{
  "title": "Page title (used in <title> and OpenGraph)",
  "h1": "Optional H1 — falls back to title if omitted",
  "meta_description": "150-160 char description for SERP and social",
  "body_html": "<p>Full article HTML. Use <h2>, <h3>, <p>, <ul>, <ol>, <blockquote>, <strong>, <em>, <a>, <table>, <aside class=\"trad-sci\">. No <script>, no <style>.</p>",
  "image_url": "https://tmolecule.com/cdn/shop/files/optional-hero.jpg",
  "published_at": "2026-04-30T00:00:00Z",
  "updated_at": "2026-04-30T00:00:00Z",
  "keywords": ["matcha", "weight loss", "EGCG"],
  "faqs": [
    { "q": "Question text?", "a": "Plain-text answer (use Unicode chars — — ' not HTML entities)", "a_html": "<p>Optional richer HTML answer.</p>" }
  ],
  "sources": [
    { "title": "Source title", "url": "https://...", "publisher": "Optional journal/publisher" }
  ]
}
```

### Field rules

- **`faqs[].q` / `faqs[].a`** — plain text. Use real Unicode (`—`, `–`, `°`, `×`, curly quotes), NOT HTML entities like `&mdash;`. The Worker `esc()`'s these fields and double-escapes entities into literal text.
- **`body_html`** — HTML. Entities (`&mdash;`, `&times;`, etc.) are fine here; they're not re-escaped.
- **`a_html`** — optional richer HTML for an FAQ answer. Use when you need `<p>`, `<a>`, `<ul>` inside an answer.

## Tradition + Science callout

Use `<aside class="trad-sci">` inside `body_html` to render a paired two-column block: traditional/Ayurvedic context on the left, modern peer-reviewed science on the right. Stacks vertically on mobile.

```html
<aside class="trad-sci">
  <div class="trad-sci__trad">
    <h4>Ayurveda says</h4>
    <p>Tulsi is classified as a <em>rasayana</em> in the Charaka Samhita — a rejuvenative held to support immunity, clarity, and longevity.</p>
  </div>
  <div class="trad-sci__sci">
    <h4>Studies show</h4>
    <p>A <a href="https://pubmed.ncbi.nlm.nih.gov/...">2024 meta-analysis of 14 RCTs</a> found tulsi extract significantly reduced blood glucose and inflammatory markers.</p>
  </div>
</aside>
```

The Markdown alternative (`/<slug>.md`) renders this as a blockquote pair so AI crawlers preserve the pairing semantically.

### When to use it

Drop one in any article that makes a health, ritual, or wellness claim where:
- An Ayurvedic source explains the *why* (Charaka Samhita, Sushruta Samhita, Bhavaprakasha, classical Tridosha framing)
- A peer-reviewed modern study confirms the *what* (PMC, PubMed, AJCN, etc.)

Goal: every claim has both a tradition citation and a science citation. That's the brand voice.

## Upload

```bash
# Production KV
npm run kv:seed

# Preview KV (for `wrangler dev`)
npm run kv:seed-preview
```

The seed script iterates every `*.json` in this directory and writes it to the `LEARN_PAGES` KV namespace using the filename as the key.
