export async function handleSitemap(env, origin) {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const now = new Date().toISOString().split('T')[0];

  const entries = [`<url><loc>${origin}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`];

  for (const key of list.keys) {
    const raw = await env.LEARN_PAGES.get(key.name);
    let lastmod = now;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.updated_at) lastmod = d.updated_at.split('T')[0];
      } catch {}
    }
    entries.push(`<url><loc>${origin}/${key.name}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  }

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

export function handleRobots(origin) {
  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400'
    }
  });
}
