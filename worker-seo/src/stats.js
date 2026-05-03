/**
 * Parchment-themed stats dashboard for password-gated decks.
 *
 * GET /decks/<slug>/stats
 *   Auth-gated. Runs Analytics Engine SQL queries via the CF API
 *   and renders a single-page HTML dashboard.
 *
 * Required env:
 *   CF_API_TOKEN              CF API token with Account Analytics:Read
 *   CF_ACCOUNT_ID             CF account UUID (in wrangler.toml [vars])
 *   DECK_ANALYTICS_DATASET    AE dataset name (in wrangler.toml [vars])
 *
 * If CF_API_TOKEN is missing, renders a friendly setup-required page
 * explaining what to do.
 */

const ESC = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

async function querySQL(env, sql) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { error: 'no_token', data: [] };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: sql
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `http_${res.status}`, message: text.slice(0, 400), data: [] };
    }
    const json = await res.json();
    return { error: null, data: json.data || [] };
  } catch (err) {
    return { error: 'fetch_failed', message: String(err).slice(0, 400), data: [] };
  }
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function fmtTimestamp(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: 'America/New_York'
    });
  } catch { return ESC(String(ts)); }
}

function fmtDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  } catch { return ESC(String(ts)); }
}

function bar(value, max, width = 120) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<span class="bar"><span class="bar__fill" style="width:${pct}%"></span></span>`;
}

function setupRequiredPage(slug, accountId) {
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stats setup required — ${ESC(slug)}</title>
${commonHead()}
</head><body>
<main class="wrap">
  <header class="hd">
    <h1>Stats — ${ESC(slug)}</h1>
    <p class="sub">One-time setup: create a Cloudflare API token so this Worker can read your Analytics Engine data.</p>
  </header>
  <section class="setup tile">
    <h2>Setup steps</h2>
    <ol>
      <li>Go to <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">Cloudflare API Tokens</a> and click <strong>Create Token</strong>.</li>
      <li>Use the <strong>Custom token</strong> template. Name it "TMolecule Deck Stats".</li>
      <li>Permissions: <code>Account → Account Analytics → Read</code>. Account Resources: <code>Include → ${ESC(accountId)}</code>.</li>
      <li>Create the token and copy its value.</li>
      <li>In your terminal:
        <pre>cd ~/tmolecule/worker-seo
echo "&lt;your-token&gt;" | npx wrangler secret put CF_API_TOKEN</pre>
      </li>
      <li>Reload this page.</li>
    </ol>
    <p class="note">The token only grants read access to analytics for one account. Stored as a Worker secret (encrypted at rest, only this Worker can read it).</p>
  </section>
</main>
</body></html>`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-frame-options': 'DENY'
    }
  });
}

