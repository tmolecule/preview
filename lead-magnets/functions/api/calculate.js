/**
 * POST /api/calculate
 * Stateless bioavailability scorer. No PII stored; logic is deterministic
 * so the same answers can be re-rendered from the email-gated PDF later.
 *
 * @typedef {Object} CalcInput
 * @property {'peptides'|'gelatin'|'undenatured_type_ii'} collagen_type
 * @property {number} daily_dose_g
 * @property {'morning'|'afternoon'|'evening'} time_of_day
 * @property {'coffee'|'tea_black'|'tea_green'|'water'|'juice'|'none'} current_beverage
 * @property {boolean} vitamin_c_source
 *
 * @typedef {Object} CalcOutput
 * @property {number} score
 * @property {'A'|'B'|'C'|'D'} grade
 * @property {string} pairing_summary
 * @property {Array<string>} tips
 * @property {string} funnel_product_url
 */

const ALLOWED_COLLAGEN = new Set(['peptides', 'gelatin', 'undenatured_type_ii']);
const ALLOWED_TIME = new Set(['morning', 'afternoon', 'evening']);
const ALLOWED_BEVERAGE = new Set(['coffee', 'tea_black', 'tea_green', 'water', 'juice', 'none']);

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: CalcInput } | { ok: false, error: string }}
 */
function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const b = /** @type {Record<string, unknown>} */ (body);
  if (!ALLOWED_COLLAGEN.has(/** @type {string} */ (b.collagen_type))) return { ok: false, error: 'collagen_type invalid' };
  if (typeof b.daily_dose_g !== 'number' || b.daily_dose_g < 1 || b.daily_dose_g > 100) return { ok: false, error: 'daily_dose_g out of range' };
  if (!ALLOWED_TIME.has(/** @type {string} */ (b.time_of_day))) return { ok: false, error: 'time_of_day invalid' };
  if (!ALLOWED_BEVERAGE.has(/** @type {string} */ (b.current_beverage))) return { ok: false, error: 'current_beverage invalid' };
  if (typeof b.vitamin_c_source !== 'boolean') return { ok: false, error: 'vitamin_c_source invalid' };
  return {
    ok: true,
    value: {
      collagen_type: /** @type {CalcInput['collagen_type']} */ (b.collagen_type),
      daily_dose_g: b.daily_dose_g,
      time_of_day: /** @type {CalcInput['time_of_day']} */ (b.time_of_day),
      current_beverage: /** @type {CalcInput['current_beverage']} */ (b.current_beverage),
      vitamin_c_source: b.vitamin_c_source
    }
  };
}

/**
 * @param {CalcInput} input
 * @returns {CalcOutput}
 */
function score(input) {
  let s = 50;
  const tips = [];

  if (input.vitamin_c_source) s += 20;
  else tips.push('Add a vitamin C source (citrus, hibiscus, or rose hip) - it is a required cofactor for collagen synthesis.');

  if (input.daily_dose_g >= 10 && input.daily_dose_g <= 20) s += 10;
  else if (input.daily_dose_g < 5) {
    s -= 15;
    tips.push('Most clinical skin studies use 10g+ per day. You are below the threshold most studies measure.');
  } else if (input.daily_dose_g > 25) {
    s -= 5;
    tips.push('Above 25g/day shows diminishing returns. Consider splitting into morning + evening doses.');
  }

  if (input.current_beverage === 'coffee') {
    s -= 10;
    tips.push('Coffee tannins bind collagen peptides. Wait 30+ minutes between coffee and your collagen dose.');
  } else if (input.current_beverage === 'tea_black' || input.current_beverage === 'tea_green') {
    s -= 5;
    tips.push('Tea tannins can mildly bind protein. Letting the brew cool slightly before adding collagen may improve mixing and taste.');
  }

  if (input.time_of_day === 'morning') s += 10;
  else if (input.time_of_day === 'evening') s += 5;

  s = Math.max(0, Math.min(100, s));
  const grade = s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D';

  const pairing = input.time_of_day === 'evening'
    ? 'Rooibos with rose hip + 5g collagen, added once the brew has cooled slightly.'
    : 'Black tea with cardamom + cinnamon, 10g collagen + 1/4 lemon for vitamin C.';

  return {
    score: s,
    grade,
    pairing_summary: pairing,
    tips: tips.slice(0, 3),
    funnel_product_url: 'https://tmolecule.com/products/spice-rush-collagen-black-tea'
  };
}

/**
 * @param {{ request: Request }} context
 */
export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const v = validate(body);
  if (!v.ok) return jsonResponse({ success: false, error: v.error }, 400);

  const result = score(v.value);
  return jsonResponse({ success: true, data: result }, 200);
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
