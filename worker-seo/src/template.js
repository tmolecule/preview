const NAV_LINKS = [
  { href: '/', label: 'Learn' },
  { href: '__SHOP__/collections/all', label: 'Shop' },
  { href: '__SHOP__/blogs/news', label: 'Journal' },
  { href: '__SHOP__/pages/about', label: 'About' }
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

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: h1 || title,
    description: meta_description,
    image: image_url || undefined,
    datePublished: published_at,
    dateModified: updated_at,
    mainEntityOfPage: canonical,
    keywords: keywords.length ? keywords.join(', ') : undefined,
    author: { '@type': 'Organization', name: env.SITE_NAME, url: env.SHOP_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: env.SITE_NAME,
      logo: { '@type': 'ImageObject', url: env.LOGO_URL }
    }
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

  return baseHtml({
    title: safeTitle,
    description: safeDesc,
    canonical,
    ogImage: image_url,
    ogType: 'article',
    schemaTags,
    env,
    bodyInner: `
      <nav class="crumbs"><a href="${env.SHOP_ORIGIN}">${esc(env.SITE_NAME)}</a> &rsaquo; <a href="/">Learn</a> &rsaquo; <span>${safeTitle}</span></nav>
      <article>
        <h1>${esc(h1 || title)}</h1>
        ${meta_description ? `<p class="lede">${safeDesc}</p>` : ''}
        ${body_html}
        ${faqHtml}
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
      <header class="hero"><h1>Learn about tea</h1><p>Brewing guides, origin stories, and tea education from the ${esc(env.SITE_NAME)} library.</p></header>
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
      <header class="hero"><h1>Page not found</h1><p>The article you’re looking for doesn’t exist or has moved.</p>
      <p><a href="/">Browse all guides</a> or <a href="${env.SHOP_ORIGIN}">visit the ${esc(env.SITE_NAME)} store</a>.</p></header>
    `
  });
}

function baseHtml({ title, description, canonical, ogImage, ogType = 'article', schemaTags = [], bodyInner, env }) {
  const navHtml = NAV_LINKS.map(l => `<a href="${l.href.replace('__SHOP__', env.SHOP_ORIGIN)}">${esc(l.label)}</a>`).join('');
  const verificationTag = env.GSC_VERIFICATION
    ? `<meta name="google-site-verification" content="${esc(env.GSC_VERIFICATION)}">`
    : '';
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
${schemaTags.join('\n')}
<style>
  :root{--bg:#faf7f2;--ink:#1f1c15;--mute:#7a7060;--rule:#e8e1d3;--accent:#5a4a2a;--card:#fff}
  *{box-sizing:border-box}
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:var(--ink);background:var(--bg);margin:0;line-height:1.65;-webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  header.site,footer.site{background:var(--card);border-bottom:1px solid var(--rule);padding:1rem 1.5rem}
  footer.site{border-top:1px solid var(--rule);border-bottom:none;margin-top:5rem;color:var(--mute);font-size:.875rem;text-align:center}
  .nav{display:flex;align-items:center;gap:1.5rem;max-width:1100px;margin:0 auto}
  .brand{font-weight:700;letter-spacing:.02em;font-size:1.05rem;color:var(--ink)}
  .nav a:not(.brand){color:#3e3a30;font-weight:500;font-size:.95rem}
  .wrap{max-width:740px;margin:0 auto;padding:2.5rem 1.5rem}
  .crumbs{font-size:.825rem;color:var(--mute);margin-bottom:1rem}
  .crumbs a{color:var(--mute)}
  h1{font-size:2.25rem;line-height:1.18;margin:.25rem 0 1rem;color:var(--ink);letter-spacing:-.01em}
  .lede{font-size:1.15rem;color:#403a2f;margin:0 0 1.75rem;line-height:1.55}
  article p{margin:0 0 1.1rem}
  article h2{font-size:1.45rem;margin:2.4rem 0 1rem}
  article h3{font-size:1.1rem;margin:1.8rem 0 .65rem}
  article ul,article ol{padding-left:1.25rem;margin:0 0 1.25rem}
  article li{margin-bottom:.4rem}
  article img{max-width:100%;height:auto;border-radius:6px;margin:1rem 0}
  article blockquote{border-left:3px solid var(--accent);padding:.25rem 0 .25rem 1rem;margin:1.25rem 0;color:#403a2f;font-style:italic}
  .faq{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--rule)}
  .faq h2{margin-top:0}
  .faq details{border:1px solid var(--rule);border-radius:6px;padding:.85rem 1.1rem;margin-bottom:.6rem;background:var(--card)}
  .faq summary{cursor:pointer;font-weight:600;list-style:none}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';float:right;color:var(--mute)}
  .faq details[open] summary::after{content:'\\2013'}
  .faq-a{margin-top:.6rem;color:#3e3a30}
  .hero{margin-bottom:2rem}
  .article-list{list-style:none;padding:0;margin:0}
  .article-list li{border-bottom:1px solid var(--rule);padding:0}
  .article-list a{display:block;padding:1rem 0;color:var(--ink)}
  .article-list a:hover{background:#f3eee4;text-decoration:none;padding-left:.5rem}
  .article-list strong{display:block;font-size:1.05rem;margin-bottom:.2rem}
  .article-list span{display:block;font-size:.9rem;color:var(--mute);font-weight:400}
</style>
</head>
<body>
<header class="site"><div class="nav"><a href="${env.SHOP_ORIGIN}" class="brand">${esc(env.SITE_NAME)}</a>${navHtml}</div></header>
<main class="wrap">${bodyInner}</main>
<footer class="site">&copy; ${new Date().getFullYear()} ${esc(env.SITE_NAME)} &middot; <a href="${env.SHOP_ORIGIN}/pages/contact">Contact</a> &middot; <a href="${env.SHOP_ORIGIN}/policies/privacy-policy">Privacy</a></footer>
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
