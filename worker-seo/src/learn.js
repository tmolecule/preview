import { renderArticle, renderIndex } from './template.js';

export async function handleArticle(slug, env, origin) {
  const raw = await env.LEARN_PAGES.get(slug);
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response('Page data malformed', { status: 500 });
  }

  const html = renderArticle(data, slug, origin, env);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
      'x-tmolecule-source': 'worker-pseo',
      'link': `<${origin}/${slug}.md>; rel="alternate"; type="text/markdown"`
    }
  });
}

/**
 * Markdown alternative for AI agents / LLM crawlers / programmatic ingestion.
 * Same article content, no HTML chrome, no JS, no CSS, no nav.
 * Discoverable via the Link header on the HTML page and via /llms.txt.
 */
export async function handleArticleMarkdown(slug, env, origin) {
  const raw = await env.LEARN_PAGES.get(slug);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response('# Page data malformed', { status: 500 });
  }

  const md = renderArticleMarkdown(data, slug, origin, env);
  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
      'x-tmolecule-source': 'worker-pseo-md',
      'access-control-allow-origin': '*'
    }
  });
}

function renderArticleMarkdown(data, slug, origin, env) {
  const {
    title,
    h1,
    meta_description = '',
    body_html = '',
    published_at,
    updated_at,
    keywords = [],
    faqs = [],
    sources = []
  } = data;

  const canonical = `${origin}/${slug}`;
  const frontmatter = [
    '---',
    `title: ${escYaml(title)}`,
    `description: ${escYaml(meta_description)}`,
    `url: ${canonical}`,
    `published: ${published_at}`,
    `updated: ${updated_at}`,
    `author: ${escYaml(env.AUTHOR_NAME || env.SITE_NAME)}`,
    keywords.length ? `keywords: [${keywords.map(k => `"${k.replace(/"/g, '\\"')}"`).join(', ')}]` : '',
    `site: ${env.SITE_NAME}`,
    '---'
  ].filter(Boolean).join('\n');

  const bodyMd = htmlToMarkdown(body_html);
  const faqMd = faqs.length
    ? '\n\n## Frequently asked questions\n\n' + faqs.map(f =>
        `### ${f.q}\n\n${htmlToMarkdown(f.a_html || `<p>${f.a}</p>`)}`
      ).join('\n\n')
    : '';
  const sourcesMd = sources.length
    ? '\n\n## Sources\n\n' + sources.map((s, i) =>
        `${i + 1}. [${s.title}](${s.url})${s.publisher ? ` — ${s.publisher}` : ''}`
      ).join('\n')
    : '';

  return `${frontmatter}\n\n# ${h1 || title}\n\n${meta_description ? '*' + meta_description + '*\n\n' : ''}${bodyMd}${faqMd}${sourcesMd}\n`;
}

function escYaml(s) {
  if (!s) return '""';
  return `"${String(s).replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

/**
 * Lossy HTML-to-Markdown converter.
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  let s = html;

  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableHtml) => {
    const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]).trim());
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => stripTags(c[1]).trim()))
      .filter(r => r.length);
    if (!headers.length && !rows.length) return '';
    const head = headers.length ? '| ' + headers.join(' | ') + ' |\n|' + headers.map(() => '---').join('|') + '|\n' : '';
    const body = rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
    return '\n\n' + head + body + '\n\n';
  });

  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n## ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n### ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n> ${stripTags(t).trim()}\n\n`);

  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, items) => {
    const lis = [...items.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => `- ${inlineMd(m[1]).trim()}`);
    return '\n\n' + lis.join('\n') + '\n\n';
  });
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, items) => {
    const lis = [...items.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m, i) => `${i + 1}. ${inlineMd(m[1]).trim()}`);
    return '\n\n' + lis.join('\n') + '\n\n';
  });

  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n\n${inlineMd(t).trim()}\n\n`);

  s = stripTags(s);
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function inlineMd(s) {
  return s
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${stripTags(text).trim()}](${href})`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t).trim()}**`)
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t) => `**${stripTags(t).trim()}**`)
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t).trim()}*`)
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t) => `*${stripTags(t).trim()}*`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, ',').replace(/&ndash;/g, '-').replace(/&middot;/g, '·').replace(/&rsaquo;/g, '›').replace(/&copy;/g, '(c)').replace(/&reg;/g, '®');
}

export async function handleIndex(env, origin) {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const items = [];
  for (const key of list.keys) {
    const raw = await env.LEARN_PAGES.get(key.name);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      items.push({
        slug: key.name,
        title: data.title,
        meta_description: data.meta_description,
        updated_at: data.updated_at,
        keywords: data.keywords || []
      });
    } catch {}
  }
  items.sort((a, b) => a.title.localeCompare(b.title));
  const html = renderIndex(items, origin, env);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600'
    }
  });
}

/**
 * /llms.txt — discovery endpoint for LLM-based agents and AI search engines.
 */
export async function handleLlmsTxt(env, origin) {
  const list = await env.LEARN_PAGES.list({ limit: 1000 });
  const items = [];
  for (const key of list.keys) {
    const raw = await env.LEARN_PAGES.get(key.name);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      items.push({
        slug: key.name,
        title: data.title,
        description: data.meta_description,
        updated_at: data.updated_at,
        keywords: data.keywords || []
      });
    } catch {}
  }
  items.sort((a, b) => a.title.localeCompare(b.title));

  const lines = [
    `# ${env.SITE_NAME} Learn`,
    '',
    `> ${env.SITE_NAME} is a tea brand built on family heritage since 1935. The Learn site is our editorial library on chai, matcha, oolong, rooibos, brewing methods, and tea science. Each article has a clean Markdown alternative for programmatic ingestion.`,
    '',
    '## Articles',
    ''
  ];

  for (const it of items) {
    lines.push(`### [${it.title}](${origin}/${it.slug}.md)`);
    lines.push('');
    if (it.description) lines.push(`${it.description}`);
    if (it.updated_at) lines.push(`Last updated: ${it.updated_at.split('T')[0]}`);
    if (it.keywords && it.keywords.length) lines.push(`Topics: ${it.keywords.join(', ')}`);
    lines.push(`HTML: ${origin}/${it.slug}`);
    lines.push('');
  }

  lines.push(
    '## About',
    '',
    `- Site: ${env.SHOP_ORIGIN}`,
    `- Author: ${env.AUTHOR_NAME || env.SITE_NAME}`,
    `- Tagline: Food with benefits. Real health benefits.`,
    `- Categories: chai concentrates, masala chai, matcha, green tea, black tea, oolong tea, rooibos tea, tea brewing methods, tea health benefits`,
    ''
  );

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600'
    }
  });
}
