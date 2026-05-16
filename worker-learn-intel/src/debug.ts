// Temporary debug endpoint — checks Vectorize filter behavior + raw DataForSEO responses.
import { Env } from "./types";
import { embed } from "./indexer";

export async function debugDfsChatGPT(env: Env, query: string): Promise<unknown> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return { error: "no credentials" };
  const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
  const r = await fetch("https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ user_prompt: query, model_name: "gpt-4o-search-preview", web_search: true, max_output_tokens: 800 }]),
  });
  const data = await r.json() as Record<string, unknown>;
  // Walk the response and return only what we care about: AIO item summary + every URL.
  const allUrls: string[] = [];
  const collect = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(collect); return; }
    const obj = o as Record<string, unknown>;
    if (typeof obj.url === "string") allUrls.push(obj.url);
    Object.values(obj).forEach(collect);
  };
  collect(data);
  const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
  const t0 = tasks[0] ?? {};
  const result = ((t0.result as Array<Record<string, unknown>>) ?? [])[0] ?? null;
  return {
    status: r.status,
    task_status: t0.status_code,
    task_message: t0.status_message,
    web_search: (result?.web_search as boolean | undefined),
    items_summary: ((result?.items as Array<Record<string, unknown>>) ?? []).map((it) => ({
      type: it.type,
      keys: Object.keys(it).slice(0, 8),
    })),
    citations_found: allUrls.length,
    citations_sample: allUrls.slice(0, 10),
  };
}

