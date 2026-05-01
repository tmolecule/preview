/**
 * TMolecule Uptime Monitor — covers BOTH the lead-magnet Pages site
 * (wellness.tmolecule.com) and the Learn Workers SEO site (learn.tmolecule.com).
 *
 * Runs every 15 minutes. Sends a Resend alert ONLY when one or more checks
 * fail, with an N-hour cooldown to prevent flood-spam during sustained outages.
 *
 * Cooldown state is held in a Cloudflare KV namespace (LAST_ALERT_AT). If KV
 * is not bound, alerts fire every cron — still useful, just noisier.
 */

const STATE_KEY = 'last_alert_at';

/**
 * @typedef {Object} CheckResult
 * @property {string} site
 * @property {string} name
 * @property {boolean} ok
 * @property {string} detail
 */

/**
 * @param {Record<string, string>} env
 */
async function runChecks(env) {
  /** @type {CheckResult[]} */
  const results = [];

  // ---- wellness.tmolecule.com (lead magnets) ----
  const w = env.WELLNESS_BASE;
  results.push(await statusCheck('wellness', 'Tools index', `${w}/`, 200));
  results.push(await statusCheck('wellness', 'Calculator page', `${w}/collagen-calculator/`, 200));
  results.push(await calculateCheck('wellness', `${w}/api/calculate`));
  results.push(await subscribeAliveCheck('wellness', `${w}/api/subscribe`));
  results.push(await pdfCheck('wellness', `${w}${env.PDF_PATH}`, Number(env.PDF_MIN_BYTES) || 1_000_000));
  results.push(await statusCheck('wellness', 'Confirmed landing', `${w}/confirmed/collagen-protocol/`, 200));
  results.push(await statusCheck('wellness', 'Unsubscribe page', `${w}/unsubscribe/`, 200));

  // ---- learn.tmolecule.com (Workers SEO site) ----
  const l = env.LEARN_BASE;
  results.push(await statusCheck('learn', 'Index', `${l}/`, 200));
  results.push(await statusCheck('learn', 'Sitemap', `${l}/sitemap.xml`, 200));
  results.push(await statusCheck('learn', 'Robots.txt', `${l}/robots.txt`, 200));
  results.push(await learnHealthCheck('learn', `${l}/health`));

  return results;
}

/**
 * @param {string} site @param {string} name @param {string} url @param {number} expectedStatus
 * @returns {Promise<CheckResult>}
 */
