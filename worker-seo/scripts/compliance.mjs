// Shared no-medical-claims scan for TMolecule /learn seeds. Single source of truth for the
// advisory CLI validator (validate-seeds.mjs) and the hard-fail Bun test (test/compliance.test.ts).
// Ported from the WhollyKaw scan and retuned for FOOD / DIETARY-SUPPLEMENT context.
//
// TMolecule products are ingestible foods/teas, not drugs. Ingredient RESEARCH framing is
// allowed ("curcumin has been studied for inflammation"); PRODUCT outcome / disease claims are
// not ("cures X", "reduces inflammation", "boosts immunity"). Negation/disclaimer context and
// cited-source provenance are exempted so the gate stays usable without false positives.
//
// DISCLAIMER MECHANISM DIFFERS FROM WK: TM injects a wellness/FDA banner via the worker
// template when a page's metadata says so — `disclaimer:true` OR intent 'safety'/'eu-status'
// (see src/template.js). There is NO inline banner in body_html, so hasDisclaimer() keys off
// that metadata predicate, mirroring template.js.

export const DISCLAIMER =
  /((no|nothing|not|neither)\b[^.?!]{0,80}?(intended|evaluated)[^.?!]{0,90}?(diagnose|cure|treat|prevent|disease|FDA|Food and Drug)[^.?!]*?[.?!])/gi;

export const NEGATION =
  /\b(do not|does not|don't|doesn't|did not|no claim|make no|makes no|made no|no outcome|not intended|not meant|not an?|none|nothing|no one|should not|won't|wouldn't|not a\b|not the same|not been evaluated|not evaluated|we make no|isn't|aren't|can't|cannot|neither|myth|overreach|skeptical|are marketing|marketing claim|sold as)\b/i;

// PRODUCT outcome / disease claims. Bare "anti-inflammatory"/"healing" are intentionally NOT
// banned (research/citation vocabulary). "\bcured\b" is NOT banned either — it fires on
// "cured carefully" (curing/drying spices), not disease. Food-specific overreach added:
// boosts immunity / detoxifies / miracle cure.
export const BANNED = [
  /\bcures?\b/i,
  /reduces? inflammation/i,
  /boosts? collagen/i,
  /boosts? (your )?immun\w+/i,
  /\bdetoxif(?:y|ies|ication)\b/i,
  /treats? (eczema|psoriasis|acne|dermatitis|rosacea|anxiety|depression|diabetes|cancer|arthritis)/i,
  /clinically proven/i,
  /\bprevents? (disease|infection|cancer|diabetes|aging)\b/i,
];

export const SCAFFOLDING = [/\{\{[^}]+\}\}/, /BEFORE PUBLISHING/i, /SOURCE NEEDED/i];

// Ingredient-effect vocab that, when present on a page carrying NO disclaimer, indicates a
// health-adjacent page missing its wellness/FDA banner.
export const BIOACTIVITY =
  /anti-?inflammat|antioxidant|immune|adaptogen|lowers? (blood|cholesterol|glucose)|blood sugar|metabolis|cortisol|inflammation/i;

/**
 * Medical-claim hits in a seed page (empty = clean).
 * @param {{body_html?:string, faqs?:any, sources?:any[]}} d
 * @returns {{term:string, ctx:string}[]}
 */
export function findClaims(d) {
  let hay = (d.body_html + " " + JSON.stringify(d.faqs || "")).replace(DISCLAIMER, " ");
  for (const s of d.sources || []) {
    for (const field of [s && s.title, s && s.abstract, s && s.snippet, s && s.summary]) {
      if (field && typeof field === "string") hay = hay.split(field).join(" ");
    }
  }
  const hits = [];
  for (const reBase of BANNED) {
    const re = new RegExp(reBase.source, reBase.flags.replace("g", "") + "g");
    let m;
    while ((m = re.exec(hay)) !== null) {
      const before = hay.slice(Math.max(0, m.index - 60), m.index);
      const after = hay.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/^[^.!]*\?/.test(after)) continue; // rhetorical FAQ question
      if (/\b(no|not|n't|without|nor|never)\b[^.?!]*$/i.test(before)) continue; // in-clause negation
      const ctx = hay.slice(Math.max(0, m.index - 140), m.index + m[0].length + 140);
      if (NEGATION.test(ctx)) continue; // adjacent-clause disclaimer / myth-table
      hits.push({ term: m[0], ctx: ctx.replace(/\s+/g, " ").trim() });
      break;
    }
  }
  return hits;
}

/**
 * True if the page will carry a wellness/FDA disclaimer. Mirrors src/template.js: injected when
 * intent is 'safety'/'eu-status' or the page sets disclaimer:true.
 */
export function hasDisclaimer(d) {
  return d.disclaimer === true || d.intent === "safety" || d.intent === "eu-status";
}
