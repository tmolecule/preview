/**
 * #2 — Brew Guide / Chai Concentrate Calculator (interactive widget).
 *
 * Mount:  <div id="tm-brew-guide"></div>
 *         (intended for /learn/chai-concentrate-recipe, /learn/masala-chai-recipe,
 *          and the Spice Rush PDP)
 *
 * Scales a TMolecule spiced black-tea brew by servings / format / strength and
 * shows temperature, steep time, water:milk:ice amounts, a step-by-step method,
 * and an optional from-scratch masala spice list.
 *
 * COMPLIANCE: preparation guidance only (temps, times, ratios, quantities), which
 * no-medical-claims explicitly permits. The lone health-adjacent line is the
 * collagen/heat NOTE below — it is research-framed ("some research examines…"),
 * not an outcome claim, and carries the food/supplement disclaimer. Product names
 * are verbatim; no benefit is claimed.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { DEFAULTS, compute, steps } from './model.js';

const SHOP = 'https://tmolecule.com';
const PRODUCT = '/products/spice-rush-collagen-black-tea';

const FORMATS = [
  { key: 'hot', label: 'Hot' },
  { key: 'iced', label: 'Iced' },
  { key: 'latte', label: 'Latte' },
  { key: 'concentrate', label: 'Concentrate' },
];
const STRENGTHS = [
  { key: 'light', label: 'Light' },
  { key: 'standard', label: 'Standard' },
  { key: 'strong', label: 'Strong' },
];

function freshState() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

class Brew {
  constructor(root) {
    this.root = root;
    this.state = freshState();
  }

  set(key, value) {
    this.state = { ...this.state, [key]: value };
    this.render();
  }

  /** A row of mutually-exclusive choice pills bound to one state key. */
  pills(stateKey, options) {
    return el(
      'div',
      { class: 'brew-pills', role: 'group' },
      options.map((o) => {
        const active = this.state[stateKey] === o.key;
        const b = el(
          'button',
          { class: `brew-pill${active ? ' active' : ''}`, type: 'button', 'aria-pressed': String(active) },
          o.label
        );
        b.addEventListener('click', () => this.set(stateKey, o.key));
        return b;
      })
    );
  }

  /** Servings range slider with a live readout. */
  servingsSlider() {
    const out = el('output', { class: 'brew-slider-val' }, String(this.state.servings));
    const input = el('input', {
      type: 'range',
      min: '1',
      max: '8',
      step: '1',
      value: String(this.state.servings),
      'aria-label': 'Servings',
    });
    input.addEventListener('input', (e) => {
      out.textContent = e.target.value;
      this.set('servings', Number(e.target.value));
    });
    return el('div', { class: 'brew-slider' }, [
      el('div', { class: 'brew-slider-head' }, [el('span', {}, 'Servings'), out]),
      input,
    ]);
  }

  statTile(label, value, unit) {
    return el('div', { class: 'brew-stat' }, [
      el('div', { class: 'brew-stat-val' }, [String(value), unit ? el('span', {}, unit) : null]),
      el('div', { class: 'brew-stat-label' }, label),
    ]);
  }

  render() {
    const r = compute(this.state);
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'Brew guide'));
    wrap.appendChild(
      el('p', { class: 'sub' }, 'Dial in your spiced black tea — hot, iced, as a latte, or a batch concentrate.')
    );

    // Controls.
    wrap.appendChild(this.servingsSlider());
    wrap.appendChild(
      el('div', { class: 'brew-control' }, [el('div', { class: 'brew-control-label' }, 'Format'), this.pills('format', FORMATS)])
    );
    wrap.appendChild(
      el('div', { class: 'brew-control' }, [el('div', { class: 'brew-control-label' }, 'Strength'), this.pills('strength', STRENGTHS)])
    );

    // From-scratch toggle.
    const cb = el('input', { type: 'checkbox' });
    cb.checked = this.state.fromScratch;
    cb.addEventListener('change', (e) => this.set('fromScratch', e.target.checked));
    wrap.appendChild(
      el('label', { class: 'brew-toggle' }, [cb, el('span', {}, 'Add a from-scratch masala spice blend')])
    );

    // Result tiles.
    const tiles = [
      this.statTile('Sachets', r.sachets, ''),
      this.statTile('Water', r.waterOz, ' oz'),
      r.isLatte ? this.statTile('Milk', r.milkOz, ' oz') : null,
      r.isIced ? this.statTile('Ice', r.iceOz, ' oz') : null,
      this.statTile('Temp', r.tempF, '°F'),
      this.statTile('Steep', r.steepMin, r.steepMin === 1 ? ' min' : ' min'),
    ].filter(Boolean);
    wrap.appendChild(el('div', { class: 'brew-stats' }, tiles));

    // Method.
    wrap.appendChild(el('div', { class: 'brew-method-title' }, `${r.formatLabel} · ${r.servings} ${r.servings === 1 ? 'serving' : 'servings'}`));
    wrap.appendChild(el('ol', { class: 'brew-method' }, steps(r).map((s) => el('li', {}, s))));

    // Optional spice list.
    if (r.spices.length) {
      wrap.appendChild(el('div', { class: 'brew-spice-title' }, 'Whole spices'));
      wrap.appendChild(
        el(
          'ul',
          { class: 'brew-spice' },
          r.spices.map((sp) => el('li', {}, `${sp.qty}${sp.unit ? ' ' + sp.unit : ''} — ${sp.name}`))
        )
      );
    }

    // Research-framed collagen/heat note (compliance-safe; no outcome claim).
    wrap.appendChild(
      el('div', { class: 'brew-research' }, [
        el('strong', {}, 'Heat & collagen: '),
        `some research examines whether prolonged boiling affects collagen peptides, so steeping just off the boil (≈${r.tempF}°F/${r.tempC}°C) rather than hard-boiling is a common precaution. This describes published research, not a health claim.`,
      ])
    );

    // CTA.
    wrap.appendChild(
      el('div', { class: 'brew-cta' }, [
        el('a', { class: 'tm-btn', href: `${SHOP}${PRODUCT}` }, 'Get Spice Rush Collagen Black Tea →'),
        el('a', { class: 'brew-cta-link', href: `${SHOP}/learn/masala-chai-recipe` }, 'or the full masala chai recipe'),
      ])
    );

    wrap.appendChild(
      el(
        'p',
        { class: 'tm-note' },
        'Preparation guidance only — adjust to taste. This is general information, not medical or dietary advice. These statements have not been evaluated by the FDA; this product is not intended to diagnose, treat, cure, or prevent any disease.'
      )
    );

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-brew-guide') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new Brew(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
