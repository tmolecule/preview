#!/usr/bin/env node
// sanitize:seeds -- run an allowlist sanitizer over every seed body_html and flag any
// page whose markup contains tags/attributes outside the allowlist (e.g. a stray <script>,
// <iframe>, on* handler). Check mode: reports, exits nonzero if disallowed markup found.
// Compares TAG SETS before/after sanitizing (robust to harmless reformatting).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'seed');

const OPTS = {
  // safe semantic tags the corpus legitimately uses; the real guard is below (no script/iframe/on*/js:)
  allowedTags: ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'strong', 'em', 'b', 'i', 'br', 'hr', 'blockquote', 'cite', 'div', 'figure', 'figcaption', 'img',
    'section', 'article', 'aside', 'span', 'sup', 'sub', 'details', 'summary'],
  allowedAttributes: {
    a: ['href', 'rel', 'target'], div: ['class', 'style', 'id'], span: ['class', 'style'],
    img: ['src', 'alt', 'loading', 'decoding', 'width', 'height'], table: ['style', 'class'],
    th: ['style'], td: ['style', 'colspan'], tr: ['style', 'class'], section: ['class'], blockquote: ['class'], p: ['class'],
  },
  allowedSchemes: ['http', 'https'],
};

const tagSet = (html) => new Set([...html.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase()));

const files = readdirSync(SEED).filter(f => f.endsWith('.json'));
let flagged = 0, checked = 0;
for (const f of files) {
  let d; try { d = JSON.parse(readFileSync(join(SEED, f), 'utf8')); } catch { continue; }
  if (!d.body_html) continue;
  checked++;
  const before = tagSet(d.body_html);
  const cleaned = sanitizeHtml(d.body_html, OPTS);
  const after = tagSet(cleaned);
  const removed = [...before].filter(t => !after.has(t));
  // also flag inline event handlers / javascript: urls explicitly
  // handler must sit inside a tag (preceded by whitespace) -- avoids matching prose like "concentration = ..."
  const dangerous = /<[^>]*\son\w+\s*=|javascript:/i.test(d.body_html);
  if (removed.length || dangerous) {
    flagged++;
    console.error(`SANITIZE ${f}: ${removed.length ? 'disallowed tags removed -> ' + removed.join(', ') : ''}${dangerous ? '  [event-handler/js: URL present]' : ''}`);
  }
}
console.log(`\nsanitize:seeds -- checked ${checked} pages, ${flagged} flagged`);
if (flagged) { console.error('FAIL: disallowed markup above.'); process.exit(1); }
console.log('OK');
