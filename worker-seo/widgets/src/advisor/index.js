/**
 * TMolecule Tea Advisor — chat widget (front-end for POST /learn/advisor).
 *
 * Mount:  <div id="tm-advisor"></div>
 *         <script defer src="https://tmolecule.com/learn/widgets/advisor.js"></script>
 *
 * A lightweight chat UI: sends the conversation to the RAG advisor endpoint and
 * renders the reply plus catalog-validated product cards. No health claims — the
 * server enforces compliance; this is just the UI.
 */
import brand from '../shared/brand.css?inline';
import css from './styles.css?inline';
import { mountShadow, el, mountPoints } from '../shared/dom.js';

const SHOP = 'https://tmolecule.com';
const ENDPOINT = `${SHOP}/learn/advisor`;
const GREETING = "Hi, I'm the TMolecule product guide. Tell me what you're after (a warming spiced blend, collagen, or a real cardamom note for any drink) and I'll point you to the right product.";
const SUGGESTIONS = [
  'A warming spiced blend with collagen',
  'Add cardamom flavor to my coffee',
  'What makes Spice Rush different?',
];
// First-order welcome code shown inline + delivered by the existing Shopify/SMS
// welcome automation. Static code (RITUAL10 = 10% off first order).
const CODE = 'RITUAL10';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class Advisor {
  constructor(root, cfg = {}) {
    this.root = root;
    this.cfg = cfg;                   // { title, greeting, variant } from the mount element
    this.messages = [];               // {role, content} sent to the API
    this.turns = [{ role: 'assistant', content: cfg.greeting || GREETING, products: [] }];
    this.loading = false;
    this.subscribed = false;      // email captured this session
    this.subscribing = false;     // POST in flight
    this.captureEmail = '';       // preserved across re-render on error
    this.captureErr = '';
    this.render();
  }

  async send(text) {
    const content = String(text || '').trim();
    if (!content || this.loading) return;
    this.turns.push({ role: 'user', content });
    this.messages.push({ role: 'user', content });
    this.loading = true;
    this.render();

    let reply = "Sorry — I couldn't reach the advisor. Please try again in a moment.";
    let products = [];
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: this.messages.slice(-12), variant: this.cfg.variant || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        reply = data.reply;
        products = Array.isArray(data.products) ? data.products : [];
      } else if (res.status === 429) {
        reply = "You're sending messages a bit fast — give it a moment and try again.";
      } else if (data.error) {
        reply = "The advisor is briefly unavailable — please try again in a moment.";
      }
    } catch {
      /* keep default error reply */
    }

    this.turns.push({ role: 'assistant', content: reply, products });
    this.messages.push({ role: 'assistant', content: reply });
    this.loading = false;
    this.render();
  }

  /**
   * Email capture -> Shopify's native customer (newsletter) form, the SAME
   * mechanism the site popup uses, tagged `ask-ayurveda` for segmentation. This
   * lands the contact in Shopify email + marketing consent and triggers the
   * existing welcome automation that delivers the RITUAL10 code. Fire-and-forget
   * (no-cors): we validate the email client-side and show the code inline, so the
   * offer reaches the visitor regardless of the automation. COMPLIANCE: marketing
   * opt-in only — no health/efficacy claims.
   */
  async subscribe(email, hpFilled) {
    if (this.subscribing || this.subscribed) return;
    this.captureEmail = String(email || '').trim();
    if (hpFilled) { this.subscribed = true; this.render(); return; } // honeypot: silent success
    if (!EMAIL_RE.test(this.captureEmail)) {
      this.captureErr = 'Please enter a valid email.';
      this.render();
      return;
    }
    this.subscribing = true;
    this.captureErr = '';
    this.render();
    try {
      const body = new URLSearchParams();
      body.set('form_type', 'customer');
      body.set('utf8', '✓');
      body.set('contact[email]', this.captureEmail);
      body.set('contact[tags]', 'newsletter,ask-ayurveda');
      body.set('contact[accepts_marketing]', '1');
      await fetch(`${SHOP}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        mode: 'no-cors',
        credentials: 'omit',
      });
      this.subscribed = true;
    } catch {
      this.captureErr = 'Something went wrong — please try again.';
    }
    this.subscribing = false;
    this.render();
  }

  /** The capture bar (or its success state). Null until the advisor has answered. */
  captureEl() {
    if (this.subscribed) {
      return el('div', { class: 'adv-cap adv-cap--done' }, [
        el('div', { class: 'adv-cap__done-title' }, "You're in. Here's 10% off your first order:"),
        el('div', { class: 'adv-cap__code' }, CODE),
        el('div', { class: 'adv-cap__fine' }, `Use ${CODE} at checkout. Check your inbox for the details.`),
      ]);
    }
    // Only after the advisor has given a real answer (greeting + >=1 reply).
    if (this.turns.filter((t) => t.role === 'assistant').length < 2) return null;

    const cap = el('div', { class: 'adv-cap' });
    cap.appendChild(el('div', { class: 'adv-cap__lead' }, [
      el('strong', {}, 'Save your picks and get 10% off.'),
      el('span', {}, ' Join our list for your first-order code, seasonal blends and rituals.'),
    ]));
    const hp = el('input', { type: 'text', name: 'company', class: 'adv-cap__hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    const input = el('input', {
      type: 'email', class: 'adv-cap__input', placeholder: 'you@email.com',
      'aria-label': 'Email address', autocomplete: 'email', value: this.captureEmail || '',
    });
    const btn = el('button', { type: 'submit', class: 'adv-cap__btn' }, this.subscribing ? 'Sending…' : 'Get 10% off');
    btn.disabled = this.subscribing;
    const form = el('form', {
      class: 'adv-cap__form',
      onSubmit: (ev) => { ev.preventDefault(); this.subscribe(input.value, hp.value); },
    }, [hp, input, btn]);
    cap.appendChild(form);
    if (this.captureErr) cap.appendChild(el('p', { class: 'adv-cap__err', role: 'status' }, this.captureErr));
    return cap;
  }

  productCard(p) {
    const media = p.image
      ? el('img', { class: 'adv-card__img', src: p.image, alt: p.title || '', loading: 'lazy' })
      : el('div', { class: 'adv-card__img adv-card__img--ph' });
    return el('a', { class: 'adv-card', href: p.url || `${SHOP}/products/${p.handle}` }, [
      media,
      el('div', { class: 'adv-card__body' }, [
        el('div', { class: 'adv-card__title' }, p.title || p.handle),
        el('div', { class: 'adv-card__foot' }, [
          p.price ? el('span', { class: 'adv-card__price' }, `$${p.price}`) : null,
          el('span', { class: 'adv-card__cta' }, 'Shop ›'),
        ]),
      ]),
    ]);
  }

  turnEl(t) {
    // Stack the text bubble and any product cards vertically (cards BELOW the text),
    // not side-by-side — otherwise a tall answer + short card leaves dead space.
    const parts = [el('div', { class: 'adv-bubble' }, t.content)];
    if (t.role === 'assistant' && t.products && t.products.length) {
      parts.push(el('div', { class: 'adv-cards' }, t.products.map((p) => this.productCard(p))));
    }
    return el('div', { class: `adv-msg adv-msg--${t.role}` }, [
      el('div', { class: 'adv-stack' }, parts),
    ]);
  }

  render() {
    const wrap = el('div', { class: 'tm adv' });
    wrap.appendChild(el('div', { class: 'adv-head' }, [
      el('h2', {}, this.cfg.title || 'Ask the tea advisor'),
      el('p', { class: 'sub' }, 'Grounded in Ayurveda and modern science.'),
    ]));

    const log = el('div', { class: 'adv-log' });
    this.turns.forEach((t) => log.appendChild(this.turnEl(t)));
    if (this.loading) {
      log.appendChild(el('div', { class: 'adv-msg adv-msg--assistant' }, [
        el('div', { class: 'adv-bubble adv-bubble--typing' }, [
          el('span', { class: 'adv-dot' }), el('span', { class: 'adv-dot' }), el('span', { class: 'adv-dot' }),
        ]),
      ]));
    }
    wrap.appendChild(log);

    // suggestion chips (only before the first user turn)
    if (!this.messages.some((m) => m.role === 'user')) {
      wrap.appendChild(el('div', { class: 'adv-chips' }, SUGGESTIONS.map((s) =>
        el('button', { class: 'adv-chip', type: 'button', onClick: () => this.send(s) }, s))));
    }

    // Email capture — appears once the advisor has answered; never before value.
    const cap = this.captureEl();
    if (cap) wrap.appendChild(cap);

    const input = el('input', {
      class: 'adv-input', type: 'text', placeholder: 'Ask me about our products.',
      'aria-label': 'Ask the tea advisor', maxlength: '400',
    });
    input.disabled = this.loading;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this.send(input.value); input.value = ''; } });
    const btn = el('button', { class: 'adv-send', type: 'button', 'aria-label': 'Send' }, 'Send');
    btn.disabled = this.loading;
    btn.addEventListener('click', () => { this.send(input.value); input.value = ''; });

    wrap.appendChild(el('form', { class: 'adv-form', onSubmit: (e) => e.preventDefault() }, [input, btn]));
    wrap.appendChild(el('p', { class: 'tm-note' },
      'General information about our teas, not medical or dietary advice. For health questions, consult a professional.'));

    this.root.replaceChildren(wrap);
    // keep the log scrolled to the latest
    const l = this.root.querySelector('.adv-log');
    if (l) l.scrollTop = l.scrollHeight;
    // autofocus after a send
    if (this.messages.length && !this.loading) { const i = this.root.querySelector('.adv-input'); if (i) i.focus(); }
  }
}

export function mount(selector = '#tm-advisor') {
  mountPoints(selector).forEach((host) => {
    if (host.dataset.tmMounted) return; // idempotent — safe if the header opens it lazily
    host.dataset.tmMounted = '1';
    const root = mountShadow(host, brand + '\n' + css);
    new Advisor(root, {
      title: host.dataset.title,
      greeting: host.dataset.greeting,
      variant: host.dataset.variant,
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', () => mount());
}