async function statusCheck(site, name, url, expectedStatus) {
  try {
    const r = await fetch(url, { method: 'GET', cf: { cacheTtl: 0 } });
    const ok = r.status === expectedStatus;
    return { site, name, ok, detail: `HTTP ${r.status} (expected ${expectedStatus})` };
  } catch (e) {
    return { site, name, ok: false, detail: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @param {string} site @param {string} url
 * @returns {Promise<CheckResult>}
 */
async function calculateCheck(site, url) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        collagen_type: 'peptides',
        daily_dose_g: 10,
        time_of_day: 'morning',
        current_beverage: 'water',
        vitamin_c_source: true
      })
    });
    if (r.status !== 200) return { site, name: 'Calculate API', ok: false, detail: `HTTP ${r.status}` };
    const json = /** @type {{ success?: boolean, data?: { score?: number } }} */ (await r.json());
    if (!json.success || typeof json.data?.score !== 'number') {
      return { site, name: 'Calculate API', ok: false, detail: 'Bad response shape' };
    }
    if (json.data.score < 0 || json.data.score > 100) {
      return { site, name: 'Calculate API', ok: false, detail: `Score out of range: ${json.data.score}` };
    }
    return { site, name: 'Calculate API', ok: true, detail: `score=${json.data.score}` };
  } catch (e) {
    return { site, name: 'Calculate API', ok: false, detail: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @param {string} site @param {string} url
 * @returns {Promise<CheckResult>}
 */
async function subscribeAliveCheck(site, url) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    if (r.status !== 400) return { site, name: 'Subscribe API alive', ok: false, detail: `Expected 400, got ${r.status}` };
    return { site, name: 'Subscribe API alive', ok: true, detail: 'Validation rejected as expected' };
  } catch (e) {
    return { site, name: 'Subscribe API alive', ok: false, detail: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @param {string} site @param {string} url @param {number} minBytes
 * @returns {Promise<CheckResult>}
 */
async function pdfCheck(site, url, minBytes) {
  try {
    const r = await fetch(url, { method: 'GET' });
    if (r.status !== 200) return { site, name: 'Protocol PDF', ok: false, detail: `HTTP ${r.status}` };
    const lengthHeader = r.headers.get('content-length');
    const length = lengthHeader ? Number(lengthHeader) : 0;
    if (length < minBytes) return { site, name: 'Protocol PDF', ok: false, detail: `Size ${length}b below minimum ${minBytes}b` };
    return { site, name: 'Protocol PDF', ok: true, detail: `${(length / 1024 / 1024).toFixed(2)} MB` };
  } catch (e) {
    return { site, name: 'Protocol PDF', ok: false, detail: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @param {string} site @param {string} url
 * @returns {Promise<CheckResult>}
 */
async function learnHealthCheck(site, url) {
  try {
    const r = await fetch(url, { method: 'GET', cf: { cacheTtl: 0 } });
    if (r.status !== 200) return { site, name: 'Health endpoint', ok: false, detail: `HTTP ${r.status} (expected 200)` };
    const json = /** @type {{ status?: string, kv?: { ok?: boolean, page_count?: number } }} */ (await r.json());
    if (json.status !== 'ok') return { site, name: 'Health endpoint', ok: false, detail: `status=${json.status}` };
    if (!json.kv?.ok) return { site, name: 'Health endpoint', ok: false, detail: 'KV not ok' };
    if ((json.kv.page_count ?? 0) === 0) return { site, name: 'Health endpoint', ok: false, detail: 'KV has zero pages' };
    return { site, name: 'Health endpoint', ok: true, detail: `KV pages=${json.kv.page_count}` };
  } catch (e) {
    return { site, name: 'Health endpoint', ok: false, detail: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @param {Record<string, string>} env
 * @param {CheckResult[]} results
 */
async function sendAlert(env, results) {
  const failed = results.filter(r => !r.ok);
  const passed = results.filter(r => r.ok);

  const sites = [...new Set(failed.map(r => r.site))].join(' + ');
  const subject = `[TMolecule Monitor] ${failed.length} check${failed.length === 1 ? '' : 's'} FAILING on ${sites}`;

  const failedRows = failed.map(r => `
    <tr>
      <td style="padding:8px 12px;background:#fee;border-bottom:1px solid #fcc;font-family:Inter,sans-serif"><strong>${escape(r.site)}</strong> &middot; ${escape(r.name)}</td>
      <td style="padding:8px 12px;background:#fee;border-bottom:1px solid #fcc;font-family:monospace;color:#a23">${escape(r.detail)}</td>
    </tr>`).join('');

  const passedRows = passed.map(r => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Inter,sans-serif;color:#666"><strong>${escape(r.site)}</strong> &middot; ${escape(r.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace;color:#666">${escape(r.detail)}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">
      <h1 style="font-size:20px;margin:0 0 8px;color:#a23">TMolecule monitor: ${failed.length} check${failed.length === 1 ? '' : 's'} failing</h1>
      <p style="margin:0 0 20px;color:#666;font-size:13px">${new Date().toISOString()}</p>

      <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#a23;margin:0 0 8px">Failing (${failed.length})</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px">${failedRows}</table>

      <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:0 0 8px">Passing (${passed.length})</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${passedRows}</table>

      <p style="margin:24px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">
        Cloudflare Worker: tmolecule-uptime-monitor &middot; runs every 15 min &middot; cooldown ${env.ALERT_COOLDOWN_HOURS}h
      </p>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [env.RESEND_TO],
      subject,
      html
    })
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`Resend error ${r.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * @param {Record<string, string>} env
 * @returns {Promise<boolean>} whether enough time has elapsed since last alert
 */
async function shouldAlert(env) {
  if (!env.MONITOR_STATE) return true; // No KV bound — always alert
  const cooldownMs = (Number(env.ALERT_COOLDOWN_HOURS) || 2) * 60 * 60 * 1000;
  const last = await /** @type {KVNamespace} */(env.MONITOR_STATE).get(STATE_KEY);
  if (!last) return true;
  const elapsed = Date.now() - Number(last);
  return elapsed >= cooldownMs;
}

/**
 * @param {Record<string, string>} env
 */
async function recordAlert(env) {
  if (!env.MONITOR_STATE) return;
  await /** @type {KVNamespace} */(env.MONITOR_STATE).put(STATE_KEY, String(Date.now()));
}

/**
 * @param {string} s
 */
function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default {
  /**
   * @param {ScheduledController} _controller
   * @param {Record<string, string>} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(_controller, env, ctx) {
    const results = await runChecks(env);
    const failed = results.filter(r => !r.ok);
    if (failed.length === 0) return;
    if (!(await shouldAlert(env))) return; // Cooldown active
    ctx.waitUntil(sendAlert(env, results).then(() => recordAlert(env)));
  },

  /**
   * Manual HTTP trigger. Visit the URL to see check results.
   * Add ?alert=1 to fire a test alert email even if everything passes.
   * Add ?reset=1 to clear the cooldown state.
   * @param {Request} request
   * @param {Record<string, string>} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.searchParams.get('reset') === '1' && env.MONITOR_STATE) {
      await /** @type {KVNamespace} */(env.MONITOR_STATE).delete(STATE_KEY);
    }

    const results = await runChecks(env);
    const summary = {
      timestamp: new Date().toISOString(),
      cron_schedule: '*/15 * * * *',
      cooldown_hours: env.ALERT_COOLDOWN_HOURS,
      total: results.length,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results
    };

    if (url.searchParams.get('alert') === '1' && env.RESEND_API_KEY) {
      await sendAlert(env, results);
    }

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
};
