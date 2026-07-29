#!/usr/bin/env node
// Citation guardrail. Validates every source URL in seed/*.json:
//
//   1. PubMed / PMC URLs are checked against NCBI E-utilities — the PMID /
//      PMCID must resolve to a real record, and the cited `title` must
//      reasonably match the record's real title.
//   1b. INLINE PubMed / PMC links — bare `<a href>`s to
//      pubmed.ncbi.nlm.nih.gov/<PMID> or pmc.ncbi.nlm.nih.gov/articles/PMC<id>
//      embedded directly in `body_html` — are extracted and resolved through
//      the SAME NCBI E-utilities + titleOverlap() logic as `sources[]`, not a
//      parallel implementation. This exists because the `sources[]` array
//      can be 100% legitimate while a page still has hallucinated PMIDs
//      hand-typed into the prose (an LLM draft citing a real, well-formed
//      PMID that happens to resolve to a completely unrelated paper — e.g. a
//      shoulder-pain outcome-measure study linked from a chai/spice page).
//      Inline links carry no cited `title` to compare against, so the check
//      instead builds a context string from the page's `title` + `keywords`
//      + the link's anchor text + its enclosing paragraph. This is a TWO
//      STAGE check — title overlap alone can't tell a fabrication from a
//      correct citation that simply uses different vocabulary than the page
//      (real example: PMID 15453700's title is "...Elettaria cardamomum (L.)
//      Maton..." — the Latin binomial — cited correctly on pages that only
//      ever say "cardamom" in prose, which scores ZERO title-keyword
//      overlap despite being a completely legitimate citation):
//        - PMID/PMCID does not resolve                    -> FAIL (checkKind
//          'inline-citation-mismatch') — same severity as an unresolved
//          `sources[]` entry.
//        - resolves, titleOverlap(context, realTitle) >=
//          TITLE_MATCH_THRESHOLD                           -> PASS (checkKind
//          'inline-citation-ok'). No abstract fetch needed.
//        - resolves, some title overlap but below
//          TITLE_MATCH_THRESHOLD (nonzero)                 -> WARN (checkKind
//          'inline-citation-low-overlap') — ambiguous; printed with the
//          PMID, the real title, and the anchor/sentence so a human can
//          adjudicate. Does not block the gate, so no abstract fetch is
//          spent on this bucket.
//        - resolves, ZERO title-keyword overlap            -> STAGE 2: fetch
//          the record's ABSTRACT (NCBI efetch, db=pubmed rettype=abstract
//          for PMIDs; the <abstract> element out of the PMC JATS XML for
//          PMCIDs) and run the SAME titleOverlap()/keywords() scorer against
//          it, against its OWN threshold (ABSTRACT_MATCH_THRESHOLD, lower
//          than TITLE_MATCH_THRESHOLD — see that constant's comment: a full
//          abstract is much longer/noisier prose than a title, so a
//          genuinely on-topic match structurally scores lower than a title
//          match would). Abstracts are only fetched for records that
//          actually reach this bucket — never for every citation — and are
//          batched one request per db, identical in spirit to the esummary
//          batching above.
//            - abstract overlap >= ABSTRACT_MATCH_THRESHOLD -> PASS (checkKind
//              'inline-citation-abstract-match') — the title used different
//              vocabulary (Latin binomial, journal-style phrasing) but the
//              paper's actual subject matter — its abstract — is on-topic.
//              This is the Elettaria cardamomum case.
//            - abstract ALSO has zero/low overlap (or is
//              unavailable)                                 -> FAIL (checkKind
//              'inline-citation-mismatch') — a real, resolving paper whose
//              subject has nothing in common with the page in EITHER its
//              title or its abstract is the hallucinated-PMID defect (e.g.
//              a Shoulder Pain and Disability Index paper linked from a
//              chai page shares nothing with it either way).
//      Always runs (like the `sources[]` NCBI check, it is not gated by
//      --offline, which only controls the raw HTTP dead-link checks below).
//      NCBI-based FAILs here are, like `sources[]` FAILs, never downgraded
//      by --warn-only-http.
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
const EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const TITLE_MATCH_THRESHOLD = 0.3; // fraction of the REAL title's keywords present in the cited title
// Abstract-vs-page-prose overlap needs its OWN (lower) bar than title-vs-title.
// Titles are short, dense noun phrases — a real topical match clears 30%
// easily. Abstracts are 60-100+ keyword-bearing words of methodology prose
// ("supercritical CO2 extraction", "randomized double-blind crossover")
// compared against a marketing/educational paragraph that's equally full of
// non-technical connective language ("smoother", "cooling perception",
// "balance") — even a genuinely on-topic citation only shares a handful of
// SPECIFIC terms (the compound/ingredient names) with that prose, so the
// fraction structurally tops out much lower than a title match ever would.
// Empirically verified against this corpus (2026-07): the real, correctly-
// cited Elettaria cardamomum paper (PMID 15453700) scores ~23-25% against
// its citing pages' context; the genuinely fabricated Shoulder Pain and
// Disability Index paper (PMID 28158958) scores ~4% against the same kind
// of context. 0.15 sits cleanly between the two.
const ABSTRACT_MATCH_THRESHOLD = 0.15;

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

