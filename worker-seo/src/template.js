import {
  PILLARS,
  getPillar,
  intentLabel,
  SAFETY_POPULATIONS,
  SAFETY_STATUS,
  REGULATORY_STATUS
} from './taxonomy.js';
import relatedLinks from './data/related-links.json';
import { WIDGET_VERSION } from './widget-bundles.js';

const NAV_LINKS = [
  { href: '__SHOP__/', label: 'Home' },
  { href: '__SHOP__/collections/all', label: 'Shop' },
  { href: '__LEARN__/', label: 'Learn' },
  { href: '__SHOP__/pages/about', label: 'About' },
  { href: '__SHOP__/pages/contact', label: 'Contact' }
];

const FOOTER_LINKS = {
  quick: [
    { href: '__SHOP__/', label: 'Home' },
    { href: '__SHOP__/collections/all', label: 'Shop' },
    { href: '__LEARN__/', label: 'Learn' },
    { href: '__SHOP__/pages/contact', label: 'Contact Us' }
  ],
  policies: [
    { href: '__SHOP__/policies/privacy-policy', label: 'Privacy Policy' },
    { href: '__SHOP__/policies/terms-of-service', label: 'Terms of Service' },
    { href: '__SHOP__/policies/refund-policy', label: 'Return Policy' },
    { href: '__SHOP__/pages/accessibility', label: 'Accessibility' }
  ]
};

const TOLL_FREE_NUMBER = '866-708-4991';
const TOLL_FREE_DISPLAY = '(866) 708-4991';
const TOLL_FREE_TEL = `+1${TOLL_FREE_NUMBER.replace(/[^\d]/g, '')}`;
const SMS_KEYWORD = 'RITUAL';
const SMS_OFFER = '10% off your first order';

const SOCIAL_LINKS = [
  { href: 'https://facebook.com/GetTMolecule', label: 'Facebook', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.5-1.5h1.6V3.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.7V13h2.6v8h3.2z"/></svg>' },
  { href: 'https://instagram.com/tmolecule.official', label: 'Instagram', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>' },
  { href: 'https://tiktok.com/@tmolecule', label: 'TikTok', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.3 8.6c-1.6 0-3-.6-4-1.6-.7-.7-1.2-1.7-1.4-2.8h-3v11.3c0 1.3-1.1 2.4-2.4 2.4-1.3 0-2.4-1.1-2.4-2.4s1.1-2.4 2.4-2.4c.3 0 .5 0 .8.1v-3c-.3 0-.5-.1-.8-.1-3 0-5.4 2.4-5.4 5.4s2.4 5.4 5.4 5.4 5.4-2.4 5.4-5.4V10c1.1.7 2.4 1.1 3.8 1.1h.7v-2.5h-.1z"/></svg>' },
  { href: 'https://twitter.com/GetTMolecule', label: 'X', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3l-6.6 7.5L22 21h-6.2l-4.8-6.3L5.3 21H2.3l7-8L2 3h6.3l4.4 5.8L17.5 3zm-1 16h1.7L7.6 4.8H5.8L16.5 19z"/></svg>' }
];

/**
 * Rewrite single-segment internal links so they include the mount prefix
 * when the Worker is mounted on a path (e.g., apex /learn/*). On the
 * subdomain (mount === ''), this is a no-op. The slug regex matches the
 * same shape we accept for article slugs, so we don't accidentally rewrite
 * Shopify paths like /cart that the body might reference.
 */
function rewriteMountLinks(html, mount) {
  if (!mount || !html) return html;
  return html.replace(
    /href="\/([a-z0-9][a-z0-9-]{0,80})(\.md)?"/g,
    (_match, slug, ext) => `href="${mount}/${slug}${ext || ''}"`
  );
}

/**
 * Build the breadcrumb (visible HTML + BreadcrumbList schema) for an article,
 * inserting the pillar hub between "Learn" and the page title when the page
 * declares a known pillar. Falls back to the flat Home › Learn › Title chain.
 */
function buildBreadcrumb({ data, title, canonical, origin, env, mount }) {
  const safeTitle = esc(title);
  const pillar = getPillar(data);
  const crumbParts = [
    `<a href="${env.SHOP_ORIGIN}">${esc(env.SITE_NAME)}</a>`,
    `<a href="${mount}/">Learn</a>`
  ];
  const schemaItems = [
    { '@type': 'ListItem', position: 1, name: env.SITE_NAME, item: env.SHOP_ORIGIN },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: `${origin}${mount}/` }
  ];
  if (pillar) {
    crumbParts.push(`<a href="${mount}/${pillar.slug}">${esc(pillar.label)}</a>`);
    schemaItems.push({ '@type': 'ListItem', position: 3, name: pillar.label, item: `${origin}${mount}/${pillar.slug}` });
  }
  crumbParts.push(`<span>${safeTitle}</span>`);
  schemaItems.push({ '@type': 'ListItem', position: schemaItems.length + 1, name: title, item: canonical });

  return {
    crumbsHtml: `<nav class="crumbs">${crumbParts.join(' &rsaquo; ')}</nav>`,
    schema: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: schemaItems }
  };
}

/**
 * "…so what do I drink?" CTA. Every learn page should bridge to a product so
 * education converts. `product_bridge` is an absolute or shop-relative URL.
 */
function renderProductBridge(data, env) {
  const href = data.product_bridge;
  if (!href) return '';
  const toUrl = (u) => (/^https?:\/\//.test(u) ? u : `${env.SHOP_ORIGIN}${u}`);
  const blurb = data.product_bridge_blurb || `Put this into practice with a cup from ${env.SITE_NAME}.`;
  let btns = `<a class="btn" href="${esc(toUrl(href))}">${esc(data.product_bridge_label || 'Shop the blend')} &rsaquo;</a>`;
  // Optional second product — pages that fit two blends (e.g. Spice Rush + the Elixir).
  if (data.product_bridge_2) {
    btns += `<a class="btn" href="${esc(toUrl(data.product_bridge_2))}">${esc(data.product_bridge_2_label || 'Shop the blend')} &rsaquo;</a>`;
  }
  return `<aside class="bridge"><div class="bridge__text"><strong>${esc(blurb)}</strong></div><div class="bridge__btns">${btns}</div></aside>`;
}

/**
 * Related-article links (internal linking spine). `related` is a list of slugs.
 */
function renderRelated(data, mount, slug) {
  // Manual `related` keeps priority; vector top-ups (build-related-links.mjs)
  // fill under-linked pages. Dedupe, preserve manual order first.
  const manual = Array.isArray(data.related) ? data.related.filter(Boolean) : [];
  const seen = new Set(manual);
  const vector = (slug && Array.isArray(relatedLinks[slug]) ? relatedLinks[slug] : [])
    .map(r => r.slug)
    .filter(s => s && !seen.has(s) && (seen.add(s), true));
  const all = [...manual, ...vector];
  if (!all.length) return '';
  const links = all.map(s => {
    const label = s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<li><a href="${mount}/${esc(s)}">${esc(label)}</a></li>`;
  }).join('');
  return `<nav class="related" aria-label="Related guides"><h2>Related guides</h2><ul>${links}</ul></nav>`;
}

/**
 * Population-aware safety table for intent: "safety". Renders one row per
 * canonical population group present in data.safety.populations.
 */
function renderSafetyBlock(data) {
  const safety = data.safety;
  if (!safety || !Array.isArray(safety.populations) || !safety.populations.length) return '';
  const byKey = Object.fromEntries(safety.populations.map(p => [p.group, p]));
  const rows = SAFETY_POPULATIONS
    .filter(pop => byKey[pop.key])
    .map(pop => {
      const row = byKey[pop.key];
      const st = SAFETY_STATUS[row.status] || { label: row.status || '—', tone: 'warn' };
      return `<tr><td>${esc(pop.label)}</td><td><span class="pill pill--${st.tone}">${esc(st.label)}</span></td><td>${esc(row.note || '')}</td></tr>`;
    }).join('');
  if (!rows) return '';
  const summary = safety.summary ? `<p class="safety__summary">${esc(safety.summary)}</p>` : '';
  return `<section class="safety"><h2>Is it safe? By group</h2>${summary}<table><thead><tr><th>Group</th><th>Status</th><th>What to know</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

/**
 * EU vs US regulatory comparison for intent: "eu-status".
 */
function renderRegulatoryBlock(data) {
  const reg = data.regulatory;
  if (!reg || (!reg.eu_status && !reg.us_status)) return '';
  const pill = (status) => {
    const st = REGULATORY_STATUS[status];
    return st ? `<span class="pill pill--${st.tone}">${esc(st.label)}</span>` : '';
  };
  const summary = reg.summary ? `<p class="reg__summary">${esc(reg.summary)}</p>` : '';
  return `<section class="reg"><h2>Regulatory status: EU vs US</h2>${summary}
    <div class="reg__grid">
      <div class="reg__col"><h3>European Union</h3>${pill(reg.eu_status)}${reg.eu_note ? `<p>${esc(reg.eu_note)}</p>` : ''}</div>
      <div class="reg__col"><h3>United States</h3>${pill(reg.us_status)}${reg.us_note ? `<p>${esc(reg.us_note)}</p>` : ''}</div>
    </div></section>`;
}

/**
 * Wellness disclaimer. TMolecule products are ingestible foods, not drugs —
 * safety/regulatory pages MUST carry this top and bottom (FDA + not-medical-advice).
 */
function wellnessDisclaimer(pos) {
  return `<aside class="wellness-disclaimer wellness-disclaimer--${pos}" role="note">
    This article is general educational information about tea and food ingredients — not medical advice, and not intended to diagnose, treat, cure, or prevent any disease. These statements have not been evaluated by the FDA. If you are pregnant, breastfeeding, giving tea to a child, managing a health condition, or taking medication, talk to a qualified healthcare provider before changing your routine.
  </aside>`;
}

function needsDisclaimer(data) {
  return data.intent === 'safety' || data.intent === 'eu-status' || data.disclaimer === true;
}

/**
 * Author object for Article/Recipe JSON-LD. A page may override the global
 * env.AUTHOR_NAME with a richer per-page `author` ({ name, url, jobTitle, sameAs })
 * to attribute an expert byline; otherwise it falls back to the site author.
 */
function buildAuthor(data, env) {
  const a = data && data.author;
  if (a && typeof a === 'object' && a.name) {
    const author = { '@type': 'Person', name: a.name, url: a.url || env.SHOP_ORIGIN };
    if (a.jobTitle) author.jobTitle = a.jobTitle;
    if (Array.isArray(a.sameAs) && a.sameAs.length) author.sameAs = a.sameAs;
    author.worksFor = { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN };
    return author;
  }
  return {
    '@type': 'Person',
    name: env.AUTHOR_NAME || env.SITE_NAME,
    url: env.SHOP_ORIGIN,
    worksFor: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
}

/**
 * Citation object for Article JSON-LD. Honors a per-source `type` — use
 * "ScholarlyArticle" for peer-reviewed / PubMed sources, a stronger AI-extraction
 * signal than the generic CreativeWork — plus optional author and datePublished.
 */
function buildCitation(s) {
  // Auto-detect peer-reviewed sources: a PubMed/PMC URL is a ScholarlyArticle
  // even when the seed didn't set an explicit `type` — a stronger AI-extraction
  // signal than the generic CreativeWork. Explicit `type` still wins.
  const isScholarly = /(?:pubmed|pmc)\.ncbi\.nlm\.nih\.gov/i.test(s.url || '');
  const c = { '@type': s.type || (isScholarly ? 'ScholarlyArticle' : 'CreativeWork'), name: s.title, url: s.url };
  if (s.author) c.author = s.author;
  if (s.datePublished) c.datePublished = s.datePublished;
  if (s.publisher) c.publisher = { '@type': 'Organization', name: s.publisher };
  return c;
}

/**
 * On-page navigation ("On this page") — anchor links to in-body section ids.
 * `on_page_nav` is a list of { anchor, label }; body H2s must carry matching ids.
 */
function renderOnPageNav(data) {
  const nav = Array.isArray(data.on_page_nav)
    ? data.on_page_nav.filter(n => n && n.anchor && n.label)
    : [];
  if (!nav.length) return '';
  const links = nav.map(n => `<li><a href="#${esc(n.anchor)}">${esc(n.label)}</a></li>`).join('');
  return `<nav class="on-page-nav" aria-label="On this page"><h2 class="opn-head">On this page</h2><ul>${links}</ul></nav>`;
}

/**
 * Visible hero image for a recipe/article. The image_url is also used for
 * og:image + schema, but neither renders on-page or carries alt text — this does.
 * Alt comes from the seed's `image_alt`, falling back to the headline.
 */
function renderHero(data) {
  const src = data.image_url;
  if (!src) return '';
  const alt = data.image_alt || data.h1 || data.title || '';
  return `<img class="hero-img" src="${esc(src)}" alt="${esc(alt)}" loading="eager" decoding="async">`;
}

// Interactive tool widgets that an article can embed via a seed `"widget"` field.
// The IIFE self-mounts into the div; it's served at <mount>/widgets/<name>.js.
const WIDGET_EMBEDS = {
  'tea-finder': { id: 'tm-tea-finder', heading: 'Not sure which tea?', blurb: 'Take the four-question finder — flavor, routine and dietary preference, no health questions.' },
  'brew-guide': { id: 'tm-brew-guide', heading: 'Brew it right', blurb: 'Scale temperature, steep time and the water-to-milk ratio to your servings.' },
  'cost-per-cup': { id: 'tm-cost-per-cup', heading: 'What does your cup cost?', blurb: 'Compare it against a café latte or a DIY coffee-and-powder routine — live.' },
  'caffeine-comparator': { id: 'tm-caffeine-comparator', heading: 'How much caffeine is in your tea?', blurb: 'Compare common teas and coffee, by the cup and across your day.' },
  'collagen-calculator': { id: 'tm-collagen-calculator', heading: 'How much collagen are you getting?', blurb: 'Set your cups per day to see the collagen protein per day and week — a content figure, not a health claim.' },
  'sugar-saved': { id: 'tm-sugar-saved', heading: 'How much sugar could you skip?', blurb: 'Swap café chai lattes for unsweetened Spice Rush and see a year of sugar, calories and dollars.' },
  'spice-blend-builder': { id: 'tm-spice-blend-builder', heading: 'Build your chai spice blend', blurb: 'Dial in cardamom, ginger, cinnamon and clove and read your cup\'s flavor profile.' },
  'steep-guide': { id: 'tm-steep-guide', heading: 'How to steep your tea', blurb: 'Pick a tea type for its water temperature, steep time and leaf-to-water ratio, sourced from tea-industry and tea-house guidance.' }
};

/** Inline a tool widget into an article body (no-op for an unknown name). */
function renderWidgetEmbed(name, origin, mount) {
  const w = WIDGET_EMBEDS[name];
  if (!w) return '';
  const src = `${origin}${mount}/widgets/${name}.js?v=${WIDGET_VERSION}`;
  return `
        <section class="widget-embed" style="margin:2.5rem 0;padding-top:1.5rem;border-top:1px solid rgb(var(--color-rule));">
          <div style="font-family:var(--serif);font-weight:600;font-size:1.4rem;line-height:1.2;color:rgb(var(--color-foreground));margin:0 0 .25rem;">${w.heading}</div>
          <p style="font-family:var(--sans);font-size:.95rem;color:rgb(var(--color-mute));margin:0 0 1rem;">${w.blurb}</p>
          <div id="${w.id}"></div>
          <script defer src="${src}"></script>
        </section>`;
}

export function renderArticle(data, slug, origin, env, mount = '') {
  const {
    title,
    h1,
    meta_description = '',
    body_html = '',
    image_url = '',
    published_at = new Date().toISOString(),
    updated_at = new Date().toISOString(),
    faqs = [],
    keywords = []
  } = data;

  // canonical_url overrides the auto-generated worker URL when this page mirrors
  // an existing Shopify post (Worker is the AI-extraction surface, Shopify owns
  // organic SEO + commerce). Worker page does not compete with the canonical.
  const canonical = data.canonical_url || `${origin}${mount}/${slug}`;
  const safeTitle = esc(title);
  const safeDesc = esc(meta_description);
  const sources = Array.isArray(data.sources) ? data.sources.filter(s => s && s.url) : [];
  const heroImage = image_url || env.LOGO_URL;
  const dateStr = formatDate(published_at);
  const readMins = readingTime(body_html);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: h1 || title,
    description: meta_description,
    image: heroImage,
    datePublished: published_at,
    dateModified: updated_at,
    mainEntityOfPage: canonical,
    keywords: keywords.length ? keywords.join(', ') : undefined,
    author: buildAuthor(data, env),
    publisher: {
      '@type': 'Organization',
      name: env.SITE_NAME,
      logo: { '@type': 'ImageObject', url: env.LOGO_URL }
    },
    citation: sources.length ? sources.map(s => buildCitation(s)) : undefined
  };

  const crumb = buildBreadcrumb({ data, title, canonical, origin, env, mount });

  const schemaTags = [
    `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(crumb.schema)}</script>`
  ];

  if (faqs.length) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.faq summary', '.faq-a']
      },
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    };
    schemaTags.push(`<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`);
  }

  // Optional Dataset node: exposes cited figures (e.g. caffeine mg by drink) as
  // machine-readable structured data. Competitor pages publishing the same numbers
  // ship no structured data at all — this is a differentiator for AI-answer and
  // rich-result eligibility. Backward compatible: absent when seed has no `dataset`.
  if (data.dataset) {
    const datasetSchema = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: data.dataset.name,
      description: data.dataset.description,
      variableMeasured: (data.dataset.variableMeasured || []).map(v => ({
        '@type': 'PropertyValue', name: v.name, value: v.value, unitText: v.unitText
      }))
    };
    schemaTags.push(`<script type="application/ld+json">${JSON.stringify(datasetSchema)}</script>`);
  }

  const faqHtml = faqs.length
    ? `<section class="faq"><h2>Frequently asked questions</h2>${faqs.map(f =>
        `<details><summary>${esc(f.q)}</summary><div class="faq-a">${f.a_html || `<p>${esc(f.a)}</p>`}</div></details>`
      ).join('')}</section>`
    : '';

  const sourcesHtml = sources.length
    ? `<section class="sources"><h2>Sources</h2><ol>${sources.map(s =>
        `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.title)}</a>${s.publisher ? ` &middot; <span class="src-pub">${esc(s.publisher)}</span>` : ''}</li>`
      ).join('')}</ol></section>`
    : '';

  const bylineHtml = `<p class="byline">By <span class="author-name">${esc((data.author && data.author.name) || env.AUTHOR_NAME || env.SITE_NAME)}</span> &middot; <time datetime="${esc(published_at)}">${esc(dateStr)}</time> &middot; ${readMins} min read</p>`;

  return baseHtml({
    title: safeTitle,
    description: safeDesc,
    canonical,
    ogImage: heroImage,
    ogType: 'article',
    schemaTags,
    env,
    mount,
    bodyInner: `
      ${crumb.crumbsHtml}
      <article>
        <h1>${esc(h1 || title)}</h1>
        ${meta_description ? `<p class="lede">${safeDesc}</p>` : ''}
        ${renderHero(data)}
        ${bylineHtml}
        <div class="read-progress" aria-live="polite" aria-label="Reading progress" data-total-mins="${readMins}">
          <span class="rp-bar-track"><span class="rp-bar"></span></span>
          <span class="rp-text">${readMins} min left</span>
        </div>
        ${renderOnPageNav(data)}
        ${rewriteMountLinks(body_html, mount)}
        ${data.widget ? renderWidgetEmbed(data.widget, origin, mount) : ''}
        ${renderSafetyBlock(data)}
        ${renderRegulatoryBlock(data)}
        ${renderProductBridge(data, env)}
        ${faqHtml}
        ${renderRelated(data, mount, slug)}
        ${sourcesHtml}
        ${needsDisclaimer(data) ? wellnessDisclaimer('bottom') : ''}
      </article>
    `
  });
}

