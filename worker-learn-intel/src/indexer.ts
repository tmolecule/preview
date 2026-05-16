import { Chunk, Env, SeedPage } from "./types";
import { chunkPage } from "./chunk";

const EMBED_BATCH = 50; // bge-base accepts up to ~96; 50 is conservative

interface EmbedResponse {
  data?: number[][];
  shape?: number[];
}

export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const slice = texts.slice(i, i + EMBED_BATCH);
    const res = (await env.AI.run(env.EMBED_MODEL as keyof AiModels, { text: slice })) as EmbedResponse;
    const vecs = res.data ?? [];
    if (vecs.length !== slice.length) {
      throw new Error(`embed: returned ${vecs.length} vectors for ${slice.length} inputs`);
    }
    out.push(...vecs);
  }
  return out;
}

export async function upsertChunks(env: Env, chunks: Chunk[]): Promise<{ count: number }> {
  if (!chunks.length) return { count: 0 };
  const vectors = await embed(env, chunks.map((c) => c.text));
  const items: VectorizeVector[] = chunks.map((c, i) => ({
    id: c.id,
    values: vectors[i],
    metadata: {
      slug: c.slug,
      paragraph_idx: c.paragraph_idx,
      kind: c.kind,
      url: c.url,
      primary_kw: c.primary_kw,
      // Vectorize metadata only accepts string/number/boolean/array-of-strings.
      all_kws: c.all_kws,
      text_preview: c.text.length > 400 ? c.text.slice(0, 397) + "…" : c.text,
    },
  }));
  await env.CORPUS.upsert(items);
  return { count: items.length };
}

/**
 * Index one page from a SeedPage object (POSTed from the local indexer script).
 * Returns chunk count for progress logging.
 */
export async function indexPage(env: Env, page: SeedPage): Promise<{ slug: string; chunks: number }> {
  const chunks = chunkPage(page);
  await upsertChunks(env, chunks);
  await env.STATE.put(
    `page:${page.slug}:indexed_at`,
    new Date().toISOString(),
    { metadata: { chunks: chunks.length, primary_kw: page.keywords?.[0] ?? "" } },
  );
  // Page-level metadata used to ground the gap monitor's claim-drafting prompt with the
  // page's actual scope (title + H1). Without this, niche pages with generic-sounding
  // keywords like "fathers day gifts" get judged against generic claim sets.
  await env.STATE.put(
    `page:${page.slug}:meta`,
    JSON.stringify({
      slug: page.slug,
      title: page.title ?? "",
      h1: page.h1 ?? "",
      meta_description: page.meta_description ?? "",
      primary_kw: page.keywords?.[0] ?? "",
      all_kws: page.keywords ?? [],
    }),
  );
  return { slug: page.slug, chunks: chunks.length };
}

export async function listIndexedSlugs(env: Env): Promise<Array<{ slug: string; indexed_at: string; primary_kw: string }>> {
  const list = await env.STATE.list({ prefix: "page:" });
  return list.keys
    .filter((k) => k.name.endsWith(":indexed_at"))
    .map((k) => ({
      slug: k.name.replace(/^page:/, "").replace(/:indexed_at$/, ""),
      indexed_at: (k.metadata as { indexed_at?: string } | undefined)?.indexed_at ?? "",
      primary_kw: (k.metadata as { primary_kw?: string } | undefined)?.primary_kw ?? "",
    }));
}
