/**
 * Collagen-per-day calculator (interactive widget).
 *
 * Mount:  <div id="tm-collagen-calculator"></div>
 *         (host page /learn/collagen-calculator; embeddable in collagen /learn pages.)
 *
 * Cups/day of Spice Rush → grams of collagen protein per day + week, and where
 * that sits vs the range published research commonly uses. Content figures only,
 * NO health-outcome claims. See model.js.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { compute, DEFAULTS, SPICE_RUSH, STUDIED_RANGE_G } from './model.js';

const SHOP = 'https://tmolecule.com';
const PDP = `${SHOP}/products/spice-rush-collagen-black-tea`;

class CollagenCalc {
  constructor(root) {
    this.root = root;
    this.state = { ...DEFAULTS };
  }

  set(key, value) {
    this.state = { ...this.state, [key]: Number(value) };
    this.render();
  }

  cupsSlider() {
    const out = el('output', { class: 'cg-slider-val' }, String(this.state.cupsPerDay));
    const input = el('input', {
      type: 'range', min: '1', max: '4', step: '1',
      value: String(this.state.cupsPerDay), 'aria-label': 'Cups of Spice Rush per day',
    });
    input.addEventListener('input', (e) => {
      out.textContent = e.target.value;
      this.set('cupsPerDay', e.target.value);
    });
    return el('div', { class: 'cg-slider' }, [
      el('div', { class: 'cg-slider-head' }, [
        el('span', {}, 'Cups of Spice Rush per day'), out,
      ]),
      input,
    ]);
  }

  scale(r) {
    // A 0–15 g track with the studied band shaded and a marker at the daily amount.
    const lowPct = (STUDIED_RANGE_G.low / STUDIED_RANGE_G.high) * 100;
    return el('div', { class: 'cg-scale' }, [
      el('div', { class: 'cg-scale-track' }, [
        el('span', { class: 'cg-scale-band', style: `left:${lowPct}%;right:0` }),
        el('span', { class: 'cg-scale-marker', style: `left:${r.pctOfScale}%` }),
      ]),
      el('div', { class: 'cg-scale-ticks' }, [
        el('span', {}, '0 g'),
        el('span', {}, `${STUDIED_RANGE_G.low} g`),
        el('span', {}, `${STUDIED_RANGE_G.high} g`),
      ]),
      el('div', { class: 'cg-scale-cap' },
        `Shaded band = the ${STUDIED_RANGE_G.low}–${STUDIED_RANGE_G.high} g/day range research commonly studies.`),
    ]);
  }

  render() {
    const r = compute(this.state);
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'How much collagen are you actually getting?'));
    wrap.appendChild(el('p', { class: 'sub' },
      `Each cup of Spice Rush has ${SPICE_RUSH.collagenPerCupG} g of hydrolyzed collagen. See your daily total.`));

    wrap.appendChild(el('div', { class: 'cg-controls' }, [this.cupsSlider()]));

    const head = el('div', { class: 'cg-result' });
    head.appendChild(el('div', { class: 'cg-big' }, [String(r.dailyG), el('span', {}, ' g/day')]));
    head.appendChild(el('div', { class: 'cg-cap' },
      `${r.cupsPerDay} cup${r.cupsPerDay > 1 ? 's' : ''} × ${r.perCupG} g · ${r.weeklyG} g over a week`));
    wrap.appendChild(head);

    wrap.appendChild(this.scale(r));

    wrap.appendChild(el('div', { class: 'cg-cta' }, [
      el('a', { class: 'tm-btn', href: PDP }, 'Shop Spice Rush →'),
      el('a', { class: 'tm-btn ghost', href: `${SHOP}/learn/collagen-tea-vs-collagen-powder` }, 'Tea vs powder →'),
    ]));

    wrap.appendChild(el('p', { class: 'tm-note' },
      'This shows the amount of collagen protein you would consume — a content figure, not a health outcome. '
      + `The ${STUDIED_RANGE_G.low}–${STUDIED_RANGE_G.high} g/day band describes what research commonly studies, not a recommendation or a promised result. `
      + 'General information, not medical or dietary advice.'));

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-collagen-calculator') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new CollagenCalc(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