// 'pmid'/'pmcid'/'doi' are citation-metadata tokens, never subject-matter
// signal — and critically, for the abstract-fallback check below, the fetched
// abstract text ALWAYS echoes "PMID: <id>" (that's the literal record we
// asked for), so leaving 'pmid' scorable would make every inline citation
// trivially self-match on that token alone, real or fabricated.
const STOP = new Set([
  'the','a','an','and','or','of','in','on','for','with','to','from','by','at','as','is','are',
  'was','were','be','its','their','effect','effects','study','trial','randomized','randomised',
  'controlled','review','meta','analysis','systematic','human','humans','adults','pmid','pmcid','doi',
  // Generic connector / filler words. These matter far more for the STAGE-2
  // abstract-vs-page-prose comparison than they ever did for title-vs-title:
  // a title is already dense and specific, but two unrelated pieces of
  // ordinary health-writing prose share plenty of this vocabulary by pure
  // coincidence (a fabricated citation's surrounding sentence and the real
  // paper's abstract can both say "have been linked to," "a small study,"
  // "after a"...), which would otherwise inflate overlap regardless of
  // whether the subject matter actually matches.
  'have','has','had','been','being','after','before','when','while','that','this','these','those',
  'which','who','whom','also','more','most','some','such','than','then','there','here','where',
  'what','how','not','can','could','should','would','may','might','must','will','shall','one','two',
  'three','first','second','new','old','high','low','large','small','long','short',
  'found','show','shows','showed','shown','link','links','linked','suggest','suggests','suggested',
  'report','reports','reported','result','results','conclude','concludes','concluded','significant',
  'significantly','associated','association','related','among','between','across','within','without',
  'upon','however','although','because','since','during','include','includes','included','including',
  'using','used','use','based','level','levels','group','groups','participants','subjects','patients',
  'week','weeks','month','months','year','years','day','days','time','daily','worth','noting','note',
  'notable','common','commonly','typical','typically','general','generally','measurement','measurements',
  'measured','measures','measure','clinical','worth',
]);

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

