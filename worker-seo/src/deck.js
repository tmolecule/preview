/**
 * Password-gated R2-backed deck serving + Analytics Engine tracking.
 *
 * GET /decks/<slug>
 *   Reads <slug>.html from R2 DECKS, serves with hardened headers.
 *   Logs a 'deck_view' event to Analytics Engine on auth success.
 *
 * POST /decks/<slug>/track?slide=N&dwell=ms
 *   Logs a 'slide_view' event with the slide number and dwell time
 *   (ms spent on the previous slide). Auth-gated. Returns 204.
 *
 * All endpoints gated by HTTP Basic Auth — username is ignored,
 * password must match env.DECK_PASSWORD (timing-safe comparison).
 *
 * Hardened against:
 *   - Path traversal (slug regex).
 *   - Edge caching of authenticated bytes (cache-control: private, no-store).
 *   - Iframe embedding (X-Frame-Options: DENY).
 */

const REALM = 'TMolecule Decks';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

function challenge(message) {
  return new Response(message || 'Authentication required', {
    status: 401,
    headers: {
      'www-authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function checkAuth(request, env) {
  const expected = env.DECK_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const password = decoded.slice(idx + 1);
  return safeEqual(password, expected);
}

/**
 * djb2 hash, base36-encoded. Not cryptographic — just a stable
 * compact identifier for User-Agent strings so we can estimate
 * unique visitors without storing the raw UA.
 */
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Lightweight UA bucketing. Returns coarse device/os/browser categories
 * suitable for funnel analysis. iPad on iPadOS 13+ reports as macOS in
 * Safari ("Request Desktop Site"), so iPads can leak into desktop —
 * tradeoff worth accepting for UA-only detection without client hints.
 */
function parseUA(ua) {
  const u = (ua || '').toLowerCase();
  if (!u) return { device: 'other', os: 'other', browser: 'other' };

  let device = 'desktop';
  if (/ipad|tablet|kindle|playbook/.test(u)) device = 'tablet';
  else if (/mobile|android|iphone|ipod|opera mini|iemobile|webos/.test(u)) device = 'mobile';

  let os = 'other';
  if (/ipad|iphone|ipod/.test(u)) os = 'ios';
  else if (/android/.test(u)) os = 'android';
  else if (/mac os x|macintosh/.test(u)) os = 'macos';
  else if (/windows/.test(u)) os = 'windows';
  else if (/linux/.test(u)) os = 'linux';
  else if (/cros\b/.test(u)) os = 'chromeos';

  let browser = 'other';
  if (/edg\//.test(u)) browser = 'edge';
  else if (/opr\/|opera/.test(u)) browser = 'opera';
  else if (/firefox|fxios/.test(u)) browser = 'firefox';
  else if (/chrome\/|crios/.test(u)) browser = 'chrome';
  else if (/safari/.test(u)) browser = 'safari';

  return { device, os, browser };
}

function trackEvent(env, request, eventName, slug, slideNum, dwellMs) {
  if (!env.DECK_ANALYTICS) return;
  try {
    const cf = request.cf || {};
    const ua = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';
    const { device, os, browser } = parseUA(ua);
    env.DECK_ANALYTICS.writeDataPoint({
      blobs: [
        eventName,                     // blob1: 'deck_view' | 'slide_view'
        slug,                          // blob2: deck slug
        cf.country || '',              // blob3: ISO country code
        cf.colo || '',                 // blob4: CF data center
        shortHash(ua),                 // blob5: anonymized UA hash
        (referrer || '').slice(0, 200),// blob6: referrer (truncated)
        device,                        // blob7: mobile | tablet | desktop | other
        os,                            // blob8: ios | android | macos | windows | linux | chromeos | other
        browser,                       // blob9: chrome | safari | firefox | edge | opera | other
        (cf.city || '').slice(0, 80),  // blob10: city
        (cf.region || '').slice(0, 80),// blob11: region/state
        (cf.timezone || '').slice(0, 60) // blob12: IANA timezone
      ],
      doubles: [
        slideNum || 0,                 // double1: slide number (0 for deck_view)
        dwellMs || 0                   // double2: dwell on previous slide (ms)
      ],
      indexes: [slug]                  // index1: slug (for fast lookups)
    });
  } catch (err) {
    // Never let analytics failures break the response
  }
}

import { handleStats } from './stats.js';

export async function handleDeck(request, env, path) {
  if (!checkAuth(request, env)) return challenge();

  // /decks/<slug>/stats — parchment-themed analytics dashboard
  const statsMatch = path.match(/^\/decks\/([a-z0-9][a-z0-9-]{0,80})\/stats\/?$/);
  if (statsMatch) {
    return handleStats(request, env, statsMatch[1]);
  }

  // /decks/<slug>/track — analytics endpoint for slide_view events
  const trackMatch = path.match(/^\/decks\/([a-z0-9][a-z0-9-]{0,80})\/track\/?$/);
  if (trackMatch) {
    const slug = trackMatch[1];
    const url = new URL(request.url);
    const slideNum = Math.max(0, Math.min(999, parseInt(url.searchParams.get('slide') || '0', 10) || 0));
    const dwellMs = Math.max(0, Math.min(86400000, parseInt(url.searchParams.get('dwell') || '0', 10) || 0));
    trackEvent(env, request, 'slide_view', slug, slideNum, dwellMs);
    return new Response('', {
      status: 204,
      headers: { 'cache-control': 'no-store' }
    });
  }

  // /decks/<slug> — serve HTML
  const slug = path.replace(/^\/decks\//, '').replace(/\/$/, '');
  if (!slug || !SLUG_RE.test(slug)) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const obj = await env.DECKS.get(`${slug}.html`);
  if (!obj) {
    return new Response('Deck not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  trackEvent(env, request, 'deck_view', slug, 1, 0);

  return new Response(obj.body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}
