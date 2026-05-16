import { GapReport } from "./types";

// TMolecule warm palette — tobacco brown / cream / copper / moss.
// Matches the brand's ayurvedic-apothecary register.
const C = {
  bg: "#fbf4e8",
  surface: "#fdf8ed",
  paper: "#fffaf0",
  ink: "#2a1f17",
  inkSoft: "#4a3a2c",
  muted: "#9b8a78",
  border: "#e8dac4",
  borderSoft: "#f0e5d0",
  good: "#6b7a3a", // moss
  warn: "#c47a3a", // burnt sienna
  bad: "#8a3823", // brick / rust
  accent: "#6b4a2a", // dark tobacco
  accentSoft: "#a4825a", // copper
};

interface Bucket {
  priority: GapReport[]; // < 50% coverage
  quickWin: GapReport[]; // 50-79%
  strong: GapReport[]; // >= 80%
}

const URGENT_THRESHOLD = 0.5;
const STRONG_THRESHOLD = 0.8;

// All TMolecule learn pages are editorial (recipes + tea education). When/if
// product or branded-query pages get indexed, add their slugs to NON_EDITORIAL_SLUGS
// to exclude them from canonical-AI-claim coverage scoring.
const NON_EDITORIAL_SLUGS = new Set<string>([]);

function isEditorial(slug: string): boolean {
  return !NON_EDITORIAL_SLUGS.has(slug);
}

