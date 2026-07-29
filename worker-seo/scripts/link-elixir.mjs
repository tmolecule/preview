#!/usr/bin/env node
// Activate the Cardamom & Green Tea Elixir internal links + CTAs.
//
// The cardamom /learn cluster currently bridges to Spice Rush (live) and references the Elixir
// as "forthcoming" (its inline link was removed during the 2026-07 compliance sweep because the
// PDP didn't exist). Run this ONCE the Elixir PDP is live to:
//   1. switch every cardamom page's product_bridge CTA to the Elixir (5 pages), and
//   2. wire the inline body links on the 2 pages that name it (dropping "forthcoming").
//
//   node scripts/link-elixir.mjs            # verifies the PDP is live, then edits the seeds
//   node scripts/link-elixir.mjs --force    # skip the live check
//   node scripts/link-elixir.mjs --push     # also push changed pages to KV
//
// After it runs (without --push), deploy:  bash scripts/seed-kv.sh   (or push the changed slugs).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HANDLE = "cardamom-green-tea-elixir";
const PATH = `/products/${HANDLE}`;
const PDP_URL = `https://tmolecule.com${PATH}`;
const LINK = `<a href="${PATH}">Cardamom & Green Tea Elixir</a>`;

// product_bridge CTA copy per cardamom page. Sensory / product framing only — no medical claims.
const BRIDGE = {
  "cardamom-and-green-tea": { label: "Try the Elixir", blurb: "The cardamom-and-green-tea pairing, ready to drink." },
  "what-is-cardamom": { label: "Taste real cardamom", blurb: "Whole cardamom milled into our Cardamom & Green Tea Elixir." },
  "cardamom-benefits": { label: "Try the Elixir", blurb: "Real cardamom and green tea in one bottle." },
  "cardamom-substitute": { label: "No substitute needed", blurb: "Real cardamom, ready to drink, in our Cardamom & Green Tea Elixir." },
  "cardamom": { label: "Taste it", blurb: "Cardamom's aromatics in our Cardamom & Green Tea Elixir." },
};

// Inline body links: wrap the existing mention + drop the now-stale "forthcoming".
const INLINE = {
  "cardamom-and-green-tea": [["TMolecule's forthcoming Cardamom & Green Tea Elixir", `TMolecule's ${LINK}`]],
  "what-is-cardamom": [["TMolecule's forthcoming Cardamom & Green Tea Elixir", `TMolecule's ${LINK}`]],
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const push = args.includes("--push");

async function pdpIsLive() {
  try {
    const res = await fetch(`${PDP_URL}.json?cb=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    return res.ok;
  } catch {
    return false;
  }
}

if (!force) {
  if (!(await pdpIsLive())) {
    console.error(
      `PDP not live yet (${PDP_URL} did not return 200). Cardamom pages still bridge to Spice Rush.\n` +
        `Re-run when the product is active, or pass --force to switch anyway.`,
    );
    process.exit(1);
  }
  console.log(`PDP is live: ${PDP_URL}`);
}

const changed = [];
for (const slug of Object.keys(BRIDGE)) {
  const file = join(ROOT, "seed", `${slug}.json`);
  const d = JSON.parse(readFileSync(file, "utf8"));
  let touched = false;

  // 1. switch the product_bridge CTA to the Elixir
  if (d.product_bridge !== PATH) {
    d.product_bridge = PATH;
    d.product_bridge_label = BRIDGE[slug].label;
    d.product_bridge_blurb = BRIDGE[slug].blurb;
    touched = true;
  }

  // 2. inline body link (only on pages that name the Elixir)
  for (const [oldStr, newStr] of INLINE[slug] || []) {
    if (d.body_html.includes(oldStr)) {
      d.body_html = d.body_html.split(oldStr).join(newStr);
      touched = true;
    }
  }

  if (touched) {
    d.updated_at = new Date().toISOString().slice(0, 10);
    writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
    changed.push(slug);
    console.log(`  ${slug}: bridge → Elixir${INLINE[slug] ? " + inline link" : ""}`);
  } else {
    console.log(`  ${slug}: already pointing at the Elixir — skipping`);
  }
}

if (!changed.length) {
  console.log("\nNothing to do.");
  process.exit(0);
}

if (push) {
  for (const slug of changed) {
    console.log(`  pushing ${slug} to KV…`);
    execFileSync(
      "npx",
      ["wrangler", "kv", "key", "put", "--binding=LEARN_PAGES", "--remote", "--preview", "false", slug, `--path=seed/${slug}.json`],
      { cwd: ROOT, stdio: "inherit" },
    );
  }
  console.log("\nDone — Elixir CTAs + links live.");
} else {
  console.log(`\nEdited ${changed.length} seed(s): ${changed.join(", ")}`);
  console.log(`Deploy with:  bash scripts/seed-kv.sh   (or re-run with --push)`);
}
