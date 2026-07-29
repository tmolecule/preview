#!/usr/bin/env node
/**
 * Build the `tm-learn-corpus` Vectorize index from the /learn seeds (TMolecule).
 * Ported from WhollyKaw's build-learn-vectors.mjs.
 *
 * One vector per /learn page (title + meta + keywords + FAQ + body lead),
 * embedded with Workers AI bge-base (768-dim). Each vector carries an
 * answer-ready `snippet` in metadata so the advisor can inject retrieved
 * passages straight into the Claude call without a second fetch.
 *
 * Writes NDJSON to scripts/.cache/tm-learn-vectors.ndjson, then upsert with:
 *   npx wrangler vectorize upsert tm-learn-corpus --file scripts/.cache/tm-learn-vectors.ndjson
 *
 * Run: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/build-learn-vectors.mjs
 * Re-run after adding/editing /learn pages (not wired into predeploy).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '..', 'seed');
const CACHE_DIR = join(__dirname, '.cache');
const OUT_NDJSON = join(CACHE_DIR, 'tm-learn-vectors.ndjson');

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const EMBED_BATCH = 50;
const SNIPPET_MAX = 850;
const SHOP = 'https://tmolecule.com';
const SKIP = new Set(['reviews.json']);

const stripHtml = (h) =>
  String(h || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function loadPages() {
  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_') && !SKIP.has(f));
  const pages = [];
  for (const f of files) {
    let d;
    try { d = JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')); } catch { continue; }
    if (!d || !d.title || !d.body_html) continue;
    const slug = f.slice(0, -5);
    const keywords = Array.isArray(d.keywords) ? d.keywords : [];
    const faqs = Array.isArray(d.faqs) ? d.faqs : [];
    const bodyText = stripHtml(d.body_html);
    const faqText = faqs.map((q) => `Q: ${q.q} A: ${q.a}`).join(' ');

    const embedText = [
      d.h1 || d.title,
      d.title,
      d.meta_description || '',
      keywords.length ? `Topics: ${keywords.join(', ')}.` : '',
      faqs.map((q) => q.q).join(' '),
      bodyText.slice(0, 600),
    ].filter(Boolean).join('\n').slice(0, 2000);

    const snippet = [d.meta_description || '', faqText || bodyText].filter(Boolean).join(' ').slice(0, SNIPPET_MAX);

    pages.push({ slug, title: d.title, url: `${SHOP}/learn/${slug}`, embedText, snippet });
  }
  return pages;
}

async function embedBatch(texts) {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN;
  if (!acct || !tok) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${EMBED_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('embed failed: ' + JSON.stringify(j.errors || j).slice(0, 300));
  return j.result.data;
}

async function main() {
  const pages = loadPages();
  console.log(`Loaded ${pages.length} /learn pages.`);
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const lines = [];
  for (let i = 0; i < pages.length; i += EMBED_BATCH) {
    const slice = pages.slice(i, i + EMBED_BATCH);
    const vecs = await embedBatch(slice.map((p) => p.embedText));
    slice.forEach((p, j) => {
      lines.push(JSON.stringify({
        id: p.slug,
        values: vecs[j],
        metadata: { slug: p.slug, title: p.title, url: p.url, snippet: p.snippet },
      }));
    });
    console.log(`  embedded ${Math.min(i + EMBED_BATCH, pages.length)}/${pages.length}`);
  }

  writeFileSync(OUT_NDJSON, lines.join('\n') + '\n');
  console.log(`\nWrote ${lines.length} vectors → ${OUT_NDJSON}`);
  console.log(`Next: npx wrangler vectorize upsert tm-learn-corpus --file ${OUT_NDJSON}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
