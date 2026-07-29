/**
 * Citation and mention detection.
 *
 * Two INDEPENDENT signals per engine per page. Keep them apart — they are
 * different problems with different fixes:
 *
 *   cited     — the engine used one of our URLs as a source. A crawlability
 *               and structure problem when it's missing.
 *   mentioned — the engine named the brand in its prose, with no link. A
 *               brand-authority problem when it's missing.
 *
 * "Mentioned but not cited" is the interesting cell: the engine knows who we
 * are but is sourcing the claim from somebody else. Before this module the
 * answer text was fetched and thrown away, so that cell was invisible.
 *
 * Brand-generic on purpose: this file is identical in the WhollyKaw and
 * TMolecule workers, and only the BrandIdentity passed in differs.
 */

export interface BrandIdentity {
  /** Registrable domain we own, e.g. "whollykaw.com". Subdomains count too. */
  domain: string;
  /**
   * Extra display forms to match in prose, e.g. "Wholly Kaw". The domain's
   * registrable label ("whollykaw") is added automatically — list only the
   * forms that can't be derived from it, such as spaced or punctuated
   * spellings.
   */
  aliases?: string[];
}

/**
 * Hosts that appear inside an AI answer's source list but are NOT a citation
 * of anyone's content — Google's own redirect, tracking and asset hosts.
 *
 * This matters because the AI Overview collector walks the block and adds
 * every `url` it finds. Left unfiltered these inflate the denominator of every
 * engine's citation rate, and a Google-internal URL can never match our domain
 * so they silently drag the measured rate DOWN.
 */
const NON_SOURCE_HOSTS: readonly string[] = [
  "google.com",
  "www.google.com",
  "googleusercontent.com",
  "gstatic.com",
  "googleapis.com",
  "vertexaisearch.cloud.google.com",
];

function hostMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/**
 * Resolve a raw citation URL to the real source URL.
 *
 * Google wraps sources in redirects. `google.com/url?q=<real>` is decodable and
 * MUST be unwrapped — the real target is frequently the site being cited, so
 * dropping it wholesale would undercount. The Vertex grounding redirect
 * (`vertexaisearch.cloud.google.com/grounding-api-redirect/<opaque>`) is not
 * decodable from the URL alone, so it is dropped rather than guessed at.
 *
 * Returns null when the URL is unparseable or is a non-source artifact.
 */
export function normalizeCitationUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  // Unwrap a decodable Google redirect before deciding anything else.
  if (hostMatches(url.hostname, "google.com") && url.pathname === "/url") {
    const target = url.searchParams.get("q") ?? url.searchParams.get("url");
    if (target) return normalizeCitationUrl(target);
    return null;
  }

  for (const host of NON_SOURCE_HOSTS) {
    if (hostMatches(url.hostname, host)) return null;
  }
  return url.toString();
}

/**
 * Clean a raw citation list: unwrap redirects, drop non-source artifacts,
 * de-duplicate. This is the list that should be counted and displayed.
 */
export function normalizeCitations(raw: readonly string[]): string[] {
  const out = new Set<string>();
  for (const c of raw) {
    const normalized = normalizeCitationUrl(c);
    if (normalized) out.add(normalized);
  }
  return Array.from(out);
}

/**
 * Did the engine cite a URL we own?
 *
 * Matches the apex and any subdomain. The same article is mirror-served from
 * several hosts (the /learn worker, the apex route, the Shopify blog canonical)
 * and a citation of any of them is a citation of us.
 *
 * Pass raw citations — normalisation happens here.
 */
export function citedIn(citations: readonly string[], brand: BrandIdentity): boolean {
  const domain = brand.domain.toLowerCase();
  return normalizeCitations(citations).some((c) => {
    try {
      return hostMatches(new URL(c).hostname.toLowerCase(), domain);
    } catch {
      return false;
    }
  });
}

/** Shortest string we will treat as a brand token. */
const MIN_BRAND_KEY_LENGTH = 4;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Public-suffix-ish trailing labels, stripped when locating the registrable
 * label. Deliberately a short heuristic list rather than the full Public
 * Suffix List — pulling PSL into a Worker for this is not worth the bytes, and
 * every brand we track sits on a plain .com.
 */
const SUFFIX_LABELS = new Set([
  "com", "org", "net", "co", "io", "ai", "app", "dev", "shop", "store",
  "uk", "us", "ca", "au", "in", "de", "fr", "nl", "eu",
]);

/**
 * The registrable label of a domain — the brand-bearing part.
 *
 * NOT the leftmost label. For `offers.example.com` the brand is "example", and
 * taking the leftmost label would make the everyday word "offers" a brand
 * token that fires on "the shop offers free shipping". Trailing suffix labels
 * are stripped first so `example.co.uk` also resolves to "example".
 */
export function registrableLabel(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  while (labels.length > 1 && SUFFIX_LABELS.has(labels[labels.length - 1])) {
    labels.pop();
  }
  return labels[labels.length - 1] ?? "";
}

/**
 * Build the prose-matching patterns for a brand.
 *
 * Keys shorter than MIN_BRAND_KEY_LENGTH are dropped entirely: a 2-3 character
 * token generates far more false positives than the signal is worth.
 *
 * Whitespace in an alias is matched flexibly, so "Wholly Kaw" also matches
 * "Wholly  Kaw" and "Wholly-Kaw".
 */
export function brandPatterns(brand: BrandIdentity): RegExp[] {
  const keys = [registrableLabel(brand.domain), ...(brand.aliases ?? [])]
    .map((k) => k.trim())
    .filter((k) => k.length >= MIN_BRAND_KEY_LENGTH);

  return keys.map((key) => {
    const body = escapeRegExp(key).replace(/\\?\s+/g, "[\\s-]+");
    return new RegExp(`(?<![\\w-])${body}(?![\\w-])`, "i");
  });
}

/** Strip URLs and bare domains so a link is never counted as a prose mention. */
function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/g, " ");
}

/**
 * Did the engine name the brand in its answer text?
 *
 * URLs are stripped first so this stays orthogonal to `citedIn` — otherwise an
 * answer that merely links us would register as a mention too, and the
 * "mentioned but not cited" cell would lose its meaning.
 */
export function mentionedIn(answer: string | null | undefined, brand: BrandIdentity): boolean {
  if (!answer) return false;
  const prose = stripUrls(answer);
  return brandPatterns(brand).some((re) => re.test(prose));
}

export interface EngineObservation {
  /** Engine used one of our URLs as a source. */
  cited: boolean;
  /** Engine named the brand in prose, links aside. */
  mentioned: boolean;
  /** Cleaned citation list — redirects unwrapped, Google artifacts removed. */
  citations: string[];
}

/** Score one engine's raw response into the two independent signals. */
export function observeEngine(
  result: { answer: string; citations: string[] } | null,
  brand: BrandIdentity,
): EngineObservation | null {
  if (!result) return null;
  return {
    cited: citedIn(result.citations, brand),
    mentioned: mentionedIn(result.answer, brand),
    citations: normalizeCitations(result.citations),
  };
}