function commonHead() {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --bg-cream:#f6ecc8; --bg-mid:#eedcae; --bg-deep:#e0c896;
    --ink:#2b2a28; --ink-soft:#4a443a; --mute:#7a7060;
    --brown:#7a5a2b; --brown-deep:#5d4520; --gold:#b08544;
    --champagne:#dac490; --rule:#d4b97a;
    --serif:'Fraunces',Georgia,serif;
    --sans:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:var(--sans);
    color:var(--ink);
    background-color:#ecdcb0;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.32 0 0 0 0 0.15 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(253,246,220,.7) 0%, transparent 60%),
      radial-gradient(ellipse 65% 45% at 100% 100%, rgba(140,100,55,.13) 0%, transparent 55%),
      radial-gradient(ellipse 65% 45% at 0% 100%, rgba(140,100,55,.09) 0%, transparent 55%),
      linear-gradient(180deg,var(--bg-cream) 0%,var(--bg-mid) 55%,var(--bg-deep) 100%);
    background-attachment:fixed;
    background-size:240px 240px,100% 100%,100% 100%,100% 100%,100% 100%;
    line-height:1.55;
  }
  .wrap{max-width:1100px;margin:0 auto;padding:48px 32px 80px}
  .hd{margin-bottom:2.5rem}
  .hd h1{font-family:var(--serif);font-weight:700;font-size:clamp(2rem,4vw,2.8rem);margin:0 0 .4rem;letter-spacing:-.012em}
  .hd .sub{font-family:var(--serif);font-style:italic;color:var(--ink-soft);margin:0;font-size:1.05rem}
  .hd .meta{font-family:var(--sans);font-size:.78rem;color:var(--mute);text-transform:uppercase;letter-spacing:.14em;margin:.4rem 0 0}
  h2{font-family:var(--serif);font-weight:600;font-size:1.45rem;margin:0 0 1rem}
  h3{font-family:var(--serif);font-weight:600;font-size:1.1rem;margin:0 0 .6rem}
  .tile{
    background:linear-gradient(135deg,#f7ecd1 0%,#ecdab0 100%);
    border:1px solid #e2cf99;border-left:3px solid var(--brown);
    border-radius:12px;padding:1.4rem 1.6rem;margin-bottom:1.5rem;
    box-shadow:0 1px 2px rgba(80,50,20,.10),0 4px 14px rgba(80,50,20,.12),0 22px 50px rgba(80,50,20,.10);
  }
  .tile.alt{background:linear-gradient(135deg,#fbf6e8 0%,#f3eccd 100%)}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.6rem}
  @media(max-width:760px){.grid-3{grid-template-columns:1fr}}
  .stat{padding:1.2rem 1.3rem}
  .stat-num{font-family:var(--serif);font-weight:700;font-size:2.4rem;line-height:1;color:var(--brown);letter-spacing:-.02em}
  .stat-label{font-family:var(--sans);font-size:.75rem;text-transform:uppercase;letter-spacing:.14em;color:var(--mute);margin-top:.6rem}
  table{width:100%;border-collapse:collapse;font-size:.92rem;font-family:var(--sans)}
  th{text-align:left;padding:.55rem .35rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.10em;color:var(--mute);border-bottom:2px solid var(--ink);font-weight:600}
  td{padding:.6rem .35rem;border-bottom:1px solid rgba(122,90,43,.15);vertical-align:middle;color:var(--ink-soft)}
  td.r{text-align:right;font-variant-numeric:tabular-nums}
  td.label{font-weight:600;color:var(--ink)}
  td .pri{color:var(--brown);font-weight:600}
  .bar{display:inline-block;width:120px;height:8px;background:rgba(122,90,43,.14);border-radius:99px;overflow:hidden;vertical-align:middle;margin-left:.5rem}
  .bar__fill{display:block;height:100%;background:linear-gradient(90deg,var(--brown) 0%,var(--gold) 100%)}
  code,pre{font-family:var(--mono);font-size:.86rem}
  pre{background:rgba(122,90,43,.06);padding:.7rem .9rem;border-radius:6px;border:1px solid rgba(122,90,43,.12);overflow-x:auto;margin:.7rem 0}
  ol{padding-left:1.4rem;line-height:1.7}
  a{color:var(--brown)}
  .empty{color:var(--mute);font-style:italic;padding:.5rem 0}
  .err{color:#a04030;font-size:.85rem;font-family:var(--mono);background:rgba(160,64,48,.08);border-left:3px solid #a04030;padding:.5rem .8rem;margin:.6rem 0;border-radius:4px}
  .note{font-size:.85rem;color:var(--mute);margin-top:1rem;font-style:italic}
  .recent td{padding:.45rem .35rem;font-size:.85rem}
  .badge{display:inline-block;padding:.18rem .55rem;border-radius:99px;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:rgba(122,90,43,.14);color:var(--brown)}
  .badge.slide{background:rgba(176,133,68,.18);color:var(--brown-deep)}
</style>`;
}

function renderStatsPage(slug, results, env) {
  const { totals, daily, funnel, geo, uniques, recent } = results;

  const totalDeckViews = (totals.data.find(r => r.event === 'deck_view') || {}).n || 0;
  const totalSlideViews = (totals.data.find(r => r.event === 'slide_view') || {}).n || 0;
  const uniqueVisitors = (uniques.data[0] || {}).uniques || 0;

  const errors = [totals, daily, funnel, geo, uniques, recent].filter(r => r.error).map(r => `${r.error}${r.message ? ': ' + r.message : ''}`);

  const dailyMax = Math.max(1, ...daily.data.map(r => r.views));
  const funnelMax = Math.max(1, ...funnel.data.map(r => r.views));
  const geoMax = Math.max(1, ...geo.data.map(r => r.views));

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stats — ${ESC(slug)}</title>
${commonHead()}
</head><body>
<main class="wrap">
  <header class="hd">
    <h1>Stats — ${ESC(slug)}</h1>
    <p class="sub">Last 30 days · view counts, slide funnel, geographic distribution.</p>
    <p class="meta">Refreshed ${ESC(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}))} ET · data lag ≈ 30s</p>
  </header>

  ${errors.length ? `<section class="tile"><h2>Query errors</h2>${errors.map(e => `<div class="err">${ESC(e)}</div>`).join('')}</section>` : ''}

  <section class="grid-3">
    <div class="tile stat">
      <div class="stat-num">${totalDeckViews.toLocaleString()}</div>
      <div class="stat-label">Deck loads (30d)</div>
    </div>
    <div class="tile stat alt">
      <div class="stat-num">${totalSlideViews.toLocaleString()}</div>
      <div class="stat-label">Slide views (30d)</div>
    </div>
    <div class="tile stat">
      <div class="stat-num">${uniqueVisitors.toLocaleString()}</div>
      <div class="stat-label">Unique visitors (UA-hash)</div>
    </div>
  </section>

  <section class="tile">
    <h2>Slide funnel</h2>
    ${funnel.data.length ? `<table>
      <thead><tr><th>Slide</th><th>Views</th><th>Uniques</th><th>Avg dwell</th><th></th></tr></thead>
      <tbody>${funnel.data.map(r => `
        <tr>
          <td class="label">#${ESC(r.slide)}</td>
          <td class="r"><span class="pri">${(r.views || 0).toLocaleString()}</span></td>
          <td class="r">${(r.uniques || 0).toLocaleString()}</td>
          <td class="r">${fmtDuration(r.avg_dwell)}</td>
          <td>${bar(r.views, funnelMax)}</td>
        </tr>`).join('')}</tbody></table>` : '<p class="empty">No slide views recorded yet — open the deck and click through a few slides, then reload.</p>'}
  </section>

  <section class="tile alt">
    <h2>Daily activity</h2>
    ${daily.data.length ? `<table>
      <thead><tr><th>Day</th><th>Deck loads</th><th></th></tr></thead>
      <tbody>${daily.data.slice(0, 30).map(r => `
        <tr>
          <td class="label">${fmtDate(r.day)}</td>
          <td class="r"><span class="pri">${(r.views || 0).toLocaleString()}</span></td>
          <td>${bar(r.views, dailyMax)}</td>
        </tr>`).join('')}</tbody></table>` : '<p class="empty">No daily data yet.</p>'}
  </section>

  <section class="tile">
    <h2>Geography</h2>
    ${geo.data.length ? `<table>
      <thead><tr><th>Country</th><th>Loads</th><th></th></tr></thead>
      <tbody>${geo.data.map(r => `
        <tr>
          <td class="label">${ESC(r.country || '—')}</td>
          <td class="r"><span class="pri">${(r.views || 0).toLocaleString()}</span></td>
          <td>${bar(r.views, geoMax)}</td>
        </tr>`).join('')}</tbody></table>` : '<p class="empty">No geographic data yet.</p>'}
  </section>

  <section class="tile alt recent">
    <h2>Recent activity (last 7 days)</h2>
    ${recent.data.length ? `<table>
      <thead><tr><th>When</th><th>Event</th><th>Slide</th><th>Country</th></tr></thead>
      <tbody>${recent.data.slice(0, 50).map(r => `
        <tr>
          <td>${fmtTimestamp(r.timestamp)}</td>
          <td><span class="badge${r.event === 'slide_view' ? ' slide' : ''}">${ESC(r.event)}</span></td>
          <td class="r">${r.slide ? '#' + ESC(r.slide) : '—'}</td>
          <td>${ESC(r.country || '—')}</td>
        </tr>`).join('')}</tbody></table>` : '<p class="empty">No recent events.</p>'}
  </section>

  <p class="note">Data is queried live via the Cloudflare Analytics Engine SQL API. Cache: none — every reload runs the queries fresh.</p>
</main>
</body></html>`;
}

export async function handleStats(request, env, slug) {
  if (!env.CF_API_TOKEN) {
    return setupRequiredPage(slug, env.CF_ACCOUNT_ID || '<your-account-id>');
  }

  const dataset = env.DECK_ANALYTICS_DATASET || 'tmolecule_deck_analytics';
  const w = `WHERE index1 = '${slug}' AND timestamp > now() - INTERVAL '30' DAY`;
  const w7 = `WHERE index1 = '${slug}' AND timestamp > now() - INTERVAL '7' DAY`;

  const [totals, daily, funnel, geo, uniques, recent] = await Promise.all([
    querySQL(env, `SELECT blob1 AS event, count() AS n FROM ${dataset} ${w} GROUP BY event`),
    querySQL(env, `SELECT toStartOfDay(timestamp) AS day, count() AS views FROM ${dataset} ${w} AND blob1 = 'deck_view' GROUP BY day ORDER BY day DESC`),
    querySQL(env, `SELECT double1 AS slide, count() AS views, count(DISTINCT blob5) AS uniques, avg(double2) AS avg_dwell FROM ${dataset} ${w} AND blob1 = 'slide_view' AND double1 > 0 GROUP BY slide ORDER BY slide`),
    querySQL(env, `SELECT blob3 AS country, count() AS views FROM ${dataset} ${w} AND blob1 = 'deck_view' GROUP BY country ORDER BY views DESC LIMIT 25`),
    querySQL(env, `SELECT count(DISTINCT blob5) AS uniques FROM ${dataset} ${w}`),
    querySQL(env, `SELECT timestamp, blob1 AS event, double1 AS slide, blob3 AS country FROM ${dataset} ${w7} ORDER BY timestamp DESC LIMIT 50`)
  ]);

  return new Response(renderStatsPage(slug, { totals, daily, funnel, geo, uniques, recent }, env), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}
