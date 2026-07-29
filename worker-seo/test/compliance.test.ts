// Hard-fail compliance gate over the TMolecule /learn seed corpus. Run with `bun test`.
//
// Ported from the WhollyKaw gate and retuned for FOOD / DIETARY-SUPPLEMENT context. The CLI
// validator (scripts/validate-seeds.mjs) WARNs; this suite FAILS so it can gate CI:
//   1. no-medical-claims  (shared scan — scripts/compliance.mjs)
//   2. no editorial scaffolding shipping live ({{VERIFY}} / BEFORE PUBLISHING)
//   3. wellness/FDA disclaimer present on ingredient-effect pages (via metadata flag)
//
// TM has no tallow fatty-acid corpus, so that WK check is intentionally absent. Disclaimers are
// a metadata flag (disclaimer:true / intent safety|eu-status) injected by the worker template —
// NOT inline HTML — so hasDisclaimer() keys off metadata (see scripts/compliance.mjs).
import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findClaims, hasDisclaimer, SCAFFOLDING, BIOACTIVITY, bioactivityText } from "../scripts/compliance.mjs";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");
const SKIP = new Set(["reviews.json"]);

type Page = { file: string; d: any };
const pages: Page[] = readdirSync(SEED)
  .filter((f) => f.endsWith(".json") && !SKIP.has(f))
  .map((f) => {
    let d: any = {};
    try {
      d = JSON.parse(readFileSync(join(SEED, f), "utf8"));
    } catch (e) {
      throw new Error(`${f}: invalid JSON — ${(e as Error).message}`);
    }
    return { file: f, d };
  })
  .filter((p) => typeof p.d.body_html === "string");

test("corpus loaded", () => {
  expect(pages.length).toBeGreaterThan(40);
});

describe("no medical claims", () => {
  for (const { file, d } of pages) {
    test(file, () => {
      const hits = findClaims(d);
      if (hits.length) {
        throw new Error(
          `${hits.length} claim(s):\n` +
            hits.map((h) => `  • "${h.term}" — …${h.ctx.slice(50, 190)}…`).join("\n"),
        );
      }
    });
  }
});

describe("no editorial scaffolding in live body", () => {
  for (const { file, d } of pages) {
    test(file, () => {
      const bad = SCAFFOLDING.filter((re) => re.test(d.body_html));
      expect(bad, `scaffolding matched: ${bad.map((r) => r.source).join(", ")}`).toHaveLength(0);
    });
  }
});

// Health-adjacent pages (benefits/mechanism about an ingredient's effects) must carry the
// wellness/FDA disclaimer flag so the worker injects the banner. Hard regression guard.
describe("wellness disclaimer — ingredient-effect pages (hard guard)", () => {
  const MUST_HAVE_DISCLAIMER = [
    "turmeric",
    "ginger",
    "ashwagandha",
    "cinnamon",
    "cardamom",
    "cardamom-benefits",
    "collagen-for-joints",
    "collagen-for-skin",
    "collagen-for-hair-nails",
    "rooibos-tea-benefits",
    "oolong-tea-benefits",
    "l-theanine-and-caffeine-in-tea",
    "gut-skin-axis",
    "chai-tea-benefits-spice-by-spice",
  ];
  const byName = new Map(pages.map((p) => [p.file.replace(/\.json$/, ""), p.d]));
  for (const slug of MUST_HAVE_DISCLAIMER) {
    test(slug, () => {
      const d = byName.get(slug);
      expect(d, `${slug} not found in corpus`).toBeDefined();
      expect(
        hasDisclaimer(d),
        `${slug} is an ingredient-effect page but has no disclaimer flag (set disclaimer:true or intent safety/eu-status)`,
      ).toBe(true);
    });
  }
});

// Advisory (never fails CI): bannerless pages that mention ingredient-effect vocab, for review.
test("wellness disclaimer coverage report (advisory)", () => {
  const bannerless = pages
    .filter((p) => BIOACTIVITY.test(bioactivityText(p.d)) && !hasDisclaimer(p.d))
    .map((p) => p.file);
  if (bannerless.length) {
    console.warn(
      `\n[advisory] ${bannerless.length} page(s) mention ingredient-effect vocab without a ` +
        `disclaimer flag. Review any whose PRIMARY subject is an ingredient's effects:\n  ` +
        bannerless.join("\n  "),
    );
  }
  expect(Array.isArray(bannerless)).toBe(true);
});
