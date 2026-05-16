import { Env, GapClaim, GapReport } from "./types";
import { embed } from "./indexer";
import { idealAnswerPrompt, coverageCheckPrompt, PageContext } from "./prompts";

async function loadPageContext(env: Env, slug: string): Promise<PageContext | undefined> {
  const raw = await env.STATE.get(`page:${slug}:meta`);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PageContext;
  } catch {
    return undefined;
  }
}

interface LlamaResponse {
  response?: string | { content?: string; text?: string };
  result?: { response?: string };
  choices?: Array<{ message?: { content?: string } }>;
}

function extractText(res: unknown): string {
  if (typeof res === "string") return res;
  if (!res || typeof res !== "object") return "";
  const r = res as Record<string, unknown>;
  // 1) classic { response: "..." }
  if (typeof r.response === "string") return r.response;
  // 2) structured output: { response: [...] } or { response: {...} } — fp8-fast often returns parsed JSON directly
  if (Array.isArray(r.response) || (r.response && typeof r.response === "object")) {
    // {response: {content: "..."}} variant
    const nested = r.response as { content?: string; text?: string };
    if (typeof nested?.content === "string") return nested.content;
    if (typeof nested?.text === "string") return nested.text;
    return JSON.stringify(r.response);
  }
  // 3) wrapped { result: { response: "..." } }
  const result = r.result as { response?: string | unknown } | undefined;
  if (typeof result?.response === "string") return result.response;
  if (Array.isArray(result?.response) || (result?.response && typeof result.response === "object")) {
    return JSON.stringify(result.response);
  }
  // 4) OpenAI-style { choices: [{ message: { content } }] }
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (Array.isArray(choices) && choices[0]?.message?.content) return choices[0].message.content;
  return "";
}

async function llm(env: Env, prompt: { system: string; user: string }, max_tokens = 1500): Promise<string> {
  const res = await env.AI.run(env.LLM_MODEL as keyof AiModels, {
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    max_tokens,
    temperature: 0.2,
  });
  const text = extractText(res);
  if (!text) {
    console.error("llm: empty extraction; shape was", JSON.stringify(res).slice(0, 500));
  }
  return text;
}

function parseJsonLoose<T>(raw: string): T | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const m = trimmed.match(/[\[{][\s\S]*[\]}]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

async function draftClaims(env: Env, query: string, page?: PageContext): Promise<string[]> {
  const prompt = idealAnswerPrompt(query, env.BRAND_VOICE === "on", page);
  const raw = await llm(env, prompt, 1500);
  const arr = parseJsonLoose<string[]>(raw);
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => typeof c === "string" && c.length >= 10 && c.length <= 300);
}

/**
 * Run gap analysis for a single keyword against a specific page (slug).
 * Steps:
 *   1. Have Llama draft the canonical answer + extract 8-15 claims.
 *   2. For each claim, embed it and query Vectorize filtered to that slug.
 *   3. Have Llama judge coverage given top-3 matching chunks.
 *   4. Aggregate into a GapReport.
 *
 * Optionally consults Perplexity Sonar for live citation tracking if PERPLEXITY_API_KEY is set.
 */
