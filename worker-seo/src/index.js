import { handleArticle, handleArticleMarkdown, handleIndex, handleHub, handleLlmsTxt, handleManifest } from './learn.js';
import { handleSitemap, handleRobots, LEARN_REDIRECTS } from './sitemap.js';
import { renderNotFound, renderBrewGuide, renderCostPerCup, renderTeaFinder } from './template.js';
import { BREW_GUIDE_JS, COST_PER_CUP_JS, TEA_FINDER_JS } from './widget-bundles.js';
import { handleDeck } from './deck.js';
import { pickVariant, VARIANT_DEFAULT } from './experiments.js';
import { isHubSlug } from './taxonomy.js';
import AGENTS_MD from '../agents.md';

/** Serve an inlined widget IIFE bundle with long, CORS-open caching. */
function serveWidgetJs(js) {
  return new Response(js, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'access-control-allow-origin': '*'
    }
  });
}

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

/**
 * Mount path is the URL prefix the Worker is bound to on each hostname.
 * Keep this map in sync with the [[routes]] in wrangler.toml.
 *
 *   learn.tmolecule.com/*          → mount ''        (subdomain — Worker owns the host)
 *   www.tmolecule.com/learn/*      → mount '/learn'  (www proves O2O works on this zone)
 *   tmolecule.com/learn/*          → mount '/learn'  (apex; only fires after A→CNAME flip)
 *
 * Any other hostname (e.g. *.workers.dev preview) defaults to '' so health
 * checks and dev requests behave like the subdomain case.
 */
const MOUNT_BY_HOSTNAME = {
  'learn.tmolecule.com': '',
  'www.tmolecule.com':   '/learn',
  'tmolecule.com':       '/learn'
};

function mountPathFor(url) {
  return MOUNT_BY_HOSTNAME[url.hostname] ?? '';
}

/**
 * Strip the mount prefix from an incoming pathname so the rest of the router
 * can reason in terms of the unmounted (subdomain-relative) path.
 */
function unmountedPath(rawPath, mount) {
  if (!mount) return rawPath;
  if (rawPath === mount || rawPath === mount + '/') return '/';
  if (rawPath.startsWith(mount + '/')) return rawPath.slice(mount.length);
  return rawPath;
}

/**
 * Detect article slug from a URL pathname (handles HTML and .md variants).
 * Returns null when the path is not an article.
 */
function articleSlugFromPath(path) {
  if (!path || path === '/') return null;
  let slug = path.slice(1);
  if (slug.endsWith('.md')) slug = slug.slice(0, -3);
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return null;
  return slug;
}

/**
 * Compute the cache-key suffix that distinguishes one experiment variant from
 * another for article paths. Empty string when no variant is in play.
 */
async function variantCacheSuffix(url, request, env) {
  const mount = mountPathFor(url);
  const rawPath = url.pathname.replace(/\/+$/, '') || '/';
  const path = unmountedPath(rawPath, mount);
  // Sitemap, robots, llms — never variant-keyed
  if (path === '/sitemap.xml' || path === '/robots.txt' || path === '/llms.txt' || path === '/agents.md') return '';
  const slug = articleSlugFromPath(path);
  if (!slug) return '';
  const variant = await pickVariant(slug, env, request);
  if (variant === VARIANT_DEFAULT) return '';
  return `&_var=${encodeURIComponent(variant)}`;
}

/**
 * Edge-cache wrapper. After the first request to a given URL, subsequent
 * requests at the same CF edge are served from cache without invoking the
 * Worker. Cache TTL is controlled by the response's cache-control headers
 * (s-maxage). Bypass on non-GET, ?nocache=1, or /health.
 */
async function handleWithCache(request, env, ctx, generator) {
  if (request.method !== 'GET') return generator();
  const url = new URL(request.url);
  if (url.searchParams.has('nocache')) return generator();
  if (url.pathname === '/health') return generator();

  // Cache key includes build version so each deploy auto-invalidates old cached responses.
  // Path-only (strips ALL incoming query params so unique URLs share one cache slot).
  // For article paths, cache key is suffixed with the experiment variant so each
  // variant gets its own cache slot (default visitors and bots all share the
  // 'default' slot; rule-targeted humans hit their variant slot independently).
  const buildVersion = env.BUILD_VERSION || 'dev';
  const variantSuffix = await variantCacheSuffix(url, request, env);
  const cacheKey = new Request(
    `${url.protocol}//${url.host}${url.pathname}?_v=${buildVersion}${variantSuffix}`,
    { method: 'GET' }
  );
  const cache = caches.default;

  let cached = await cache.match(cacheKey);
  if (cached) {
    const r = new Response(cached.body, cached);
    r.headers.set('x-edge-cache', 'HIT');
    return r;
  }

  const fresh = await generator();
  if (fresh.status === 200) {
    ctx.waitUntil(cache.put(cacheKey, fresh.clone()));
  }
  const out = new Response(fresh.body, fresh);
  out.headers.set('x-edge-cache', 'MISS');
  return out;
}

