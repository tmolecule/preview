/**
 * #1 — Tea Finder Quiz (Typeform style: one question per screen, pill choices,
 * letter-key selection, animated transitions, back navigation). Ported from the
 * WhollyKaw scent-finder, simplified to a self-contained two-product router.
 *
 * Mount:  <div id="tm-tea-finder"></div>  (intended for /learn/tea-finder)
 *
 * Data:   inline PRODUCTS catalog below — every fact (composition, vegan status,
 *         blurb) is taken verbatim from the live PDP, so nothing is invented and
 *         there's no network dependency. A /learn/tea-finder.json endpoint can
 *         override this later (see SCOPE.md) but is not required.
 *
 * COMPLIANCE: matches are flavor / occasion / dietary preference only. No medical,
 * immunity, or outcome claim. Result blurbs are verbatim PDP composition copy.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { QUESTIONS } from './questions.js';

const SHOP = 'https://tmolecule.com';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Verbatim from the live product pages — do not embellish.
const PRODUCTS = {
  'spice-rush': {
    name: 'Spice Rush Collagen Black Tea',
    handle: '/products/spice-rush-collagen-black-tea',
    learn: '/learn/best-collagen-tea',
    learnLabel: 'collagen tea formats, ranked',
    blurb:
      'Black tea, hydrolyzed collagen peptides, and warming chai spices in one milled scoop — built for your morning ritual.',
  },
  immunitea: {
    name: 'ImmuniTea Defense Tea',
    handle: '/products/immunitea-defense-tea',
    learn: '/learn/best-adaptogen-tea',
    learnLabel: 'adaptogen ingredients, by the research',
    blurb:
      'Black tea built on four standardized adaptogens — turmeric, gooseberry, postbiotics, terminalia bellerica. Real doses, no powdered flavorings.',
  },
};

class Finder {
  constructor(root) {
    this.root = root;
    this.answers = {}; // questionId -> option index
    this.step = 0;
    this._onKey = this._onKey.bind(this);
  }

  start() {
    this.answers = {};
    this.show(0);
  }

  show(step) {
    this.step = step;
    const q = QUESTIONS[step];
    const wrap = el('div', { class: 'tm' });
    const card = el('div', { class: 'q-card' });

    const bar = el('span', { style: `width:${(step / QUESTIONS.length) * 100}%` });
    card.appendChild(el('div', { class: 'q-progress' }, bar));
    card.appendChild(el('div', { class: 'q-num' }, `Question ${step + 1} of ${QUESTIONS.length}`));
    card.appendChild(el('p', { class: 'q-prompt' }, q.prompt));
    if (q.note) card.appendChild(el('p', { class: 'q-note' }, q.note));

    const opts = el('div', { class: 'q-options' });
    q.options.forEach((o, i) => {
      const selected = this.answers[q.id] === i;
      const pill = el('button', { class: `q-option${selected ? ' selected' : ''}`, type: 'button' }, [
        el('span', { class: 'kbd' }, LETTERS[i]),
        el('span', { class: 'label' }, o.label),
        el('span', { class: 'tick' }, selected ? '✓' : ''),
      ]);
      pill.addEventListener('click', () => this.select(i));
      opts.appendChild(pill);
    });
    card.appendChild(opts);

    const foot = el('div', { class: 'q-foot' });
    if (step > 0) {
      const back = el('button', { class: 'q-back', type: 'button' }, '← Back');
      back.addEventListener('click', () => this.show(step - 1));
      foot.appendChild(back);
    }
    foot.appendChild(
      el('span', { class: 'q-hint' }, ['Press ', el('kbd', {}, 'A'), '–', el('kbd', {}, LETTERS[q.options.length - 1]), ' or tap'])
    );
    card.appendChild(foot);

    wrap.appendChild(card);
    this.root.replaceChildren(wrap);

    window.removeEventListener('keydown', this._onKey);
    window.addEventListener('keydown', this._onKey);
  }

  _onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const q = QUESTIONS[this.step];
    if (!q) return;
    let idx = -1;
    const k = e.key.toUpperCase();
    if (LETTERS.includes(k)) idx = LETTERS.indexOf(k);
    else if (/^[1-9]$/.test(e.key)) idx = Number(e.key) - 1;
    else if (e.key === 'Backspace' && this.step > 0) {
      e.preventDefault();
      this.show(this.step - 1);
      return;
    }
    if (idx >= 0 && idx < q.options.length) {
      e.preventDefault();
      this.select(idx);
    }
  }

  select(i) {
    const q = QUESTIONS[this.step];
    this.answers = { ...this.answers, [q.id]: i };
    if (this.step + 1 < QUESTIONS.length) this.show(this.step + 1);
    else this.finish();
  }

  /** Tally answer scores; return product keys ranked best-first (flagship wins ties). */
  rank() {
    const tally = { 'spice-rush': 0, immunitea: 0 };
    QUESTIONS.forEach((q) => {
      const idx = this.answers[q.id];
      if (idx == null) return;
      const score = q.options[idx].score || {};
      for (const [key, pts] of Object.entries(score)) tally[key] = (tally[key] || 0) + pts;
    });
    // Stable: spice-rush listed first, so an exact tie defaults to the flagship.
    return ['spice-rush', 'immunitea'].sort((a, b) => tally[b] - tally[a]);
  }

  finish() {
    window.removeEventListener('keydown', this._onKey);
    const ranked = this.rank();
    const top = PRODUCTS[ranked[0]];
    const alt = PRODUCTS[ranked[1]];

    const wrap = el('div', { class: 'tm' });
    wrap.appendChild(el('h2', {}, 'Your match'));
    wrap.appendChild(el('p', { class: 'sub' }, 'Based on flavor, routine and dietary preference.'));

    wrap.appendChild(
      el('div', { class: 'result-card' }, [
        el('div', { class: 'result-name' }, top.name),
        el('p', { class: 'result-blurb' }, top.blurb),
        el('div', { class: 'result-actions' }, [
          el('a', { class: 'tm-btn', href: `${SHOP}${top.handle}` }, 'Shop this tea →'),
          el('a', { class: 'result-link', href: `${SHOP}${top.learn}` }, `Read: ${top.learnLabel}`),
        ]),
      ])
    );

    wrap.appendChild(
      el('div', { class: 'result-alt' }, [
        'Also worth a look: ',
        el('a', { href: `${SHOP}${alt.handle}` }, alt.name),
      ])
    );

    wrap.appendChild(
      el(
        'p',
        { class: 'tm-note' },
        'Matches are based on taste, routine and dietary preference — not health needs. This is general information, not medical or dietary advice; statements have not been evaluated by the FDA.'
      )
    );

    const over = el('button', { class: 'tm-btn ghost back', type: 'button' }, '↺ Start over');
    over.addEventListener('click', () => this.start());
    wrap.appendChild(over);

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-tea-finder') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new Finder(root).start();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
