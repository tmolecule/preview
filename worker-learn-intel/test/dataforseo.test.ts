import { describe, expect, it } from "bun:test";
import { parseChatGptScraper, unwrapDfs, type DfsFailure } from "../src/dataforseo";
import fixture from "./fixtures/dfs-chatgpt-scraper.json";
import { citedIn, type BrandIdentity } from "../src/citations";

const WK: BrandIdentity = { domain: "whollykaw.com", aliases: ["Wholly Kaw"] };
// Fixture is a WhollyKaw query captured from live ChatGPT; it exercises the
// parser, so the brand asserted here is WhollyKaw regardless of repo.

/**
 * The exact envelope that hid a dead engine for months: HTTP 200, top-level
 * "Ok.", task-level 40501, result null. Captured verbatim from the live API.
 */
const RETIRED_MODEL_ERROR = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 40501,
      status_message: "Invalid Field: 'model_name'.",
      result: null,
    },
  ],
};

describe("unwrapDfs", () => {
  it("catches a task-level error hiding behind a 200 OK envelope", () => {
    const out = unwrapDfs(RETIRED_MODEL_ERROR);
    expect(out.ok).toBe(false);
    const f = out as DfsFailure;
    expect(f.stage).toBe("task");
    expect(f.status).toBe(40501);
    expect(f.message).toContain("model_name");
  });

  it("catches an envelope-level error", () => {
    const out = unwrapDfs({ status_code: 40100, status_message: "Auth error", tasks: [] });
    expect(out.ok).toBe(false);
    expect((out as DfsFailure).stage).toBe("envelope");
    expect((out as DfsFailure).status).toBe(40100);
  });

  it("distinguishes 'ran but returned nothing' from 'errored'", () => {
    // Both used to collapse to null. Only the error should leave the engine
    // out of the rate denominator, so they must stay distinguishable.
    const empty = unwrapDfs({ status_code: 20000, tasks: [{ status_code: 20000, result: [] }] });
    expect(empty.ok).toBe(false);
    expect((empty as DfsFailure).stage).toBe("empty");
    expect((empty as DfsFailure).status).toBeUndefined();
  });

  it("reports a response with no tasks", () => {
    const out = unwrapDfs({ status_code: 20000, tasks: [] });
    expect((out as DfsFailure).stage).toBe("task");
  });

  it("rejects junk without throwing", () => {
    for (const junk of [null, undefined, "", 42, "not json"]) {
      expect(unwrapDfs(junk).ok).toBe(false);
    }
  });

  it("unwraps a real successful response", () => {
    const out = unwrapDfs(fixture);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result).toHaveProperty("items");
  });
});

describe("parseChatGptScraper", () => {
  const out = unwrapDfs(fixture);
  const result = out.ok ? (out.result as Record<string, unknown>) : {};

  it("extracts the answer text", () => {
    const { answer } = parseChatGptScraper(result);
    expect(answer.length).toBeGreaterThan(500);
    expect(answer.toLowerCase()).toContain("shav");
  });

  it("extracts cited URLs", () => {
    const { citations } = parseChatGptScraper(result);
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) expect(c).toMatch(/^https?:\/\//);
  });

  it("de-duplicates across top-level and per-item source lists", () => {
    // Per-item sources are a superset of the top-level list and repeat across
    // items; without de-duplication the citation list double-counts.
    const { citations } = parseChatGptScraper(result);
    expect(new Set(citations).size).toBe(citations.length);
  });

  it("finds the WhollyKaw citation this query actually produced", () => {
    // The regression that matters: this exact query DOES cite whollykaw.com in
    // live ChatGPT. The old implementation reported it as "not checked".
    const { citations } = parseChatGptScraper(result);
    expect(citedIn(citations, WK)).toBe(true);
  });

  it("survives a result with no sources or items", () => {
    expect(parseChatGptScraper({})).toEqual({ answer: "", citations: [] });
    expect(parseChatGptScraper({ items: null, sources: null })).toEqual({ answer: "", citations: [] });
  });

  it("ignores malformed source entries", () => {
    const { citations } = parseChatGptScraper({
      sources: [{ url: "https://a.com" }, { url: 42 }, null, {}, { url: "" }],
    });
    expect(citations).toEqual(["https://a.com"]);
  });

  it("falls back to item markdown when the top-level markdown is absent", () => {
    const { answer } = parseChatGptScraper({
      items: [{ markdown: "one" }, { markdown: "two" }],
    });
    expect(answer).toBe("one\ntwo");
  });
});