export function renderRecipe(data, slug, origin, env, mount = '') {
  const {
    title,
    h1,
    meta_description = '',
    body_html = '',
    image_url = '',
    published_at = new Date().toISOString(),
    updated_at = new Date().toISOString(),
    faqs = [],
    keywords = [],
    recipe = {}
  } = data;

  const canonical = data.canonical_url || `${origin}${mount}/${slug}`;
  const safeTitle = esc(title);
  const safeDesc = esc(meta_description);
  const sources = Array.isArray(data.sources) ? data.sources.filter(s => s && s.url) : [];
  const heroImage = image_url || env.LOGO_URL;
  const dateStr = formatDate(published_at);
  const readMins = readingTime(body_html);

  // Recipe schema as primary — eligible for Google's recipe rich result + AI Overview citations.
  // Defined fields only; undefined fields are stripped before serialization.
  const recipeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: h1 || title,
    description: meta_description,
    image: heroImage,
    author: {
      '@type': 'Person',
      name: env.AUTHOR_NAME || env.SITE_NAME,
      url: env.SHOP_ORIGIN
    },
    publisher: {
      '@type': 'Organization',
      name: env.SITE_NAME,
      logo: { '@type': 'ImageObject', url: env.LOGO_URL }
    },
    datePublished: published_at,
    dateModified: updated_at,
    keywords: keywords.length ? keywords.join(', ') : undefined,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    recipeYield: recipe.recipeYield,
    recipeCategory: recipe.recipeCategory,
    recipeCuisine: recipe.recipeCuisine,
    recipeIngredient: recipe.recipeIngredient,
    recipeInstructions: recipe.recipeInstructions
      ? recipe.recipeInstructions.map(step =>
          typeof step === 'string'
            ? { '@type': 'HowToStep', text: step }
            : step
        )
      : undefined
  };
  // Strip undefined fields so the JSON-LD validates cleanly.
  Object.keys(recipeSchema).forEach(k => recipeSchema[k] === undefined && delete recipeSchema[k]);

  const crumb = buildBreadcrumb({ data, title, canonical, origin, env, mount });

  const schemaTags = [
    `<script type="application/ld+json">${JSON.stringify(recipeSchema)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(crumb.schema)}</script>`
  ];

  // FAQPage retained for AI extraction signal (no longer Google rich result on commerce sites,
  // but still parsed by ChatGPT/Claude/Perplexity and Google AI Overview).
  if (faqs.length) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.faq summary', '.faq-a']
      },
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    };
    schemaTags.push(`<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`);
  }

  const faqHtml = faqs.length
    ? `<section class="faq"><h2>Frequently asked questions</h2>${faqs.map(f =>
        `<details><summary>${esc(f.q)}</summary><div class="faq-a">${f.a_html || `<p>${esc(f.a)}</p>`}</div></details>`
      ).join('')}</section>`
    : '';

  const sourcesHtml = sources.length
    ? `<section class="sources"><h2>Sources</h2><ol>${sources.map(s =>
        `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.title)}</a>${s.publisher ? ` &middot; <span class="src-pub">${esc(s.publisher)}</span>` : ''}</li>`
      ).join('')}</ol></section>`
    : '';

  const bylineHtml = `<p class="byline">By <span class="author-name">${esc((data.author && data.author.name) || env.AUTHOR_NAME || env.SITE_NAME)}</span> &middot; <time datetime="${esc(published_at)}">${esc(dateStr)}</time> &middot; ${readMins} min read</p>`;

  return baseHtml({
    title: safeTitle,
    description: safeDesc,
    canonical,
    ogImage: heroImage,
    ogType: 'article',
    schemaTags,
    env,
    mount,
    bodyInner: `
      ${crumb.crumbsHtml}
      <article>
        <h1>${esc(h1 || title)}</h1>
        ${meta_description ? `<p class="lede">${safeDesc}</p>` : ''}
        ${renderHero(data)}
        ${bylineHtml}
        <div class="read-progress" aria-live="polite" aria-label="Reading progress" data-total-mins="${readMins}">
          <span class="rp-bar-track"><span class="rp-bar"></span></span>
          <span class="rp-text">${readMins} min left</span>
        </div>
        ${rewriteMountLinks(body_html, mount)}
        ${data.widget ? renderWidgetEmbed(data.widget, origin, mount) : ''}
        ${renderProductBridge(data, env)}
        ${faqHtml}
        ${renderRelated(data, mount, slug)}
        ${sourcesHtml}
      </article>
    `
  });
}

