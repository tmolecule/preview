/**
 * Chai spice-blend builder (interactive widget).
 *
 * Mount:  <div id="tm-spice-blend-builder"></div>  (host page /learn/spice-blend-builder)
 *
 * Four sliders (cardamom, ginger, cinnamon, clove) → a live flavor description and
 * how close it is to Spice Rush's balanced blend. Pure flavor — no health claims.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';

const SHOP = 'https://tmolecule.com';
const PDP = `${SHOP}/products/spice-rush-collagen-black-tea`;

// Each spice: key, label, and a flavor descriptor. Levels 0–3 (off/mild/medium/bold).
const SPICES = [
  { key: 'cardamom', label: 'Cardamom', note: 'floral, aromatic, citrus-cool' },
  { key: 'ginger', label: 'Ginger', note: 'warming, bright, gently spicy' },
  { key: 'cinnamon', label: 'Cinnamon', note: 'sweet, woody (Ceylon)' },
  { key: 'clove', label: 'Clove', note: 'deep, resinous, warming' },
];
const LEVELS = ['Off', 'Mild', 'Medium', 'Bold'];
// Spice Rush's actual balance: cardamom + ginger + Ceylon cinnamon forward, clove a whisper.
const SPICE_RUSH_PROFILE = { cardamom: 2, ginger: 2, cinnamon: 2, clove: 1 };
const DEFAULTS = { cardamom: 2, ginger: 2, cinnamon: 1, clove: 1 };

function describe(state) {
  const active = SPICES.filter((s) => state[s.key] > 0).sort((a, b) => state[b.key] - state[a.key]);
  if (!active.length) return 'A plain black tea — add a spice to start building.';
  const lead = active[0];
  const rest = active.slice(1).map((s) => s.label.toLowerCase());
  const total = SPICES.reduce((n, s) => n + state[s.key], 0);
  const strength = total <= 3 ? 'delicate' : total <= 6 ? 'balanced' : 'bold';
  let s = `A ${strength} cup led by ${lead.label.toLowerCase()} — ${lead.note}`;
  if (rest.length) s += `, with ${rest.join(', ')} behind it`;
  return s + '.';
}

function matchPct(state) {
  // 0–3 per spice, 4 spices → max distance 12; convert to a closeness %.
  let dist = 0;
  for (const s of SPICES) dist += Math.abs(state[s.key] - SPICE_RUSH_PROFILE[s.key]);
  return Math.max(0, Math.round((1 - dist / 12) * 100));
}

class SpiceBuilder {
  constructor(root) {
    this.root = root;
    this.state = { ...DEFAULTS };
  }

  set(key, value) {
    this.state = { ...this.state, [key]: Number(value) };
    this.render();
  }

  spiceRow(s) {
    const val = this.state[s.key];
    const badge = el('span', { class: 'sb-level' }, LEVELS[val]);
    const input = el('input', {
      type: 'range', min: '0', max: '3', step: '1', value: String(val),
      'aria-label': `${s.label} level`,
    });
    input.addEventListener('input', (e) => {
      badge.textContent = LEVELS[Number(e.target.value)];
      this.set(s.key, e.target.value);
    });
    return el('div', { class: 'sb-row' }, [
      el('div', { class: 'sb-row-head' }, [
        el('span', { class: 'sb-name' }, s.label), badge,
      ]),
      input,
    ]);
  }

  render() {
    const wrap = el('div', { class: 'tm' });
    wrap.appendChild(el('h2', {}, 'Build your chai spice blend'));
    wrap.appendChild(el('p', { class: 'sub' },
      'Dial in the four classic chai spices and taste the profile in words.'));

    wrap.appendChild(el('div', { class: 'sb-rows' }, SPICES.map((s) => this.spiceRow(s))));

    wrap.appendChild(el('div', { class: 'sb-profile' }, [
      el('div', { class: 'sb-profile-label' }, 'Your blend tastes like'),
      el('div', { class: 'sb-profile-text' }, describe(this.state)),
    ]));

    const pct = matchPct(this.state);
    wrap.appendChild(el('div', { class: 'sb-match' }, [
      el('div', { class: 'sb-match-bar' }, [el('span', { style: `width:${pct}%` })]),
      el('div', { class: 'sb-match-cap' },
        pct >= 80
          ? `That's ${pct}% of the way to Spice Rush — you basically rebuilt our blend.`
          : `${pct}% match to Spice Rush, our balanced everyday blend.`),
    ]));

    wrap.appendChild(el('div', { class: 'sb-cta' }, [
      el('a', { class: 'tm-btn', href: PDP }, 'Skip the measuring — get Spice Rush →'),
      el('a', { class: 'tm-btn ghost', href: `${SHOP}/learn/best-cardamom-for-chai` }, 'Best cardamom for chai →'),
    ]));

    wrap.appendChild(el('p', { class: 'tm-note' },
      'A flavor-building tool. Spice Rush pairs these spices with black tea and collagen, milled to dissolve in one stir.'));

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-spice-blend-builder') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new SpiceBuilder(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
