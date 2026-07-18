#!/usr/bin/env node
// preview:seed <slug> -- render a seed's CONTENT to a standalone HTML file you can open
// locally, so you can eyeball a /learn page before deploy (no wrangler round-trip).
// Renders the body + FAQ + sources as they'll appear; not full worker chrome.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: npm run preview:seed <slug>'); process.exit(2); }
const seedPath = join(ROOT, 'seed', slug + '.json');
if (!existsSync(seedPath)) { console.error('no seed: ' + seedPath); process.exit(2); }
const d = JSON.parse(readFileSync(seedPath, 'utf8'));

const faqs = (d.faqs || []).map(f => `<details><summary><strong>${f.q}</strong></summary><p>${f.a}</p></details>`).join('\n');
const sources = (d.sources || []).map(s => `<li><a href="${s.url}">${s.title || s.url}</a>${s.publisher ? ' — ' + s.publisher : ''}</li>`).join('\n');
const spots = (d.spotlight_pool || []).map(s => `<li><strong>${s.title || s.handle}</strong> — $${s.price}${s.note ? ' — ' + s.note : ''}</li>`).join('\n');

const html = `<!doctype html><meta charset="utf-8"><title>PREVIEW: ${d.title || slug}</title>
<style>body{max-width:720px;margin:40px auto;padding:0 20px;font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#222}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #d9cfb6;padding:8px;text-align:left}
h1{font-size:1.8rem}details{margin:.4rem 0}.meta{color:#777;font-size:13px;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:24px}
.preview-banner{background:#c5a059;color:#fff;padding:6px 12px;border-radius:4px;font-size:13px;display:inline-block;margin-bottom:16px}</style>
<div class="preview-banner">LOCAL PREVIEW — content only, not full worker chrome</div>
<div class="meta"><strong>title:</strong> ${d.title || ''}<br><strong>meta:</strong> ${d.meta_description || ''}<br><strong>updated:</strong> ${d.updated_at || ''}</div>
<h1>${d.h1 || ''}</h1>
${d.body_html || ''}
${faqs ? '<h2>FAQ</h2>' + faqs : ''}
${spots ? '<h2>Spotlight</h2><ul>' + spots + '</ul>' : ''}
${sources ? '<h2>Sources</h2><ul>' + sources + '</ul>' : ''}`;

const outDir = join(ROOT, 'preview');
if (!existsSync(outDir)) mkdirSync(outDir);
const outPath = join(outDir, slug + '.html');
writeFileSync(outPath, html);
console.log('preview written: ' + outPath);
console.log('open: file://' + outPath);