export function renderIndex(items, origin, env, mount = '') {
  // Featured: explicit `featured: true` in seed JSON. Up to 6, alphabetical.
  const featuredItems = items.filter(i => i.featured).slice(0, 6);
  const featuredSlugs = new Set(featuredItems.map(i => i.slug));

  // Recent: top 5 by updated_at, excluding already-featured to avoid double-listing.
  const recentItems = items
    .filter(i => i.updated_at && !featuredSlugs.has(i.slug))
    .map(i => ({ ...i, _ts: Date.parse(i.updated_at) || 0 }))
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 5);

  const renderTile = item =>
    `<li><a href="${mount}/${item.slug}"><strong>${esc(item.title)}</strong>${item.meta_description ? `<span>${esc(item.meta_description)}</span>` : ''}</a></li>`;

  const featuredHtml = featuredItems.length
    ? `<section class="i-section">
        <h2 class="i-section__head">Featured</h2>
        <ul class="article-list">${featuredItems.map(renderTile).join('')}</ul>
      </section>`
    : '';

  const recentHtml = recentItems.length
    ? `<section class="i-section">
        <h2 class="i-section__head">Recently updated</h2>
        <ul class="article-list">${recentItems.map(renderTile).join('')}</ul>
      </section>`
    : '';

  const fullList = items.map(renderTile).join('');

  // Browse-by-topic: only show pillar hubs that have at least one page.
  const presentPillars = new Set(items.map(i => i.pillar).filter(Boolean));
  const topicsHtml = presentPillars.size
    ? `<section class="i-section">
        <h2 class="i-section__head">Browse by topic</h2>
        <ul class="topic-grid">${PILLARS.filter(p => presentPillars.has(p.slug)).map(p =>
          `<li><a href="${mount}/${p.slug}"><strong>${esc(p.label)}</strong><span>${esc(p.blurb)}</span></a></li>`
        ).join('')}</ul>
      </section>`
    : '';

  return baseHtml({
    title: `Learn about tea — ${env.SITE_NAME}`,
    description: 'Explore TMolecule tea guides, ingredient research, chai recipes, collagen tea explainers, and practical brewing notes from a family tea brand since 1935.',
    canonical: `${origin}${mount}/`,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${env.SITE_NAME} Learn`,
        url: `${origin}${mount}/`,
        hasPart: items.map(i => ({ '@type': 'Article', name: i.title, url: `${origin}${mount}/${i.slug}` }))
      })}</script>`,
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: `${origin}${mount}/`,
        name: `${env.SITE_NAME} Learn`,
        publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
      })}</script>`
    ],
    bodyInner: `
      <header class="hero">
        <h1>Learn about tea</h1>
        <p>Brewing guides, origin stories, and tea education from the ${esc(env.SITE_NAME)} library.</p>
      </header>
      ${topicsHtml}
      ${featuredHtml}
      ${recentHtml}
      <section class="i-section">
        <h2 class="i-section__head">All articles</h2>
        <ul class="article-list">${fullList || '<li>No articles yet.</li>'}</ul>
      </section>
    `
  });
}

/**
 * Pillar hub page: lists every article in the pillar, grouped by cluster.
 */
export function renderHub(pillar, items, origin, env, mount = '') {
  const canonical = `${origin}${mount}/${pillar.slug}`;

  // Group by cluster, preserving alphabetical article order within each group.
  const groups = new Map();
  for (const it of items) {
    const c = it.cluster || 'general';
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(it);
  }
  const clusterLabel = c => c.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

  const renderTile = item =>
    `<li><a href="${mount}/${item.slug}"><strong>${esc(item.title)}</strong>${item.meta_description ? `<span>${esc(item.meta_description)}</span>` : ''}</a></li>`;

  const sectionsHtml = items.length
    ? [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cluster, list]) =>
        `<section class="i-section">
          <h2 class="i-section__head">${esc(clusterLabel(cluster))}</h2>
          <ul class="article-list">${list.map(renderTile).join('')}</ul>
        </section>`
      ).join('')
    : `<section class="i-section"><p>No guides here yet — <a href="${mount}/">browse all articles</a>.</p></section>`;

  const otherPillars = PILLARS.filter(p => p.slug !== pillar.slug);

  return baseHtml({
    title: `${pillar.title} — ${env.SITE_NAME} Learn`,
    description: pillar.blurb,
    canonical,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: pillar.title,
        description: pillar.blurb,
        url: canonical,
        hasPart: items.map(i => ({ '@type': 'Article', name: i.title, url: `${origin}${mount}/${i.slug}` }))
      })}</script>`,
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: env.SITE_NAME, item: env.SHOP_ORIGIN },
          { '@type': 'ListItem', position: 2, name: 'Learn', item: `${origin}${mount}/` },
          { '@type': 'ListItem', position: 3, name: pillar.label, item: canonical }
        ]
      })}</script>`
    ],
    bodyInner: `
      <nav class="crumbs"><a href="${env.SHOP_ORIGIN}">${esc(env.SITE_NAME)}</a> &rsaquo; <a href="${mount}/">Learn</a> &rsaquo; <span>${esc(pillar.label)}</span></nav>
      <header class="hero">
        <h1>${esc(pillar.title)}</h1>
        <p>${esc(pillar.blurb)}</p>
      </header>
      ${sectionsHtml}
      <section class="i-section">
        <h2 class="i-section__head">More topics</h2>
        <ul class="topic-grid">${otherPillars.map(p =>
          `<li><a href="${mount}/${p.slug}"><strong>${esc(p.label)}</strong><span>${esc(p.blurb)}</span></a></li>`
        ).join('')}</ul>
      </section>
    `
  });
}

/**
 * #2 Brew Guide tool page — a real /learn page hosting the interactive
 * brew-guide widget (the IIFE is served separately at <mount>/widgets/brew-guide.js
 * and self-mounts into the div below). Indexable (canonical + sitemap), so this
 * URL is the GSC / IndexNow-submittable surface.
 *
 * COMPLIANCE (no-medical-claims, food/supplement tier): preparation guidance only.
 * The <noscript> fallback makes no health claim; the research note is research-
 * framed and carries the general-information + FDA disclaimer.
 */
export function renderBrewGuide(origin, env, mount = '') {
  const canonical = `${origin}${mount}/brew-guide`;
  const title = `Tea Brew Guide & Chai Calculator — ${env.SITE_NAME} Learn`;
  const description =
    'Dial in spiced black tea, chai latte, iced, or batch concentrate — temperature, steep time and water-to-milk ratios scaled to your servings.';
  const scriptSrc = `${origin}${mount}/widgets/brew-guide.js?v=${WIDGET_VERSION}`;

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Tea Brew Guide',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Brew guide', item: canonical }
    ]
  };

  return baseHtml({
    title,
    description,
    canonical,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>Tea brew guide</h1>
        <p class="lede">Scale a spiced black-tea brew to any number of servings — hot, iced, as a latte, or a batch concentrate. The calculator gives you temperature, steep time and the water-to-milk ratio; flip on the masala blend for whole-spice amounts.</p>
        <section class="widget-block"><div id="tm-brew-guide"></div></section>
        <noscript>
          <h2>Standard brew (per cup)</h2>
          <ul>
            <li>Heat 8&nbsp;oz water to about 205&deg;F (96&deg;C) — just off the boil.</li>
            <li>Add 1 sachet and steep 4 minutes.</li>
            <li>For a latte, use 4&nbsp;oz strong brew + 4&nbsp;oz frothed milk.</li>
            <li>For a batch concentrate, brew double-strength and dilute 1:1 to serve.</li>
          </ul>
          <p>Pairs with <a href="${env.SHOP_ORIGIN}/products/spice-rush-collagen-black-tea">Spice Rush Collagen Black Tea</a>.</p>
        </noscript>
        <p class="tm-research-note"><strong>Heat &amp; collagen:</strong> some research examines whether prolonged boiling affects collagen peptides, so steeping just off the boil rather than hard-boiling is a common precaution. This describes published research, not a health claim. This is general information, not medical or dietary advice; these statements have not been evaluated by the FDA.</p>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * #3 Cost-per-cup tool page — hosts the cost-per-cup widget (IIFE served at
 * <mount>/widgets/cost-per-cup.js). Indexable; the GSC / IndexNow URL.
 *
 * COMPLIANCE: arithmetic price comparison only. The <noscript> fallback states
 * representative costs as editable estimates and makes no nutritional-equivalence
 * or medical claim; the disclaimer mirrors the widget's.
 */
export function renderCostPerCup(origin, env, mount = '') {
  const canonical = `${origin}${mount}/cost-per-cup`;
  const title = `Collagen Tea Cost-per-Cup Calculator — ${env.SITE_NAME} Learn`;
  const description =
    'Compare the cost of a collagen tea against a daily café latte or a DIY coffee-plus-collagen-powder morning — live per-cup, monthly and annual totals.';
  const scriptSrc = `${origin}${mount}/widgets/cost-per-cup.js?v=${WIDGET_VERSION}`;

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Collagen Tea Cost-per-Cup Calculator',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Cost per cup', item: canonical }
    ]
  };

  return baseHtml({
    title,
    description,
    canonical,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>Collagen tea cost-per-cup</h1>
        <p class="lede">What does your morning drink actually cost? Compare a collagen tea against a daily café latte or a do-it-yourself coffee-plus-collagen-powder routine — per cup, per month, and per year. Every price is editable to match your own.</p>
        <section class="widget-block"><div id="tm-cost-per-cup"></div></section>
        <noscript>
          <h2>Representative costs (editable estimates)</h2>
          <ul>
            <li>Collagen tea: a ~$29 box of ~20 sachets &asymp; <strong>$1.45/cup</strong>.</li>
            <li>Café latte: ~<strong>$5.50/cup</strong>.</li>
            <li>Coffee + collagen powder: ~$0.50 coffee + a scoop from a ~$40 / 30-serving tub &asymp; <strong>$1.83/cup</strong>.</li>
          </ul>
          <p>At one cup a day, that is roughly <strong>$1,480/yr</strong> for the café habit vs <strong>$529/yr</strong> for the tea. Prices vary — adjust to your own.</p>
          <p>Pairs with <a href="${env.SHOP_ORIGIN}/products/spice-rush-collagen-black-tea">Spice Rush Collagen Black Tea</a>.</p>
        </noscript>
        <p class="tm-research-note">This compares the <em>cost</em> of assembling a morning drink. It is not a claim that the tea is nutritionally equivalent to collagen powder, and not a medical, performance, or guaranteed-savings claim. This is general information, not financial or dietary advice.</p>
        <nav class="related" aria-label="Related guides">
          <h2>Related reading</h2>
          <ul>
            <li><a href="${mount}/collagen-tea-vs-collagen-powder">Collagen tea vs collagen powder</a></li>
            <li><a href="${mount}/does-collagen-tea-actually-work">Does collagen tea actually work?</a></li>
            <li><a href="${mount}/collagen-tea-vs-bone-broth">Collagen tea vs bone broth</a></li>
          </ul>
        </nav>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * #5 Caffeine comparator tool page — hosts the caffeine-comparator widget (IIFE
 * served at <mount>/widgets/caffeine-comparator.js). Indexable; the GSC / IndexNow
 * URL. Also designed to be EMBEDDED by other sites (link-building asset) — see the
 * copy-paste snippet in the body.
 *
 * COMPLIANCE: caffeine content is purely factual (SCOPE.md allows it explicitly).
 * The <noscript> fallback lists representative figures and makes no health claim;
 * the note carries the general-information + FDA-reference framing.
 */
export function renderCaffeineComparator(origin, env, mount = '') {
  const canonical = `${origin}${mount}/caffeine-comparator`;
  const title = `Caffeine in Tea vs Coffee: Interactive Comparator — ${env.SITE_NAME} Learn`;
  const description =
    'How much caffeine is in your tea? Compare rooibos, white, green, oolong, black, matcha and pu-erh against coffee and espresso — per cup and across your day.';
  const scriptSrc = `${origin}${mount}/widgets/caffeine-comparator.js?v=${WIDGET_VERSION}`;
  const embedSnippet = `<div id="tm-caffeine-comparator"></div>\n<script defer src="${origin}${mount}/widgets/caffeine-comparator.js"></script>`;

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Tea Caffeine Comparator',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Caffeine comparator', item: canonical }
    ]
  };

  return baseHtml({
    title,
    description,
    canonical,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>How much caffeine is in your tea?</h1>
        <p class="lede">Pick a tea and your cups per day to see the caffeine per cup, the daily total, and how it stacks up against coffee — with every common tea on one chart.</p>
        <section class="widget-block"><div id="tm-caffeine-comparator"></div></section>
        <noscript>
          <h2>Caffeine per ~8 oz cup (representative)</h2>
          <ul>
            <li>Rooibos / herbal: <strong>0 mg</strong> (naturally caffeine-free)</li>
            <li>White tea: ~15&ndash;30 mg</li>
            <li>Green tea: ~30&ndash;50 mg</li>
            <li>Oolong tea: ~30&ndash;50 mg</li>
            <li>Black tea: ~40&ndash;70 mg</li>
            <li>Pu-erh: ~30&ndash;70 mg</li>
            <li>Matcha (1 tsp): ~60&ndash;80 mg</li>
            <li>Espresso (1 shot): ~60&ndash;80 mg</li>
            <li>Brewed coffee: ~80&ndash;100 mg</li>
          </ul>
        </noscript>
        <p class="tm-research-note">Representative figures per ~8&nbsp;oz cup; brewing strength, leaf grade and steep time all change the real number. The ~400&nbsp;mg/day figure used for context is a reference the U.S. FDA has cited for healthy adults, not a recommendation. This is general information, not medical or dietary advice.</p>
        <section class="cc-embed">
          <h2>Embed this tool</h2>
          <p>Free to embed on your own site or blog &mdash; please keep the link back to ${esc(env.SITE_NAME)}.</p>
          <pre style="background:rgba(122,90,43,.06);border:1px solid rgb(var(--color-rule));border-radius:8px;padding:.9rem 1rem;overflow:auto;font-size:.82rem;line-height:1.5"><code>${esc(embedSnippet)}</code></pre>
        </section>
        <nav class="related" aria-label="Related guides">
          <h2>Related reading</h2>
          <ul>
            <li><a href="${mount}/is-rooibos-caffeine-free">Is rooibos caffeine-free?</a></li>
            <li><a href="${mount}/l-theanine-and-caffeine-in-tea">L-theanine and caffeine in tea</a></li>
            <li><a href="${mount}/best-tea-to-replace-coffee">The best tea to replace coffee</a></li>
            <li><a href="${mount}/best-tea-for-sleep">Tea for sleep</a></li>
          </ul>
        </nav>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * #6 Collagen-per-day calculator page. Content figures only (grams of collagen
 * protein consumed) — no skin/joint/hair outcome claims. Spice Rush = 10 g
 * hydrolyzed collagen per cup (verified from the PDP).
 */
export function renderCollagenCalculator(origin, env, mount = '') {
  const canonical = `${origin}${mount}/collagen-calculator`;
  const title = `Collagen in Your Tea: How Much Are You Getting? — ${env.SITE_NAME} Learn`;
  const description =
    'How much collagen protein do you get from your tea? Spice Rush has 10 g of hydrolyzed collagen per cup — set your cups per day to see the daily and weekly total.';
  const scriptSrc = `${origin}${mount}/widgets/collagen-calculator.js?v=${WIDGET_VERSION}`;
  const appSchema = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Collagen-per-Day Calculator',
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Web', url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Collagen calculator', item: canonical }
    ]
  };
  return baseHtml({
    title, description, canonical, ogType: 'website', env, mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>How much collagen are you actually getting?</h1>
        <p class="lede">Each cup of Spice Rush carries 10&nbsp;g of hydrolyzed collagen. Set your cups per day to see the daily and weekly total — and where it sits next to the range research commonly studies.</p>
        <section class="widget-block"><div id="tm-collagen-calculator"></div></section>
        <noscript>
          <ul>
            <li>Spice Rush: <strong>10 g</strong> hydrolyzed collagen per cup</li>
            <li>1 cup = 10 g/day · 2 cups = 20 g/day · 3 cups = 30 g/day</li>
            <li>Published collagen-peptide research commonly uses ~2.5&ndash;15 g/day</li>
          </ul>
        </noscript>
        <p class="tm-research-note">These are content figures — the amount of collagen protein consumed — not a health outcome. The 2.5&ndash;15&nbsp;g/day band describes what research commonly studies, not a recommendation or a promised result. This is general information, not medical or dietary advice.</p>
        <nav class="related" aria-label="Related guides">
          <h2>Related reading</h2>
          <ul>
            <li><a href="${mount}/collagen-tea-vs-collagen-powder">Collagen tea vs powder</a></li>
            <li><a href="${mount}/does-collagen-tea-actually-work">Does collagen tea actually work?</a></li>
            <li><a href="${mount}/collagen-peptides">What are collagen peptides?</a></li>
          </ul>
        </nav>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * #7 Sugar-saved / café-swap calculator page. Sugar-grams, calories-from-sugar
 * and dollars arithmetic — a comparison, not a health claim.
 */
export function renderSugarSaved(origin, env, mount = '') {
  const canonical = `${origin}${mount}/sugar-saved`;
  const title = `Sugar-Saved Calculator: Café Chai vs Unsweetened Spice Rush — ${env.SITE_NAME} Learn`;
  const description =
    'See a year of sugar, calories and dollars you would skip by swapping café chai lattes (~40 g sugar each) for unsweetened Spice Rush (0 g added sugar).';
  const scriptSrc = `${origin}${mount}/widgets/sugar-saved.js?v=${WIDGET_VERSION}`;
  const appSchema = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Sugar-Saved Café-Swap Calculator',
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Web', url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Sugar-saved calculator', item: canonical }
    ]
  };
  return baseHtml({
    title, description, canonical, ogType: 'website', env, mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>How much sugar could you skip?</h1>
        <p class="lede">A café chai latte carries around 40&nbsp;g of sugar. Spice Rush has none added. Set your café habit to see a year of sugar, calories and dollars you'd avoid by swapping.</p>
        <section class="widget-block"><div id="tm-sugar-saved"></div></section>
        <noscript>
          <ul>
            <li>Café chai latte: <strong>~40 g</strong> sugar (typically 30&ndash;50 g)</li>
            <li>Spice Rush: <strong>0 g</strong> added sugar</li>
            <li>Swapping 5 café chais/week ≈ 10&nbsp;lb of sugar and ~$1,300 in a year</li>
          </ul>
        </noscript>
        <p class="tm-research-note">Café figures are representative and vary by chain, size and recipe. This is a sugar-and-cost comparison, not a health claim. General information, not medical or dietary advice.</p>
        <nav class="related" aria-label="Related guides">
          <h2>Related reading</h2>
          <ul>
            <li><a href="${mount}/how-to-brew-chai-without-sugar">How to brew chai without sugar</a></li>
            <li><a href="${mount}/is-tea-keto-and-paleo-friendly">Is tea keto & paleo friendly?</a></li>
            <li><a href="${mount}/best-milk-for-chai">The best milk for chai</a></li>
          </ul>
        </nav>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * #8 Chai spice-blend builder page. Pure flavor tool — no health claims.
 */
export function renderSpiceBlendBuilder(origin, env, mount = '') {
  const canonical = `${origin}${mount}/spice-blend-builder`;
  const title = `Chai Spice Blend Builder: Design Your Cup — ${env.SITE_NAME} Learn`;
  const description =
    'Dial in cardamom, ginger, cinnamon and clove and see your chai flavor profile in words — plus how close it is to Spice Rush, our balanced everyday blend.';
  const scriptSrc = `${origin}${mount}/widgets/spice-blend-builder.js?v=${WIDGET_VERSION}`;
  const appSchema = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Chai Spice Blend Builder',
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Web', url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Spice blend builder', item: canonical }
    ]
  };
  return baseHtml({
    title, description, canonical, ogType: 'website', env, mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>Build your chai spice blend</h1>
        <p class="lede">Cardamom, ginger, cinnamon, clove — the four spices that make a chai. Dial each one and read your cup's flavor profile, then see how close you got to Spice Rush.</p>
        <section class="widget-block"><div id="tm-spice-blend-builder"></div></section>
        <noscript>
          <ul>
            <li><strong>Cardamom</strong> — floral, aromatic, citrus-cool</li>
            <li><strong>Ginger</strong> — warming, bright, gently spicy</li>
            <li><strong>Cinnamon</strong> (Ceylon) — sweet, woody</li>
            <li><strong>Clove</strong> — deep, resinous, warming</li>
          </ul>
          <p>Spice Rush balances all four with black tea and collagen, milled to dissolve in one stir.</p>
        </noscript>
        <nav class="related" aria-label="Related guides">
          <h2>Related reading</h2>
          <ul>
            <li><a href="${mount}/best-cardamom-for-chai">The best cardamom for chai</a></li>
            <li><a href="${mount}/chai-tea-benefits-spice-by-spice">Chai, spice by spice</a></li>
            <li><a href="${mount}/what-is-masala-chai">What is masala chai?</a></li>
          </ul>
        </nav>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

/**
 * Tools hub — a single indexable landing page listing every interactive tool.
 * The one thing to link from the nav ("Tools" → /learn/tools). ItemList schema
 * for AI shopping/answer surfaces.
 */
const TOOLS_HUB = [
  { slug: 'collagen-calculator', name: 'Collagen Calculator', blurb: 'Set your cups per day to see how much collagen protein you actually get.' },
  { slug: 'sugar-saved', name: 'Sugar-Saved Calculator', blurb: 'Sugar, calories and dollars you skip swapping café chai for unsweetened Spice Rush.' },
  { slug: 'spice-blend-builder', name: 'Spice Blend Builder', blurb: 'Dial in cardamom, ginger, cinnamon and clove and read your cup&rsquo;s flavor.' },
  { slug: 'tea-finder', name: 'Tea Finder', blurb: 'Four quick questions — flavor, routine, dietary — matched to a blend.' },
  { slug: 'brew-guide', name: 'Brew Guide', blurb: 'Scale water temperature, steep time and milk ratio to your servings.' },
  { slug: 'cost-per-cup', name: 'Cost per Cup', blurb: 'Compare your cup against a café latte or a coffee-and-powder routine.' },
  { slug: 'caffeine-comparator', name: 'Caffeine Comparator', blurb: 'Caffeine per cup for every common tea vs coffee, and across your day.' },
];

export function renderToolsHub(origin, env, mount = '') {
  const canonical = `${origin}${mount}/tools`;
  const title = `Tea Tools & Calculators — ${env.SITE_NAME} Learn`;
  const description =
    'Free interactive tea tools from TMolecule: a collagen calculator, a café-swap sugar-saved calculator, a chai spice-blend builder, a tea finder, a brew guide, cost-per-cup and a caffeine comparator.';
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'TMolecule tea tools & calculators',
    itemListElement: TOOLS_HUB.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name, url: `${origin}${mount}/${t.slug}`
    }))
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: canonical }
    ]
  };
  const cards = TOOLS_HUB.map((t) => `
          <a class="tool-card" href="${mount}/${t.slug}" style="display:block;text-decoration:none;padding:1.15rem 1.25rem;border:1px solid rgb(var(--color-rule));border-radius:12px;background:rgba(122,90,43,.03);transition:box-shadow .15s ease;">
            <div style="font-family:var(--serif);font-weight:600;font-size:1.2rem;color:rgb(var(--color-foreground));margin:0 0 .3rem;">${t.name} &rsaquo;</div>
            <p style="font-family:var(--sans);font-size:.92rem;line-height:1.5;color:rgb(var(--color-mute));margin:0;">${t.blurb}</p>
          </a>`).join('');

  return baseHtml({
    title, description, canonical, ogType: 'website', env, mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>Tea tools &amp; calculators</h1>
        <p class="lede">Free, no-signup tools to plan your cup — from how much collagen you&rsquo;re getting to how much sugar you&rsquo;d skip swapping the café. Everything runs in your browser.</p>
        <section class="advisor-block" style="margin:1.5rem 0;"><div id="tm-advisor"></div></section>
        <script defer src="${origin}${mount}/widgets/advisor.js?v=${WIDGET_VERSION}"></script>
        <h2>Calculators &amp; guides</h2>
        <section class="tools-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin:1.5rem 0;">
          ${cards}
        </section>
        <p class="tm-research-note">Calculators show content, cost and flavor figures, not health outcomes. General information, not medical or dietary advice.</p>
      </article>
    `
  });
}

