import { Env, SeedPage } from "./types";
import { indexPage, listIndexedSlugs } from "./indexer";
import { runGapAnalysis, saveGapReport, listGapReports } from "./gap";
import { suggestLinks } from "./linker";
import { renderDashboard } from "./dashboard";
import { debugQuery, debugDfsChatGPT, debugDfsAIO, debugDfsAmazon, debugDfsAsin, debugDfsReviews } from "./debug";
import { generateImage } from "./image-gen";

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

function requireAdmin(req: Request, env: Env): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.ADMIN_TOKEN}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Public read-only dashboard. We rely on Cloudflare Access or workers_dev URL obscurity
    // for protection — flip to admin-gated if this gets a custom hostname.
    if (path === "/" || path === "/dashboard") {
      const reports = await listGapReports(env);
      return new Response(renderDashboard(reports), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/health") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    if (path === "/api/indexed-pages") {
      return json(await listIndexedSlugs(env));
    }

    // ---------- admin endpoints ----------
    if (path.startsWith("/admin/")) {
      if (!requireAdmin(req, env)) return unauthorized();

      if (path === "/admin/index-page" && req.method === "POST") {
        const page = (await req.json()) as SeedPage;
        if (!page?.slug || !page?.body_html) return json({ error: "slug + body_html required" }, 400);
        const result = await indexPage(env, page);
        return json(result);
      }

      if (path === "/admin/gap-run" && req.method === "POST") {
        const body = (await req.json()) as { slugs?: string[]; force?: boolean };
        const result = await runGapBatch(env, body?.slugs ?? null);
        return json(result);
      }

      if (path === "/admin/debug-query" && req.method === "POST") {
        const body = (await req.json()) as { query: string; slug?: string };
        return json(await debugQuery(env, body.query, body.slug));
      }

      if (path === "/admin/debug-dfs-chatgpt" && req.method === "POST") {
        const body = (await req.json()) as { query: string };
        return json(await debugDfsChatGPT(env, body.query));
      }

      if (path === "/admin/debug-dfs-aio" && req.method === "POST") {
        const body = (await req.json()) as { query: string };
        return json(await debugDfsAIO(env, body.query));
      }

      if (path === "/admin/debug-dfs-amazon" && req.method === "POST") {
        const body = (await req.json()) as { query: string };
        return json(await debugDfsAmazon(env, body.query));
      }

      if (path === "/admin/debug-dfs-asin" && req.method === "POST") {
        const body = (await req.json()) as { asin: string };
        return json(await debugDfsAsin(env, body.asin));
      }

      if (path === "/admin/debug-dfs-reviews" && req.method === "POST") {
        const body = (await req.json()) as { asin: string; sort_by?: "helpful" | "recent" };
        return json(await debugDfsReviews(env, body.asin, body.sort_by));
      }

      if (path === "/admin/generate-image" && req.method === "POST") {
        const body = (await req.json()) as { prompt: string; steps?: number; seed?: number };
        return json(await generateImage(env, body.prompt, { steps: body.steps, seed: body.seed }));
      }

      if (path === "/admin/gap-clear" && req.method === "POST") {
        const list = await env.STATE.list({ prefix: "gap:" });
        for (const k of list.keys) await env.STATE.delete(k.name);
        return json({ cleared: list.keys.length });
      }
    }

    // ---------- public-ish helper for the link suggester ----------
    if (path === "/api/link-suggest" && req.method === "POST") {
      if (!requireAdmin(req, env)) return unauthorized();
      const body = (await req.json()) as { draft: string; exclude_slug?: string };
      if (!body?.draft) return json({ error: "draft required" }, 400);
      const out = await suggestLinks(env, body.draft, body.exclude_slug ?? null);
      return json(out);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await runGapBatch(env, null);
  },
};

/**
 * Run gap analysis for up to GAP_PAGES_PER_TICK pages.
 * If `slugs` is null, picks the oldest-analyzed pages (or never-analyzed).
 */
async function runGapBatch(env: Env, slugs: string[] | null): Promise<{ ran: number; skipped: number; errors: number }> {
  const cap = parseInt(env.GAP_PAGES_PER_TICK || "10", 10);
  const indexed = await listIndexedSlugs(env);

  let targets = indexed;
  if (slugs?.length) {
    const wanted = new Set(slugs);
    targets = indexed.filter((p) => wanted.has(p.slug));
  } else {
    // Prioritize never-analyzed first, then oldest gap report.
    const reports = await listGapReports(env);
    const reportTs = new Map(reports.map((r) => [r.slug, r.generated_at]));
    targets = [...indexed].sort((a, b) => {
      const ta = reportTs.get(a.slug) ?? "";
      const tb = reportTs.get(b.slug) ?? "";
      return ta.localeCompare(tb); // empty string sorts first → never-analyzed wins
    });
  }

  // Cap only applies to autonomous cron runs (slugs == null). Explicit slug lists from a
  // manual or weekly batch invocation should process all requested pages — the caller decided.
  if (slugs == null) targets = targets.slice(0, cap);

  let ran = 0, errors = 0;
  for (const p of targets) {
    if (!p.primary_kw) continue;
    const pageUrl = `${env.LEARN_ORIGIN}/${p.slug}`;
    try {
      const report = await runGapAnalysis(env, p.slug, p.primary_kw, pageUrl);
      await saveGapReport(env, report);
      ran += 1;
    } catch (e) {
      errors += 1;
      console.error(`gap analysis failed for ${p.slug}:`, e);
    }
  }
  return { ran, skipped: Math.max(0, targets.length - ran - errors), errors };
}
