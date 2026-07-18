#!/usr/bin/env node
// Citation guardrail. Validates every PubMed / PMC source URL in seed/*.json
// against NCBI E-utilities:
//   1. the PMID / PMCID must resolve to a real record, and
//   2. the cited `title` must reasonably match the record's real title.
//
// LLM-drafted citations frequently keep a plausible title/journal/year but
// attach a hallucinated PMID that points to an unrelated paper. This catches
// exactly that. Exits non-zero on any FAIL so it can gate the seed pipeline.
//
// Usage:
//   node scripts/verify-citations.mjs            # human report, exits 1 on failure
//   node scripts/verify-citations.mjs --json     # machine-readable
//
// Non-NCBI URLs (journals, ScienceDirect, Wikipedia) can't be verified via
// E-utilities; they're reported as UNVERIFIED (warning, not a failure), and
// Wikipedia used as a source is flagged.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '..', 'seed');
const JSON_OUT = process.argv.includes('--json');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const TITLE_MATCH_THRESHOLD = 0.3; // fraction of the REAL title's keywords present in the cited title

const STOP = new Set(['the','a','an','and','or','of','in','on','for','with','to','from','by','at','as','is','are','was','were','be','its','their','effect','effects','study','trial','randomized','randomised','controlled','review','meta','analysis','systematic','human','humans','adults']);

function keywords(t) {
  return new Set(
    String(t || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')        // drop "(Author et al., 2017)" tails
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w))
  );
}

// Fraction of the real title's significant words that appear in the cited title.
function titleOverlap(cited, real) {
  const r = keywords(real);
  if (!r.size) return 1;
  const c = keywords(cited);
  let hit = 0;
  for (const w of r) if (c.has(w)) hit++;
  return hit / r.size;
}

function classify(url) {
  let m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  if (m) return { kind: 'pubmed', id: m[1] };
  m = url.match(/(?:pmc\.ncbi\.nlm\.nih\.gov\/articles\/|ncbi\.nlm\.nih\.gov\/pmc\/articles\/)PMC(\d+)/i);
  if (m) return { kind: 'pmc', id: m[1] };
  if (/(?:^|\.)wikipedia\.org/i.test(url)) return { kind: 'wikipedia' };
  return { kind: 'other' };
}

async function esummary(db, ids) {
  if (!ids.length) return {};
  const url = `${EUTILS}?db=${db}&retmode=json&id=${ids.join(',')}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tmolecule-citation-guardrail' } });
  if (!res.ok) throw new Error(`E-utilities ${db} HTTP ${res.status}`);
  const data = await res.json();
  const out = {};
  const r = data.result;
  if (r && Array.isArray(r.uids)) for (const uid of r.uids) out[uid] = r[uid];
  return out;
}

// ---- collect every citation ----
const files = readdirSync(SEED_DIR).filter(f => f.endsWith('.json')).sort();
const citations = []; // { file, citedTitle, url, ...classify }
for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')); } catch { continue; }
  for (const s of (data.sources || [])) {
    if (!s || !s.url) continue;
    citations.push({ file, citedTitle: s.title || '', url: s.url, ...classify(s.url) });
  }
}

// ---- batch-resolve NCBI ids ----
const pubmedIds = [...new Set(citations.filter(c => c.kind === 'pubmed').map(c => c.id))];
const pmcIds = [...new Set(citations.filter(c => c.kind === 'pmc').map(c => c.id))];

let pubmed = {}, pmc = {};
try {
  pubmed = await esummary('pubmed', pubmedIds);
  if (pmcIds.length) { await new Promise(r => setTimeout(r, 350)); pmc = await esummary('pmc', pmcIds); }
} catch (e) {
  console.error(`Could not reach NCBI E-utilities: ${e.message}`);
  process.exit(2);
}

// ---- evaluate ----
const results = citations.map(c => {
  if (c.kind === 'pubmed' || c.kind === 'pmc') {
    const rec = (c.kind === 'pubmed' ? pubmed : pmc)[c.id];
    if (!rec || rec.error || !rec.title) {
      return { ...c, status: 'FAIL', reason: `${c.kind.toUpperCase()} ${c.id} does not resolve`, realTitle: '' };
    }
    const overlap = titleOverlap(c.citedTitle, rec.title);
    if (overlap < TITLE_MATCH_THRESHOLD) {
      return { ...c, status: 'FAIL', reason: `title mismatch (overlap ${(overlap * 100).toFixed(0)}%)`, realTitle: rec.title, overlap };
    }
    return { ...c, status: 'PASS', realTitle: rec.title, overlap };
  }
  if (c.kind === 'wikipedia') return { ...c, status: 'WARN', reason: 'Wikipedia used as a source — fine for history, not for health claims' };
  return { ...c, status: 'UNVERIFIED', reason: 'non-NCBI URL — cannot auto-verify' };
});

const fails = results.filter(r => r.status === 'FAIL');
const warns = results.filter(r => r.status === 'WARN');
const unver = results.filter(r => r.status === 'UNVERIFIED');
const pass = results.filter(r => r.status === 'PASS');

if (JSON_OUT) {
  console.log(JSON.stringify({ summary: { total: results.length, pass: pass.length, fail: fails.length, warn: warns.length, unverified: unver.length }, fails, results }, null, 2));
} else {
  console.log(`\nCitation guardrail — ${results.length} sources across ${files.length} seeds`);
  console.log(`  PASS ${pass.length}  ·  FAIL ${fails.length}  ·  WARN ${warns.length}  ·  UNVERIFIED ${unver.length}\n`);
  if (fails.length) {
    console.log('FAILURES (block seeding):');
    for (const f of fails) {
      console.log(`  ✗ ${f.file}`);
      console.log(`      cited : ${f.citedTitle}`);
      console.log(`      ${f.url}`);
      console.log(`      reason: ${f.reason}`);
      if (f.realTitle) console.log(`      actual: ${f.realTitle}`);
    }
    console.log('');
  }
  if (warns.length) {
    console.log('WARNINGS:');
    for (const w of warns) console.log(`  ! ${w.file} — ${w.reason} (${w.url})`);
    console.log('');
  }
}

process.exit(fails.length ? 1 : 0);
