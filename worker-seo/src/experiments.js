/**
 * Experiment / A/B variant selection for the AI-SEO Worker.
 *
 * # Storage layout in LEARN_PAGES KV
 *
 *   <slug>                 — default (canonical) article JSON
 *   <slug>:<variant_name>  — variant article JSON (same schema as default)
 *   <slug>:experiment      — experiment config JSON (see schema below)
 *
 * # Experiment config schema
 *
 * {
 *   "start_at": "2026-05-22T00:00:00Z",   // optional; rule inactive before this
 *   "end_at":   "2026-05-30T23:59:59Z",   // optional; rule inactive after this
 *   "rules": [
 *     { "country": "US", "variant": "veteran" }
 *   ]
 * }
 *
 * # Decision order (first match wins)
 *
 *   1. Bots / crawlers / preview clients → always 'default' (avoids cloaking)
 *   2. Sticky cookie tmol_exp_<slug>=<variant> → that variant (returning visitor)
 *   3. No experiment config in KV → 'default'
 *   4. Time window not active → 'default'
 *   5. First matching rule (currently only `country`) → rule.variant
 *   6. Otherwise → 'default'
 */

const BOT_UA = /bot|crawl|spider|preview|fetch|monitor|axios|curl|wget|httpclient/i;

export const VARIANT_DEFAULT = 'default';
export const COOKIE_PREFIX = 'tmol_exp_';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Return the variant name to serve for `slug` given `request`.
 * Always returns a non-empty string (defaults to VARIANT_DEFAULT).
 */
export async function pickVariant(slug, env, request) {
  // 1. Bots and crawlers always see canonical (default) — avoids cloaking penalty
  const ua = request.headers.get('user-agent') || '';
  if (BOT_UA.test(ua)) return VARIANT_DEFAULT;

  // 2. Sticky cookie — returning visitor in this experiment sees the same variant
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieName = COOKIE_PREFIX + slug;
  const stickyMatch = cookieHeader.match(
    new RegExp('(?:^|; *)' + escapeRegExp(cookieName) + '=([^;]+)')
  );
  if (stickyMatch) {
    const v = decodeURIComponent(stickyMatch[1]).trim();
    if (/^[a-z0-9][a-z0-9_-]{0,40}$/i.test(v)) return v;
  }

  // 3. No experiment config in KV → no experiment, default
  const cfgRaw = await env.LEARN_PAGES.get(slug + ':experiment');
  if (!cfgRaw) return VARIANT_DEFAULT;

  let cfg;
  try { cfg = JSON.parse(cfgRaw); } catch { return VARIANT_DEFAULT; }

  // 4. Time window check
  const now = Date.now();
  if (cfg.start_at && now < Date.parse(cfg.start_at)) return VARIANT_DEFAULT;
  if (cfg.end_at   && now > Date.parse(cfg.end_at))   return VARIANT_DEFAULT;

  // 5. First matching rule wins
  const country = (request.headers.get('cf-ipcountry') || '').toUpperCase();
  for (const rule of (cfg.rules || [])) {
    if (rule.country && rule.country.toUpperCase() === country) {
      return safeVariantName(rule.variant);
    }
  }

  // 6. No rule matched → default
  return VARIANT_DEFAULT;
}

/**
 * Build a Set-Cookie header value to make the variant assignment sticky for
 * future requests. Returns null when no cookie should be set (default variant
 * or sticky cookie already present).
 */
export function buildStickyCookie(slug, variant, request) {
  if (!variant || variant === VARIANT_DEFAULT) return null;
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieName = COOKIE_PREFIX + slug;
  if (cookieHeader.includes(cookieName + '=')) return null;
  return `${cookieName}=${encodeURIComponent(variant)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function safeVariantName(v) {
  if (typeof v !== 'string') return VARIANT_DEFAULT;
  const trimmed = v.trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,40}$/i.test(trimmed)) return VARIANT_DEFAULT;
  return trimmed;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
