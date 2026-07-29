/**
 * DataForSEO response handling.
 *
 * THE THING THIS MODULE EXISTS FOR: DataForSEO returns **HTTP 200 with a
 * task-level error**. A dead model name, exhausted credits, or a malformed
 * field all come back as:
 *
 *   { status_code: 20000, "Ok.", tasks: [ { status_code: 40501,
 *     status_message: "Invalid Field: 'model_name'.", result: null } ] }
 *
 * Code that only checks `response.ok` sees success, finds `result` null, and
 * returns null — which the pipeline reads as "engine not checked" and the
 * dashboard renders as "—", identical to "no credentials configured".
 *
 * That is exactly how the ChatGPT engine sat dead for months: OpenAI retired
 * `gpt-4o-search-preview`, every call returned 40501, and nothing surfaced it.
 * Never inspect only the HTTP status of a DataForSEO call.
 */

const DFS_OK = 20000;

export interface DfsFailure {
  ok: false;
  /** Where it broke, for the log line. */
  stage: "http" | "envelope" | "task" | "empty";
  status?: number;
  message: string;
}

export interface DfsSuccess<T = Record<string, unknown>> {
  ok: true;
  result: T;
}

export type DfsOutcome<T = Record<string, unknown>> = DfsSuccess<T> | DfsFailure;

/**
 * Unwrap a DataForSEO live response to its first result, checking status at
 * every level the API can fail at.
 *
 * Returns a discriminated outcome rather than null so the caller can tell
 * "the engine errored" apart from "the engine ran and found nothing" — a
 * distinction the citation rates depend on, since only the former should be
 * excluded from the denominator.
 */
export function unwrapDfs<T = Record<string, unknown>>(body: unknown): DfsOutcome<T> {
  if (!body || typeof body !== "object") {
    return { ok: false, stage: "envelope", message: "response was not an object" };
  }
  const env = body as Record<string, unknown>;

  const topStatus = typeof env.status_code === "number" ? env.status_code : undefined;
  if (topStatus !== undefined && topStatus !== DFS_OK) {
    return {
      ok: false,
      stage: "envelope",
      status: topStatus,
      message: String(env.status_message ?? "unknown envelope error"),
    };
  }

  const tasks = Array.isArray(env.tasks) ? (env.tasks as Array<Record<string, unknown>>) : [];
  const task = tasks[0];
  if (!task) return { ok: false, stage: "task", message: "response contained no tasks" };

  const taskStatus = typeof task.status_code === "number" ? task.status_code : undefined;
  if (taskStatus !== undefined && taskStatus !== DFS_OK) {
    return {
      ok: false,
      stage: "task",
      status: taskStatus,
      message: String(task.status_message ?? "unknown task error"),
    };
  }

  const results = Array.isArray(task.result) ? (task.result as T[]) : [];
  const first = results[0];
  if (!first) return { ok: false, stage: "empty", message: "task succeeded but returned no result" };

  return { ok: true, result: first };
}

/** One log line per failure, so a dead engine is visible in `wrangler tail`. */
export function logDfsFailure(engine: string, failure: DfsFailure): void {
  console.error(
    JSON.stringify({
      evt: "dfs_error",
      engine,
      stage: failure.stage,
      status: failure.status ?? null,
      message: failure.message,
    }),
  );
}

interface ScraperSource {
  url?: unknown;
}

interface ScraperItem {
  markdown?: unknown;
  sources?: unknown;
}

/**
 * Parse a ChatGPT llm_scraper result into answer text + cited URLs.
 *
 * Endpoint: POST /v3/ai_optimization/chat_gpt/llm_scraper/live/advanced
 *
 * This is the SCRAPER, not `llm_responses`. The distinction matters and is the
 * whole reason the previous implementation could not be repaired by swapping
 * the model name: `llm_responses` calls the OpenAI API, where `web_search:true`
 * is silently ignored — it returns `web_search: false` and `annotations: null`
 * on every model tested, i.e. model knowledge with zero citations. Only the
 * scraper drives real ChatGPT and returns the sources it actually cited.
 *
 * Sources appear BOTH at the result top level and per item, and the per-item
 * set is a superset. Both are collected and de-duplicated.
 */
export function parseChatGptScraper(result: Record<string, unknown>): {
  answer: string;
  citations: string[];
} {
  const citations = new Set<string>();

  const collect = (raw: unknown): void => {
    if (!Array.isArray(raw)) return;
    for (const s of raw as ScraperSource[]) {
      if (s && typeof s.url === "string" && s.url) citations.add(s.url);
    }
  };

  collect(result.sources);

  const items = Array.isArray(result.items) ? (result.items as ScraperItem[]) : [];
  const chunks: string[] = [];
  for (const item of items) {
    collect(item?.sources);
    if (typeof item?.markdown === "string" && item.markdown) chunks.push(item.markdown);
  }

  // Prefer the whole-response markdown; fall back to concatenated item text.
  const answer =
    typeof result.markdown === "string" && result.markdown ? result.markdown : chunks.join("\n");

  return { answer, citations: Array.from(citations) };
}