export async function runGapAnalysis(env: Env, slug: string, primary_kw: string, url: string): Promise<GapReport> {
  const pageCtx = await loadPageContext(env, slug);
  const claims = await draftClaims(env, primary_kw, pageCtx);
  if (!claims.length) {
    return {
      slug,
      url,
      primary_kw,
      generated_at: new Date().toISOString(),
      model: env.LLM_MODEL,
      total_claims: 0,
      covered_claims: 0,
      uncovered_claims: 0,
      claims: [],
    };
  }

  const claimVectors = await embed(env, claims);
  const checked: GapClaim[] = [];

  for (let i = 0; i < claims.length; i += 1) {
    const claim = claims[i];
    const vec = claimVectors[i];
    const matches = await env.CORPUS.query(vec, {
      topK: 3,
      filter: { slug },
      returnMetadata: true,
    });
    const candidates = (matches.matches ?? []).map((m) => ({
      id: m.id,
      text: (m.metadata?.text_preview as string) ?? "",
      score: m.score,
    }));

    if (!candidates.length) {
      checked.push({ claim, source: "ideal_answer", covered: false, note: "no candidates in index" });
      continue;
    }

    const verdict = await llm(env, coverageCheckPrompt(claim, candidates), 200);
    const parsed = parseJsonLoose<{ covered: boolean; best_match_idx: number | null; note: string }>(verdict);
    if (!parsed) {
      checked.push({ claim, source: "ideal_answer", covered: false, note: "verdict parse failed" });
      continue;
    }
    const matchIdx = parsed.best_match_idx ? parsed.best_match_idx - 1 : null;
    const best = matchIdx !== null && candidates[matchIdx] ? candidates[matchIdx] : null;
    checked.push({
      claim,
      source: "ideal_answer",
      covered: parsed.covered,
      best_match_chunk_id: best?.id,
      best_match_score: best?.score,
      note: parsed.note,
    });
  }

  // Three citation engines, all optional. Run them in parallel so the total wall time
  // for the AI-visibility check is governed by the slowest single engine (≈10-30s),
  // not their sum. Each returns null if the credentials are missing or the call fails.
  const hasDfs = !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
  const [pplx, chat, aio] = await Promise.all([
    env.PERPLEXITY_API_KEY ? queryPerplexity(env, primary_kw) : Promise.resolve(null),
    hasDfs ? queryChatGPT(env, primary_kw) : Promise.resolve(null),
    hasDfs ? queryAIO(env, primary_kw) : Promise.resolve(null),
  ]);

  let perplexity_cited_us: boolean | undefined;
  let perplexity_citations: string[] | undefined;
  let chatgpt_cited_us: boolean | undefined;
  let chatgpt_citations: string[] | undefined;
  let aio_cited_us: boolean | undefined;
  let aio_citations: string[] | undefined;

  if (pplx) {
    perplexity_citations = pplx.citations;
    perplexity_cited_us = tmCitedIn(pplx.citations);
  }
  if (chat) {
    chatgpt_citations = chat.citations;
    chatgpt_cited_us = tmCitedIn(chat.citations);
  }
  if (aio) {
    aio_citations = aio.citations;
    aio_cited_us = tmCitedIn(aio.citations);
  }

  const covered = checked.filter((c) => c.covered).length;
  return {
    slug,
    url,
    primary_kw,
    generated_at: new Date().toISOString(),
    model: env.LLM_MODEL,
    total_claims: checked.length,
    covered_claims: covered,
    uncovered_claims: checked.length - covered,
    claims: checked,
    perplexity_cited_us,
    perplexity_citations,
    chatgpt_cited_us,
    chatgpt_citations,
    aio_cited_us,
    aio_citations,
  };
}

// Match any TMolecule-owned canonical URL. learn.tmolecule.com is served by
// worker-seo; apex tmolecule.com may also be cited. An AI engine citing any
// of them counts as a citation for us.
function tmCitedIn(citations: string[]): boolean {
  return citations.some((c) => {
    try {
      const u = new URL(c);
      return u.hostname === "tmolecule.com" || u.hostname.endsWith(".tmolecule.com");
    } catch {
      return false;
    }
  });
}

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
}

async function queryPerplexity(env: Env, query: string): Promise<{ answer: string; citations: string[] } | null> {
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: query }],
        return_citations: true,
      }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as PerplexityResponse;
    return {
      answer: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
    };
  } catch {
    return null;
  }
}

