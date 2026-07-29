import { handleArticle, handleArticleMarkdown, handleIndex, handleHub, handleLlmsTxt, handleManifest } from './learn.js';
import { handleSitemap, handleRobots, LEARN_REDIRECTS } from './sitemap.js';
import { renderNotFound, renderBrewGuide, renderCostPerCup, renderTeaFinder, renderCaffeineComparator, renderCollagenCalculator, renderSugarSaved, renderSpiceBlendBuilder, renderToolsHub } from './template.js';
import { BREW_GUIDE_JS, COST_PER_CUP_JS, TEA_FINDER_JS, CAFFEINE_COMPARATOR_JS, COLLAGEN_CALCULATOR_JS, SUGAR_SAVED_JS, SPICE_BLEND_BUILDER_JS, ADVISOR_JS, STEEP_GUIDE_JS } from './widget-bundles.js';
import { handleDeck } from './deck.js';
import { pickVariant, VARIANT_DEFAULT } from './experiments.js';
import { classifyCrawler } from './crawlers.js';
import { handleAdvisor, AdvisorRateLimiter } from './advisor.js';

// Durable Object class must be a named export of the entry module.
export { AdvisorRateLimiter };
import { isHubSlug } from './taxonomy.js';
import AGENTS_MD from '../agents.md';

/** Serve an inlined widget IIFE bundle. Short browser cache so fixes propagate
 *  quickly even for lazily-injected loads (e.g. the header advisor) that a
 *  hard-refresh doesn't bypass; the versioned embeds (?v=WIDGET_VERSION) still
 *  cache hard at the edge. */
function serveWidgetJs(js) {
  return new Response(js, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=120, s-maxage=600',
      'access-control-allow-origin': '*'
    }
  });
}

