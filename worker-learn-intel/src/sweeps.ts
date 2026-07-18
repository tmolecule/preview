/**
 * Sweep history — the time series that makes "did our citation rate actually
 * move?" answerable.
 *
 * Before this, the only stored artefact was `gap:<slug>:latest`, which each run
 * OVERWROTE. There was no way to ask what the rate was last month, so there was
 * no way to distinguish a real gain from sampling noise.
 *
 * Storage shape: ONE key per batch run, `sweep:<iso-timestamp>`, holding that
 * batch's per-engine totals. Deliberately not a per-page key and deliberately
 * not a running counter:
 *
 *   - a running counter would need read-modify-write on a single hot key, and
 *     KV gives no atomicity, so concurrent runs would silently lose increments;
 *   - a per-page-per-day key would mean tens of thousands of keys and a paged
 *     `list()` walk on every dashboard load.
 *
 * One append-only record per run is race-free, and a year of daily cron is ~365
 * keys — a single unpaged `list()`.
 */

import { Env } from "./types";
import { compareRates, summariseRate, type RateComparison, type RateSummary } from "./statistics";

export const ENGINE_IDS = ["perplexity", "chatgpt", "aio"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export const ENGINE_LABELS: Record<EngineId, string> = {
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
  aio: "Google AI Overview",
};

export interface EngineTally {
  /**
   * Pages where this engine actually returned an answer. NOT the page count —
   * an engine that errored, or a query with no AI Overview surface, is not a
   * miss and must not land in the denominator.
   */
  checked: number;
  cited: number;
  mentioned: number;
}

export interface SweepRecord {
  ts: string;
  /** Pages attempted in this batch, whatever each engine did. */
  pages: number;
  engines: Record<EngineId, EngineTally>;
}

/** Retain a little over a year so a full year-over-year comparison is possible. */
const SWEEP_TTL_SECONDS = 60 * 60 * 24 * 400;

const emptyTally = (): EngineTally => ({ checked: 0, cited: 0, mentioned: 0 });

export function emptyEngineTallies(): Record<EngineId, EngineTally> {
  return {
    perplexity: emptyTally(),
    chatgpt: emptyTally(),
    aio: emptyTally(),
  };
}

export async function recordSweep(env: Env, record: SweepRecord): Promise<void> {
  await env.STATE.put(`sweep:${record.ts}`, JSON.stringify(record), {
    expirationTtl: SWEEP_TTL_SECONDS,
  });
}

/**
 * Read sweep records, newest first. `sinceIso` and `untilIso` are inclusive
 * lower / exclusive upper bounds on the record timestamp.
 */
export async function listSweeps(
  env: Env,
  sinceIso?: string,
  untilIso?: string,
): Promise<SweepRecord[]> {
  const out: SweepRecord[] = [];
  let cursor: string | undefined;

  do {
    const page = await env.STATE.list({ prefix: "sweep:", cursor });
    for (const key of page.keys) {
      const ts = key.name.slice("sweep:".length);
      if (sinceIso && ts < sinceIso) continue;
      if (untilIso && ts >= untilIso) continue;
      const raw = await env.STATE.get(key.name);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as SweepRecord);
      } catch {
        // A corrupt record must not take the dashboard down.
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export function aggregate(sweeps: readonly SweepRecord[]): Record<EngineId, EngineTally> {
  const totals = emptyEngineTallies();
  for (const sweep of sweeps) {
    for (const engine of ENGINE_IDS) {
      const tally = sweep.engines?.[engine];
      if (!tally) continue;
      totals[engine].checked += tally.checked ?? 0;
      totals[engine].cited += tally.cited ?? 0;
      totals[engine].mentioned += tally.mentioned ?? 0;
    }
  }
  return totals;
}

export interface EngineRates {
  engine: EngineId;
  label: string;
  cited: RateSummary;
  mentioned: RateSummary;
}

/** Per-engine cited and mentioned rates, each with its 95% interval. */
export function ratesFrom(totals: Record<EngineId, EngineTally>): EngineRates[] {
  return ENGINE_IDS.map((engine) => ({
    engine,
    label: ENGINE_LABELS[engine],
    cited: summariseRate(totals[engine].cited, totals[engine].checked),
    mentioned: summariseRate(totals[engine].mentioned, totals[engine].checked),
  }));
}

function isoDaysAgo(days: number, from: Date): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}

export interface WindowComparison {
  engine: EngineId;
  label: string;
  cited: RateComparison;
  mentioned: RateComparison;
}

/**
 * Compare the last `days` against the `days` immediately before them.
 *
 * `now` is injectable so this is testable without freezing the clock.
 *
 * Note the windows are adjacent, not overlapping — with a 10-pages-per-tick
 * cron the TMolecule corpus (~81 pages) rotates about every 8 days, so a 30-day
 * window covers roughly three full passes. Shorter windows compare different
 * subsets of pages, not the same pages over time, and the comparison gets much
 * weaker. Prefer 30 days or more.
 */
export interface VisibilityData {
  rates: EngineRates[];
  comparisons: WindowComparison[];
}

/**
 * Everything the dashboard's rates panel needs: current-window rates with
 * intervals, plus the window-over-window verdict.
 *
 * Failures are swallowed into an empty panel — sweep history is diagnostic, and
 * a KV hiccup must not take down a dashboard whose main job is the coverage
 * report.
 */
export async function visibilityData(
  env: Env,
  days = 30,
  now: Date = new Date(),
): Promise<VisibilityData | null> {
  try {
    const current = await listSweeps(env, isoDaysAgo(days, now));
    return {
      rates: ratesFrom(aggregate(current)),
      comparisons: await compareWindows(env, days, now),
    };
  } catch (e) {
    console.error("visibilityData failed:", e);
    return null;
  }
}

export async function compareWindows(
  env: Env,
  days = 30,
  now: Date = new Date(),
): Promise<WindowComparison[]> {
  const currentStart = isoDaysAgo(days, now);
  const previousStart = isoDaysAgo(days * 2, now);

  const [current, previous] = await Promise.all([
    listSweeps(env, currentStart),
    listSweeps(env, previousStart, currentStart),
  ]);

  const currentTotals = aggregate(current);
  const previousTotals = aggregate(previous);

  return ENGINE_IDS.map((engine) => ({
    engine,
    label: ENGINE_LABELS[engine],
    cited: compareRates(
      { successes: previousTotals[engine].cited, n: previousTotals[engine].checked },
      { successes: currentTotals[engine].cited, n: currentTotals[engine].checked },
    ),
    mentioned: compareRates(
      { successes: previousTotals[engine].mentioned, n: previousTotals[engine].checked },
      { successes: currentTotals[engine].mentioned, n: currentTotals[engine].checked },
    ),
  }));
}
