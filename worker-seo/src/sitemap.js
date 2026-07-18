// /learn slugs consolidated onto another surface (301). Recipes belong on the
// blog (content strategy: /learn = evergreen knowledge, blog = recipes), so the
// duplicate /learn recipe 301s to its blog home. Used by the router (index.js)
// to redirect and here to exclude the slug from the sitemap.
export const LEARN_REDIRECTS = {
  'masala-chai-recipe': 'https://tmolecule.com/blogs/recipes/masala-chai-recipe',
  // Consolidated the older /learn/cardamom into the newer, better-cited
  // cardamom-benefits page (2026-07-13) to avoid two competing cardamom pages.
  'cardamom': 'https://tmolecule.com/learn/cardamom-benefits',
};

export async function handleSitemap(env, origin, mount = '') {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const now = new Date().toISOString().split('T')[0];

  const entries = [`<url><loc>${origin}${mount}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`];

  // Static code-routed tool pages (not in KV) — list explicitly so they index.
  for (const tool of ['tools', 'tea-finder', 'brew-guide', 'cost-per-cup', 'caffeine-comparator', 'collagen-calculator', 'sugar-saved', 'spice-blend-builder']) {
    entries.push(`<url><loc>${origin}${mount}/${tool}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  }

  const articleEntries = [];
  const presentPillars = new Set();

  // Fetch page bodies in PARALLEL — sequential awaits inside this loop made the
  // sitemap take ~N×200ms cold, timing out crawlers on cache-miss regen. Filter
  // first, then Promise.all; order is preserved so the XML is byte-identical.
  const pages = await Promise.all(
    list.keys
      .filter((key) => !key.name.includes(':') && !LEARN_REDIRECTS[key.name])
      .map(async (key) => ({ name: key.name, raw: await env.LEARN_PAGES.get(key.name) }))
  );

  for (const { name, raw } of pages) {
    let lastmod = now;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.updated_at) lastmod = d.updated_at.split('T')[0];
        if (d.pillar) presentPillars.add(d.pillar);
      } catch {}
    }
    articleEntries.push(`<url><loc>${origin}${mount}/${name}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  }

  // Pillar hub pages — emitted only for pillars that actually have content.
  for (const slug of presentPillars) {
    entries.push(`<url><loc>${origin}${mount}/${slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  }
  entries.push(...articleEntries);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    }
  });
}

export function handleRobots(origin, mount = '') {
  const body = `User-agent: *
Allow: /

# AI search and discovery — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

# IETF Content-Signal: opt in to AI search and RAG, opt out of training
Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${origin}${mount}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400'
    }
  });
}
