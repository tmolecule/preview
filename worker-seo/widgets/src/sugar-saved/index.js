/**
 * Sugar-saved / café-swap calculator (interactive widget).
 *
 * Mount:  <div id="tm-sugar-saved"></div>  (host page /learn/sugar-saved)
 *
 * Café chais per week → grams of sugar, calories from sugar, and dollars you'd
 * avoid over a year by swapping to unsweetened Spice Rush. Arithmetic only,
 * no health claims. See model.js.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { compute, DEFAULTS, CAFE } from './model.js';

const SHOP = 'https://tmolecule.com';
const PDP = `${SHOP}/products/spice-rush-collagen-black-tea`;

class SugarSaved {
  constructor(root) {
    this.root = root;
    this.state = { ...DEFAULTS };
  }

  set(key, value) {
    this.state = { ...this.state, [key]: Number(value) };
    this.render();
  }

  slider() {
    const out = el('output', { class: 'ss-slider-val' }, String(this.state.drinksPerWeek));
    const input = el('input', {
      type: 'range', min: '1', max: '14', step: '1',
      value: String(this.state.drinksPerWeek), 'aria-label': 'Café chai lattes per week',
    });
    input.addEventListener('input', (e) => {
      out.textContent = e.target.value;
      this.set('drinksPerWeek', e.target.value);
    });
    return el('div', { class: 'ss-slider' }, [
      el('div', { class: 'ss-slider-head' }, [
        el('span', {}, 'Café chai lattes per week'), out,
      ]),
      input,
    ]);
  }

  stat(value, unit, label) {
    return el('div', { class: 'ss-stat' }, [
      el('div', { class: 'ss-stat-num' }, [value, el('span', {}, ' ' + unit)]),
      el('div', { class: 'ss-stat-label' }, label),
    ]);
  }

  render() {
    const r = compute(this.state);
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'How much sugar could you skip?'));
    wrap.appendChild(el('p', { class: 'sub' },
      'Swap café chai lattes for unsweetened Spice Rush and see a year of the difference.'));

    wrap.appendChild(el('div', { class: 'ss-controls' }, [this.slider()]));

    wrap.appendChild(el('div', { class: 'ss-grid' }, [
      this.stat(r.sugarSavedLbs.toLocaleString(), 'lb', 'of sugar a year'),
      this.stat(r.sugarSavedTsp.toLocaleString(), 'tsp', 'sugar avoided'),
      this.stat(r.calSaved.toLocaleString(), 'cal', 'from sugar, skipped'),
      this.stat('$' + r.moneySaved.toLocaleString(), '', 'kept in your pocket'),
    ]));

    wrap.appendChild(el('p', { class: 'ss-basis' },
      `Based on ${r.drinksPerYear} café chais a year at ~${r.perDrinkSugar} g sugar each `
      + `(${r.sugarLow}–${r.sugarHigh} g typical) vs Spice Rush at 0 g added sugar.`));

    wrap.appendChild(el('div', { class: 'ss-cta' }, [
      el('a', { class: 'tm-btn', href: PDP }, 'Shop Spice Rush →'),
      el('a', { class: 'tm-btn ghost', href: `${SHOP}/learn/how-to-brew-chai-without-sugar` }, 'Brew chai without sugar →'),
    ]));

    wrap.appendChild(el('p', { class: 'tm-note' },
      'Café figures are representative and vary by chain, size and recipe. This is a sugar-and-cost comparison, '
      + 'not a health claim. General information, not medical or dietary advice.'));

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-sugar-saved') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new SugarSaved(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
