/**
 * POST /api/unsubscribe
 * Removes the contact from all lists and globally blocks future sends.
 * Idempotent: safe to call multiple times.
 *
 * @typedef {Object} UnsubInput
 * @property {string} email
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ request: Request, env: Record<string, string> }} context
 */
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ success: false, error: 'Server not configured' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ success: false, error: 'Invalid email' }, 400);
  }

  // Globally blacklist so they don't get future sends from any list
  const resp = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify({ emailBlacklisted: true })
  });

  // 204 success | 404 = contact never existed (treat as success — they're not on the list anyway)
  if (resp.status !== 204 && resp.status !== 404) {
    const text = await resp.text();
    return jsonResponse({ success: false, error: 'Brevo error', detail: text.slice(0, 400) }, 502);
  }

  return jsonResponse({ success: true, data: { status: 'unsubscribed' } }, 200);
}

/**
 * @param {unknown} body
 * @param {number} status
 */
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
