import { Env, LinkSuggestion, LinkSuggestionResponse } from "./types";
import { chunkDraft } from "./chunk";
import { embed } from "./indexer";
import { anchorSuggestPrompt } from "./prompts";

const MIN_INBOUND_PER_DRAFT = 2; // matches the user's documented internal-linking rule
const PER_PARAGRAPH_TOPK = 3;
const SCORE_FLOOR = 0.55; // cosine; below this we don't bother LLM-rerunning

function extractText(res: unknown): string {
  if (typeof res === "string") return res;
  if (!res || typeof res !== "object") return "";
  const r = res as Record<string, unknown>;
  if (typeof r.response === "string") return r.response;
  if (Array.isArray(r.response) || (r.response && typeof r.response === "object")) {
    const nr = r.response as { content?: string; text?: string };
    if (typeof nr?.content === "string") return nr.content;
    if (typeof nr?.text === "string") return nr.text;
    return JSON.stringify(r.response);
  }
  const result = r.result as { response?: string | unknown } | undefined;
  if (typeof result?.response === "string") return result.response;
  if (Array.isArray(result?.response) || (result?.response && typeof result.response === "object")) {
    return JSON.stringify(result.response);
  }
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (Array.isArray(choices) && choices[0]?.message?.content) return choices[0].message.content;
  return "";
}

async function llm(env: Env, system: string, user: string, max_tokens = 200): Promise<string> {
  const res = await env.AI.run(env.LLM_MODEL as keyof AiModels, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens,
    temperature: 0.2,
  });
  return extractText(res);
}

function parseAnchorJson(raw: string): { anchor: string; score: number; reason: string } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/**
 * For a draft (markdown/plain text), suggest internal links to indexed pages.
 *
 * Approach:
 *   1. Chunk draft into paragraphs (drops frontmatter, code blocks).
 *   2. Embed each paragraph, query Vectorize topK=3.
 *   3. For matches above SCORE_FLOOR, ask the LLM for a natural anchor span.
 *   4. Deduplicate so the same target URL is only suggested once per draft.
 *   5. Enforce the ≥2 inbound rule by surfacing meets_min_inbound flag.
 *
 * If a slug appears in the draft frontmatter as the page being written, we
 * exclude self-suggestions via excludeSlug.
 */
export async function suggestLinks(
  env: Env,
  draft: string,
  excludeSlug: string | null,
): Promise<LinkSuggestionResponse> {
  const paragraphs = chunkDraft(draft);
  if (!paragraphs.length) {
    return {
      draft_chars: draft.length,
      suggestions: [],
      total_suggestions: 0,
      meets_min_inbound: false,
      min_required: MIN_INBOUND_PER_DRAFT,
    };
  }

  const vectors = await embed(env, paragraphs);
  const used = new Set<string>(); // url already suggested
  const suggestions: LinkSuggestion[] = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const para = paragraphs[i];
    const vec = vectors[i];
    const res = await env.CORPUS.query(vec, {
      topK: PER_PARAGRAPH_TOPK,
      returnMetadata: true,
      filter: excludeSlug ? { slug: { $ne: excludeSlug } } : undefined,
    });

    for (const m of res.matches ?? []) {
      if (m.score < SCORE_FLOOR) continue;
      const targetUrl = (m.metadata?.url as string) ?? "";
      const targetText = (m.metadata?.text_preview as string) ?? "";
      const targetSlug = (m.metadata?.slug as string) ?? "";
      if (used.has(targetUrl)) continue;
      if (excludeSlug && targetSlug === excludeSlug) continue;

      const verdict = await llm(env, ...Object.values(anchorSuggestPrompt(para, targetText, targetSlug.replace(/-/g, " "))) as [string, string]);
      const parsed = parseAnchorJson(verdict);
      if (!parsed || !parsed.anchor || parsed.score < 0.45) continue;
      if (!para.toLowerCase().includes(parsed.anchor.toLowerCase())) continue; // anchor must be verbatim

      used.add(targetUrl);
      suggestions.push({
        source_paragraph: para,
        source_paragraph_idx: i,
        target_url: targetUrl,
        target_chunk_id: m.id,
        target_text: targetText,
        suggested_anchor: parsed.anchor,
        score: parsed.score,
      });
      break; // one suggestion per source paragraph
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return {
    draft_chars: draft.length,
    suggestions,
    total_suggestions: suggestions.length,
    meets_min_inbound: suggestions.length >= MIN_INBOUND_PER_DRAFT,
    min_required: MIN_INBOUND_PER_DRAFT,
  };
}
