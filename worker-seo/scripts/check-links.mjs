#!/usr/bin/env node
// check:links -- verify every internal /learn/<slug> link in seed bodies resolves
// to a real seed OR a known code-route (offline, fast). With --remote, also verifies
// product handles (spotlight + /products/ links) against live Shopify product JSON.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'seed');
const REMOTE = process.argv.includes('--remote');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124';

// code-routes served under /learn/* that have no seed file
const CODE_ROUTES = new Set([]);

const files = readdirSync(SEED).filter(f => f.endsWith('.json'));
const slugs = new Set(files.map(f => basename(f, '.json')));
const valid = new Set([...slugs, ...CODE_ROUTES]);

let broken = 0, handlesChecked = 0, handlesBad = 0;
const productHandles = new Set();

for (const f of files) {
  let d; try { d = JSON.parse(readFileSync(join(SEED, f), 'utf8')); } catch { continue; }
  const body = d.body_html || '';
  // internal /learn links
  for (const m of body.matchAll(/\/learn\/([a-z0-9-]+)/gi)) {
    const target = m[1];
    if (!valid.has(target)) { console.error(`LINK    ${f}: broken internal -> /learn/${target}`); broken++; }
  }
  // product handles: spotlight_pool + recommended_products + /products/ links
  for (const s of [...(d.spotlight_pool || []), ...(d.recommended_products || [])]) if (s.handle) productHandles.add(s.handle);
  for (const m of body.matchAll(/\/products\/([a-z0-9-]+)/gi)) productHandles.add(m[1]);
}

console.log(`check:links -- ${slugs.size} seeds, ${productHandles.size} unique product handles referenced`);
console.log(`  broken internal /learn links: ${broken}`);

if (REMOTE) {
  console.log('  verifying product handles against live Shopify...');
  const handles = [...productHandles];
  const LIMIT = 6;
  for (let i = 0; i < handles.length; i += LIMIT) {
    await Promise.all(handles.slice(i, i + LIMIT).map(async h => {
      handlesChecked++;
      try {
        const r = await fetch(`https://tmolecule.com/products/${h}.json`, { headers: { 'User-Agent': UA } });
        if (!r.ok) { console.error(`HANDLE  broken -> /products/${h} (HTTP ${r.status})`); handlesBad++; }
      } catch (e) { console.error(`HANDLE  error -> /products/${h} (${e.message})`); handlesBad++; }
    }));
  }
  console.log(`  product handles checked: ${handlesChecked}, broken: ${handlesBad}`);
}

if (broken || handlesBad) { console.error('FAIL: broken links/handles above.'); process.exit(1); }
console.log('OK');
