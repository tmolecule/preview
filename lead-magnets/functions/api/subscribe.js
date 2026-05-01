/**
 * POST /api/subscribe
 * Forwards email + result snapshot to Brevo, triggers DOI confirmation.
 * The {{ doubleoptin }} merge tag in the Brevo HTML template renders the
 * confirmation link (per reference_brevo_doi_merge_tag.md).
 *
 * @typedef {Object} SubscribeInput
 * @property {string} email
 * @property {Record<string, unknown>} [result_snapshot]
 * @property {string} [source]
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: SubscribeInput } | { ok: false, error: string }}
 */
function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const b = /** @type {Record<string, unknown>} */ (body);
  if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email)) return { ok: false, error: 'Invalid email' };
  return {
    ok: true,
    value: {
      email: b.email.trim().toLowerCase(),
      result_snapshot: typeof b.result_snapshot === 'object' && b.result_snapshot !== null
        ? /** @type {Record<string, unknown>} */ (b.result_snapshot)
        : undefined,
      source: typeof b.source === 'string' ? b.source : 'collagen-calculator'
    }
  };
}

/**
 * @param {{ request: Request, env: Record<string, string> }} context
 */
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.BREVO_API_KEY || !env.BREVO_LIST_ID_COLLAGEN_CALC || !env.BREVO_DOI_TEMPLATE_ID) {
    return jsonResponse({ success: false, error: 'Server not configured' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const v = validate(body);
  if (!v.ok) return jsonResponse({ success: false, error: v.error }, 400);

  const brevoResp = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify({
      email: v.value.email,
      includeListIds: [Number(env.BREVO_LIST_ID_COLLAGEN_CALC)],
      templateId: Number(env.BREVO_DOI_TEMPLATE_ID),
      redirectionUrl: env.BREVO_REDIRECT_URL,
      attributes: {
        SOURCE: v.value.source,
        CALC_SCORE: v.value.result_snapshot?.score ?? null,
        CALC_GRADE: v.value.result_snapshot?.grade ?? null
      }
    })
  });

  if (!brevoResp.ok && brevoResp.status !== 204) {
    const text = await brevoResp.text();
    return jsonResponse({ success: false, error: 'Brevo error', detail: text.slice(0, 500) }, 502);
  }

  return jsonResponse({ success: true, data: { status: 'confirmation_sent' } }, 200);
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