export async function debugDfsReviews(env: Env, asin: string, sortBy: "helpful" | "recent" = "helpful"): Promise<unknown> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return { error: "no credentials" };
  const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
  const r = await fetch("https://api.dataforseo.com/v3/merchant/amazon/reviews/task_post", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ asin, language_code: "en_US", location_code: 2840, sort_by: sortBy, depth: 30 }]),
  });
  const post = await r.json() as Record<string, unknown>;
  const tasks = (post.tasks as Array<Record<string, unknown>>) ?? [];
  const taskId = tasks[0]?.id as string | undefined;
  if (!taskId) return { error: "no task id", post_status_code: post.status_code, post_status_message: post.status_message, task_status_code: tasks[0]?.status_code, task_status_message: tasks[0]?.status_message };
  // Poll for ~25s. DFS critical reviews task usually finishes in 5-15s.
  for (let i = 0; i < 12; i++) {
    await new Promise((res) => setTimeout(res, 2500));
    const g = await fetch(`https://api.dataforseo.com/v3/merchant/amazon/reviews/task_get/advanced/${taskId}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!g.ok) continue;
    const data = await g.json() as Record<string, unknown>;
    const tk = (data.tasks as Array<Record<string, unknown>>)?.[0];
    const status = tk?.status_code as number | undefined;
    if (status === 20000 || status === 20100) {
      const result = ((tk?.result as Array<Record<string, unknown>>) ?? [])[0] ?? null;
      const items = ((result?.items as Array<Record<string, unknown>>) ?? []);
      return {
        asin,
        sort_by: sortBy,
        total: result?.reviews_count,
        rating: result?.rating,
        reviews: items.slice(0, 15).map((it) => ({
          rating: (it.rating as { value?: number })?.value,
          title: it.title,
          text: it.review_text,
          publication_date: it.publication_date,
          verified: it.verified,
          helpful_count: it.helpful_count,
          author: (it.user_profile as { name?: string })?.name,
        })),
      };
    }
  }
  return { error: "task did not complete within poll window", taskId };
}

export async function debugDfsAsin(env: Env, asin: string): Promise<unknown> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return { error: "no credentials" };
  const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
  const r = await fetch("https://api.dataforseo.com/v3/merchant/amazon/asin/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ asin, language_code: "en_US", location_code: 2840, load_more_local_reviews: false }]),
  });
  const data = await r.json() as Record<string, unknown>;
  const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
  const t0 = tasks[0] ?? {};
  const result = ((t0.result as Array<Record<string, unknown>>) ?? [])[0] ?? null;
  const items = ((result?.items as Array<Record<string, unknown>>) ?? []);
  const product = items[0] ?? {};
  return {
    status: r.status,
    task_status: t0.status_code,
    task_message: t0.status_message,
    cost: data.cost,
    asin,
    title: product.title,
    description: product.description,
    price: product.price,
    price_max: product.price_max,
    delivery_message: product.delivery_message,
    is_amazon_choice: product.is_amazon_choice,
    is_best_seller: product.is_best_seller,
    rating: product.rating,
    image_url: product.image_url,
    images_count: Array.isArray(product.images) ? product.images.length : null,
    bullet_points: product.bullet_points,
    product_information_attributes: product.product_information_attributes,
    bought_past_month: product.bought_past_month,
    seller: product.seller_name ?? product.merchant,
    is_fba: product.fulfillment_info ?? product.is_fba,
    categories: product.categories,
    rank_info: product.rank_info,
    has_aplus: typeof product.full_description === "string" && (product.full_description as string).includes("aplus"),
    full_description_chars: typeof product.full_description === "string" ? (product.full_description as string).length : 0,
  };
}

export async function debugDfsAmazon(env: Env, query: string): Promise<unknown> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return { error: "no credentials" };
  const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
  const r = await fetch("https://api.dataforseo.com/v3/merchant/amazon/products/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: query, language_code: "en_US", location_code: 2840, depth: 30 }]),
  });
  const data = await r.json() as Record<string, unknown>;
  const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
  const t0 = tasks[0] ?? {};
  const result = ((t0.result as Array<Record<string, unknown>>) ?? [])[0] ?? null;
  const items = ((result?.items as Array<Record<string, unknown>>) ?? []);
  return {
    status: r.status,
    task_status: t0.status_code,
    task_message: t0.status_message,
    cost: data.cost,
    total_items: items.length,
    items: items.slice(0, 25).map((it) => ({
      type: it.type,
      asin: it.data_asin ?? it.asin,
      rank: it.rank_absolute,
      title: typeof it.title === "string" ? (it.title as string).slice(0, 130) : it.title,
      seller: it.seller,
      price: it.price?.current ?? it.price,
      rating: it.rating?.value ?? it.rating,
      reviews_count: it.rating?.votes_count ?? it.reviews_count,
      url: it.url,
      is_amazon_choice: it.is_amazon_choice,
      is_best_seller: it.is_best_seller,
    })),
  };
}

export async function debugDfsAIO(env: Env, query: string): Promise<unknown> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return { error: "no credentials" };
  const auth = btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`);
  const r = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: query, language_code: "en", location_code: 2840, device: "desktop" }]),
  });
  const data = await r.json() as Record<string, unknown>;
  const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
  const t0 = tasks[0] ?? {};
  const result = ((t0.result as Array<Record<string, unknown>>) ?? [])[0] ?? null;
  const items = ((result?.items as Array<Record<string, unknown>>) ?? []);
  const aio = items.find((it) => it.type === "ai_overview");
  const aioUrls: string[] = [];
  if (aio) {
    const collect = (o: unknown): void => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(collect); return; }
      const obj = o as Record<string, unknown>;
      if (typeof obj.url === "string") aioUrls.push(obj.url);
      Object.values(obj).forEach(collect);
    };
    collect(aio);
  }
  return {
    status: r.status,
    task_status: t0.status_code,
    task_message: t0.status_message,
    item_types: items.map((it) => it.type).slice(0, 20),
    has_aio: !!aio,
    aio_keys: aio ? Object.keys(aio) : null,
    aio_citation_count: aioUrls.length,
    aio_citations: aioUrls.slice(0, 15),
  };
}

export async function debugQuery(env: Env, query: string, slug?: string): Promise<unknown> {
  const [vec] = await embed(env, [query]);
  const unfiltered = await env.CORPUS.query(vec, { topK: 5, returnMetadata: true });
  const filtered = slug
    ? await env.CORPUS.query(vec, { topK: 5, filter: { slug }, returnMetadata: true })
    : null;
  return {
    query,
    slug,
    unfiltered: (unfiltered.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score,
      slug: m.metadata?.slug,
      kind: m.metadata?.kind,
      text_preview: m.metadata?.text_preview,
    })),
    filtered: filtered ? (filtered.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score,
      slug: m.metadata?.slug,
      kind: m.metadata?.kind,
      text_preview: m.metadata?.text_preview,
    })) : null,
  };
}