// ---- inline-citation extraction (body_html) ----
// Finds every <a href="...pubmed.ncbi.nlm.nih.gov/<id>..."> or PMC-articles
// link embedded in body_html, plus its anchor text and enclosing block
// (paragraph/list-item/table-cell), stripped to plain text, for context.
const INLINE_LINK_RE = /<a\b[^>]*href=["']([^"']*(?:pubmed\.ncbi\.nlm\.nih\.gov\/\d+|(?:pmc\.ncbi\.nlm\.nih\.gov\/articles\/|ncbi\.nlm\.nih\.gov\/pmc\/articles\/)PMC\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function extractInlineCitations(bodyHtml) {
  const out = [];
  if (!bodyHtml) return out;
  const re = new RegExp(INLINE_LINK_RE.source, INLINE_LINK_RE.flags);
  let m;
  while ((m = re.exec(bodyHtml))) {
    const url = m[1];
    const cls = classify(url);
    if (cls.kind !== 'pubmed' && cls.kind !== 'pmc') continue; // shouldn't happen given the regex, but be safe
    const anchorText = stripTags(m[2]);
    const start = m.index;
    const end = start + m[0].length;
    const blockStart = Math.max(
      bodyHtml.lastIndexOf('<p', start),
      bodyHtml.lastIndexOf('<li', start),
      bodyHtml.lastIndexOf('<td', start),
      0
    );
    const endCandidates = [
      bodyHtml.indexOf('</p>', end),
      bodyHtml.indexOf('</li>', end),
      bodyHtml.indexOf('</td>', end),
    ].filter((i) => i !== -1);
    const blockEnd = endCandidates.length ? Math.min(...endCandidates) + 4 : Math.min(bodyHtml.length, end + 400);
    const context = stripTags(bodyHtml.slice(blockStart, blockEnd));
    out.push({ url, anchorText, context, ...cls });
  }
  return out;
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

// ---- abstract fallback (stage 2 of the inline-citation check) ----
// Only called for records that resolved but scored ZERO title-keyword
// overlap — see the header comment. Batched one request per db, exactly
// like esummary() above; each function fetches every id it's given in a
// single call and returns a { id -> abstractText } map, so the caller's
// Set-deduped id list IS the caching (an id is never fetched twice within a
// run, and ids that don't need an abstract are never fetched at all).

// PubMed's plain-text abstract format numbers each record ("1. ...",
// "2. ...") and always closes it with a "PMID: <id>" line, so records are
// recovered by slicing the response between successive "PMID: <id>"
// markers rather than assuming response order matches request order.
async function efetchPubmedAbstracts(ids) {
  if (!ids.length) return {};
  const url = `${EFETCH}?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=text`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tmolecule-citation-guardrail' } });
  if (!res.ok) throw new Error(`E-utilities efetch(pubmed) HTTP ${res.status}`);
  const text = await res.text();
  const out = {};
  const re = /PMID:\s*(\d+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    out[m[1]] = text.slice(last, re.lastIndex);
    last = re.lastIndex;
  }
  return out;
}

// PMC's efetch ignores rettype=abstract and always returns full JATS XML, so
// this pulls the <abstract>...</abstract> element out of each
// <article>...</article> block (an article can carry more than one —
// e.g. a "graphical" abstract variant — the first is the real text
// abstract) and maps it to that article's PMCID.
async function efetchPmcAbstracts(ids) {
  if (!ids.length) return {};
  const url = `${EFETCH}?db=pmc&id=${ids.join(',')}&rettype=abstract&retmode=xml`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tmolecule-citation-guardrail' } });
  if (!res.ok) throw new Error(`E-utilities efetch(pmc) HTTP ${res.status}`);
  const xml = await res.text();
  const out = {};
  const articleRe = /<article\b[\s\S]*?<\/article>/g;
  let am;
  while ((am = articleRe.exec(xml))) {
    const block = am[0];
    const idMatch = block.match(/<article-id pub-id-type="pmcid">PMC(\d+)<\/article-id>/);
    const abstractMatch = block.match(/<abstract\b[^>]*>([\s\S]*?)<\/abstract>/);
    if (idMatch && abstractMatch) {
      out[idMatch[1]] = stripTags(abstractMatch[1]);
    }
  }
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
const inlineCitations = []; // { file, pageTitle, pageKeywords, url, anchorText, context, ...classify }
for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')); } catch { continue; }
  for (const s of (data.sources || [])) {
    if (!s || !s.url) continue;
    citations.push({ file, citedTitle: s.title || '', url: s.url, ...classify(s.url) });
  }
  for (const ic of extractInlineCitations(data.body_html)) {
    inlineCitations.push({
      file,
      pageTitle: data.title || '',
      pageKeywords: Array.isArray(data.keywords) ? data.keywords : [],
      ...ic,
    });
  }
}

// ---- batch-resolve NCBI ids (sources[] + inline body_html links, one call each) ----
const pubmedIds = [...new Set([...citations, ...inlineCitations].filter(c => c.kind === 'pubmed').map(c => c.id))];
const pmcIds = [...new Set([...citations, ...inlineCitations].filter(c => c.kind === 'pmc').map(c => c.id))];

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

// ---- evaluate inline citations (body_html links) — stage 1: title ----
// Reuses the same esummary() records and titleOverlap() as sources[] above;
// the only difference is there's no cited `title` to compare against, so the
// "cited" side of titleOverlap() is a context string built from the page's
// title + keywords + the link's anchor text + its enclosing paragraph.
const inlineTitleChecked = inlineCitations.map(c => {
  const rec = (c.kind === 'pubmed' ? pubmed : pmc)[c.id];
  const ctxString = [c.pageTitle, c.pageKeywords.join(' '), c.anchorText, c.context].join(' ');
  if (!rec || rec.error || !rec.title) {
    return { ...c, rec: null, ctxString, titleOv: 0 };
  }
  return { ...c, rec, ctxString, titleOv: titleOverlap(ctxString, rec.title) };
});

// ---- stage 2: abstract fallback, ONLY for the zero-title-overlap bucket ----
// A resolving record with SOME title overlap (even below threshold) is
// already a non-blocking WARN — no need to spend an NCBI call on it. Only
// ZERO title overlap is currently a hard FAIL, and that's exactly the bucket
// that produces false positives (title uses different vocabulary than the
// page, e.g. a Latin binomial). Fetch abstracts, batched one request per db,
// for only those records before deciding FAIL.
const needsAbstract = inlineTitleChecked.filter(c => c.rec && c.titleOv === 0);
const needPubmedAbstractIds = [...new Set(needsAbstract.filter(c => c.kind === 'pubmed').map(c => c.id))];
const needPmcAbstractIds = [...new Set(needsAbstract.filter(c => c.kind === 'pmc').map(c => c.id))];

let pubmedAbstracts = {}, pmcAbstracts = {};
try {
  if (needPubmedAbstractIds.length) {
    pubmedAbstracts = await efetchPubmedAbstracts(needPubmedAbstractIds);
  }
  if (needPmcAbstractIds.length) {
    if (needPubmedAbstractIds.length) await new Promise(r => setTimeout(r, 350));
    pmcAbstracts = await efetchPmcAbstracts(needPmcAbstractIds);
  }
} catch (e) {
  console.error(`Warning: could not fetch abstracts for zero-title-overlap inline citations (${e.message}) — falling back to title-only for these records.`);
}

const inlineResults = inlineTitleChecked.map(c => {
  if (!c.rec) {
    return { ...c, status: 'FAIL', checkKind: 'inline-citation-mismatch', reason: `inline ${c.kind.toUpperCase()} ${c.id} does not resolve`, realTitle: '' };
  }
  if (c.titleOv === 0) {
    const abstractText = c.kind === 'pubmed' ? pubmedAbstracts[c.id] : pmcAbstracts[c.id];
    // Note the argument order is flipped vs the title check: real=ctxString
    // (denominator = the page's own, much smaller keyword set) and
    // cited=abstractText (the large search space we're checking it against).
    // Denominating on the page's keyword count — not the abstract's — is
    // what keeps this comparable to ABSTRACT_MATCH_THRESHOLD; see that
    // constant's comment for why the bar itself is lower than a title match.
    //
    // Strip the citation's OWN id digits out of ctxString first: the anchor
    // text always contains "PMID <id>" (or the URL's PMCID), and the fetched
    // abstract text ALWAYS echoes "PMID: <id>" too (it's literally the
    // record we asked for by that id) — so without this, the id digits are a
    // guaranteed, tautological "match" for every citation, fabricated or
    // not, and would silently defeat this whole check.
    const ctxNoId = c.ctxString.replace(new RegExp(c.id, 'g'), ' ');
    const abstractOv = abstractText ? titleOverlap(abstractText, ctxNoId) : 0;
    if (abstractText && abstractOv >= ABSTRACT_MATCH_THRESHOLD) {
      return {
        ...c, status: 'PASS', checkKind: 'inline-citation-abstract-match',
        reason: `inline ${c.kind.toUpperCase()} ${c.id} has ZERO title-keyword overlap with the page, but the ABSTRACT overlap (${(abstractOv * 100).toFixed(0)}%) confirms it's on-topic — the title just uses different vocabulary (e.g. a Latin binomial) than the page's prose`,
        realTitle: c.rec.title, overlap: c.titleOv, abstractOverlap: abstractOv,
      };
    }
    return {
      ...c, status: 'FAIL', checkKind: 'inline-citation-mismatch',
      reason: `inline ${c.kind.toUpperCase()} ${c.id} resolves to a real paper with ZERO keyword overlap against the page in BOTH the title AND the abstract${abstractText ? ` (abstract overlap ${(abstractOv * 100).toFixed(0)}%)` : ' (abstract unavailable)'} — likely a hallucinated/fabricated citation`,
      realTitle: c.rec.title, overlap: c.titleOv, abstractOverlap: abstractText ? abstractOv : null,
    };
  }
  if (c.titleOv < TITLE_MATCH_THRESHOLD) {
    return {
      ...c, status: 'WARN', checkKind: 'inline-citation-low-overlap',
      reason: `inline ${c.kind.toUpperCase()} ${c.id} overlap ${(c.titleOv * 100).toFixed(0)}% is below the ${(TITLE_MATCH_THRESHOLD * 100).toFixed(0)}% threshold — ambiguous, needs human adjudication (may be a legitimate citation using different vocabulary)`,
      realTitle: c.rec.title, overlap: c.titleOv,
    };
  }
  return { ...c, status: 'PASS', checkKind: 'inline-citation-ok', realTitle: c.rec.title, overlap: c.titleOv };
});

const fails = [...results.filter(r => r.status === 'FAIL'), ...inlineResults.filter(r => r.status === 'FAIL')];
const warns = [...results.filter(r => r.status === 'WARN'), ...inlineResults.filter(r => r.status === 'WARN')];
const unver = results.filter(r => r.status === 'UNVERIFIED');
const pass = [...results.filter(r => r.status === 'PASS'), ...inlineResults.filter(r => r.status === 'PASS')];
const inlineFails = inlineResults.filter(r => r.status === 'FAIL');
const inlineWarns = inlineResults.filter(r => r.status === 'WARN');
const inlinePass = inlineResults.filter(r => r.status === 'PASS');

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
const inlineSummary = {
  total: inlineResults.length,
  pass: inlinePass.length,
  fail: inlineFails.length,
  warn: inlineWarns.length,
  mismatch: inlineResults.filter(r => r.checkKind === 'inline-citation-mismatch').length,
  lowOverlap: inlineResults.filter(r => r.checkKind === 'inline-citation-low-overlap').length,
  abstractMatch: inlineResults.filter(r => r.checkKind === 'inline-citation-abstract-match').length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({
    summary: { total: results.length, pass: pass.length, fail: fails.length, warn: warns.length, unverified: unver.length, offline: OFFLINE, warnOnlyHttp: WARN_ONLY_HTTP },
    httpSummary,
    inlineSummary,
    fails,
    inlineFails,
    inlineResults,
    results,
  }, null, 2));
} else {
  console.log(`\nCitation guardrail — ${results.length} sources + ${inlineResults.length} inline body_html citations across ${files.length} seeds${OFFLINE ? ' (offline: HTTP checks skipped)' : ''}`);
  console.log(`  PASS ${pass.length}  ·  FAIL ${fails.length}  ·  WARN ${warns.length}  ·  UNVERIFIED ${unver.length}`);
  console.log(`  (of which inline body_html citations: PASS ${inlineSummary.pass}  ·  FAIL ${inlineSummary.fail}  ·  WARN ${inlineSummary.warn})\n`);
  if (fails.length) {
    console.log('FAILURES (block seeding):');
    for (const f of fails) {
      console.log(`  ✗ ${f.file}${f.checkKind && f.checkKind.startsWith('inline-') ? ' [inline]' : ''}`);
      if (f.checkKind && f.checkKind.startsWith('inline-')) {
        console.log(`      anchor: "${f.anchorText}"`);
        console.log(`      context: ${f.context}`);
      } else {
        console.log(`      cited : ${f.citedTitle}`);
      }
      console.log(`      ${f.url}`);
      console.log(`      reason: ${f.reason}`);
      if (f.realTitle) console.log(`      actual: ${f.realTitle}`);
    }
    console.log('');
  }
  if (warns.length) {
    console.log('WARNINGS:');
    for (const w of warns) {
      const tag = w.checkKind && w.checkKind.startsWith('inline-') ? ' [inline]' : '';
      console.log(`  ! ${w.file}${tag} — ${w.reason} (${w.url})`);
      if (w.checkKind === 'inline-citation-low-overlap') {
        console.log(`      anchor : "${w.anchorText}"`);
        console.log(`      context: ${w.context}`);
        console.log(`      actual : ${w.realTitle}`);
      }
    }
    console.log('');
  }
  if (!OFFLINE) {
    console.log(`HTTP check breakdown: dead ${httpSummary.deadLink} · bare-root ${httpSummary.bareRoot} · redirect-to-root ${httpSummary.redirectToRoot} · rate-limited(429) ${httpSummary.rateLimited} · bot-challenge ${httpSummary.botChallenge} · network-error ${httpSummary.networkError} · timeout ${httpSummary.timeout} · wikipedia ${httpSummary.wikipedia}`);
  }
  console.log(`Inline citation breakdown: total ${inlineSummary.total} · mismatch(FAIL) ${inlineSummary.mismatch} · low-overlap(WARN) ${inlineSummary.lowOverlap} · abstract-match(PASS) ${inlineSummary.abstractMatch} · ok(PASS) ${inlineSummary.pass}\n`);
}

process.exit(fails.length ? 1 : 0);