async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);

  // Consolidate the legacy learn.* subdomain onto the apex /learn/* path.
  // Both hosts served byte-identical content with self-referential canonicals,
  // so Google split-indexed them and selected the subdomain over the apex
  // ("Duplicate, Google chose a different canonical than user"). 301 slug-for-
  // slug so the apex is the single canonical home. Keep the subdomain route
  // bound until GSC shows the learn.* URLs dropped (~90 days), then unbind in
  // wrangler.toml. Mirrors the whollykaw learn-subdomain consolidation.
  if (url.hostname === 'learn.tmolecule.com') {
    // Strip trailing slashes here so we land on the final apex URL in one hop
    // (avoids subdomain/<slug>/ → apex/learn/<slug>/ → apex/learn/<slug>). The
    // bare subdomain root maps to the apex index, which keeps its trailing slash.
    const sub = url.pathname.replace(/\/+$/, '');
    const dest = sub === '' ? '/learn/' : `/learn${sub}`;
    return Response.redirect(`https://tmolecule.com${dest}${url.search}`, 301);
  }

  const mount = mountPathFor(url);

  // Canonicalize away trailing slashes on article/hub paths: /learn/<slug>/ and
  // /learn/<slug> otherwise both serve a 200 (the router strips the slash
  // internally), which Google sees as duplicate URLs. 301 to the no-slash form.
  // The mount root keeps its slash — /learn/ is the index page's own canonical,
  // so never redirect when the trimmed path collapses to the mount.
  const trimmedPath = url.pathname.replace(/\/+$/, '');
  if (trimmedPath && trimmedPath !== url.pathname && trimmedPath !== mount) {
    return Response.redirect(`${url.origin}${trimmedPath}${url.search}`, 301);
  }

  const rawPath = url.pathname.replace(/\/+$/, '') || '/';
  const path = unmountedPath(rawPath, mount);

  // Consolidated slugs (e.g. recipes that live on the blog) — 301 to their home
  // so /learn doesn't cannibalize the canonical surface. Map in sitemap.js.
  const redirectSlug = path.replace(/^\//, '');
  if (LEARN_REDIRECTS[redirectSlug]) {
    return Response.redirect(`${LEARN_REDIRECTS[redirectSlug]}${url.search}`, 301);
  }

  if (path === '/' || path === '') {
    return handleIndex(env, url.origin, mount);
  }

  if (path === '/sitemap.xml') {
    return handleSitemap(env, url.origin, mount);
  }

  if (path === '/robots.txt') {
    return handleRobots(url.origin, mount);
  }

  if (path === '/health') {
    return handleHealth(env);
  }

  if (path === '/llms.txt') {
    return handleLlmsTxt(env, url.origin, mount);
  }

  // Agent-facing store description. Overrides Shopify's generic auto-generated
  // /agents.md with our brand-specific, food/supplement-compliant version.
  // Source of truth is worker-seo/agents.md (imported as text at top of file).
  if (path === '/agents.md') {
    return new Response(AGENTS_MD, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  }

  // IndexNow ownership-proof key. Hosted under the /learn mount, so the
  // submittable URL scope is /learn/* (all this Worker owns). Submit URLs via
  // POST to https://api.indexnow.org/IndexNow with this key + keyLocation
  // pointing back at this file.
  if (path === '/6e140b318cfa4ad57fd1a1e06e4bd20e.txt') {
    return new Response('6e140b318cfa4ad57fd1a1e06e4bd20e', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      },
    });
  }

  if (path === '/manifest.json') {
    return handleManifest(env, url.origin, mount);
  }

  // Interactive tool widget (#2 Brew Guide). The IIFE is served here; the host
  // page at /brew-guide self-mounts it into <div id="tm-brew-guide">.
  if (path === '/widgets/brew-guide.js') {
    return serveWidgetJs(BREW_GUIDE_JS);
  }
  if (path === '/brew-guide') {
    return new Response(renderBrewGuide(url.origin, env, mount), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600'
      }
    });
  }

  // Interactive tool widget (#3 Cost-per-cup).
  if (path === '/widgets/cost-per-cup.js') {
    return serveWidgetJs(COST_PER_CUP_JS);
  }
  if (path === '/cost-per-cup') {
    return new Response(renderCostPerCup(url.origin, env, mount), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600'
      }
    });
  }

  // Interactive tool widget (#1 Tea Finder quiz).
  if (path === '/widgets/tea-finder.js') {
    return serveWidgetJs(TEA_FINDER_JS);
  }
  if (path === '/tea-finder') {
    return new Response(renderTeaFinder(url.origin, env, mount), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600'
      }
    });
  }

  if (path.startsWith('/decks/')) {
    return handleDeck(request, env, path);
  }

  // Markdown alternative for any article: /<slug>.md
  if (path.endsWith('.md')) {
    const mdSlug = path.slice(1, -3);
    if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(mdSlug)) {
      const md = await handleArticleMarkdown(mdSlug, env, url.origin, request, mount);
      if (md) return md;
    }
  }

  const slug = path.slice(1);

  // Pillar hub pages (/ingredients, /benefits, …) take precedence over article
  // lookup so a hub slug can never be shadowed by an article of the same name.
  if (isHubSlug(slug)) {
    return handleHub(slug, env, url.origin, mount);
  }

  if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
    const article = await handleArticle(slug, env, url.origin, request, mount);
    if (article) return article;
  }

  return new Response(renderNotFound(env, url.origin, mount), {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    return handleWithCache(request, env, ctx, () => handleFetch(request, env, ctx));
  }
};
