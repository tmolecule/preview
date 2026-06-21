/**
 * Shadow-DOM mounting helpers. Every widget renders inside a shadow root so the
 * Shopify theme's CSS can't reach in and ours can't leak out. Ported verbatim
 * from the WhollyKaw widget kit.
 */

/**
 * Attach a shadow root to `host`, inject the widget's inlined CSS, and return a
 * dedicated CONTAINER element to render into.
 *
 * The container matters: callers re-render with container.replaceChildren(...).
 * If we returned the shadow root itself, that call would also wipe the injected
 * <style> (it's a child of the root), leaving the widget unstyled. Keeping the
 * style as a sibling of the container protects it across re-renders.
 *
 * @param {HTMLElement} host  the mount node (e.g. <div id="tm-brew-guide">)
 * @param {string} css        CSS string (imported via `./styles.css?inline`)
 * @returns {HTMLElement}     container to render into
 */
export function mountShadow(host, css) {
  const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  const container = document.createElement('div');
  shadow.appendChild(container);
  return container;
}

/** Tiny tagged-template-free element builder to avoid innerHTML on user data. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Find every mount point for a widget on the page (supports multiple). */
export function mountPoints(selector) {
  return Array.from(document.querySelectorAll(selector));
}
