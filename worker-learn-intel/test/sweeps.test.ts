import { describe, expect, it } from "bun:test";
import {
  aggregate,
  compareWindows,
  emptyEngineTallies,
  listSweeps,
  ratesFrom,
  recordSweep,
  type SweepRecord,
} from "../src/sweeps";

/** Minimal in-memory stand-in for the KV binding, with cursor paging. */
function fakeKv(pageSize = 1000) {
  const store = new Map<string, string>();
  return {
    store,
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async list({ prefix = "", cursor }: { prefix?: string; cursor?: string } = {}) {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const next = start + pageSize;
      const complete = next >= all.length;
      return {
        keys: slice.map((name) => ({ name })),
        list_complete: complete,
        cursor: complete ? undefined : String(next),
      };
    },
  };
}

const envWith = (kv: ReturnType<typeof fakeKv>) => ({ STATE: kv }) as unknown as Env;

function sweep(ts: string, tallies: Partial<Record<"perplexity" | "chatgpt" | "aio", [number, number, number]>>): SweepRecord {
  const engines = emptyEngineTallies();
  for (const [engine, [checked, cited, mentioned]] of Object.entries(tallies)) {
    engines[engine as "perplexity"] = { checked, cited, mentioned };
  }
  return { ts, pages: 10, engines };
}

describe("recordSweep / listSweeps", () => {
  it("round-trips a record", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-07-18T08:00:00.000Z", { perplexity: [10, 3, 5] }));

    const out = await listSweeps(env);
    expect(out).toHaveLength(1);
    expect(out[0].engines.perplexity).toEqual({ checked: 10, cited: 3, mentioned: 5 });
  });

  it("returns newest first", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-07-01T08:00:00.000Z", {}));
    await recordSweep(env, sweep("2026-07-18T08:00:00.000Z", {}));

    const out = await listSweeps(env);
    expect(out.map((s) => s.ts)).toEqual([
      "2026-07-18T08:00:00.000Z",
      "2026-07-01T08:00:00.000Z",
    ]);
  });

  it("honours an inclusive lower and exclusive upper bound", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    for (const d of ["01", "10", "20"]) {
      await recordSweep(env, sweep(`2026-07-${d}T00:00:00.000Z`, {}));
    }

    const mid = await listSweeps(env, "2026-07-10T00:00:00.000Z", "2026-07-20T00:00:00.000Z");
    expect(mid.map((s) => s.ts)).toEqual(["2026-07-10T00:00:00.000Z"]);
  });

  it("pages through a cursor rather than truncating", async () => {
    const kv = fakeKv(2); // force paging
    const env = envWith(kv);
    for (let i = 1; i <= 7; i++) {
      await recordSweep(env, sweep(`2026-07-0${i}T00:00:00.000Z`, {}));
    }
    expect(await listSweeps(env)).toHaveLength(7);
  });

  it("skips a corrupt record instead of throwing", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-07-18T08:00:00.000Z", { chatgpt: [4, 1, 1] }));
    await kv.put("sweep:2026-07-19T08:00:00.000Z", "{ not json");

    const out = await listSweeps(env);
    expect(out).toHaveLength(1);
  });
});

describe("aggregate", () => {
  it("sums tallies across sweeps", () => {
    const totals = aggregate([
      sweep("a", { perplexity: [10, 3, 5], chatgpt: [8, 2, 2] }),
      sweep("b", { perplexity: [10, 4, 6] }),
    ]);
    expect(totals.perplexity).toEqual({ checked: 20, cited: 7, mentioned: 11 });
    expect(totals.chatgpt).toEqual({ checked: 8, cited: 2, mentioned: 2 });
    expect(totals.aio).toEqual({ checked: 0, cited: 0, mentioned: 0 });
  });

  it("tolerates a record missing an engine block", () => {
    const partial = { ts: "a", pages: 1, engines: {} } as unknown as SweepRecord;
    expect(() => aggregate([partial])).not.toThrow();
    expect(aggregate([partial]).aio.checked).toBe(0);
  });
});

describe("ratesFrom", () => {
  it("attaches an interval to every engine rate", () => {
    const totals = emptyEngineTallies();
    totals.perplexity = { checked: 100, cited: 50, mentioned: 70 };
    const rates = ratesFrom(totals);
    const pplx = rates.find((r) => r.engine === "perplexity")!;

    expect(pplx.cited.label).toBe("50% (40-60%, n=100)");
    expect(pplx.mentioned.rate).toBeCloseTo(0.7, 4);
  });

  it("reports no data for an engine that was never checked", () => {
    const rates = ratesFrom(emptyEngineTallies());
    expect(rates.every((r) => r.cited.label === "no data")).toBe(true);
  });
});

describe("compareWindows", () => {
  const NOW = new Date("2026-07-31T00:00:00.000Z");

  it("calls a small move on a small panel within noise", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    // previous 30d window
    await recordSweep(env, sweep("2026-06-15T00:00:00.000Z", { perplexity: [6, 4, 4] }));
    // current 30d window
    await recordSweep(env, sweep("2026-07-15T00:00:00.000Z", { perplexity: [6, 5, 5] }));

    const [pplx] = await compareWindows(env, 30, NOW);
    expect(pplx.engine).toBe("perplexity");
    expect(pplx.cited.withinNoise).toBe(true);
    expect(pplx.cited.label).toContain("within noise");
  });

  it("calls a large move on a large panel a real change", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-06-15T00:00:00.000Z", { perplexity: [100, 10, 10] }));
    await recordSweep(env, sweep("2026-07-15T00:00:00.000Z", { perplexity: [100, 50, 50] }));

    const [pplx] = await compareWindows(env, 30, NOW);
    expect(pplx.cited.withinNoise).toBe(false);
    expect(pplx.cited.delta).toBeCloseTo(0.4, 4);
  });

  it("does not bleed the previous window into the current one", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-06-15T00:00:00.000Z", { chatgpt: [10, 0, 0] }));
    await recordSweep(env, sweep("2026-07-15T00:00:00.000Z", { chatgpt: [10, 10, 10] }));

    const chatgpt = (await compareWindows(env, 30, NOW)).find((c) => c.engine === "chatgpt")!;
    expect(chatgpt.cited.before.successes).toBe(0);
    expect(chatgpt.cited.after.successes).toBe(10);
  });

  it("ignores sweeps older than both windows", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordSweep(env, sweep("2026-01-01T00:00:00.000Z", { perplexity: [999, 999, 999] }));
    await recordSweep(env, sweep("2026-07-15T00:00:00.000Z", { perplexity: [10, 5, 5] }));

    const [pplx] = await compareWindows(env, 30, NOW);
    expect(pplx.cited.after.n).toBe(10);
    expect(pplx.cited.before.n).toBe(0);
  });

  it("reports no data when there is no history yet", async () => {
    const env = envWith(fakeKv());
    const comparisons = await compareWindows(env, 30, NOW);
    expect(comparisons).toHaveLength(3);
    expect(comparisons.every((c) => c.cited.label === "no data")).toBe(true);
  });
});
