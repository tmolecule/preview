/**
 * Password-gated R2-backed deck serving.
 *
 * GET /decks/<slug>
 *   Reads <slug>.html from the R2 DECKS bucket and serves it.
 *   Gated by HTTP Basic Auth — username is ignored, password must
 *   match env.DECK_PASSWORD (timing-safe comparison).
 *
 * Hardened against:
 *   - Path traversal (slug regex restricts to [a-z0-9-]).
 *   - Edge caching of authenticated bytes (cache-control: private, no-store).
 *   - Iframe embedding (X-Frame-Options: DENY).
 */

const REALM = 'TMolecule Decks';

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

export async function handleDeck(request, env, path) {
  if (!checkAuth(request, env)) return challenge();

  const slug = path.replace(/^\/decks\//, '').replace(/\/$/, '');
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const obj = await env.DECKS.get(`${slug}.html`);
  if (!obj) {
    return new Response('Deck not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

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
