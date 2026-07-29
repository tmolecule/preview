#!/usr/bin/env node
// Citation guardrail. Validates every source URL in seed/*.json:
//
//   1. PubMed / PMC URLs are checked against NCBI E-utilities — the PMID /
//      PMCID must resolve to a real record, and the cited `title` must
//      reasonably match the record's real title.
//   2. Every OTHER URL (journals, government sites, news, Wikipedia, etc.)
//      is HTTP-checked directly:
//        - 4xx/5xx  -> FAIL (dead citation; blocks the gate, same as a bad
//                      PMID) unless --warn-only-http is passed, in which
//                      case it's downgraded to WARN.
//        - 429, OR a 403 that looks like a Cloudflare edge bot-block (the
//          `cf-mitigated` header, or a bare 403 fronted by `server:
//          cloudflare`) -> WARN, indeterminate. The origin's real response
//          is unknown in these cases; ScienceDirect/Wiley do this to every
//          non-browser client even for live articles. Never a hard FAIL —
//          this exists specifically so a bot-wall or a transient rate
//          limit can't masquerade as "dead citation" and block the gate.
//          A 404/410/anything else in the 4xx/5xx range still hard-FAILs.
//        - other network error / timeout -> WARN, indeterminate.
//        - resolves 2xx/3xx but the (possibly post-redirect) path is bare
//          root (`""` or `/`, e.g. `https://fdc.nal.usda.gov/`) -> WARN
//          "bare-root" (cites a homepage/search page, substantiates
//          nothing specific).
//        - resolves 2xx/3xx via a redirect that LANDED on a bare-root path
//          even though the cited URL itself had a deeper path -> WARN
//          "redirect-to-root" (strong signal the deep link died and the
//          site bounced to its homepage).
//        - otherwise -> UNVERIFIED (HTTP resolves fine; content/title
//          still can't be automatically confirmed, same meaning as before).
//
// LLM-drafted citations frequently keep a plausible title/journal/year but
// attach a hallucinated PMID that points to an unrelated paper, a dead URL,
// or a bare homepage that doesn't actually substantiate the claim. This
// catches all three. Exits non-zero on any FAIL so it can gate the seed
// pipeline.
//
// HTTP checks are polite: HEAD first with a GET fallback (some hosts 403/405
// HEAD), a real browser User-Agent, redirects followed, a ~10s per-request
// timeout, an in-run cache (each unique URL is fetched at most once even if
// cited by many seeds), and a paced worker pool capped at ~5-7 requests/sec
// with limited concurrency — unpaced checking has tripped rate limits and
// produced false "dead link" reports here before; don't reintroduce that.
//
// Usage:
//   node scripts/verify-citations.mjs                # human report, exits 1 on FAIL
//   node scripts/verify-citations.mjs --json          # machine-readable
//   node scripts/verify-citations.mjs --offline       # skip all HTTP checks (alias: --no-http)
//   node scripts/verify-citations.mjs --warn-only-http # downgrade HTTP dead-link FAILs to WARN
//                                                       # (deliberate, documented way to unblock
//                                                       # the pipeline without weakening the gate
//                                                       # permanently — NCBI PMID/title FAILs are
//                                                       # never downgraded by this flag)
//
// Wikipedia URLs are still just flagged as WARN (no HTTP check added to them
// — history citations are fine, health claims aren't); PubMed/PMC handling
// and the title-match threshold are unchanged from before.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '..', 'seed');
const JSON_OUT = process.argv.includes('--json');
const OFFLINE = process.argv.includes('--offline') || process.argv.includes('--no-http');
const WARN_ONLY_HTTP = process.argv.includes('--warn-only-http');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const TITLE_MATCH_THRESHOLD = 0.3; // fraction of the REAL title's keywords present in the cited title

// ---- HTTP-check tuning ----
const HTTP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HTTP_TIMEOUT_MS = 10_000;
const HTTP_CONCURRENCY = 4;
const HTTP_MIN_INTERVAL_MS = 1000 / 6; // paces the whole pool to ~6 req/s regardless of concurrency
const HEAD_RETRY_STATUSES = new Set([403, 405, 501]); // hosts that reject/mishandle HEAD

// Hosts that answer datacenter/CI IP ranges with a 404 instead of a 403 as an
// anti-bot measure, making a real removal indistinguishable from a block.
// Non-2xx from these is downgraded to an indeterminate WARN. Keep this list
// SHORT and only add a host after confirming the same URL 200s from a normal
// client while failing in CI — every entry weakens the gate for that host.
const BOT_WALLED_404_HOSTS = ['fda.gov'];
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

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

