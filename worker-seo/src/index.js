import { handleArticle, handleIndex } from './learn.js';
import { handleSitemap, handleRobots } from './sitemap.js';
import { renderNotFound } from './template.js';

async function handleHealth(env) {
  const start = Date.now();
  let kvOk = false;
  let kvCount = 0;
  let kvLatencyMs = 0;
  try {
    const kvStart = Date.now();
    const list = await env.LEARN_PAGES.list({ limit: 100 });
    kvLatencyMs = Date.now() - kvStart;
    kvOk = true;
    kvCount = list.keys.length;
  } catch {
    kvOk = false;
  }
  const ok = kvOk && kvCount > 0;
  const body = {
    status: ok ? 'ok' : 'degraded',
    kv: { ok: kvOk, page_count: kvCount, latency_ms: kvLatencyMs },
    site_name: env.SITE_NAME,
    timestamp: new Date().toISOString(),
    response_time_ms: Date.now() - start
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: ok ? 200 : 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-tmolecule-source': 'worker-health'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '') {
      return handleIndex(env, url.origin);
    }

    if (path === '/sitemap.xml') {
      return handleSitemap(env, url.origin);
    }

    if (path === '/robots.txt') {
      return handleRobots(url.origin);
    }

    if (path === '/health') {
      return handleHealth(env);
    }

    const slug = path.slice(1);
    if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
      const article = await handleArticle(slug, env, url.origin);
      if (article) return article;
    }

    return new Response(renderNotFound(env, url.origin), {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60'
      }
    });
  }
};
