import { Chunk, SeedPage } from "./types";

const TAG_RE = /<([a-z0-9]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
const STRIP_INLINE = /<\/?(strong|em|b|i|a|code|span|sub|sup|u)(?:\s[^>]*)?>/gi;
const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&mdash;": "—",
  "&ndash;": "–",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos|mdash|ndash|nbsp|hellip|[rl]squo|[rl]dquo);/g, (m) => ENTITY_MAP[m] ?? m);
}

function stripInline(s: string): string {
  return decode(s.replace(STRIP_INLINE, "")).replace(/\s+/g, " ").trim();
}

/**
 * Parse body_html into ordered blocks. Recognizes h1/h2/h3, p, li.
 * Lists are flattened into one block per <li>. Tag nesting is shallow in WK seed JSONs,
 * so a regex pass is sufficient and avoids pulling in a parser.
 */
export function parseBlocks(html: string): Array<{ kind: Chunk["kind"]; text: string }> {
  const blocks: Array<{ kind: Chunk["kind"]; text: string }> = [];
  const re = /<(h1|h2|h3|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const kind = match[1].toLowerCase() as Chunk["kind"];
    const text = stripInline(match[2]);
    if (text.length >= 12) blocks.push({ kind, text });
  }
  return blocks;
}

/**
 * Build embedding-ready chunks for a single seed page.
 * Each chunk carries enough metadata to support retrieval surfaces:
 * - paragraph_idx — stable ordering for "find the paragraph near this anchor"
 * - kind — lets us weight h2/h3 differently in scoring later
 * - primary_kw + all_kws — the gap monitor matches against these
 */
export function chunkPage(page: SeedPage): Chunk[] {
  const chunks: Chunk[] = [];
  const url = page.canonical_url || `https://learn.tmolecule.com/${page.slug}`;
  const primary = page.keywords?.[0] ?? page.slug.replace(/-/g, " ");
  const all = page.keywords ?? [primary];

  chunks.push({
    id: `${page.slug}::title`,
    slug: page.slug,
    paragraph_idx: 0,
    kind: "title",
    text: `${page.title}\n\n${page.h1}\n\n${page.meta_description}`,
    url,
    primary_kw: primary,
    all_kws: all,
  });

  const blocks = parseBlocks(page.body_html ?? "");
  blocks.forEach((b, i) => {
    chunks.push({
      id: `${page.slug}::p${i + 1}`,
      slug: page.slug,
      paragraph_idx: i + 1,
      kind: b.kind,
      text: b.text,
      url,
      primary_kw: primary,
      all_kws: all,
    });
  });

  (page.faqs ?? []).forEach((f, i) => {
    chunks.push({
      id: `${page.slug}::faq${i + 1}q`,
      slug: page.slug,
      paragraph_idx: 1000 + i * 2,
      kind: "faq_q",
      text: f.q,
      url: `${url}#faq-${i + 1}`,
      primary_kw: primary,
      all_kws: all,
    });
    chunks.push({
      id: `${page.slug}::faq${i + 1}a`,
      slug: page.slug,
      paragraph_idx: 1001 + i * 2,
      kind: "faq_a",
      text: f.a,
      url: `${url}#faq-${i + 1}`,
      primary_kw: primary,
      all_kws: all,
    });
  });

  return chunks;
}

/**
 * Split a draft markdown/plain doc into paragraph-sized chunks for the linker.
 * Stays simple: blank-line separation, drop code fences and frontmatter.
 */
export function chunkDraft(draft: string): string[] {
  const noFm = draft.replace(/^---[\s\S]*?---\n/, "");
  const noCode = noFm.replace(/```[\s\S]*?```/g, "");
  return noCode
    .split(/\n\s*\n+/)
    .map((s) => s.replace(/^#+\s+/, "").trim())
    .filter((s) => s.length >= 40 && s.length <= 1500);
}