/**
 * #1 Tea Finder tool page — hosts the tea-finder quiz widget (IIFE served at
 * <mount>/widgets/tea-finder.js). Indexable; the GSC / IndexNow URL.
 *
 * COMPLIANCE: a flavor/occasion/dietary preference quiz. The <noscript> fallback
 * routes by preference only and names composition, not outcomes.
 */
export function renderTeaFinder(origin, env, mount = '') {
  const canonical = `${origin}${mount}/tea-finder`;
  const title = `Tea Finder Quiz: Which TMolecule Tea Fits You — ${env.SITE_NAME} Learn`;
  const description =
    'Answer four quick questions about flavor, routine and dietary preference and we’ll point you to the TMolecule tea that fits — collagen black tea or adaptogen defense tea.';
  const scriptSrc = `${origin}${mount}/widgets/tea-finder.js?v=${WIDGET_VERSION}`;
  const shop = env.SHOP_ORIGIN;

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'TMolecule Tea Finder',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: env.SITE_NAME, url: shop }
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: `${origin}${mount}/` },
      { '@type': 'ListItem', position: 2, name: 'Tea finder', item: canonical }
    ]
  };

  return baseHtml({
    title,
    description,
    canonical,
    ogType: 'website',
    env,
    mount,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify(appSchema)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
    ],
    bodyInner: `
      <article>
        <h1>Which TMolecule tea fits you?</h1>
        <p class="lede">Four quick questions on flavor, routine and dietary preference — no health questions — and we’ll point you to the right cup.</p>
        <section class="widget-block"><div id="tm-tea-finder"></div></section>
        <noscript>
          <h2>The two teas at a glance</h2>
          <ul>
            <li><strong><a href="${shop}/products/spice-rush-collagen-black-tea">Spice Rush Collagen Black Tea</a></strong> — black tea, hydrolyzed collagen peptides and warming chai spices in one milled scoop; built for a morning ritual. Contains collagen (not vegan).</li>
            <li><strong><a href="${shop}/products/immunitea-defense-tea">ImmuniTea Defense Tea</a></strong> — black tea built on four standardized adaptogens (turmeric, gooseberry, postbiotics, terminalia bellerica); plant-based.</li>
          </ul>
          <p>Pick warm-and-spiced + collagen + a morning cup → Spice Rush. Pick earthy-and-golden + adaptogens + plant-based → ImmuniTea.</p>
        </noscript>
        <p class="tm-research-note">This quiz matches on taste, routine and dietary preference — not health needs. It is general information, not medical or dietary advice; statements have not been evaluated by the FDA.</p>
      </article>
      <script defer src="${scriptSrc}"></script>
    `
  });
}

