const VOICE_HINT = `TMolecule voice: direct, evidence-led, no marketing fluff. Mentions specific cultivars (e.g. Camellia sinensis var. assamica), brewing parameters (water temp, steep time, leaf-to-water ratio), and active compounds (catechins, L-theanine, theaflavins). Prefers "steep" over "brew", "leaf" over "tea bag", "cultivar" over "variety".`;

/**
 * Ideal-answer prompt: ask the model to produce the answer a generalist AI engine
 * (AIO / Perplexity / ChatGPT) would give for `query`, then extract the load-bearing
 * factual claims. We diff those claims against our page coverage.
 *
 * Output contract: a JSON array of strings, one claim per element. Claims should be
 * standalone declarative sentences with the entity + attribute baked in
 * (e.g. "Tallow's fatty-acid profile mirrors human sebum" — not "It mirrors it").
 */
export interface PageContext {
  title?: string;
  h1?: string;
  meta_description?: string;
}

export function idealAnswerPrompt(
  query: string,
  brandVoiceOn: boolean,
  page?: PageContext,
): { system: string; user: string } {
  const voice = brandVoiceOn ? `\n\n${VOICE_HINT}` : "";
  const ctx = page
    ? `\n\nThe page you are evaluating is scoped specifically to:\nTitle: ${page.title ?? ""}\nH1: ${page.h1 ?? ""}\nMeta: ${page.meta_description ?? ""}\n\nDraft claims that an AI search engine would expect to find on THIS page given its specific scope — not a generic article about the keyword.`
    : "";
  return {
    system:
      "You are a content gap analyst. Given a search query and a page scope, you draft the canonical AI-search answer that page would need to cover, then extract the load-bearing factual claims as a JSON array of short standalone sentences.\n\n" +
      "Rules:\n" +
      "1. Each claim is a single declarative sentence, 8-25 words, with the entity baked in.\n" +
      "2. No marketing language, no opinions — only verifiable facts or commonly-cited frameworks.\n" +
      "3. 8-15 claims total. Skip generic claims everyone knows.\n" +
      "4. Stay within the page's actual scope (see context). If the page is about \"fathers day gifts for wet shavers,\" draft wet-shaving gift claims, not generic Father's Day gift claims.\n" +
      "5. Output ONLY the JSON array of strings. No markdown fence, no preamble." +
      voice +
      ctx,
    user: `Search query: ${query}\n\nDraft the answer mentally, then output the JSON array of claims.`,
  };
}

/**
 * Coverage prompt: given a candidate claim and the top-N matching paragraphs from our page,
 * decide whether the page actually covers the claim. We do this with the LLM rather than
 * pure cosine because semantic similarity can be high while the claim is unstated.
 */
export function coverageCheckPrompt(claim: string, candidateChunks: Array<{ text: string; id: string }>): {
  system: string;
  user: string;
} {
  const candidates = candidateChunks
    .map((c, i) => `[${i + 1}] (${c.id})\n${c.text}`)
    .join("\n\n");
  return {
    system:
      "You judge whether a target claim is supported by candidate paragraphs from a webpage. " +
      "Return strict JSON: {\"covered\": boolean, \"best_match_idx\": number|null, \"note\": string}. " +
      "\n\nMark covered=true if a candidate either (a) states the claim, (b) clearly entails the claim, " +
      "(c) covers the claim using different phrasing or a near-synonym, or (d) provides equivalent factual content that a reader would understand to support the claim.\n" +
      "Mark covered=false only if NO candidate substantively addresses the same fact. " +
      "Do not require exact wording. Mechanism descriptions count as coverage even if the named entity differs slightly (e.g. 'tallow- or butter-based soap' supports 'tallow is a common ingredient').\n" +
      "best_match_idx is the 1-based index of the strongest candidate (or null if none). " +
      "Keep notes under 25 words.",
    user: `Target claim:\n${claim}\n\nCandidates:\n${candidates}\n\nJSON only.`,
  };
}

/**
 * Internal-link anchor suggester: given a draft paragraph + the candidate target paragraph,
 * pick the natural anchor text span inside the draft and confirm relevance.
 */
export function anchorSuggestPrompt(draftParagraph: string, targetText: string, targetTitle: string): {
  system: string;
  user: string;
} {
  return {
    system:
      "You suggest the most natural internal-link anchor text from a DRAFT paragraph to a TARGET page. " +
      "Return strict JSON: {\"anchor\": string, \"score\": number, \"reason\": string}. " +
      "anchor is a 2-6 word verbatim span from the DRAFT (not invented). " +
      "score is 0.0-1.0 for how natural the link would feel. " +
      "If no good anchor exists, anchor=\"\" and score<0.3.",
    user: `DRAFT paragraph:\n${draftParagraph}\n\nTARGET (\"${targetTitle}\"):\n${targetText}\n\nJSON only.`,
  };
}