function scentRowCount(reports: GapReport[]): number {
  return reports.filter((r) => !isEditorial(r.slug)).length;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

function pctLabel(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function bucketize(reports: GapReport[]): Bucket {
  const out: Bucket = { priority: [], quickWin: [], strong: [] };
  for (const r of reports) {
    if (r.total_claims === 0) continue;
    const p = pct(r.covered_claims, r.total_claims);
    if (p < URGENT_THRESHOLD) out.priority.push(r);
    else if (p < STRONG_THRESHOLD) out.quickWin.push(r);
    else out.strong.push(r);
  }
  out.priority.sort((a, b) => pct(a.covered_claims, a.total_claims) - pct(b.covered_claims, b.total_claims));
  out.quickWin.sort((a, b) => a.uncovered_claims - b.uncovered_claims);
  out.strong.sort((a, b) => pct(b.covered_claims, b.total_claims) - pct(a.covered_claims, a.total_claims));
  return out;
}

function pillForCoverage(p: number): { color: string; bg: string; label: string } {
  if (p >= STRONG_THRESHOLD) return { color: C.good, bg: "#e9eede", label: "on track" };
  if (p >= URGENT_THRESHOLD) return { color: C.warn, bg: "#f4e3d0", label: "quick win" };
  return { color: C.bad, bg: "#f1d8ce", label: "priority" };
}

function renderAlerts(reports: GapReport[]): string {
  // Priority alerts ONLY consider editorial pages — scent/product pages are scored using a
  // misaligned model (canonical AI claims vs branded product queries) and would always read red.
  const editorial = reports.filter((r) => isEditorial(r.slug));
  const urgent = editorial.filter((r) => r.total_claims > 0 && pct(r.covered_claims, r.total_claims) < 0.3);
  // AI visibility miss = none of the engines we checked cited any TMolecule URL.
  // Skip pages where every engine returned `undefined` (means we didn't check that engine).
  const aiBlackout = editorial.filter((r) => {
    const checks = [r.perplexity_cited_us, r.chatgpt_cited_us, r.aio_cited_us].filter((v) => v !== undefined);
    return checks.length > 0 && checks.every((v) => v === false);
  });
  const noReports = reports.length === 0;

  const items: string[] = [];

  if (noReports) {
    items.push(`<div class="alert alert-info"><strong>No reports yet.</strong> Trigger via <code>POST /admin/gap-run</code> or wait for the weekly Friday 01:00 ET refresh.</div>`);
  }

  if (urgent.length) {
    const list = urgent
      .slice(0, 5)
      .map((r) => `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.slug)}</a> — ${pctLabel(r.covered_claims, r.total_claims)} covered</li>`)
      .join("");
    items.push(`<div class="alert alert-urgent">
      <div class="alert-icon">!</div>
      <div>
        <strong>${urgent.length} ${urgent.length === 1 ? "page is" : "pages are"} below 30% coverage.</strong> These are losing AI citations to whoever does cover the canonical claims. Rewrite as soon as practical.
        <ul class="alert-list">${list}${urgent.length > 5 ? `<li class="muted">… and ${urgent.length - 5} more</li>` : ""}</ul>
      </div>
    </div>`);
  }

  if (aiBlackout.length) {
    const list = aiBlackout
      .slice(0, 5)
      .map((r) => `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.slug)}</a> <span class="muted">— ${escapeHtml(r.primary_kw)}</span></li>`)
      .join("");
    items.push(`<div class="alert alert-warn">
      <div class="alert-icon">∅</div>
      <div>
        <strong>AI visibility blackout</strong> on ${aiBlackout.length} ${aiBlackout.length === 1 ? "page" : "pages"} — no engine we check (Perplexity, ChatGPT, Google AI Overview) cited any TMolecule URL for the primary keyword.
        <ul class="alert-list">${list}${aiBlackout.length > 5 ? `<li class="muted">… and ${aiBlackout.length - 5} more</li>` : ""}</ul>
      </div>
    </div>`);
  }

  if (!items.length) {
    items.push(`<div class="alert alert-good"><div class="alert-icon">✓</div><div><strong>No alerts.</strong> No pages below 30% coverage and no AI visibility blackouts in the current report set.</div></div>`);
  }

  return items.join("");
}

function renderFindings(reports: GapReport[], bucket: Bucket): string {
  if (!reports.length) {
    return `<div class="muted">No reports available yet.</div>`;
  }

  // Findings only show editorial pages — the priority workflow is editorial copy edits.
  const editorial = reports.filter((r) => isEditorial(r.slug));
  const topPriority = bucket.priority.slice(0, 3);
  const quickest = bucket.quickWin.filter((r) => r.uncovered_claims <= 2).slice(0, 3);
  const strongest = bucket.strong.slice(0, 3);

  const totalClaims = editorial.reduce((s, r) => s + r.total_claims, 0);
  const totalCovered = editorial.reduce((s, r) => s + r.covered_claims, 0);
  const overall = pctLabel(totalCovered, totalClaims);
  const scentCount = reports.length - editorial.length;

  function pageCard(r: GapReport, kind: "priority" | "quickWin" | "strong"): string {
    const p = pct(r.covered_claims, r.total_claims);
    const pill = pillForCoverage(p);
    const topMiss = r.claims.find((c) => !c.covered);
    const missLabel = kind === "strong" ? "All key claims covered" : topMiss ? `Missing: <span class="claim-snippet">${escapeHtml(topMiss.claim)}</span>` : "—";
    return `<article class="finding-card">
      <header>
        <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" class="card-title">${escapeHtml(r.slug)}</a>
        <span class="coverage-pill" style="color:${pill.color};background:${pill.bg}">${pctLabel(r.covered_claims, r.total_claims)}</span>
      </header>
      <div class="card-kw">${escapeHtml(r.primary_kw)}</div>
      <div class="card-miss">${missLabel}</div>
      <div class="card-meta">${r.covered_claims}/${r.total_claims} canonical claims covered</div>
    </article>`;
  }

  const sections: string[] = [];

  sections.push(`<div class="findings-overview">
    <div class="overview-num"><span class="value">${overall}</span><span class="label">editorial coverage</span></div>
    <div class="overview-num"><span class="value">${editorial.length}</span><span class="label">editorial pages</span></div>
    <div class="overview-num"><span class="value">${bucket.priority.length}</span><span class="label">priority (&lt;50%)</span></div>
    <div class="overview-num"><span class="value">${bucket.quickWin.length}</span><span class="label">quick wins (50–79%)</span></div>
    <div class="overview-num"><span class="value">${bucket.strong.length}</span><span class="label">on track (≥80%)</span></div>
    <div class="overview-num"><span class="value">${scentCount}</span><span class="label">scent / product pages (informational)</span></div>
  </div>`);

  if (topPriority.length) {
    sections.push(`<div class="finding-block">
      <h3 class="finding-h"><span class="dot bad"></span>Top priorities — rewrite next</h3>
      <p class="finding-sub">These pages cover the smallest share of the canonical AI answer for their keyword. Most leverage per hour of editing.</p>
      <div class="finding-grid">${topPriority.map((r) => pageCard(r, "priority")).join("")}</div>
    </div>`);
  }

  if (quickest.length) {
    sections.push(`<div class="finding-block">
      <h3 class="finding-h"><span class="dot warn"></span>Quick wins — 1–2 claims from green</h3>
      <p class="finding-sub">Adding a single paragraph or short section per missing claim should push these to ≥80%.</p>
      <div class="finding-grid">${quickest.map((r) => pageCard(r, "quickWin")).join("")}</div>
    </div>`);
  }

  if (strongest.length) {
    sections.push(`<div class="finding-block">
      <h3 class="finding-h"><span class="dot good"></span>Strong performers — minimal action</h3>
      <p class="finding-sub">These pages cover most or all canonical claims. Recheck only if SERP positions drop or competitors ship new content.</p>
      <div class="finding-grid">${strongest.map((r) => pageCard(r, "strong")).join("")}</div>
    </div>`);
  }

  return sections.join("");
}

export function renderDashboard(reports: GapReport[]): string {
  // Header stats reflect editorial only — that's the actionable population.
  const editorial = reports.filter((r) => isEditorial(r.slug));
  const totalClaims = editorial.reduce((s, r) => s + r.total_claims, 0);
  const totalCovered = editorial.reduce((s, r) => s + r.covered_claims, 0);
  const totalUncovered = totalClaims - totalCovered;
  const overallPctLabel = pctLabel(totalCovered, totalClaims);
  const bucket = bucketize(editorial);

  const generatedTimes = reports.map((r) => r.generated_at).filter(Boolean).sort();
  const oldestReport = generatedTimes[0] ?? null;
  const newestReport = generatedTimes[generatedTimes.length - 1] ?? null;

  // Build rows. Editorial first (sorted by widest gap = worst coverage), then scent pages.
  const rowsBuilder = (subset: GapReport[]) => subset
    .slice()
    .sort((a, b) => a.uncovered_claims - b.uncovered_claims)
    .reverse()
    .map((r) => {
      const covered = r.covered_claims;
      const total = r.total_claims;
      const p = pct(covered, total);
      const pill = pillForCoverage(p);
      const citePill = (v: boolean | undefined): string => {
        if (v === true) return `<span class="pill good">✓</span>`;
        if (v === false) return `<span class="pill bad">✗</span>`;
        return `<span class="pill neutral">—</span>`;
      };
      const pplx = citePill(r.perplexity_cited_us);
      const chatgpt = citePill(r.chatgpt_cited_us);
      const aio = citePill(r.aio_cited_us);

      const uncoveredClaims = r.claims
        .filter((c) => !c.covered)
        .map((c) => `<li>${escapeHtml(c.claim)}</li>`)
        .join("");
      const coveredClaims = r.claims
        .filter((c) => c.covered)
        .map((c) => {
          const cid = c.best_match_chunk_id ?? "";
          const sc = c.best_match_score ? c.best_match_score.toFixed(2) : "—";
          return `<li><span class="ok">✓</span> ${escapeHtml(c.claim)} <span class="muted">(${escapeHtml(cid)}, ${sc})</span></li>`;
        })
        .join("");

      const editorialTag = isEditorial(r.slug)
        ? `<span class="type-pill editorial">editorial</span>`
        : `<span class="type-pill scent">scent</span>`;
      return `
<tr class="page-row ${isEditorial(r.slug) ? "type-editorial" : "type-scent"}" data-slug="${escapeHtml(r.slug)}">
  <td class="slug-cell">
    <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.slug)}</a> ${editorialTag}
    <div class="kw">${escapeHtml(r.primary_kw)}</div>
  </td>
  <td class="coverage-cell">
    <div class="bar"><span style="width:${total ? Math.round(p * 100) : 0}%;background:${pill.color}"></span></div>
    <div class="cov-text">${covered} / ${total} <span class="muted">(${pctLabel(covered, total)})</span></div>
  </td>
  <td><span class="coverage-pill" style="color:${pill.color};background:${pill.bg}">${pill.label}</span></td>
  <td class="cite-cell" title="Perplexity">${pplx}</td>
  <td class="cite-cell" title="ChatGPT">${chatgpt}</td>
  <td class="cite-cell" title="Google AI Overview">${aio}</td>
  <td class="gen-cell muted">${escapeHtml(r.generated_at.slice(0, 10))}</td>
</tr>
<tr class="detail-row" data-slug="${escapeHtml(r.slug)}">
  <td colspan="7">
    <div class="detail-grid">
      <div>
        <strong>Uncovered claims (${r.uncovered_claims})</strong>
        <ul class="claim-list">${uncoveredClaims || '<li class="muted">none — full coverage</li>'}</ul>
      </div>
      <div>
        <strong>Covered claims (${r.covered_claims})</strong>
        <ul class="claim-list compact">${coveredClaims || '<li class="muted">none</li>'}</ul>
      </div>
    </div>
  </td>
</tr>`;
    })
    .join("");

  const editorialRows = rowsBuilder(reports.filter((r) => isEditorial(r.slug)));
  const scentRows = rowsBuilder(reports.filter((r) => !isEditorial(r.slug)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AI Citation Gap — TMolecule learn corpus</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<style>
  :root {
    --bg:${C.bg}; --surface:${C.surface}; --paper:${C.paper}; --ink:${C.ink}; --ink-soft:${C.inkSoft};
    --muted:${C.muted}; --border:${C.border}; --border-soft:${C.borderSoft};
    --good:${C.good}; --warn:${C.warn}; --bad:${C.bad}; --accent:${C.accent}; --accent-soft:${C.accentSoft};
  }
  * { box-sizing: border-box }
  html, body { margin:0; padding:0 }
  body {
    background:var(--bg); color:var(--ink);
    font:15px/1.55 "Georgia", "Iowan Old Style", "Palatino", serif;
    -webkit-font-smoothing: antialiased;
  }
  .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif }

  /* Header — letterpress / vintage barbershop card feel */
  header.masthead {
    padding:40px 48px 28px;
    border-bottom:2px solid var(--accent);
    background:linear-gradient(180deg, var(--paper) 0%, var(--surface) 100%);
    position:relative;
  }
  header.masthead::before {
    content:""; position:absolute; left:0; right:0; bottom:0; height:6px;
    background:repeating-linear-gradient(90deg, var(--accent-soft) 0 6px, transparent 6px 12px);
    opacity:0.35;
  }
  header.masthead .eyebrow {
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:11px; letter-spacing:0.25em; text-transform:uppercase;
    color:var(--accent-soft); font-weight:600; margin-bottom:8px;
  }
  header.masthead h1 {
    margin:0; font-size:32px; font-weight:400; letter-spacing:-0.01em; color:var(--ink);
    font-family:"Georgia",serif; line-height:1.1;
  }
  header.masthead .sub {
    margin-top:10px; color:var(--ink-soft); font-size:15px; max-width:740px; font-style:italic;
  }
  header.masthead .gen-info {
    margin-top:14px; font-size:12px; color:var(--muted); font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    letter-spacing:0.04em;
  }

  /* Section container */
  main { padding:0 48px 80px; max-width:1280px; margin:0 auto }
  section { margin-top:32px }
  section h2 {
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:11px; text-transform:uppercase; letter-spacing:0.25em;
    color:var(--accent); font-weight:600; margin:0 0 14px;
    display:flex; align-items:center; gap:10px;
  }
  section h2::before {
    content:""; display:inline-block; width:24px; height:1px; background:var(--accent);
  }

  /* Preamble */
  .preamble details {
    background:var(--paper); border:1px solid var(--border); border-radius:6px;
    padding:0 22px; font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .preamble summary {
    padding:16px 0; cursor:pointer; font-size:14px; color:var(--ink); list-style:none;
    user-select:none;
  }
  .preamble summary::-webkit-details-marker { display:none }
  .preamble summary::before {
    content:"▸"; display:inline-block; width:18px; color:var(--accent-soft);
    transition:transform .2s;
  }
  .preamble details[open] summary::before { transform:rotate(90deg) }
  .preamble-body {
    padding:4px 0 20px 18px; border-top:1px solid var(--border-soft); margin-top:0; max-width:780px;
  }
  .preamble-body h3 {
    font-size:11px; text-transform:uppercase; letter-spacing:0.16em;
    color:var(--accent); margin:20px 0 6px; font-weight:600;
  }
  .preamble-body p, .preamble-body li {
    font-size:14px; line-height:1.6; color:var(--ink-soft);
  }
  .preamble-body code {
    background:#efe2ce; padding:1px 6px; border-radius:3px; font-size:13px;
    color:var(--accent); font-family: "SF Mono", "Menlo", monospace;
  }
  .preamble-body ul, .preamble-body ol { padding-left:22px; margin:6px 0 }
  .preamble-body em { color:var(--muted) }

  /* Alerts */
  .alert {
    display:flex; gap:14px; padding:16px 20px; border-radius:6px; margin-bottom:10px;
    background:var(--paper); border:1px solid var(--border);
    font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:14px; color:var(--ink-soft);
  }
  .alert strong { color:var(--ink) }
  .alert-urgent { border-left:4px solid var(--bad); background:#fbece4 }
  .alert-warn { border-left:4px solid var(--warn); background:#faeedb }
  .alert-good { border-left:4px solid var(--good); background:#eef0db }
  .alert-info { border-left:4px solid var(--accent-soft); background:#f6ecda }
  .alert-icon {
    flex-shrink:0; width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:14px;
  }
  .alert-urgent .alert-icon { background:var(--bad); color:#fff }
  .alert-warn .alert-icon { background:var(--warn); color:#fff }
  .alert-good .alert-icon { background:var(--good); color:#fff }
  .alert-info .alert-icon { background:var(--accent-soft); color:#fff }
  .alert-list { margin:8px 0 0; padding-left:18px }
  .alert-list li { padding:2px 0 }
  .alert-list a { color:var(--accent); text-decoration:none; font-weight:600 }
  .alert-list a:hover { text-decoration:underline }

  /* Findings */
  .findings-overview {
    display:flex; gap:24px; flex-wrap:wrap; margin-bottom:24px;
    padding:18px 22px; background:var(--paper); border:1px solid var(--border); border-radius:6px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .overview-num { display:flex; flex-direction:column; min-width:120px }
  .overview-num .value {
    font-size:28px; font-weight:600; color:var(--ink); font-family:"Georgia",serif;
    letter-spacing:-0.02em;
  }
  .overview-num .label {
    font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); margin-top:2px;
  }
  .finding-block { margin-bottom:30px }
  .finding-h {
    font-size:14px; font-weight:600; color:var(--ink); margin:0 0 4px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    display:flex; align-items:center; gap:10px; text-transform:none; letter-spacing:0;
  }
  .finding-h::before { display:none }
  .finding-sub {
    margin:0 0 14px; color:var(--ink-soft); font-size:14px; font-style:italic;
  }
  .dot {
    display:inline-block; width:10px; height:10px; border-radius:50%;
  }
  .dot.bad { background:var(--bad) }
  .dot.warn { background:var(--warn) }
  .dot.good { background:var(--good) }
  .finding-grid {
    display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:14px;
  }
  .finding-card {
    background:var(--paper); border:1px solid var(--border); border-radius:6px; padding:16px 18px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .finding-card header {
    display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;
  }
  .card-title {
    color:var(--accent); text-decoration:none; font-weight:600; font-size:14px;
  }
  .card-title:hover { text-decoration:underline }
  .card-kw { font-size:12px; color:var(--muted); margin-bottom:10px; font-style:italic }
  .card-miss { font-size:13px; color:var(--ink-soft); margin-bottom:8px; line-height:1.4 }
  .card-meta { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted) }
  .claim-snippet { color:var(--ink) }
  .coverage-pill {
    display:inline-block; padding:3px 10px; border-radius:999px;
    font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }

  /* Table */
  table.detail-table {
    width:100%; border-collapse:collapse; background:var(--paper);
    border:1px solid var(--border); border-radius:6px; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  table.detail-table th {
    text-align:left; padding:12px 16px; font-size:11px; font-weight:600;
    text-transform:uppercase; letter-spacing:0.1em; color:var(--accent);
    border-bottom:1px solid var(--border); background:var(--surface);
  }
  table.detail-table td {
    padding:14px 16px; border-bottom:1px solid var(--border-soft); vertical-align:top;
    font-size:14px; color:var(--ink-soft);
  }
  .page-row { cursor:pointer; transition:background .12s }
  .page-row:hover { background:#f7ecd8 }
  .slug-cell a { color:var(--accent); text-decoration:none; font-weight:600 }
  .slug-cell a:hover { text-decoration:underline }
  .kw { font-size:12px; color:var(--muted); margin-top:2px; font-style:italic }
  .bar { width:170px; height:7px; background:var(--border); border-radius:4px; overflow:hidden; margin-bottom:4px }
  .bar span { display:block; height:100%; transition:width .3s }
  .cov-text { font-size:13px; color:var(--ink) }
  .muted { color:var(--muted); font-weight:normal }
  .cite-cell { text-align:center; padding:8px 10px; min-width:48px }
  .cite-cell .pill { padding:2px 8px; font-size:11px; line-height:1.2 }
  .pill { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em }
  .pill.good { background:#e9eede; color:var(--good) }
  .pill.bad { background:#f1d8ce; color:var(--bad) }
  .pill.neutral { background:#ece4d3; color:var(--muted) }
  .type-pill {
    display:inline-block; margin-left:6px; padding:1px 7px; border-radius:3px;
    font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em;
    vertical-align:middle;
  }
  .type-pill.editorial { background:#e9eede; color:var(--good); border:1px solid #d6decb }
  .type-pill.scent { background:#f0e5d0; color:var(--accent-soft); border:1px solid #e2d1b0 }
  .scent-fold {
    background:var(--paper); border:1px solid var(--border); border-radius:6px; padding:0 22px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .scent-fold summary {
    padding:16px 0; cursor:pointer; font-size:14px; color:var(--ink-soft); list-style:none;
    user-select:none;
  }
  .scent-fold summary::-webkit-details-marker { display:none }
  .scent-fold summary::before {
    content:"▸"; display:inline-block; width:18px; color:var(--accent-soft); transition:transform .2s;
  }
  .scent-fold[open] summary::before { transform:rotate(90deg) }
  .scent-fold[open] summary { border-bottom:1px solid var(--border-soft); margin-bottom:14px }
  .scent-fold table.detail-table { border:none }
  .scent-fold > table.detail-table { margin-bottom:14px }
  .detail-row { display:none; background:#faf0dd }
  .detail-row.open { display:table-row }
  .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; padding:6px 0 4px }
  .claim-list { margin:8px 0 0; padding-left:20px }
  .claim-list li { padding:3px 0; font-size:13px; line-height:1.5 }
  .claim-list.compact li { font-size:12px; color:var(--muted) }
  .claim-list .ok { color:var(--good); font-weight:700 }
  .claim-snippet { color:var(--ink) }

  /* Footer */
  footer {
    margin-top:48px; padding:24px 48px; border-top:1px solid var(--border);
    color:var(--muted); font-size:12px; font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    text-align:center; letter-spacing:0.04em;
  }
  footer a { color:var(--accent-soft); text-decoration:none }
  footer a:hover { text-decoration:underline }

  @media print {
    body { background:#fff }
    header.masthead, .preamble details, .alert, .findings-overview, .finding-card, table.detail-table {
      box-shadow:none; border-color:#ccc;
    }
    .page-row { cursor:default }
    .detail-row { display:table-row !important }
    summary { pointer-events:none }
    details { open:true }
  }
</style>
</head>
<body>

<header class="masthead">
  <div class="eyebrow">TMolecule &middot; SEO &amp; AI Visibility</div>
  <h1>AI Citation Gap Report — <em>learn.tmolecule.com</em></h1>
  <div class="sub">A standing audit of how well each editorial page covers the claims an AI search engine would expect to cite for its target keyword.</div>
  <div class="gen-info">
    Reports: <strong>${reports.length}</strong> &nbsp;·&nbsp;
    Overall coverage: <strong>${overallPctLabel}</strong> &nbsp;·&nbsp;
    Total claims: <strong>${totalClaims}</strong> (gap: <strong>${totalUncovered}</strong>) &nbsp;·&nbsp;
    Oldest: <strong>${oldestReport ? escapeHtml(oldestReport.slice(0, 10)) : "—"}</strong> &nbsp;·&nbsp;
    Newest: <strong>${newestReport ? escapeHtml(newestReport.slice(0, 10)) : "—"}</strong>
  </div>
</header>

<main>

  <section class="preamble">
    <h2>About this report</h2>
    <details>
      <summary><strong>What it measures, how to read it, what to do</strong></summary>
      <div class="preamble-body">
        <h3>What's measured</h3>
        <p>For each indexed editorial page on <code>learn.tmolecule.com</code>, the system asks Llama&nbsp;3.3 (70b) to draft the canonical AI-search answer for that page's primary target keyword and extract 8–15 load-bearing factual claims. It then checks whether each claim is supported by your page's content, using semantic retrieval over a paragraph-level Vectorize index plus an LLM coverage judgment. The result is a coverage percentage and a list of <em>uncovered claims</em> — facts an AI Overview, Perplexity answer, or ChatGPT response would likely include but your page does not.</p>

        <h3>How to read the table</h3>
        <ul>
          <li><strong>Coverage bar</strong> — moss ≥ 80%, sienna 50–79%, brick &lt; 50%.</li>
          <li><strong>Status pill</strong> — <em>on track</em> / <em>quick win</em> / <em>priority</em>.</li>
          <li><strong>Citation columns</strong> — <code>PPLX</code> (Perplexity Sonar), <code>GPT</code> (ChatGPT with web search via DataForSEO), <code>AIO</code> (Google AI Overview via DataForSEO). ✓ = cited a TMolecule URL, ✗ = answer cited other sources, — = engine not checked (credentials missing for that engine).</li>
          <li><strong>Click any row</strong> to expand uncovered + covered claims for that page.</li>
        </ul>

        <h3>What to do with it</h3>
        <ol>
          <li><strong>Priority rows first.</strong> Pages below 50% are losing AI citations to whoever does cover those claims. Add a short, declarative paragraph or section per missing claim — fact-first writing (AI engines won't lift marketing-style copy).</li>
          <li><strong>Quick wins next.</strong> Usually 1–3 specific claims away from on-track. Often one new H2 + 2–3 paragraphs closes the gap.</li>
          <li><strong>On-track rows.</strong> Skip unless a missing claim happens to be one competitors are now ranking for.</li>
          <li><strong>Reject bad claims.</strong> Some uncovered claims are wrong, off-brand, or things you intentionally omit (e.g. "tallow can be from cows or pigs" — TMolecule uses beef tallow only). Mark in your editorial doc and ignore; the model retries every cycle.</li>
        </ol>

        <h3>What it does <em>not</em> tell you</h3>
        <ul>
          <li>Coverage <em>beyond</em> the canonical AI frame — your unique angles aren't scored here.</li>
          <li>Live AIO/ChatGPT citations directly. The Llama-drafted canonical answer is a proxy. Perplexity column is the closest thing to live citation tracking.</li>
          <li>Internal linking, schema markup, page speed, or any technical SEO. Different audits.</li>
        </ul>

        <h3>How often it updates</h3>
        <p>A GitHub Actions workflow runs every Friday at 01:00 ET (05:00 UTC) and refreshes every editorial page in this report. Outside the weekly run, a Cloudflare cron rotates ~10 pages/day as a safety net.</p>
      </div>
    </details>
  </section>

  <section>
    <h2>Alerts</h2>
    ${renderAlerts(reports)}
  </section>

  <section>
    <h2>Findings</h2>
    ${renderFindings(reports, bucket)}
  </section>

  <section>
    <h2>Editorial pages — full report</h2>
    <table class="detail-table">
      <thead>
        <tr>
          <th>Page · Primary keyword</th>
          <th>Coverage</th>
          <th>Status</th>
          <th title="Perplexity Sonar">PPLX</th>
          <th title="ChatGPT (gpt-4o-mini with web search)">GPT</th>
          <th title="Google AI Overview">AIO</th>
          <th>Generated</th>
        </tr>
      </thead>
      <tbody>${editorialRows || '<tr><td colspan="7" class="muted" style="padding:24px;text-align:center">No editorial reports yet.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Scent &amp; product pages — informational only</h2>
    <details class="scent-fold">
      <summary><strong>${scentRowCount(reports)} scent / product pages</strong> &middot; not factored into priority alerts or findings. Coverage scoring is calibrated to canonical AI answers, which don't apply cleanly to branded product queries.</summary>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Page · Primary keyword</th>
            <th>Coverage</th>
            <th>Status</th>
            <th>Perplexity</th>
            <th>Generated</th>
          </tr>
        </thead>
        <tbody>${scentRows || '<tr><td colspan="7" class="muted" style="padding:24px;text-align:center">No scent reports.</td></tr>'}</tbody>
      </table>
    </details>
  </section>

</main>

<footer>
  tmolecule-learn-intel &middot; Workers AI + Vectorize + Llama 3.3 &middot; daily refresh 04:00 ET
</footer>

<script>
document.querySelectorAll('.page-row').forEach(r => {
  r.addEventListener('click', () => {
    const slug = r.dataset.slug;
    const detail = document.querySelector('.detail-row[data-slug="' + slug + '"]');
    if (detail) detail.classList.toggle('open');
  });
});
</script>
</body>
</html>`;
}
