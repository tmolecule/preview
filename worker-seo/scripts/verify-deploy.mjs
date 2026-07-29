#!/usr/bin/env node
// verify:deploy [slug ...] -- after a deploy/KV push, content-level verify each live
// /learn/<slug>: HTTP 200, not a 404 body, contains its h1, and FAQPage schema if it
// has faqs. Catches the silent-bad-push 404 we discovered only via IndexNow returning 200.
// Default targets = the markdown-sourced pages in seed-src/.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'seed');
const SRC = join(ROOT, 'seed-src');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124';
const BASE = 'https://tmolecule.com/learn/';

let slugs = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!slugs.length && existsSync(SRC)) slugs = readdirSync(SRC).filter(f => f.endsWith('.md')).map(f => basename(f, '.md'));
if (!slugs.length) { console.error('no slugs given and seed-src/ empty'); process.exit(2); }

const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
let fail = 0;
const LIMIT = 5;
for (let i = 0; i < slugs.length; i += LIMIT) {
  await Promise.all(slugs.slice(i, i + LIMIT).map(async slug => {
    const out = { slug, ok: true, notes: [] };
    try {
      const r = await fetch(BASE + slug, { headers: { 'User-Agent': UA } });
      const body = await r.text();
      if (r.status !== 200) { out.ok = false; out.notes.push(`HTTP ${r.status}`); }
      if (/page not found/i.test(body)) { out.ok = false; out.notes.push('404 body'); }
      const seedPath = join(SEED, slug + '.json');
      if (existsSync(seedPath)) {
        const d = JSON.parse(readFileSync(seedPath, 'utf8'));
        if (d.h1) { const h1 = textOf(d.h1).trim().slice(0, 40); if (!textOf(body).includes(h1)) { out.ok = false; out.notes.push('h1 missing'); } }
        if ((d.faqs || []).length && !/FAQPage/.test(body)) { out.ok = false; out.notes.push('no FAQPage schema'); }
      }
    } catch (e) { out.ok = false; out.notes.push('fetch error: ' + e.message); }
    if (!out.ok) fail++;
    console.log(`${out.ok ? 'PASS' : 'FAIL'}  /learn/${slug}${out.notes.length ? '  (' + out.notes.join(', ') + ')' : ''}`);
  }));
}
console.log(`\nverify:deploy -- ${slugs.length} checked, ${fail} failed`);
process.exit(fail ? 1 : 0);
