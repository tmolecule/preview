/**
 * #3 — Cost-per-cup calculator (interactive widget).
 *
 * Mount:  <div id="tm-cost-per-cup"></div>
 *         (intended for /learn/cost-per-cup, /learn/collagen-tea-vs-collagen-powder,
 *          /learn/does-collagen-tea-actually-work, and the Spice Rush PDP)
 *
 * Compares a TMolecule collagen tea against a daily café latte or a DIY
 * coffee-plus-collagen-powder morning: live $/cup, monthly + annual totals, and
 * the savings vs the chosen baseline. Two headline controls (cups/day, baseline)
 * plus an "Adjust assumptions" panel exposing every editable figure.
 *
 * COMPLIANCE: purely an arithmetic price comparison. It compares the COST of a
 * morning drink — no nutritional-equivalence claim vs powder, no medical or
 * guaranteed-savings claim. Every number is editable. See model.js.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { DEFAULTS, compute } from './model.js';

const SHOP = 'https://tmolecule.com';
const PRODUCT = '/products/spice-rush-collagen-black-tea';

const BASELINES = [
  { key: 'cafe', label: 'Café latte' },
  { key: 'diy', label: 'Coffee + collagen powder' },
];

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  return Math.abs(v) >= 10
    ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

function cents(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '$0.00';
}

function freshState() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

class Calc {
  constructor(root) {
    this.root = root;
    this.state = freshState();
    this.showAssumptions = false;
  }

  setNum(path, value) {
    const num = Number(value);
    const v = Number.isFinite(num) ? num : 0;
    const parts = path.split('.');
    if (parts.length === 1) {
      this.state = { ...this.state, [parts[0]]: v };
    } else {
      const [group, key] = parts;
      this.state = { ...this.state, [group]: { ...this.state[group], [key]: v } };
    }
    this.render();
  }

  setVal(key, value) {
    this.state = { ...this.state, [key]: value };
    this.render();
  }

  field(label, path, value, { step = 1, min = 0, prefix = '', suffix = '' } = {}) {
    const input = el('input', {
      type: 'number',
      value: String(value),
      step: String(step),
      min: String(min),
      inputmode: 'decimal',
      'aria-label': label,
    });
    input.addEventListener('input', (e) => this.setNum(path, e.target.value));
    return el('label', { class: 'cpc-field' }, [
      el('span', { class: 'cpc-field-label' }, label),
      el('span', { class: 'cpc-input-wrap' }, [
        prefix ? el('span', { class: 'cpc-affix' }, prefix) : null,
        input,
        suffix ? el('span', { class: 'cpc-affix suffix' }, suffix) : null,
      ]),
    ]);
  }

  slider(label, path, value, min, max, suffix) {
    const out = el('output', { class: 'cpc-slider-val' }, `${value}${suffix}`);
    const input = el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: '1',
      value: String(value),
      'aria-label': label,
    });
    input.addEventListener('input', (e) => {
      out.textContent = `${e.target.value}${suffix}`;
      this.setNum(path, e.target.value);
    });
    return el('div', { class: 'cpc-slider' }, [
      el('div', { class: 'cpc-slider-head' }, [el('span', {}, label), out]),
      input,
    ]);
  }

  baselinePills() {
    return el(
      'div',
      { class: 'cpc-pills', role: 'group' },
      BASELINES.map((o) => {
        const active = this.state.baseline === o.key;
        const b = el(
          'button',
          { class: `cpc-pill${active ? ' active' : ''}`, type: 'button', 'aria-pressed': String(active) },
          o.label
        );
        b.addEventListener('click', () => this.setVal('baseline', o.key));
        return b;
      })
    );
  }

  render() {
    const r = compute(this.state);
    const cheaper = r.savingsAnnual > 0;
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'Cost-per-cup calculator'));
    wrap.appendChild(
      el('p', { class: 'sub' }, 'See what your morning cup really costs — collagen tea vs the café or a DIY coffee-and-powder routine.')
    );

    // Headline controls.
    wrap.appendChild(
      el('div', { class: 'cpc-controls' }, [
        this.slider('Cups per day', 'cupsPerDay', this.state.cupsPerDay, 1, 5, ''),
        el('div', { class: 'cpc-baseline' }, [
          el('div', { class: 'cpc-control-label' }, 'Compare against'),
          this.baselinePills(),
        ]),
      ])
    );

    // Result — two methods side by side.
    wrap.appendChild(
      el('div', { class: 'cpc-result' }, [
        el('div', { class: 'cpc-method highlight' }, [
          el('div', { class: 'cpc-method-name' }, 'TMolecule collagen tea'),
          el('div', { class: 'cpc-percup' }, [cents(r.tmPerCup), el('span', {}, '/cup')]),
          el('div', { class: 'cpc-total' }, `${money(r.tmAnnual)}/yr · ${money(r.tmMonthly)}/mo`),
        ]),
        el('div', { class: 'cpc-method' }, [
          el('div', { class: 'cpc-method-name' }, r.baselineLabel),
          el('div', { class: 'cpc-percup' }, [cents(r.basePerCup), el('span', {}, '/cup')]),
          el('div', { class: 'cpc-total' }, `${money(r.baseAnnual)}/yr · ${money(r.baseMonthly)}/mo`),
        ]),
      ])
    );

    // Verdict.
    const verdict = el('div', { class: `cpc-verdict ${cheaper ? 'save' : 'nosave'}` });
    if (cheaper) {
      verdict.appendChild(el('div', { class: 'cpc-save-amt' }, money(r.savingsAnnual)));
      verdict.appendChild(
        el('div', { class: 'cpc-save-cap' }, `saved a year vs ${r.baselineLabel.toLowerCase()} (${money(r.savingsMonthly)}/month)`)
      );
    } else {
      verdict.appendChild(
        el('div', { class: 'cpc-save-cap' }, 'With these numbers the baseline comes out cheaper. Adjust the assumptions to match your own prices.')
      );
    }
    wrap.appendChild(verdict);

    // Assumptions.
    const toggle = el(
      'button',
      { class: 'cpc-toggle', type: 'button', 'aria-expanded': String(this.showAssumptions) },
      this.showAssumptions ? 'Hide assumptions ▲' : 'Adjust assumptions ▼'
    );
    toggle.addEventListener('click', () => {
      this.showAssumptions = !this.showAssumptions;
      this.render();
    });
    wrap.appendChild(toggle);

    if (this.showAssumptions) {
      const t = this.state.tm;
      const c = this.state.cafe;
      const d = this.state.diy;
      wrap.appendChild(
        el('div', { class: 'cpc-assume' }, [
          el('fieldset', { class: 'cpc-col' }, [
            el('legend', {}, 'TMolecule tea'),
            this.field('Price per box', 'tm.boxPrice', t.boxPrice, { step: 1, prefix: '$' }),
            this.field('Cups (sachets) per box', 'tm.cupsPerBox', t.cupsPerBox, { step: 1, min: 1 }),
          ]),
          this.state.baseline === 'cafe'
            ? el('fieldset', { class: 'cpc-col' }, [
                el('legend', {}, 'Café latte'),
                this.field('Price per latte', 'cafe.lattePrice', c.lattePrice, { step: 0.25, prefix: '$' }),
              ])
            : el('fieldset', { class: 'cpc-col' }, [
                el('legend', {}, 'Coffee + collagen powder'),
                this.field('Home coffee per cup', 'diy.coffeePerCup', d.coffeePerCup, { step: 0.05, prefix: '$' }),
                this.field('Collagen powder tub', 'diy.powderTubPrice', d.powderTubPrice, { step: 1, prefix: '$' }),
                this.field('Scoops per tub', 'diy.servingsPerTub', d.servingsPerTub, { step: 1, min: 1 }),
              ]),
        ])
      );
      const reset = el('button', { class: 'tm-btn ghost cpc-reset', type: 'button' }, '↺ Reset to defaults');
      reset.addEventListener('click', () => {
        this.state = { ...freshState(), baseline: this.state.baseline };
        this.render();
      });
      wrap.appendChild(reset);
    }

    // CTA.
    if (cheaper) {
      wrap.appendChild(
        el('div', { class: 'cpc-cta' }, [
          el('a', { class: 'tm-btn', href: `${SHOP}${PRODUCT}` }, 'Get Spice Rush Collagen Black Tea →'),
          el('a', { class: 'cpc-cta-link', href: `${SHOP}/learn/collagen-tea-vs-collagen-powder` }, 'tea vs powder — the full breakdown'),
        ])
      );
    }

    wrap.appendChild(
      el(
        'p',
        { class: 'tm-note' },
        'Estimates only — every figure above is editable, and prices vary. This compares the cost of a morning drink; it is not a nutritional-equivalence, medical, or guaranteed-savings claim, and is not financial or dietary advice.'
      )
    );

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-cost-per-cup') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new Calc(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
