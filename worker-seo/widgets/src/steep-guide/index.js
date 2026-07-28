/**
 * Steep Guide (interactive widget).
 *
 * Mount:  <div id="tm-steep-guide"></div>
 *         (intended for /learn/matcha-to-water-ratio, /learn/green-tea-steeping-time,
 *          and any other tea-type page — embeddable on other sites.)
 *
 * Pick a tea type → see its water temperature, steep time and leaf:water
 * ratio, plus a short sourced note wherever authorities genuinely disagree.
 * This is a reference lookup, not a calculator — no arithmetic on user input.
 * Purely factual brewing parameters; no health-outcome claims. See model.js
 * for every figure's source.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { TEAS, DEFAULTS, teaByKey } from './model.js';

const SHOP = 'https://tmolecule.com';
const PRODUCT = '/products/spice-rush-collagen-black-tea';

function freshState() {
  return { ...DEFAULTS };
}

class SteepGuide {
  constructor(root) {
    this.root = root;
    this.state = freshState();
  }

  set(key, value) {
    this.state = { ...this.state, [key]: value };
    this.render();
  }

  teaSelect() {
    const sel = el(
      'select',
      { class: 'sg-select', 'aria-label': 'Choose a tea type' },
      TEAS.map((t) => el('option', { value: t.key }, t.label))
    );
    sel.value = this.state.tea;
    sel.addEventListener('change', (e) => this.set('tea', e.target.value));
    return sel;
  }

  statTile(label, value) {
    return el('div', { class: 'sg-stat' }, [
      el('div', { class: 'sg-stat-val' }, value),
      el('div', { class: 'sg-stat-label' }, label),
    ]);
  }

  render() {
    const t = teaByKey(this.state.tea);
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'How to steep your tea'));
    wrap.appendChild(
      el('p', { class: 'sub' }, 'Pick a tea type for its water temperature, steep time and leaf-to-water ratio.')
    );

    wrap.appendChild(
      el('div', { class: 'sg-field' }, [
        el('span', { class: 'sg-field-label' }, 'Tea type'),
        this.teaSelect(),
      ])
    );

    wrap.appendChild(
      el('div', { class: 'sg-stats' }, [
        this.statTile('Water temp', `${t.tempF} · ${t.tempC}`),
        this.statTile('Steep time', t.time),
        this.statTile('Leaf : water', t.ratio),
      ])
    );

    if (t.note) {
      wrap.appendChild(
        el('div', { class: 'sg-note' }, [el('strong', {}, 'Sourced note: '), t.note])
      );
    }

    wrap.appendChild(
      el('div', { class: 'sg-cta' }, [
        el('a', { class: 'tm-btn', href: `${SHOP}${PRODUCT}` }, 'Shop Spice Rush Black Tea →'),
      ])
    );

    wrap.appendChild(
      el(
        'p',
        { class: 'tm-note' },
        'Preparation guidance only, drawn from published tea-industry and tea-house sources — adjust to taste. This is general information, not medical or dietary advice.'
      )
    );

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-steep-guide') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new SteepGuide(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
