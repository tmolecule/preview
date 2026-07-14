#!/usr/bin/env node
/**
 * Weekly /learn QA report → email via Brevo.
 *
 * Runs the QA suite (schema, citations, broken links, no-medical compliance),
 * builds an HTML summary, and emails it through Brevo's transactional API.
 * Portable across brands — skips any check whose script isn't present in the repo.
 *
 * Env:
 *   BREVO_API_KEY   Brevo transactional key (required to send; dry-run prints if absent)
 *   QA_BRAND        Display name, default "TMolecule"
 *   QA_FROM_EMAIL   Validated Brevo sender, default support@tmolecule.com
 *   QA_TO_EMAIL     Recipient, default = QA_FROM_EMAIL
 *
 * Exit code: 1 if any check failed (after emailing), else 0 — so the Action turns red
 * on a real QA regression while still delivering the report.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BRAND = process.env.QA_BRAND || 'TMolecule';
const FROM = process.env.QA_FROM_EMAIL || 'support@tmolecule.com';
const TO = process.env.QA_TO_EMAIL || FROM;

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// [display name, file that must exist, command]
const candidates = [
  ['Schema validation', 'scripts/validate-seeds.mjs', 'node scripts/validate-seeds.mjs --strict'],
  ['Citations', 'scripts/verify-citations.mjs', 'node scripts/verify-citations.mjs'],
  ['Broken links', 'scripts/check-links.mjs', 'node scripts/check-links.mjs'],
  ['Compliance (no-medical)', 'test/compliance.test.ts', 'bun test test/compliance.test.ts'],
];

const results = [];
for (const [name, file, cmd] of candidates) {
  if (!fs.existsSync(file)) continue;
  const r = run(cmd);
  results.push({ name, ok: r.ok, tail: r.out.trim().split('\n').slice(-8).join('\n') });
}

const allOk = results.every((r) => r.ok);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const date = new Date().toISOString().slice(0, 10);

const rows = results
  .map(
    (r) =>
      `<tr><td style="padding:8px 10px;border-bottom:1px solid #e8e1d2;">${r.name}</td>` +
      `<td style="padding:8px 10px;border-bottom:1px solid #e8e1d2;">${r.ok ? '✅ PASS' : '❌ FAIL'}</td></tr>`
  )
  .join('');
const details = results
  .map(
    (r) =>
      `<h3 style="margin:18px 0 6px;">${r.name} — ${r.ok ? 'PASS' : 'FAIL'}</h3>` +
      `<pre style="background:#f4efe4;padding:12px 14px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${esc(r.tail)}</pre>`
  )
  .join('');

const html =
  `<html><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:28px;color:#1a1a17;background:#faf7f0;">` +
  `<h1>${BRAND} /learn — Weekly QA</h1>` +
  `<p><strong>${date}</strong> · Overall: <strong>${allOk ? '✅ PASS' : '❌ FAIL — action needed'}</strong></p>` +
  `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;"><thead><tr>` +
  `<th style="text-align:left;border-bottom:2px solid #1a1a17;padding:8px 10px;">Check</th>` +
  `<th style="text-align:left;border-bottom:2px solid #1a1a17;padding:8px 10px;">Result</th></tr></thead><tbody>${rows}</tbody></table>` +
  `${details}` +
  `<hr style="margin:28px 0 14px;border:0;border-top:1px solid #e8e1d2;">` +
  `<p style="color:#999;font-size:12px;">Automated weekly /learn QA — ${BRAND}. Runs Saturdays via GitHub Actions.</p>` +
  `</body></html>`;

const key = process.env.BREVO_API_KEY;
if (!key) {
  console.log(`[dry-run] No BREVO_API_KEY set. Overall ${allOk ? 'PASS' : 'FAIL'} across ${results.length} checks. Report ${html.length} bytes.`);
  process.exit(allOk ? 0 : 1);
}

const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    sender: { name: `${BRAND} QA`, email: FROM },
    to: [{ email: TO }],
    subject: `${BRAND} /learn — Weekly QA (${allOk ? 'PASS' : 'FAIL'})`,
    htmlContent: html,
  }),
});
console.log(`Brevo: HTTP ${resp.status} ${await resp.text()}`);
if (!resp.ok) process.exit(2);
process.exit(allOk ? 0 : 1);
