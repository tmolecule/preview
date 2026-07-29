#!/usr/bin/env node
// validate:seeds -- schema-validate every seed/*.json (HARD fail) + scan for
// no-medical-claims violations (WARN by default; HARD fail with --strict).
// Catches the two classes of bug we hit by hand: malformed seeds + compliance slips.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { findClaims } from './compliance.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'seed');
const STRICT = process.argv.includes('--strict');

const schema = {
  type: 'object',
  required: ['title', 'h1', 'meta_description', 'body_html'],
  properties: {
    title: { type: 'string', minLength: 1 },
    h1: { type: 'string', minLength: 1 },
    meta_description: { type: 'string', minLength: 1, maxLength: 320 },
    body_html: { type: 'string', minLength: 50 },
    keywords: { type: 'array', items: { type: 'string' } },
    faqs: { type: 'array', items: { type: 'object', required: ['q', 'a'], properties: { q: { type: 'string', minLength: 1 }, a: { type: 'string', minLength: 1 } } } },
    sources: { type: 'array', items: { type: 'object', required: ['url'], properties: { url: { type: 'string', pattern: '^https?://' } } } },
    spotlight_pool: { type: 'array', items: { type: 'object', required: ['handle', 'price'], properties: { handle: { type: 'string', minLength: 1 }, price: { type: 'number' } } } },
    recommended_products: { type: 'array', items: { type: 'object', required: ['handle'], properties: { handle: { type: 'string', minLength: 1 } } } },
  },
  additionalProperties: true,
};

// no-medical-claims scan (DISCLAIMER / NEGATION / BANNED regexes + findClaims) now lives in
// ./compliance.mjs — shared verbatim with the hard-fail Bun suite in test/compliance.test.ts.
const SKIP = new Set(['reviews.json']);

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const files = readdirSync(SEED).filter(f => f.endsWith('.json'));
let schemaErrors = 0, complianceHits = 0, skipped = 0, checked = 0;
const sentence = (text, m) => {
  const i = text.search(m); if (i < 0) return '';
  return text.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, ' ').trim();
};

for (const f of files) {
  if (SKIP.has(f)) { skipped++; continue; }
  let d;
  try { d = JSON.parse(readFileSync(join(SEED, f), 'utf8')); }
  catch (e) { console.error(`SCHEMA  ${f}: invalid JSON -- ${e.message}`); schemaErrors++; continue; }
  if (!d.body_html) { skipped++; continue; } // data file, not a page
  checked++;
  if (!validate(d)) {
    schemaErrors++;
    for (const e of validate.errors) console.error(`SCHEMA  ${f}: ${e.instancePath || '/'} ${e.message}`);
  }
  for (const h of findClaims(d)) {
    complianceHits++;
    console.warn(`CLAIM   ${f}: "${h.term}"  ->  ...${h.ctx.slice(60, 210)}...`);
  }
}

console.log(`\nvalidate:seeds -- checked ${checked} pages, skipped ${skipped} data files`);
console.log(`  schema errors: ${schemaErrors}   compliance flags: ${complianceHits}`);
if (schemaErrors) { console.error('FAIL: schema errors must be fixed.'); process.exit(1); }
if (complianceHits && STRICT) { console.error('FAIL (--strict): compliance flags present.'); process.exit(1); }
if (complianceHits) console.warn('WARN: review compliance flags above (advisory; run with --strict to gate).');
console.log('OK');