async function handleHealth(env) {
  const start = Date.now();
  let kvOk = false;
  let kvCount = 0;
  let kvLatencyMs = 0;
  let timer;
  try {
    const kvStart = Date.now();
    // Bound the probe: if KV hangs, resolve to a controlled 503 'degraded' below
    // instead of letting the request stall until Cloudflare's gateway 504s (opaque
    // to the uptime monitor). 5s is well under the edge gateway timeout.
    const list = await Promise.race([
      env.LEARN_PAGES.list({ limit: 100 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('kv-timeout')), 5000); }),
    ]);
    clearTimeout(timer);
    kvLatencyMs = Date.now() - kvStart;
    kvOk = true;
    kvCount = list.keys.length;
  } catch {
    clearTimeout(timer);
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

  // IndexNow ownership-proof key. Served BOTH under /learn (/learn/<key>.txt)
  // and at the apex root (tmolecule.com/<key>.txt, via exact-path routes in
  // wrangler.toml). The root-hosted copy expands the submittable URL scope from
  // /learn/* to the WHOLE domain (incl. /blogs/*). Submit URLs via POST to
  // https://api.indexnow.org/IndexNow with keyLocation pointing at the ROOT copy.
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

  // Recipe / article media (images), served from the DECKS R2 bucket under media/*.
  // Referenced from seeds as image_url = <origin>/learn/media/<file>.
  if (path.startsWith('/media/')) {
    const obj = await env.DECKS.get(path.slice(1));
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    if (!headers.has('content-type')) headers.set('content-type', 'image/jpeg');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
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

  // Interactive tool widget (#5 Caffeine comparator). Embeddable on other sites.
  if (path === '/widgets/caffeine-comparator.js') {
    return serveWidgetJs(CAFFEINE_COMPARATOR_JS);
  }
  if (path === '/caffeine-comparator') {
    return new Response(renderCaffeineComparator(url.origin, env, mount), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600'
      }
    });
  }

  // Interactive tool widget (#10 Steep Guide — tea-type water temp/time/ratio lookup).
  if (path === '/widgets/steep-guide.js') {
    return serveWidgetJs(STEEP_GUIDE_JS);
  }

  // Interactive tool widget (#6 Collagen-per-day calculator).
  if (path === '/widgets/collagen-calculator.js') {
    return serveWidgetJs(COLLAGEN_CALCULATOR_JS);
  }
  if (path === '/collagen-calculator') {
    return new Response(renderCollagenCalculator(url.origin, env, mount), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=3600' }
    });
  }

  // Interactive tool widget (#7 Sugar-saved / café-swap calculator).
  if (path === '/widgets/sugar-saved.js') {
    return serveWidgetJs(SUGAR_SAVED_JS);
  }
  if (path === '/sugar-saved') {
    return new Response(renderSugarSaved(url.origin, env, mount), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=3600' }
    });
  }

  // Interactive tool widget (#8 Chai spice-blend builder).
  if (path === '/widgets/spice-blend-builder.js') {
    return serveWidgetJs(SPICE_BLEND_BUILDER_JS);
  }
  if (path === '/spice-blend-builder') {
    return new Response(renderSpiceBlendBuilder(url.origin, env, mount), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=3600' }
    });
  }

  // RAG advisor — POST /learn/advisor. Billable LLM + Vectorize endpoint (rate-limited, no-store).
  if (path === '/advisor') {
    return handleAdvisor(request, env, ctx);
  }
  // Advisor chat widget IIFE (mounts into <div id="tm-advisor">).
  if (path === '/widgets/advisor.js') {
    return serveWidgetJs(ADVISOR_JS);
  }

  // Tools hub — the single indexable landing page linking every interactive tool.
  if (path === '/tools') {
    return new Response(renderToolsHub(url.origin, env, mount), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=3600' }
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

// Baseline security headers for every Worker response. The Worker generates the
// /learn HTML + tool/widget pages, which carry NONE of Shopify's edge security
// headers otherwise. CSP mirrors Shopify's own (frame-ancestors + mixed-content +
// upgrade only — deliberately NO script-src/style-src, so the templates' inline
// <style>/<script> keep working). COOP/CORP/Referrer-Policy/Permissions-Policy are
// the headers Shopify itself is missing too; a CF Transform Rule adds those four to
// the Shopify-served pages (homepage/products/collections/blogs).
const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "block-all-mixed-content; frame-ancestors 'none'; upgrade-insecure-requests",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};
function withSecurityHeaders(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

// Server-side pageview logging for the /learn worker pages (GA4's gtag is not
// injected here, so the whole corpus is otherwise invisible to analytics).
// Writes one Analytics Engine data point per HTML page response. Runs on EVERY
// request — including edge-cache HITs, since the Worker still executes — so
// counts are complete, not miss-only. No-op when the PAGEVIEWS binding is
// absent; never throws into the response path.
//
// Schema (query via the Analytics Engine SQL API, dataset
// `tmolecule_learn_pageviews`):
//   index1 = path        blob1 = path      blob2 = referer   blob3 = variant
//   blob4  = client      (human | gptbot | claudebot | perplexity | googlebot | other-bot | …)
//   blob5  = user-agent (truncated 200)
//   blob6  = purpose     (training | search | user-agent | index | other | none)
//   blob7  = operator    (OpenAI | Anthropic | Perplexity | Google | …, '' for humans)
//   double1 = 1 (count)  double2 = isBot (0 human/unknown, 1 crawler)
//   double3 = isLiveRetrieval (1 when purpose === 'user-agent')
//
// APPEND ONLY once this ships — positions are how the dataset is queried.
// Layout deliberately mirrors WhollyKaw's `learn_pageviews` so one query works
// against both brands.
//
// double3 is the one to watch. `training` crawls (GPTBot, ClaudeBot) say
// nothing about whether we get cited; a live conversation-time fetch
// (ChatGPT-User, Claude-User, Perplexity-User) means the page is being pulled
// into a real answer right now, and it moves weeks before a citation rate does.
function logPageview(request, resp, url, env) {
  try {
    if (request.method !== 'GET' || !env.PAGEVIEWS || resp.status !== 200) return;
    if (!(resp.headers.get('content-type') || '').includes('text/html')) return;
    const path = (url.pathname.replace(/\/+$/, '') || '/').slice(0, 96);
    const ua = (request.headers.get('user-agent') || '');
    const c = classifyCrawler(ua);
    // Our own auditor crawls this corpus as a side effect of measuring it.
    // Counting it would inflate exactly the numbers it exists to report.
    if (c.isSelf) return;
    env.PAGEVIEWS.writeDataPoint({
      indexes: [path],
      blobs: [
        path,
        (request.headers.get('referer') || '').slice(0, 200),
        '',
        c.client,
        ua.slice(0, 200),
        c.purpose,
        c.operator,
      ],
      doubles: [1, c.isBot ? 1 : 0, c.purpose === 'user-agent' ? 1 : 0],
    });
  } catch (_) { /* analytics must never break a response */ }
}

export default {
  async fetch(request, env, ctx) {
    const response = await handleWithCache(request, env, ctx, () => handleFetch(request, env, ctx));
    const resp = withSecurityHeaders(response);
    logPageview(request, resp, new URL(request.url), env);
    return resp;
  }
};