export function renderNotFound(env, origin, mount = '') {
  return baseHtml({
    title: `Page not found — ${env.SITE_NAME} Learn`,
    description: 'The page you requested could not be found.',
    canonical: `${origin}${mount}/`,
    ogType: 'website',
    env,
    mount,
    schemaTags: [],
    bodyInner: `
      <header class="hero">
        <h1>Page not found</h1>
        <p>The article you’re looking for doesn’t exist or has moved.</p>
        <p><a class="btn" href="${mount}/">Browse all guides</a> &nbsp; <a href="${env.SHOP_ORIGIN}">Visit the shop &rsaquo;</a></p>
      </header>
    `
  });
}

function expandLink(href, shop, mount) {
  return href.replace('__SHOP__', shop).replace('__LEARN__', mount || '');
}

function baseHtml({ title, description, canonical, ogImage, ogType = 'article', schemaTags = [], bodyInner, env, mount = '' }) {
  const shop = env.SHOP_ORIGIN;
  const navHtml = NAV_LINKS.map(l =>
    `<a href="${expandLink(l.href, shop, mount)}">${esc(l.label)}</a>`
  ).join('');
  const verificationTag = env.GSC_VERIFICATION
    ? `<meta name="google-site-verification" content="${esc(env.GSC_VERIFICATION)}">`
    : '';
  const year = new Date().getFullYear();
  const logoHi = `${env.LOGO_URL}${env.LOGO_URL.includes('?') ? '&' : '?'}width=1200`;
  const logoLo = `${env.LOGO_URL}${env.LOGO_URL.includes('?') ? '&' : '?'}width=400`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
${verificationTag}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${ogType}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap">
${schemaTags.join('\n')}
<style>
  :root {
    --color-background: 250, 247, 240;
    --color-foreground: 43, 42, 40;
    --color-button: 122, 90, 43;
    --color-button-text: 250, 247, 240;
    --color-contrast: 218, 196, 144;
    --color-rule: 232, 222, 200;
    --color-mute: 122, 112, 96;
    --color-card: 255, 252, 246;
    --footer-bg-top: #2a1f10;
    --footer-bg-bot: #1a1208;
    --footer-fg: #faf3e0;
    --footer-accent: #d4b97a;
    --serif: 'Fraunces', Georgia, serif;
    --sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:var(--sans);
    color:rgb(var(--color-foreground));
    background-color:#ecdcb0;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.32 0 0 0 0 0.15 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(253,246,220,.7) 0%, transparent 60%),
      radial-gradient(ellipse 65% 45% at 100% 100%, rgba(140,100,55,.13) 0%, transparent 55%),
      radial-gradient(ellipse 65% 45% at 0% 100%, rgba(140,100,55,.09) 0%, transparent 55%),
      linear-gradient(to right,
        rgba(35,18,5,.55) 0%,
        rgba(80,42,16,.40) 1%,
        rgba(140,90,45,.22) 3%,
        rgba(180,130,70,.10) 6%,
        transparent 9%,
        transparent 91%,
        rgba(180,130,70,.10) 94%,
        rgba(140,90,45,.22) 97%,
        rgba(80,42,16,.40) 99%,
        rgba(35,18,5,.55) 100%
      ),
      linear-gradient(180deg, #f6ecc8 0%, #eedcae 55%, #e0c896 100%);
    background-attachment:fixed;
    background-size:240px 240px, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
    min-height:100vh;
    line-height:1.65;
    -webkit-font-smoothing:antialiased;
  }
  a{color:rgb(var(--color-button));text-decoration:none}
  a:hover{text-decoration:underline}

  /* Header — sticky on scroll, translucent background */
  .tm-header{
    background:rgba(250,247,240,.92);
    border-bottom:1px solid rgb(var(--color-rule));
    padding:18px 28px;
    display:grid;
    grid-template-columns:1fr auto 1fr;
    align-items:center;
    gap:24px;
    position:sticky;
    top:0;
    z-index:50;
    backdrop-filter:saturate(140%) blur(8px);
    -webkit-backdrop-filter:saturate(140%) blur(8px);
  }
  .tm-header__nav{
    display:flex;
    gap:22px;
    align-items:center;
    flex-wrap:wrap;
  }
  .tm-header__nav a{
    color:rgb(var(--color-foreground));
    font-size:14px;
    font-weight:500;
    letter-spacing:.02em;
  }
  .tm-header__nav a:hover{color:rgb(var(--color-button));text-decoration:none}
  .tm-header__logo{
    position:relative;
    display:inline-block;
    justify-self:center;
  }
  .tm-header__logo img{
    height:42px;
    width:auto;
    display:block;
  }
  .tm-header__logo sup{
    position:absolute;
    top:-2px;
    right:-12px;
    font-size:11px;
    font-weight:700;
    color:rgb(var(--color-button));
    line-height:1;
  }
  .tm-header__spacer{display:block}

  /* Header search */
  .tm-search{
    position:relative;
    justify-self:end;
    display:flex;
    align-items:center;
    gap:8px;
    padding:7px 38px 7px 34px;
    background:rgba(255,250,225,.78);
    border:1px solid rgba(122,90,43,.3);
    border-radius:999px;
    width:240px;
    max-width:100%;
    color:rgb(var(--color-mute));
    transition:background .15s ease, border-color .15s ease, box-shadow .15s ease;
  }
  .tm-search:focus-within{
    background:rgba(255,253,238,.95);
    border-color:rgb(var(--color-button));
    box-shadow:0 0 0 3px rgba(122,90,43,.12);
  }
  .tm-search__icon{
    position:absolute;
    left:12px;
    top:50%;
    transform:translateY(-50%);
    color:rgb(var(--color-mute));
    pointer-events:none;
  }
  .tm-search input{
    border:0;
    outline:none;
    background:transparent;
    font:inherit;
    font-size:14px;
    color:rgb(var(--color-foreground));
    width:100%;
    padding:0;
    line-height:1.4;
  }
  .tm-search input::placeholder{color:rgb(var(--color-mute))}
  .tm-search input::-webkit-search-cancel-button{display:none}
  .tm-search__clear{
    position:absolute;
    right:8px;
    top:50%;
    transform:translateY(-50%);
    width:22px;
    height:22px;
    border:0;
    padding:0;
    background:rgba(122,90,43,.14);
    color:rgb(var(--color-foreground));
    border-radius:50%;
    cursor:pointer;
    display:none;
    align-items:center;
    justify-content:center;
    transition:background .12s ease;
  }
  .tm-search__clear:hover{background:rgba(122,90,43,.28)}
  .tm-search.has-query .tm-search__clear{display:inline-flex}
  .tm-search__dropdown{
    position:absolute;
    top:calc(100% + 8px);
    right:0;
    left:0;
    max-height:60vh;
    overflow-y:auto;
    background:linear-gradient(180deg, rgba(253,247,225,.98) 0%, rgba(248,237,200,.98) 100%);
    border:1px solid rgba(122,90,43,.22);
    border-radius:8px;
    box-shadow:
      0 1px 2px rgba(80,50,20,.10),
      0 6px 18px rgba(80,50,20,.14),
      0 22px 46px rgba(80,50,20,.10);
    z-index:60;
    padding:.4rem;
  }
  .tm-search__hit{
    display:block;
    padding:.7rem .85rem;
    text-decoration:none;
    color:rgb(var(--color-foreground));
    border-radius:6px;
    transition:background .12s ease;
  }
  .tm-search__hit:hover,
  .tm-search__hit.active{background:rgba(122,90,43,.10);text-decoration:none}
  .tm-search__hit strong{
    display:block;
    font-family:var(--serif);
    font-weight:600;
    font-size:.98rem;
    margin-bottom:.18rem;
    line-height:1.3;
  }
  .tm-search__hit span{
    display:block;
    font-size:.84rem;
    color:rgb(var(--color-mute));
    line-height:1.45;
  }
  .tm-search__empty{padding:.9rem;color:rgb(var(--color-mute));font-size:.9rem;text-align:center}

  @media (max-width:760px){
    .tm-header{grid-template-columns:1fr;gap:14px;text-align:center;padding:16px 20px}
    .tm-header__nav{justify-content:center;gap:16px;font-size:13px}
    .tm-header__nav a{font-size:13px}
    .tm-header__spacer{display:none}
    .tm-search{justify-self:center;width:100%;max-width:340px}
  }

  /* Main content — page panel with burnt-edge effect on left/right.
     Dark char at the very edge fades through scorched amber into the
     clean parchment center, like a manuscript page rescued from a fire. */
  .wrap{
    max-width:740px;
    margin:0 auto;
    padding:48px 56px 64px;
    background-image:
      linear-gradient(to right,
        rgba(38,20,5,.55) 0%,
        rgba(78,40,15,.42) 1%,
        rgba(140,85,40,.22) 3%,
        rgba(180,125,65,.10) 6%,
        transparent 10%,
        transparent 90%,
        rgba(180,125,65,.10) 94%,
        rgba(140,85,40,.22) 97%,
        rgba(78,40,15,.42) 99%,
        rgba(38,20,5,.55) 100%
      ),
      linear-gradient(180deg, rgba(253,247,225,.85) 0%, rgba(248,237,200,.78) 100%);
    box-shadow:
      0 1px 2px rgba(80,50,20,.06),
      0 10px 36px rgba(80,50,20,.10),
      0 0 0 1px rgba(60,35,15,.10);
    border-radius:0 0 4px 4px;
  }
  @media (max-width:760px){
    .wrap{padding:36px 36px 48px}
  }
  .crumbs{font-size:.85rem;color:rgb(var(--color-mute));margin-bottom:14px}
  .crumbs a{color:rgb(var(--color-mute))}
  h1{
    font-family:var(--serif);
    font-size:2.6rem;
    line-height:1.15;
    margin:.25rem 0 1rem;
    color:rgb(var(--color-foreground));
    letter-spacing:-.012em;
    font-weight:600;
  }
  .lede{
    font-size:1.18rem;
    color:rgba(var(--color-foreground),.85);
    margin:0 0 2rem;
    line-height:1.55;
    font-family:var(--serif);
    font-style:italic;
    font-weight:400;
  }
  article p{margin:0 0 1.15rem;font-size:1.02rem}
  article h2{
    font-family:var(--serif);
    font-size:1.55rem;
    margin:2.6rem 0 1rem;
    font-weight:600;
    color:rgb(var(--color-foreground));
  }

  /* Colored section markers — each body H2 cycles through the brand palette */
  article > h2{
    padding:.45rem 0 .45rem 1rem;
    margin-left:-1rem;
    border-left:4px solid rgb(var(--color-button));
    border-radius:0 4px 4px 0;
    background:rgba(122,90,43,.04);
  }
  article > h2:nth-of-type(6n+1){border-left-color:#7a5a2b;background:rgba(122,90,43,.06)}
  article > h2:nth-of-type(6n+2){border-left-color:#b08544;background:rgba(176,133,68,.07)}
  article > h2:nth-of-type(6n+3){border-left-color:#c89e57;background:rgba(200,158,87,.08)}
  article > h2:nth-of-type(6n+4){border-left-color:#d4b97a;background:rgba(212,185,122,.10)}
  article > h2:nth-of-type(6n+5){border-left-color:#5d4520;background:rgba(93,69,32,.05)}
  article > h2:nth-of-type(6n){border-left-color:#dac490;background:rgba(218,196,144,.10)}
  article h3{
    font-family:var(--serif);
    font-size:1.18rem;
    margin:1.85rem 0 .65rem;
    font-weight:600;
  }
  article ul,article ol{padding-left:1.25rem;margin:0 0 1.3rem}
  article li{margin-bottom:.45rem}
  article img{max-width:100%;height:auto;border-radius:6px;margin:1.25rem 0}
  article blockquote{
    border-left:3px solid rgb(var(--color-button));
    padding:.25rem 0 .25rem 1.1rem;
    margin:1.4rem 0;
    color:rgba(var(--color-foreground),.88);
    font-family:var(--serif);
    font-style:italic;
  }
  article strong{color:rgb(var(--color-foreground));font-weight:600}

  /* Byline (author + date + read time) */
  .byline{
    font-family:var(--sans);
    font-size:.85rem;
    color:rgb(var(--color-mute));
    margin:0 0 2rem;
    padding-bottom:1.4rem;
    border-bottom:1px solid rgb(var(--color-rule));
  }
  .byline .author-name{color:rgb(var(--color-foreground));font-weight:600}

  /* Tables — clean, borderless, with bottom rules */
  article table{
    width:100%;
    border-collapse:separate;
    border-spacing:0;
    margin:1.8rem 0;
    font-size:.97rem;
    font-family:var(--sans);
    line-height:1.55;
  }
  article thead th{
    text-align:left;
    padding:.65rem .25rem .55rem;
    font-weight:600;
    color:rgb(var(--color-foreground));
    border-bottom:2px solid rgb(var(--color-foreground));
    font-size:.82rem;
    letter-spacing:.04em;
    text-transform:uppercase;
  }
  article tbody td{
    padding:.7rem .25rem;
    border-bottom:1px solid rgb(var(--color-rule));
    vertical-align:top;
    color:rgba(var(--color-foreground),.85);
  }
  article tbody td:first-child{
    font-weight:600;
    color:rgb(var(--color-foreground));
    width:38%;
  }
  article tbody tr.hl{background:rgba(var(--color-contrast),.18)}
  article tbody tr.hl td:first-child{color:rgb(var(--color-button))}

  /* First table after H2 — themed Quick-Facts callout */
  article h2 + table{
    background:linear-gradient(135deg, #fdf8e8 0%, #f1e6c8 100%);
    padding:.6rem 1.1rem .9rem;
    border-radius:12px;
    border-top:1px solid #e8d9b2;
    border-right:1px solid #e8d9b2;
    border-bottom:1px solid #e8d9b2;
    border-left:3px solid rgb(var(--color-button));
    box-shadow:
      0 1px 2px rgba(80,50,20,.10),
      0 4px 12px rgba(80,50,20,.10),
      0 18px 40px rgba(80,50,20,.08);
    overflow:hidden;
  }
  article h2 + table thead th:first-child{padding-left:.85rem}
  article h2 + table tbody tr:first-child td{padding-top:.85rem}
  article h2 + table tbody tr:last-child td{border-bottom:0}
  article h2 + table thead th{border-bottom-color:rgb(var(--color-button))}

  /* FAQ — blush gradient block matching site palette */
  .faq{
    margin-top:3rem;
    padding:1.9rem 1.7rem 1.2rem;
    background:linear-gradient(135deg, #f7ecd1 0%, #ecdab0 100%);
    border-radius:12px;
    border-top:1px solid #e2cf99;
    border-right:1px solid #e2cf99;
    border-bottom:1px solid #e2cf99;
    border-left:3px solid rgb(var(--color-button));
    box-shadow:
      0 1px 2px rgba(80,50,20,.10),
      0 4px 14px rgba(80,50,20,.12),
      0 22px 50px rgba(80,50,20,.10);
  }
  .faq h2{margin-top:0}
  .faq details{
    border:0;
    border-bottom:1px solid rgba(122,90,43,.18);
    border-radius:0;
    padding:1rem .25rem;
    margin-bottom:0;
    background:transparent;
  }
  .faq details:first-of-type{border-top:1px solid rgba(122,90,43,.18)}
  .faq summary{cursor:pointer;font-weight:600;list-style:none;font-family:var(--serif);font-size:1.08rem;color:rgb(var(--color-foreground))}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';float:right;color:rgb(var(--color-mute));font-weight:400;font-size:1.25em;line-height:1}
  .faq details[open] summary::after{content:'\\2013'}
  .faq-a{margin-top:.7rem;color:rgba(var(--color-foreground),.88);font-size:.98rem;line-height:1.65}

  /* Tradition + Science callout — paired two-column block.
     Authors mark up via aside.trad-sci with two child divs
     (.trad-sci__trad and .trad-sci__sci). See seed/_README.md
     for the full markup pattern. */
  .trad-sci{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0;
    margin:2rem 0;
    border-radius:12px;
    overflow:hidden;
    border:1px solid rgba(122,90,43,.16);
    border-left:3px solid rgb(var(--color-button));
    box-shadow:
      0 1px 2px rgba(80,50,20,.10),
      0 4px 14px rgba(80,50,20,.12),
      0 22px 50px rgba(80,50,20,.10);
  }
  .trad-sci__trad,
  .trad-sci__sci{
    padding:1.4rem 1.5rem 1.2rem;
    font-size:.95rem;
    line-height:1.6;
  }
  .trad-sci__trad{
    background:linear-gradient(135deg, #f7ecd1 0%, #ecdab0 100%);
    border-right:1px solid rgba(122,90,43,.14);
  }
  .trad-sci__sci{
    background:linear-gradient(135deg, #fbf6e8 0%, #f3eccd 100%);
  }
  .trad-sci h4{
    font-family:var(--sans);
    font-size:.72rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:.16em;
    color:rgb(var(--color-button));
    margin:0 0 .65rem;
  }
  .trad-sci__trad h4::before{content:'\\2756  '}  /* small ornamental glyph */
  .trad-sci__sci h4::before{content:'\\25E6  '}    /* small ring glyph */
  .trad-sci p{margin:0 0 .7rem;font-size:.95rem;line-height:1.6;color:rgba(var(--color-foreground),.92)}
  .trad-sci p:last-child{margin-bottom:0}
  .trad-sci em,
  .trad-sci i{
    font-style:italic;
    color:rgb(var(--color-button));
  }
  .trad-sci a{color:rgb(var(--color-button));text-decoration:underline;text-decoration-color:rgba(122,90,43,.4);text-underline-offset:2px}
  .trad-sci a:hover{text-decoration-color:rgb(var(--color-button))}
  @media (max-width:680px){
    .trad-sci{grid-template-columns:1fr}
    .trad-sci__trad{border-right:0;border-bottom:1px solid rgba(122,90,43,.14)}
  }

  /* Sources — restrained cream gradient (functional, not decorative) */
  .sources{
    margin-top:2.5rem;
    padding:1.6rem 1.7rem 1.3rem;
    background:linear-gradient(135deg, #fbf6e8 0%, #f3eccd 100%);
    border-radius:12px;
    border-top:1px solid rgba(122,90,43,.16);
    border-right:1px solid rgba(122,90,43,.16);
    border-bottom:1px solid rgba(122,90,43,.16);
    border-left:3px solid rgb(var(--color-button));
    box-shadow:
      0 1px 2px rgba(80,50,20,.10),
      0 4px 12px rgba(80,50,20,.10),
      0 18px 40px rgba(80,50,20,.08);
    font-size:.92rem;
  }
  .sources h2{margin:0 0 .8rem;font-size:1.2rem}
  .sources ol{padding-left:1.3rem;margin:0}
  .sources li{margin-bottom:.5rem;line-height:1.5}
  .sources .src-pub{color:rgb(var(--color-mute));font-size:.85rem}

  /* Read-progress capsule — vertical pill, right side, sticky */
  .read-progress{
    position:fixed;
    right:24px;
    top:50%;
    transform:translateY(-50%);
    z-index:60;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:.7rem;
    padding:14px 9px;
    background:linear-gradient(180deg, #f6ead0 0%, #ecd9a8 50%, #efe2c5 100%);
    border:1px solid #d4ba80;
    border-radius:999px;
    font-family:var(--sans);
    box-shadow:0 2px 8px rgba(122,90,43,.10), 0 12px 28px rgba(122,90,43,.08);
    min-height:140px;
    max-height:60vh;
  }
  .rp-bar-track{
    width:5px;
    flex:1;
    background:rgba(122,90,43,.18);
    border-radius:3px;
    overflow:hidden;
    position:relative;
    min-height:80px;
  }
  .rp-bar{
    display:block;
    width:100%;
    height:0;
    background:linear-gradient(180deg, rgb(var(--color-button)) 0%, #b08544 100%);
    border-radius:3px;
    position:absolute;
    top:0;
    left:0;
    transition:height .12s linear;
  }
  .rp-text{
    font-variant-numeric:tabular-nums;
    color:rgb(var(--color-button));
    font-weight:700;
    font-size:.62rem;
    text-transform:uppercase;
    letter-spacing:.08em;
    writing-mode:vertical-rl;
    transform:rotate(180deg);
    white-space:nowrap;
    line-height:1;
  }
  .read-progress.done{
    background:linear-gradient(180deg, #d4b97a 0%, #e8d4a3 100%);
    border-color:rgb(var(--color-button));
  }
  .read-progress.done .rp-bar{background:rgb(var(--color-button))}
  .read-progress.done .rp-text{color:#5d4520}
  @media (max-width:880px){
    .read-progress{
      right:14px;
      padding:11px 7px;
      min-height:110px;
    }
    .rp-text{font-size:.58rem}
  }
  @media (max-width:520px){
    .read-progress{
      right:8px;
      padding:9px 5px;
      min-height:88px;
      gap:.5rem;
    }
    .rp-bar-track{width:4px;min-height:55px}
    .rp-text{font-size:.55rem;letter-spacing:.06em}
  }
  @media print{.read-progress{display:none!important}}

  /* Buttons */
  .btn{
    display:inline-block;
    background:rgb(var(--color-button));
    color:rgb(var(--color-button-text));
    padding:.7rem 1.25rem;
    border-radius:4px;
    font-weight:600;
    letter-spacing:.04em;
    font-size:.92rem;
    text-transform:uppercase;
  }
  .btn:hover{text-decoration:none;background:rgba(var(--color-button),.9)}

  /* Hero (index + 404) */
  /* === INDEX SECTIONS (Featured / Recent / Alphabetical) === */
  .i-section{margin:2.4rem 0}
  .i-section__head{
    font-family:var(--sans);
    font-size:11px;
    font-weight:700;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--brown);
    margin:0 0 1rem;
  }

  .hero{margin-bottom:2.5rem}
  .hero h1{margin-bottom:.5rem}
  .hero p{font-size:1.1rem;color:rgba(var(--color-foreground),.8);margin:0 0 1rem}

  /* Article list (index) */
  .article-list{list-style:none;padding:0;margin:0;border-top:1px solid rgb(var(--color-rule))}
  .article-list li{border-bottom:1px solid rgb(var(--color-rule));padding:0}
  .article-list a{
    display:block;
    padding:1.1rem .25rem;
    color:rgb(var(--color-foreground));
    transition:background .15s ease,padding .15s ease;
  }
  .article-list a:hover{background:rgba(var(--color-contrast),.18);text-decoration:none;padding-left:.75rem}
  .article-list strong{
    display:block;
    font-family:var(--serif);
    font-size:1.12rem;
    margin-bottom:.25rem;
    font-weight:600;
  }
  .article-list span{
    display:block;
    font-size:.92rem;
    color:rgb(var(--color-mute));
    font-weight:400;
    line-height:1.5;
  }

  /* Footer */
  .tm-footer{
    background:linear-gradient(180deg,var(--footer-bg-top) 0%,var(--footer-bg-bot) 100%);
    color:var(--footer-fg);
    padding:64px 40px 32px;
    margin-top:5rem;
  }
  .tm-footer__sms-banner{
    max-width:560px;
    margin:0 auto 48px;
    text-align:center;
    padding:28px 32px;
    background:linear-gradient(135deg, rgba(212,185,122,.18) 0%, rgba(218,196,144,.10) 100%);
    border:1px solid rgba(212,185,122,.32);
    border-radius:12px;
  }
  .tm-footer__sms-banner h4{
    font-family:var(--serif);
    font-size:14px;
    font-weight:600;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--footer-accent);
    margin:0 0 12px;
  }
  .tm-footer__sms-banner p{
    margin:0 0 8px;
    font-size:15px;
    line-height:1.55;
    color:var(--footer-fg);
  }
  .tm-footer__sms-banner strong{
    color:var(--footer-accent);
    font-weight:700;
    letter-spacing:.04em;
  }
  .tm-footer__sms-banner a{
    color:var(--footer-accent);
    font-weight:600;
    font-variant-numeric:tabular-nums;
    border-bottom:1px solid rgba(212,185,122,.4);
  }
  .tm-footer__sms-banner a:hover{color:#faf7f0;border-bottom-color:#faf7f0;text-decoration:none}
  .tm-footer__sms-fineprint{
    font-size:11px !important;
    line-height:1.5 !important;
    opacity:.55;
    margin:10px 0 0 !important;
  }
  .tm-footer a{color:var(--footer-accent);text-decoration:none}
  .tm-footer a:hover{color:#faf7f0}
  .tm-footer__brand{
    max-width:1200px;
    margin:0 auto 48px;
    text-align:center;
    border-bottom:1px solid rgba(212,185,122,.2);
    padding-bottom:40px;
  }
  .tm-footer__brand-logo{
    position:relative;
    display:inline-block;
    margin-bottom:14px;
  }
  .tm-footer__brand img{
    height:60px;
    width:auto;
    filter:brightness(0) invert(1);
    display:block;
  }
  .tm-footer__brand-logo sup{
    position:absolute;
    top:-4px;
    right:-14px;
    font-family:var(--sans);
    font-size:13px;
    color:var(--footer-accent);
    font-weight:700;
    line-height:1;
  }
  .tm-footer__tagline{
    font-family:var(--serif);
    font-size:18px;
    font-style:italic;
    opacity:.85;
    margin:0;
  }
  .tm-footer__inner{
    max-width:1200px;
    margin:0 auto;
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:40px;
    align-items:start;
  }
  .tm-footer h4{
    font-family:var(--serif);
    font-size:14px;
    font-weight:600;
    letter-spacing:.06em;
    text-transform:uppercase;
    color:#faf7f0;
    margin:0 0 18px;
  }
  .tm-footer ul{list-style:none;padding:0;margin:0;display:grid;gap:10px;font-size:14px}
  .tm-footer__social{display:flex;gap:12px;margin-bottom:20px}
  .tm-footer__social a{
    width:36px;
    height:36px;
    border-radius:50%;
    background:rgba(212,185,122,.15);
    display:flex;
    align-items:center;
    justify-content:center;
    transition:background .2s ease;
  }
  .tm-footer__social a:hover{background:rgba(212,185,122,.3)}
  .tm-footer__contact{font-size:14px;line-height:1.6}
  .tm-footer__contact .label{
    display:block;
    font-size:11px;
    letter-spacing:.18em;
    text-transform:uppercase;
    opacity:.6;
    margin-bottom:2px;
  }
  .tm-footer__contact a{display:block}
  .tm-footer__bottom{
    max-width:1200px;
    margin:48px auto 0;
    padding:24px 0 0;
    border-top:1px solid rgba(212,185,122,.2);
    display:flex;
    justify-content:space-between;
    flex-wrap:wrap;
    gap:14px;
    font-size:12px;
    opacity:.7;
  }
  @media (max-width:860px){
    .tm-footer__inner{grid-template-columns:1fr 1fr;gap:32px}
    .tm-footer__bottom{flex-direction:column;text-align:center}
  }
  @media (max-width:520px){
    .tm-footer__inner{grid-template-columns:1fr}
    .tm-footer{padding:48px 22px 24px}
  }

  /* === TAXONOMY COMPONENTS === */
  /* Topic grid (index browse-by-topic + hub "more topics") */
  .topic-grid{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
  .topic-grid a{
    display:block;height:100%;padding:1.1rem 1.2rem;border-radius:12px;
    background:linear-gradient(135deg,#fdf8e8 0%,#f1e6c8 100%);
    border:1px solid #e8d9b2;border-left:3px solid rgb(var(--color-button));
    box-shadow:0 1px 2px rgba(80,50,20,.08),0 4px 12px rgba(80,50,20,.08);
    transition:transform .15s ease,box-shadow .15s ease;
  }
  .topic-grid a:hover{transform:translateY(-2px);text-decoration:none;box-shadow:0 2px 4px rgba(80,50,20,.12),0 10px 24px rgba(80,50,20,.12)}
  .topic-grid strong{display:block;font-family:var(--serif);font-size:1.1rem;margin-bottom:.3rem;color:rgb(var(--color-foreground))}
  .topic-grid span{display:block;font-size:.9rem;line-height:1.5;color:rgb(var(--color-mute))}

  /* Product bridge CTA */
  .bridge{
    display:flex;align-items:center;justify-content:space-between;gap:1.2rem;flex-wrap:wrap;
    margin:2.4rem 0;padding:1.3rem 1.5rem;border-radius:12px;
    background:linear-gradient(135deg,#f7ecd1 0%,#ecdab0 100%);
    border:1px solid #e2cf99;border-left:3px solid rgb(var(--color-button));
  }
  .bridge__text strong{font-family:var(--serif);font-size:1.1rem;color:rgb(var(--color-foreground));font-weight:600}
  .bridge__btns{display:flex;gap:.6rem;flex-wrap:wrap}

  /* Related guides */
  .related{margin:2.4rem 0}
  .related h2{font-size:1.15rem}
  .related ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:.6rem}
  .related a{
    display:inline-block;padding:.45rem .9rem;border-radius:999px;font-size:.9rem;
    background:rgba(var(--color-contrast),.22);border:1px solid rgb(var(--color-rule));color:rgb(var(--color-button));
  }
  .related a:hover{background:rgba(var(--color-contrast),.4);text-decoration:none}

  /* Status pills (safety + regulatory) */
  .pill{display:inline-block;padding:.2rem .6rem;border-radius:999px;font-size:.8rem;font-weight:600;font-family:var(--sans);white-space:nowrap}
  .pill--ok{background:#e3f0dc;color:#3d6b27}
  .pill--warn{background:#fbeccd;color:#8a5a14}
  .pill--bad{background:#f6dcdc;color:#9a2a2a}

  /* Safety + regulatory sections */
  .safety,.reg{margin:2.6rem 0}
  .safety__summary,.reg__summary{color:rgba(var(--color-foreground),.85)}
  .reg__grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:1rem}
  .reg__col{padding:1.1rem 1.2rem;border-radius:12px;background:rgb(var(--color-card));border:1px solid rgb(var(--color-rule))}
  .reg__col h3{margin:0 0 .6rem;font-size:1.05rem}
  .reg__col p{margin:.6rem 0 0;font-size:.92rem;color:rgb(var(--color-mute))}
  @media (max-width:560px){.reg__grid{grid-template-columns:1fr}}

  /* Wellness / FDA disclaimer — amber banner, kept prominent on ingredient/effects pages */
  .wellness-disclaimer{
    margin:1.6rem 0;padding:.9rem 1.15rem;border-radius:8px;
    background:#fbf6e6;border:1px solid #d9c27a;border-left:4px solid #b8902f;
    font-family:var(--sans);font-size:.82rem;line-height:1.55;color:#5a4a22;
  }

  /* On-page navigation ("On this page") */
  .on-page-nav{
    background:rgba(122,90,43,.05);border:1px solid rgb(var(--color-rule));
    border-radius:8px;padding:.9rem 1.2rem;margin:0 0 2rem;
  }
  .on-page-nav .opn-head{
    font-family:var(--sans);font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;
    color:rgb(var(--color-mute));margin:0 0 .5rem;font-weight:700;
  }
  .on-page-nav ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.35rem 1.2rem}
  .on-page-nav li{margin:0}
  .on-page-nav a{font-size:.92rem}

  /* Research citation cards — peer-reviewed / PubMed sources cited inline in the body */
  .citation-card{
    border:1px solid rgb(var(--color-rule));border-left:4px solid rgb(var(--color-button));
    background:rgb(var(--color-card));border-radius:6px;padding:1rem 1.15rem;margin:1.6rem 0;
  }
  .citation-card__type{
    display:inline-block;font-family:var(--sans);font-size:.68rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.07em;color:rgb(var(--color-button));margin:0 0 .35rem;
  }
  .citation-card__title{font-family:var(--serif);font-weight:600;font-size:1.02rem;line-height:1.35;margin:0 0 .3rem}
  .citation-card__title a{color:rgb(var(--color-foreground));text-decoration:none}
  .citation-card__title a:hover{text-decoration:underline}
  .citation-card__meta{font-family:var(--sans);font-size:.8rem;color:rgb(var(--color-mute));margin:0 0 .5rem}
  .citation-card__finding{margin:.35rem 0 0;font-size:.95rem}

  /* Hero image (recipe / article) */
  .hero-img{
    display:block;width:100%;height:auto;border-radius:12px;margin:0 0 1.6rem;
    border:1px solid rgb(var(--color-rule));
    box-shadow:0 1px 2px rgba(80,50,20,.08),0 8px 28px rgba(80,50,20,.12);
  }
</style>
</head>
<body>

<header class="tm-header">
  <nav class="tm-header__nav" aria-label="Main">${navHtml}</nav>
  <a class="tm-header__logo" href="${shop}" aria-label="${esc(env.SITE_NAME)} home">
    <img src="${logoHi}" srcset="${logoLo} 400w, ${logoHi} 1200w" sizes="(max-width:760px) 180px, 220px" alt="${esc(env.SITE_NAME)}" width="220" height="60">
    <sup>&reg;</sup>
  </a>
  <div class="tm-search" role="search">
    <svg class="tm-search__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input type="search" placeholder="Search articles…" aria-label="Search articles" autocomplete="off" spellcheck="false">
    <button class="tm-search__clear" type="button" aria-label="Clear search" tabindex="-1">
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div class="tm-search__dropdown" role="listbox" hidden></div>
  </div>
</header>

<main class="wrap">${bodyInner}</main>

<script>
(function(){
  var pill = document.querySelector('.read-progress');
  var article = document.querySelector('article');
  if (!pill || !article) return;
  var totalMins = parseInt(pill.getAttribute('data-total-mins') || '5', 10);
  var bar = pill.querySelector('.rp-bar');
  var text = pill.querySelector('.rp-text');
  var raf = null;
  function update(){
    raf = null;
    var rect = article.getBoundingClientRect();
    var winH = window.innerHeight;
    var top = rect.top;
    var height = rect.height;
    var scrolled;
    if (top >= 0) scrolled = 0;
    else if (top + height <= winH) scrolled = 1;
    else scrolled = Math.max(0, Math.min(1, -top / (height - winH)));
    var pct = Math.round(scrolled * 100);
    bar.style.height = pct + '%';
    var left = Math.max(0, Math.round(totalMins * (1 - scrolled)));
    if (scrolled >= 0.995) {
      text.textContent = 'Done';
      pill.classList.add('done');
    } else if (left === 0) {
      text.textContent = '< 1 min left';
      pill.classList.remove('done');
    } else {
      text.textContent = left + ' min left';
      pill.classList.remove('done');
    }
  }
  function onScroll(){
    if (raf) return;
    raf = requestAnimationFrame(update);
  }
  update();
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
})();
</script>

<script>
(function(){
  var box = document.querySelector('.tm-search');
  if (!box) return;
  var input = box.querySelector('input');
  var dropdown = box.querySelector('.tm-search__dropdown');
  var clearBtn = box.querySelector('.tm-search__clear');
  var articles = null;
  var activeIdx = -1;
  function syncClearBtn(){box.classList.toggle('has-query', !!input.value);}
  if (clearBtn) clearBtn.addEventListener('click', function(){
    input.value = '';
    syncClearBtn();
    dropdown.hidden = true;
    input.focus();
  });
  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function loadManifest(){
    if (articles) return Promise.resolve();
    return fetch('${mount}/manifest.json').then(function(r){return r.json();}).then(function(d){articles = d.articles || [];}).catch(function(){articles = [];});
  }
  function render(q){
    if (!q || !q.trim() || !articles) { dropdown.hidden = true; return; }
    var query = q.toLowerCase().trim();
    var hits = articles.filter(function(a){
      return (a.title||'').toLowerCase().indexOf(query)>=0 ||
             (a.description||'').toLowerCase().indexOf(query)>=0 ||
             (a.keywords||[]).some(function(k){return k.toLowerCase().indexOf(query)>=0;});
    }).slice(0,8);
    if (hits.length === 0) {
      dropdown.innerHTML = '<div class="tm-search__empty">No matches for &ldquo;' + escHtml(q) + '&rdquo;</div>';
      dropdown.hidden = false; return;
    }
    dropdown.innerHTML = hits.map(function(a){
      return '<a class="tm-search__hit" href="${mount}/' + escHtml(a.slug) + '" role="option">' +
        '<strong>' + escHtml(a.title) + '</strong>' +
        (a.description ? '<span>' + escHtml(a.description) + '</span>' : '') + '</a>';
    }).join('');
    dropdown.hidden = false;
    activeIdx = -1;
  }
  function setActive(idx){
    var hits = dropdown.querySelectorAll('.tm-search__hit');
    if (!hits.length) return;
    for (var i=0;i<hits.length;i++) hits[i].classList.remove('active');
    activeIdx = (idx + hits.length) % hits.length;
    hits[activeIdx].classList.add('active');
    hits[activeIdx].scrollIntoView({block:'nearest'});
  }
  input.addEventListener('focus', function(){loadManifest().then(function(){if (input.value) render(input.value);});});
  input.addEventListener('input', function(){syncClearBtn(); render(input.value);});
  input.addEventListener('keydown', function(e){
    if (dropdown.hidden) return;
    var hits = dropdown.querySelectorAll('.tm-search__hit');
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === 'Enter' && activeIdx >= 0 && hits[activeIdx]) { e.preventDefault(); window.location.href = hits[activeIdx].getAttribute('href'); }
    else if (e.key === 'Escape') { dropdown.hidden = true; input.blur(); }
  });
  document.addEventListener('click', function(e){if (!box.contains(e.target)) dropdown.hidden = true;});
})();
</script>

<footer class="tm-footer">
  <div class="tm-footer__sms-banner">
    <h4>Get discounts</h4>
    <p>Text <strong>${SMS_KEYWORD}</strong> to <a href="sms:${TOLL_FREE_TEL}?body=${SMS_KEYWORD}">${TOLL_FREE_DISPLAY}</a> for ${SMS_OFFER}.</p>
    <p class="tm-footer__sms-fineprint">Recurring msgs. Msg &amp; data rates may apply. Reply STOP to cancel, HELP for help.</p>
  </div>
  <div class="tm-footer__brand">
    <div class="tm-footer__brand-logo">
      <img src="${logoLo}" alt="${esc(env.SITE_NAME)}" width="240" height="60">
      <sup>&reg;</sup>
    </div>
    <p class="tm-footer__tagline">Food with benefits. Real ingredients.</p>
  </div>
  <div class="tm-footer__inner">
    <div>
      <h4>Quick Links</h4>
      <ul>${FOOTER_LINKS.quick.map(l => `<li><a href="${expandLink(l.href, shop, mount)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h4>Policies</h4>
      <ul>${FOOTER_LINKS.policies.map(l => `<li><a href="${expandLink(l.href, shop, mount)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h4>Connect</h4>
      <div class="tm-footer__social">${SOCIAL_LINKS.map(s => `<a href="${s.href}" aria-label="${esc(s.label)}" target="_blank" rel="noopener">${s.icon}</a>`).join('')}</div>
      <div class="tm-footer__contact">
        <span class="label">Customer Care</span>
        <a href="mailto:support@tmolecule.com">support@tmolecule.com</a>
        <span class="label" style="margin-top:14px;">Hours</span>
        <span>Mon–Fri, 9am–5pm ET</span>
      </div>
    </div>
  </div>
  <div class="tm-footer__bottom">
    <div>&copy; ${year} ${esc(env.SITE_NAME)}<sup style="color:var(--footer-accent);font-weight:700;font-size:10px;margin-left:2px;">&reg;</sup></div>
    <div><a href="${shop}">Visit shop &rsaquo;</a></div>
  </div>
</footer>

</body>
</html>`;
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function readingTime(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const words = (text.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 220));
}
