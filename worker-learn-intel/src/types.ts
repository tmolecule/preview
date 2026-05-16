export interface Env {
  AI: Ai;
  CORPUS: VectorizeIndex;
  STATE: KVNamespace;
  ADMIN_TOKEN: string;
  PERPLEXITY_API_KEY?: string;
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  SITE_NAME: string;
  LEARN_ORIGIN: string;
  EMBED_MODEL: string;
  LLM_MODEL: string;
  GAP_PAGES_PER_TICK: string;
  BRAND_VOICE: string;
}

export interface SeedPage {
  slug: string;
  title: string;
  h1: string;
  meta_description: string;
  canonical_url: string;
  keywords: string[];
  body_html: string;
  faqs?: Array<{ q: string; a: string }>;
  sources?: Array<{ title: string; url: string; publisher?: string }>;
  published_at?: string;
  updated_at?: string;
}

export interface Chunk {
  id: string;
  slug: string;
  paragraph_idx: number;
  kind: "h1" | "h2" | "h3" | "p" | "li" | "faq_q" | "faq_a" | "title";
  text: string;
  url: string;
  primary_kw: string;
  all_kws: string[];
}

export interface GapClaim {
  claim: string;
  source: "ideal_answer" | "perplexity" | "aio";
  covered: boolean;
  best_match_chunk_id?: string;
  best_match_score?: number;
  note?: string;
}

export interface GapReport {
  slug: string;
  url: string;
  primary_kw: string;
  generated_at: string;
  model: string;
  total_claims: number;
  covered_claims: number;
  uncovered_claims: number;
  claims: GapClaim[];
  perplexity_cited_us?: boolean;
  perplexity_citations?: string[];
  chatgpt_cited_us?: boolean;
  chatgpt_citations?: string[];
  aio_cited_us?: boolean;
  aio_citations?: string[];
}

export interface LinkSuggestion {
  source_paragraph: string;
  source_paragraph_idx: number;
  target_url: string;
  target_chunk_id: string;
  target_text: string;
  suggested_anchor: string;
  score: number;
}

export interface LinkSuggestionResponse {
  draft_chars: number;
  suggestions: LinkSuggestion[];
  total_suggestions: number;
  meets_min_inbound: boolean;
  min_required: number;
}
