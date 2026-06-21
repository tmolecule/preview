/**
 * Shopify AJAX Cart helpers. Public, keyless. These only work when the widget
 * runs ON the TMolecule storefront (same-origin /cart/*). On the worker-hosted
 * /learn pages, addBundle() instead returns a permalink to /cart/<id>:<qty>.
 *
 * Ported from the WhollyKaw widget kit, retargeted to tmolecule.com.
 * (The brew-guide widget does not add to cart; this is here for tea-finder /
 * routine-builder, which do.)
 */

const SHOP_ORIGIN = 'https://tmolecule.com';

const onShopify =
  typeof location !== 'undefined' && /(^|\.)tmolecule\.com$/.test(location.hostname) &&
  !location.pathname.startsWith('/learn');

/**
 * @param {Array<{id:number, quantity:number}>} items  variant-id line items
 * @param {Record<string,string>} [attributes]         cart attributes for tracking
 */
export async function addBundle(items, attributes = {}) {
  const clean = items.filter((i) => i && i.id);
  if (!clean.length) throw new Error('no items to add');

  if (!onShopify) {
    // Standalone/worker context: hand back a cart permalink instead of POSTing.
    const pairs = clean.map((i) => `${i.id}:${i.quantity || 1}`).join(',');
    return { permalink: `${SHOP_ORIGIN}/cart/${pairs}` };
  }

  const addRes = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: clean }),
  });
  if (!addRes.ok) throw new Error(`cart/add ${addRes.status}`);

  if (Object.keys(attributes).length) {
    await fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes }),
    });
  }
  return addRes.json();
}

export function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '';
}