// DataForSEO ChatGPT scraper — runs the query through GPT with web search enabled and
// returns the answer plus the list of source URLs ChatGPT cited.
// Endpoint: POST /v3/ai_optimization/chat_gpt/llm_responses/live
// IMPORTANT: must use a search-capable model. gpt-4o-mini silently disables web_search
// (the response comes back with "web_search": false) and returns vanilla model knowledge
// with no citations. gpt-4o-search-preview is the search-enabled variant.
// Pricing: ~$0.005–0.01 per request.
async function queryChatGPT(env: Env, query: string): Promise<{ answer: string; citations: string[] } | null> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return null;
  try {
    const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
    const r = await fetch("https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        user_prompt: query,
        model_name: "gpt-4o-search-preview",
        web_search: true,
        max_output_tokens: 800,
      }]),
    });
    if (!r.ok) {
      console.error(`queryChatGPT: HTTP ${r.status}`);
      return null;
    }
    const data = (await r.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<{ result?: Array<Record<string, unknown>> }>) ?? [];
    const result = tasks[0]?.result?.[0] ?? null;
    if (!result) return null;
    // Walk every shape the API can return citations in: top-level annotations,
    // per-item references, per-section annotations, per-section sources.
    const citations = new Set<string>();
    const collect = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") return;
      const o = obj as Record<string, unknown>;
      if (typeof o.url === "string") citations.add(o.url);
      for (const key of ["annotations", "references", "web_search_results", "sources", "citations", "items", "sections"]) {
        const v = o[key];
        if (Array.isArray(v)) for (const x of v) collect(x);
      }
    };
    collect(result);
    // Pull the answer text from items[].sections[type=text].text (current shape).
    let answer = (result.message_content as string) ?? "";
    if (!answer) {
      const items = (result.items as Array<{ sections?: Array<{ type?: string; text?: string }> }>) ?? [];
      for (const it of items) {
        for (const s of it.sections ?? []) {
          if (s.type === "text" && s.text) answer += (answer ? "\n" : "") + s.text;
        }
      }
    }
    return { answer, citations: Array.from(citations) };
  } catch (e) {
    console.error("queryChatGPT failed:", e);
    return null;
  }
}

// DataForSEO Google AI Overview scraper — runs the keyword on Google and returns the AIO
// block (the boxed AI answer at the top of the SERP) plus the list of sites it cited.
// Endpoint: POST /v3/serp/google/organic/live/advanced
// AIO comes back as one item with type === "ai_overview" inside the SERP items array.
// Returns null if the query has no AIO surface for this geo (about ~30% of queries vary).
async function queryAIO(env: Env, query: string): Promise<{ answer: string; citations: string[] } | null> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return null;
  try {
    const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
    const r = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        keyword: query,
        language_code: "en",
        location_code: 2840, // United States
        device: "desktop",
      }]),
    });
    if (!r.ok) {
      console.error(`queryAIO: HTTP ${r.status}`);
      return null;
    }
    const data = (await r.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<{ result?: Array<Record<string, unknown>> }>) ?? [];
    const result = tasks[0]?.result?.[0] ?? null;
    if (!result) return null;
    const items = (result.items as Array<Record<string, unknown>>) ?? [];
    const aioItem = items.find((it) => it.type === "ai_overview");
    if (!aioItem) return null;
    // Recursively walk the AIO block to collect every URL it cites — references arrays
    // can be nested under markdown_items, items, references, links, etc.
    const citations = new Set<string>();
    const collectUrls = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const v of obj) collectUrls(v);
        return;
      }
      const o = obj as Record<string, unknown>;
      if (typeof o.url === "string") citations.add(o.url);
      if (typeof o.source_url === "string") citations.add(o.source_url);
      for (const key of ["references", "markdown_items", "items", "links", "annotations", "source_results"]) {
        const v = o[key];
        if (v) collectUrls(v);
      }
    };
    collectUrls(aioItem);
    let answer = (aioItem.markdown as string) ?? (aioItem.text as string) ?? "";
    const mItems = (aioItem.markdown_items as Array<{ text?: string }>) ?? [];
    for (const mi of mItems) if (mi.text && !answer.includes(mi.text)) answer += `\n${mi.text}`;
    return { answer, citations: Array.from(citations) };
  } catch (e) {
    console.error("queryAIO failed:", e);
    return null;
  }
}

export async function saveGapReport(env: Env, report: GapReport): Promise<void> {
  const key = `gap:${report.slug}:latest`;
  await env.STATE.put(key, JSON.stringify(report), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days
    metadata: {
      generated_at: report.generated_at,
      covered: report.covered_claims,
      uncovered: report.uncovered_claims,
    },
  });
}

export async function listGapReports(env: Env): Promise<GapReport[]> {
  const list = await env.STATE.list({ prefix: "gap:" });
  const out: GapReport[] = [];
  for (const k of list.keys) {
    const raw = await env.STATE.get(k.name);
    if (raw) {
      try {
        out.push(JSON.parse(raw) as GapReport);
      } catch {
        // skip malformed
      }
    }
  }
  return out.sort((a, b) => b.uncovered_claims - a.uncovered_claims);
}
