#!/usr/bin/env node
/**
 * Vector-resolved internal-linking pass for the TMolecule /learn corpus.
 *
 * TM differs from WhollyKaw: pages already carry a hand-authored `related` slug
 * list (avg ~2.7 links) rendered by renderRelated(). So this pass is a
 * GAP-FILLER, not a replacement — it embeds every page, finds the strongest
 * semantic neighbours, and emits only NEW suggestions to top each page up to
 * K_TARGET total links. Manual links keep priority; the template merges.
 *
 * Output: src/data/related-links.json -> { [slug]: [{ slug, title, score }] }
 *         (vector top-ups only; manual `related` stays authoritative)
 *
 * Run: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/build-related-links.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '..', 'seed');
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'related-links.json');
const CACHE_DIR = join(__dirname, '.cache');
const CACHE_PATH = join(CACHE_DIR, 'related-embeddings.json');

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const EMBED_BATCH = 50;
const K_TARGET = 5;       // desired total links per page (manual + vector)
const K_MAX_ADD = 4;      // never add more than this many vector links to one page
const DROP_GAP = 0.06;    // keep candidates within this cosine of the best
const FLOOR = 0.52;       // hard minimum cosine
const MIRROR_PENALTY = 0.02;

function loadPages() {
  const files = readdirSync(SEED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  const pages = [];
  for (const f of files) {
    let d;
    try { d = JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')); } catch { continue; }
    if (!d || !d.title) continue;
    const slug = f.replace(/\.json$/, '');
    if (slug.includes(':')) continue;
    const kws = Array.isArray(d.keywords) ? d.keywords : [];
    const embedText = [d.h1 || d.title, d.meta_description || '', kws.join(', ')]
      .filter(Boolean).join('. ').slice(0, 1200);
    const manual = new Set(Array.isArray(d.related) ? d.related.filter(Boolean) : []);
    [...String(d.body_html || '').matchAll(/\/learn\/([a-z0-9-]+)/g)].forEach(m => manual.add(m[1]));
    pages.push({
      slug, title: d.title, embedText,
      cluster: d.cluster || null,
      isMirror: !!d.canonical_url,
      manual,                         // existing links to preserve + skip
      manualCount: Array.isArray(d.related) ? d.related.filter(Boolean).length : 0,
    });
  }
  return pages;
}

function textHash(t) { return createHash('sha1').update(EMBED_MODEL + '\n' + t).digest('hex'); }

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

async function embedAll(pages) {
  let cache = {};
  if (existsSync(CACHE_PATH)) { try { cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8')); } catch {} }
  const need = pages.filter(p => !cache[textHash(p.embedText)]);
  console.log(`embeddings: ${pages.length - need.length} cached, ${need.length} to fetch`);
  for (let i = 0; i < need.length; i += EMBED_BATCH) {
    const slice = need.slice(i, i + EMBED_BATCH);
    const vecs = await embedBatch(slice.map(p => p.embedText));
    slice.forEach((p, j) => { cache[textHash(p.embedText)] = vecs[j]; });
  }
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  return pages.map(p => cache[textHash(p.embedText)]);
}

function normalize(v) { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return v.map(x => x / n); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

const pages = loadPages();
console.log(`corpus: ${pages.length} pages`);
const vectors = (await embedAll(pages)).map(normalize);

const map = {};
const report = { total: pages.length, topped: 0, added: 0, alreadyFull: 0, scores: [] };

for (let i = 0; i < pages.length; i++) {
  const src = pages[i];
  const slots = Math.min(K_MAX_ADD, K_TARGET - src.manualCount);
  if (slots <= 0) { report.alreadyFull++; map[src.slug] = []; continue; }

  const scored = [];
  for (let k = 0; k < pages.length; k++) {
    if (k === i) continue;
    const tgt = pages[k];
    if (src.manual.has(tgt.slug)) continue;       // already linked (manual or body)
    let score = dot(vectors[i], vectors[k]);
    if (tgt.isMirror) score -= MIRROR_PENALTY;
    scored.push({ slug: tgt.slug, title: tgt.title, raw: dot(vectors[i], vectors[k]), score });
  }
  scored.sort((a, b) => b.score - a.score);
  const chosen = [];
  if (scored.length) {
    const best = scored[0].score;
    for (const c of scored) {
      if (chosen.length >= slots) break;
      if (c.score < FLOOR) break;
      if (c.score < best - DROP_GAP) break;
      chosen.push({ slug: c.slug, title: c.title, score: Number(c.raw.toFixed(4)) });
    }
  }
  map[src.slug] = chosen;
  if (chosen.length) { report.topped++; report.added += chosen.length; chosen.forEach(c => report.scores.push(c.score)); }
}

writeFileSync(OUT_PATH, JSON.stringify(map, null, 0));

const avg = report.scores.length ? report.scores.reduce((s, x) => s + x, 0) / report.scores.length : 0;
console.log('\n=== TM related-links report ===');
console.log(`pages:              ${report.total}`);
console.log(`already at target:  ${report.alreadyFull}`);
console.log(`topped up:          ${report.topped}`);
console.log(`vector links added: ${report.added}`);
console.log(`avg cosine (added): ${avg.toFixed(3)}`);
console.log(`written: ${OUT_PATH}`);
console.log('\n=== samples ===');
for (const s of ['collagen-for-skin', 'best-chai-tea', 'matcha-vs-green-tea', 'turmeric', 'anti-inflammatory-diet']) {
  if (map[s]) console.log(`${s} +-> ${map[s].map(x => `${x.slug}(${x.score})`).join(', ') || '(already full / none)'}`);
}
