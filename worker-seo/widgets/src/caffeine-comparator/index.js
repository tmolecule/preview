/**
 * Caffeine comparator (interactive widget).
 *
 * Mount:  <div id="tm-caffeine-comparator"></div>
 *         (intended for /learn/caffeine-comparator, /learn/is-rooibos-caffeine-free,
 *          /learn/l-theanine-and-caffeine-in-tea — and embeddable on other sites.)
 *
 * Pick a drink + cups/day → caffeine mg per cup (with range), the daily total,
 * how it compares to coffee, and a bar chart of every drink. Purely factual
 * caffeine figures; no health-outcome claims. See model.js.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';
import { DRINKS, DEFAULTS, compute, COFFEE_AVG } from './model.js';

const SHOP = 'https://tmolecule.com';

function freshState() {
  return { ...DEFAULTS };
}

class Comparator {
  constructor(root) {
    this.root = root;
    this.state = freshState();
  }

  set(key, value) {
    const v = key === 'cupsPerDay' ? Number(value) : value;
    this.state = { ...this.state, [key]: v };
    this.render();
  }

  drinkSelect() {
    const sel = el(
      'select',
      { class: 'cc-select', 'aria-label': 'Choose a drink' },
      DRINKS.map((d) => el('option', { value: d.key }, d.label))
    );
    sel.value = this.state.drink;
    sel.addEventListener('change', (e) => this.set('drink', e.target.value));
    return sel;
  }

  cupsSlider() {
    const out = el('output', { class: 'cc-slider-val' }, String(this.state.cupsPerDay));
    const input = el('input', {
      type: 'range',
      min: '1',
      max: '6',
      step: '1',
      value: String(this.state.cupsPerDay),
      'aria-label': 'Cups per day',
    });
    input.addEventListener('input', (e) => {
      out.textContent = e.target.value;
      this.set('cupsPerDay', e.target.value);
    });
    return el('div', { class: 'cc-slider' }, [
      el('div', { class: 'cc-slider-head' }, [el('span', {}, 'Cups per day'), out]),
      input,
    ]);
  }

  bars(selKey) {
    return el(
      'div',
      { class: 'cc-bars' },
      DRINKS.map((d) => {
        const pct = d.avg <= 0 ? 1.5 : Math.max((d.avg / COFFEE_AVG) * 100, 4);
        const active = d.key === selKey;
        return el('div', { class: `cc-bar-row${active ? ' active' : ''}` }, [
          el('span', { class: 'cc-bar-label' }, d.label),
          el('span', { class: 'cc-bar-track' }, [
            el('span', { class: 'cc-bar-fill', style: `width:${pct}%` }),
          ]),
          el('span', { class: 'cc-bar-mg' }, d.free ? '0' : String(d.avg)),
        ]);
      })
    );
  }

  render() {
    const r = compute(this.state);
    const wrap = el('div', { class: 'tm' });

    wrap.appendChild(el('h2', {}, 'How much caffeine is in your tea?'));
    wrap.appendChild(
      el('p', { class: 'sub' }, 'Compare common teas and coffee — by the cup, and across your day.')
    );

    wrap.appendChild(
      el('div', { class: 'cc-controls' }, [
        el('label', { class: 'cc-field' }, [
          el('span', { class: 'cc-field-label' }, 'Your drink'),
          this.drinkSelect(),
        ]),
        this.cupsSlider(),
      ])
    );

    const head = el('div', { class: `cc-result${r.free ? ' free' : ''}` });
    if (r.free) {
      head.appendChild(el('div', { class: 'cc-big' }, ['0', el('span', {}, ' mg')]));
      head.appendChild(
        el('div', { class: 'cc-cap' }, `${r.drink.label} is naturally caffeine-free — none per cup, none across the day.`)
      );
    } else {
      head.appendChild(el('div', { class: 'cc-big' }, [String(r.perCupAvg), el('span', {}, ' mg/cup')]));
      head.appendChild(
        el('div', { class: 'cc-cap' }, `typically ${r.perCupLow}–${r.perCupHigh} mg · about ${r.vsCoffeePct}% of a cup of coffee`)
      );
      head.appendChild(
        el(
          'div',
          { class: 'cc-daily' },
          `${r.dailyAvg} mg/day at ${r.cupsPerDay} cup${r.cupsPerDay > 1 ? 's' : ''} (${r.dailyLow}–${r.dailyHigh} mg) · ~${r.pctOfDailyRef}% of the 400 mg reference`
        )
      );
    }
    wrap.appendChild(head);

    wrap.appendChild(el('div', { class: 'cc-bars-head' }, 'Caffeine per cup, compared'));
    wrap.appendChild(this.bars(this.state.drink));

    wrap.appendChild(
      el('div', { class: 'cc-cta' }, [
        el('a', { class: 'cc-cta-link', href: `${SHOP}/learn/is-rooibos-caffeine-free` }, 'Want zero caffeine? →'),
        el('a', { class: 'cc-cta-link', href: `${SHOP}/learn/l-theanine-and-caffeine-in-tea` }, 'Why tea’s caffeine feels different →'),
      ])
    );

    wrap.appendChild(
      el(
        'p',
        { class: 'tm-note' },
        'Representative figures per ~8 oz cup; brewing strength, leaf grade and steep time all change the real number, so each is a range. The ~400 mg/day figure is a general reference the U.S. FDA has cited for healthy adults, not a recommendation. This is general information, not medical or dietary advice.'
      )
    );

    this.root.replaceChildren(wrap);
  }
}

export function mount(selector = '#tm-caffeine-comparator') {
  mountPoints(selector).forEach((host) => {
    const root = mountShadow(host, brand + '\n' + css);
    new Comparator(root).render();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