// ---- bare-root helper ----
// A URL whose path is empty or "/" substantiates nothing specific — it's a
// homepage or search landing page, not a deep link to the cited claim.
function isBareRootPath(u) {
  try {
    const p = new URL(u).pathname;
    return p === '' || p === '/';
  } catch {
    return false;
  }
}

// ---- paced worker pool ----
// Caps global request rate to ~1000/HTTP_MIN_INTERVAL_MS per second
// (~6 req/s) AND limits concurrency, independent of how many unique URLs
// need checking. Reads/writes of `nextSlot` never straddle an await, so
// this is safe without a lock despite the concurrent workers.
let nextSlot = 0;
async function paced() {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + HTTP_MIN_INTERVAL_MS;
  const wait = start - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchOnce(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': HTTP_UA, Accept: '*/*' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Checks one URL: HEAD first, GET fallback if HEAD is rejected/errors.
// Returns a plain result object; never throws.
async function checkUrl(url) {
  await paced();
  let res, method = 'HEAD', headError = null;
  try {
    res = await fetchOnce(url, 'HEAD');
    if (HEAD_RETRY_STATUSES.has(res.status)) {
      await paced();
      method = 'GET';
      res = await fetchOnce(url, 'GET');
    }
  } catch (e) {
    headError = e;
  }
  if (!res) {
    try {
      await paced();
      method = 'GET';
      res = await fetchOnce(url, 'GET');
    } catch (e2) {
      const isTimeout = e2.name === 'AbortError';
      return { ok: false, networkError: true, timeout: isTimeout, message: (headError || e2).message || String(headError || e2) };
    }
  }
  return {
    ok: true,
    status: res.status,
    finalUrl: res.url || url,
    redirected: res.redirected,
    method,
    cfMitigated: res.headers.get('cf-mitigated') || '',
    server: res.headers.get('server') || '',
  };
}

function evaluateHttpResult(url, r) {
  if (!r.ok) {
    return {
      checkKind: r.timeout ? 'timeout' : 'network-error',
      status: 'WARN',
      reason: `could not verify via HTTP — ${r.message} (indeterminate, not treated as dead)`,
    };
  }
  if (r.status === 429) {
    return { checkKind: 'rate-limited', status: 'WARN', reason: `HTTP 429 while checking — rate-limited, could not verify (indeterminate)`, httpStatus: 429 };
  }
  if (r.status >= 400) {
    // Cloudflare (and similar edge bot-management) sets `cf-mitigated` when
    // IT intercepted the request with a JS challenge/block — the origin's
    // real response is unknown, so this is not evidence the citation is
    // dead. Publisher sites (ScienceDirect, Wiley, etc.) commonly wall off
    // non-browser clients this way even when the article is live. Treat as
    // indeterminate, not a hard FAIL, regardless of --warn-only-http (this
    // isn't a deliberate downgrade of a real dead-link finding — it's "we
    // couldn't tell").
    if (r.cfMitigated) {
      return { checkKind: 'bot-challenge', status: 'WARN', reason: `HTTP ${r.status} with cf-mitigated: ${r.cfMitigated} — bot-walled by the target's edge, not confirmed dead (indeterminate)`, httpStatus: r.status };
    }
    // Cloudflare bot-management/WAF blocks are usually 403 (access denied)
    // even without the cf-mitigated header — genuinely removed content
    // behind Cloudflare normally surfaces as a 404 passed through from the
    // origin, not a 403 from the edge. A bare 403 fronted by Cloudflare
    // (identified via the `server` header + presence of a cf-ray id) gets
    // the same indeterminate treatment; a 404/410/5xx never does.
    if (r.status === 403 && /cloudflare/i.test(r.server)) {
      return { checkKind: 'bot-challenge', status: 'WARN', reason: `HTTP 403 from a Cloudflare-fronted host (no cf-mitigated header, but server=cloudflare) — likely a bot/WAF block, not confirmed dead (indeterminate)`, httpStatus: r.status };
    }
    // Hosts that serve a 404 (not a 403) to datacenter/CI IP ranges as an
    // anti-bot measure. fda.gov does exactly this: the same URL returns 200
    // from an ordinary client and 404 from a GitHub Actions runner, so a hard
    // FAIL here is a false positive that blocks the pipeline on a live page.
    // Verified 2026-07-28: the FDA caffeine page 200s locally, 404s in CI.
    // Kept deliberately narrow — one host, and only because its block is
    // indistinguishable from a real 404. A genuinely removed page on these
    // hosts will surface as a WARN a human must check, not silently pass.
    if (BOT_WALLED_404_HOSTS.some((h) => hostOf(url) === h || hostOf(url).endsWith(`.${h}`))) {
      return { checkKind: 'bot-challenge', status: 'WARN', reason: `HTTP ${r.status} from ${hostOf(url)}, a host known to serve 404s to datacenter/CI IPs — not confirmed dead (indeterminate; verify manually)`, httpStatus: r.status };
    }
    return {
      checkKind: 'dead-link',
      status: WARN_ONLY_HTTP ? 'WARN' : 'FAIL',
      reason: `HTTP ${r.status} — citation URL is dead${WARN_ONLY_HTTP ? ' (downgraded by --warn-only-http)' : ''}`,
      httpStatus: r.status,
    };
  }
  const bareOriginal = isBareRootPath(url);
  const bareFinal = isBareRootPath(r.finalUrl);
  if (bareOriginal) {
    return { checkKind: 'bare-root', status: 'WARN', reason: 'bare-root citation — URL points to a homepage/search page, not a specific claim', httpStatus: r.status };
  }
  if (r.redirected && bareFinal) {
    return { checkKind: 'redirect-to-root', status: 'WARN', reason: `redirects to bare-root (${r.finalUrl}) — the deep link likely died and bounced to the homepage`, httpStatus: r.status };
  }
  return { checkKind: 'ok', status: 'UNVERIFIED', reason: 'non-NCBI URL — resolves fine (HTTP checked), content/title still cannot be auto-verified', httpStatus: r.status };
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

// ---- HTTP-check every unique non-NCBI, non-Wikipedia URL once ----
const httpCache = new Map(); // url -> evaluated result
if (!OFFLINE) {
  const otherUrls = [...new Set(citations.filter(c => c.kind === 'other').map(c => c.url))];
  await mapPool(otherUrls, HTTP_CONCURRENCY, async (url) => {
    const raw = await checkUrl(url);
    httpCache.set(url, evaluateHttpResult(url, raw));
  });
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
  if (OFFLINE) return { ...c, status: 'UNVERIFIED', reason: 'non-NCBI URL — cannot auto-verify (--offline, HTTP check skipped)' };
  const http = httpCache.get(c.url) || { status: 'UNVERIFIED', reason: 'non-NCBI URL — HTTP check did not run', checkKind: 'skipped' };
  return { ...c, ...http };
});

const fails = results.filter(r => r.status === 'FAIL');
const warns = results.filter(r => r.status === 'WARN');
const unver = results.filter(r => r.status === 'UNVERIFIED');
const pass = results.filter(r => r.status === 'PASS');

// Sub-tallies within WARN, useful for the corpus inventory.
const byKind = (kind) => results.filter(r => r.checkKind === kind);
const httpSummary = {
  deadLink: byKind('dead-link').length,
  bareRoot: byKind('bare-root').length,
  redirectToRoot: byKind('redirect-to-root').length,
  rateLimited: byKind('rate-limited').length,
  botChallenge: byKind('bot-challenge').length,
  networkError: byKind('network-error').length,
  timeout: byKind('timeout').length,
  wikipedia: results.filter(r => r.kind === 'wikipedia').length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({
    summary: { total: results.length, pass: pass.length, fail: fails.length, warn: warns.length, unverified: unver.length, offline: OFFLINE, warnOnlyHttp: WARN_ONLY_HTTP },
    httpSummary,
    fails,
    results,
  }, null, 2));
} else {
  console.log(`\nCitation guardrail — ${results.length} sources across ${files.length} seeds${OFFLINE ? ' (offline: HTTP checks skipped)' : ''}`);
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
  if (!OFFLINE) {
    console.log(`HTTP check breakdown: dead ${httpSummary.deadLink} · bare-root ${httpSummary.bareRoot} · redirect-to-root ${httpSummary.redirectToRoot} · rate-limited(429) ${httpSummary.rateLimited} · bot-challenge ${httpSummary.botChallenge} · network-error ${httpSummary.networkError} · timeout ${httpSummary.timeout} · wikipedia ${httpSummary.wikipedia}\n`);
  }
}

process.exit(fails.length ? 1 : 0);
