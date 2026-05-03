const NAV_LINKS = [
  { href: '__SHOP__/', label: 'Home' },
  { href: '__SHOP__/collections/all', label: 'Shop' },
  { href: '/', label: 'Learn' },
  { href: '__SHOP__/pages/about', label: 'About' },
  { href: '__SHOP__/pages/contact', label: 'Contact' }
];

const FOOTER_LINKS = {
  quick: [
    { href: '__SHOP__/', label: 'Home' },
    { href: '__SHOP__/collections/all', label: 'Shop' },
    { href: '/', label: 'Learn' },
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

export function renderArticle(data, slug, origin, env) {
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

  const canonical = `${origin}/${slug}`;
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
    author: {
      '@type': 'Person',
      name: env.AUTHOR_NAME || env.SITE_NAME,
      url: env.SHOP_ORIGIN,
      worksFor: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
    },
    publisher: {
      '@type': 'Organization',
      name: env.SITE_NAME,
      logo: { '@type': 'ImageObject', url: env.LOGO_URL }
    },
    citation: sources.length
      ? sources.map(s => ({
          '@type': 'CreativeWork',
          name: s.title,
          url: s.url,
          publisher: s.publisher ? { '@type': 'Organization', name: s.publisher } : undefined
        }))
      : undefined
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: env.SITE_NAME, item: env.SHOP_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Learn', item: `${origin}/` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical }
    ]
  };

  const schemaTags = [
    `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`
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

  const bylineHtml = `<p class="byline">By <span class="author-name">${esc(env.AUTHOR_NAME || env.SITE_NAME)}</span> &middot; <time datetime="${esc(published_at)}">${esc(dateStr)}</time> &middot; ${readMins} min read</p>`;

  return baseHtml({
    title: safeTitle,
    description: safeDesc,
    canonical,
    ogImage: heroImage,
    ogType: 'article',
    schemaTags,
    env,
    bodyInner: `
      <nav class="crumbs"><a href="${env.SHOP_ORIGIN}">${esc(env.SITE_NAME)}</a> &rsaquo; <a href="/">Learn</a> &rsaquo; <span>${safeTitle}</span></nav>
      <article>
        <h1>${esc(h1 || title)}</h1>
        ${meta_description ? `<p class="lede">${safeDesc}</p>` : ''}
        ${bylineHtml}
        <div class="read-progress" aria-live="polite" aria-label="Reading progress" data-total-mins="${readMins}">
          <span class="rp-bar-track"><span class="rp-bar"></span></span>
          <span class="rp-text">${readMins} min left</span>
        </div>
        ${body_html}
        ${faqHtml}
        ${sourcesHtml}
      </article>
    `
  });
}

export function renderIndex(items, origin, env) {
  const list = items.map(item =>
    `<li><a href="/${item.slug}"><strong>${esc(item.title)}</strong>${item.meta_description ? `<span>${esc(item.meta_description)}</span>` : ''}</a></li>`
  ).join('');

  return baseHtml({
    title: `Learn about tea — ${env.SITE_NAME}`,
    description: 'Guides, how-tos, and origin stories from the TMolecule tea library.',
    canonical: `${origin}/`,
    ogType: 'website',
    env,
    schemaTags: [
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${env.SITE_NAME} Learn`,
        url: `${origin}/`,
        hasPart: items.map(i => ({ '@type': 'Article', name: i.title, url: `${origin}/${i.slug}` }))
      })}</script>`,
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: origin,
        name: `${env.SITE_NAME} Learn`,
        publisher: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN }
      })}</script>`
    ],
    bodyInner: `
      <header class="hero">
        <h1>Learn about tea</h1>
        <p>Brewing guides, origin stories, and tea education from the ${esc(env.SITE_NAME)} library.</p>
      </header>
      <ul class="article-list">${list || '<li>No articles yet.</li>'}</ul>
    `
  });
}

export function renderNotFound(env, origin) {
  return baseHtml({
    title: `Page not found — ${env.SITE_NAME} Learn`,
    description: 'The page you requested could not be found.',
    canonical: `${origin}/`,
    ogType: 'website',
    env,
    schemaTags: [],
    bodyInner: `
      <header class="hero">
        <h1>Page not found</h1>
        <p>The article you’re looking for doesn’t exist or has moved.</p>
        <p><a class="btn" href="/">Browse all guides</a> &nbsp; <a href="${env.SHOP_ORIGIN}">Visit the shop &rsaquo;</a></p>
      </header>
    `
  });
}

function baseHtml({ title, description, canonical, ogImage, ogType = 'article', schemaTags = [], bodyInner, env }) {
  const shop = env.SHOP_ORIGIN;
  const navHtml = NAV_LINKS.map(l =>
    `<a href="${l.href.replace('__SHOP__', shop)}">${esc(l.label)}</a>`
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
      linear-gradient(180deg, #f6ecc8 0%, #eedcae 55%, #e0c896 100%);
    background-attachment:fixed;
    background-size:240px 240px, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
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
  @media (max-width:760px){
    .tm-header{grid-template-columns:1fr;gap:14px;text-align:center;padding:16px 20px}
    .tm-header__nav{justify-content:center;gap:16px;font-size:13px}
    .tm-header__nav a{font-size:13px}
    .tm-header__spacer{display:none}
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
</style>
</head>
<body>

<header class="tm-header">
  <nav class="tm-header__nav" aria-label="Main">${navHtml}</nav>
  <a class="tm-header__logo" href="${shop}" aria-label="${esc(env.SITE_NAME)} home">
    <img src="${logoHi}" srcset="${logoLo} 400w, ${logoHi} 1200w" sizes="(max-width:760px) 180px, 220px" alt="${esc(env.SITE_NAME)}" width="220" height="60">
    <sup>&reg;</sup>
  </a>
  <div class="tm-header__spacer"></div>
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
    <p class="tm-footer__tagline">Food with benefits. Real health benefits.</p>
  </div>
  <div class="tm-footer__inner">
    <div>
      <h4>Quick Links</h4>
      <ul>${FOOTER_LINKS.quick.map(l => `<li><a href="${l.href.replace('__SHOP__', shop)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h4>Policies</h4>
      <ul>${FOOTER_LINKS.policies.map(l => `<li><a href="${l.href.replace('__SHOP__', shop)}">${esc(l.label)}</a></li>`).join('')}</ul>
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
