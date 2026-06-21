// /learn slugs consolidated onto another surface (301). Recipes belong on the
// blog (content strategy: /learn = evergreen knowledge, blog = recipes), so the
// duplicate /learn recipe 301s to its blog home. Used by the router (index.js)
// to redirect and here to exclude the slug from the sitemap.
export const LEARN_REDIRECTS = {
  'masala-chai-recipe': 'https://tmolecule.com/blogs/recipes/masala-chai-recipe',
};

export async function handleSitemap(env, origin, mount = '') {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const now = new Date().toISOString().split('T')[0];

  const entries = [`<url><loc>${origin}${mount}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`];

  // Static code-routed tool pages (not in KV) — list explicitly so they index.
  for (const tool of ['tea-finder', 'brew-guide', 'cost-per-cup']) {
    entries.push(`<url><loc>${origin}${mount}/${tool}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  }

  const articleEntries = [];
  const presentPillars = new Set();

  for (const key of list.keys) {
    if (key.name.includes(':')) continue; // skip variant + experiment keys
    if (LEARN_REDIRECTS[key.name]) continue; // 301'd elsewhere — don't list
    const raw = await env.LEARN_PAGES.get(key.name);
    let lastmod = now;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.updated_at) lastmod = d.updated_at.split('T')[0];
        if (d.pillar) presentPillars.add(d.pillar);
      } catch {}
    }
    articleEntries.push(`<url><loc>${origin}${mount}/${key.name}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
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
