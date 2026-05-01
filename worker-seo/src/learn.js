import { renderArticle, renderIndex } from './template.js';

export async function handleArticle(slug, env, origin) {
  const raw = await env.LEARN_PAGES.get(slug);
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response('Page data malformed', { status: 500 });
  }

  const html = renderArticle(data, slug, origin, env);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
      'x-tmolecule-source': 'worker-pseo'
    }
  });
}

export async function handleIndex(env, origin) {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const items = [];
  for (const key of list.keys) {
    const raw = await env.LEARN_PAGES.get(key.name);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      items.push({
        slug: key.name,
        title: data.title,
        meta_description: data.meta_description
      });
    } catch {}
  }
  items.sort((a, b) => a.title.localeCompare(b.title));
  const html = renderIndex(items, origin, env);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600'
    }
  });
}
