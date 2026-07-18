/**
 * AI + search crawler classification for the pageview and click logs.
 *
 * This is the AEO feedback loop. The question it answers is not "was this a
 * bot" but WHY the bot came, because the three reasons predict completely
 * different things:
 *
 *   training    — the operator is collecting corpus for a future model.
 *                 GPTBot, ClaudeBot, CCBot. Tells you nothing about whether
 *                 you will be cited; the model that reads this page ships
 *                 months from now, if ever.
 *   search      — the operator is building the retrieval index its answer
 *                 engine queries at answer time. OAI-SearchBot, PerplexityBot.
 *                 A precondition for being cited.
 *   user-agent  — a LIVE fetch made during somebody's actual conversation.
 *                 ChatGPT-User, Perplexity-User, Claude-User. This is the
 *                 leading indicator: it means the page is being pulled into
 *                 real answers right now, and it moves weeks before a citation
 *                 rate does.
 *   index       — classic search crawlers (Googlebot, bingbot). Not AEO.
 *
 * Extracted from src/index.js so it is unit-testable as a pure function, and
 * so worker-seo and any sibling worker share ONE definition.
 *
 * Keep the UA list in sync with the robots.txt allow-list in src/sitemap.js.
 *
 * NOT to be confused with BOT_UA in src/experiments.js. That one is an
 * anti-cloaking gate deciding who gets canonical content; this one labels
 * telemetry. They are deliberately different and must not be merged.
 */

/** @typedef {'training'|'search'|'user-agent'|'index'|'other'|'none'} CrawlerPurpose */

/**
 * Ordered most-specific first. `label` is written to Analytics Engine blob4 and
 * is load-bearing: existing labels must never be renamed or reordered, because
 * scripts/learn-pageviews.sh reads that field by position and value.
 *
 * @type {Array<{label: string, re: RegExp, operator: string, purpose: CrawlerPurpose}>}
 */
export const CRAWLER_UA = [
  // --- OpenAI ---
  { label: 'gptbot', re: /GPTBot/i, operator: 'OpenAI', purpose: 'training' },
  { label: 'oai-searchbot', re: /OAI-SearchBot/i, operator: 'OpenAI', purpose: 'search' },
  { label: 'chatgpt-user', re: /ChatGPT-User/i, operator: 'OpenAI', purpose: 'user-agent' },

  // --- Anthropic ---
  // Claude-User is the per-conversation fetcher and has NO "bot" token in its
  // UA, so before this list existed it fell through to 'human'. It is a live
  // retrieval signal and must be counted as such.
  { label: 'claude-user', re: /Claude-User/i, operator: 'Anthropic', purpose: 'user-agent' },
  { label: 'claude-searchbot', re: /Claude-SearchBot/i, operator: 'Anthropic', purpose: 'search' },
  { label: 'claudebot', re: /ClaudeBot|anthropic-ai|Claude-Web/i, operator: 'Anthropic', purpose: 'training' },

  // --- Perplexity ---
  // Perplexity-User is likewise a live fetch, and is listed before the crawler
  // so the more specific pattern wins.
  { label: 'perplexity-user', re: /Perplexity-User/i, operator: 'Perplexity', purpose: 'user-agent' },
  { label: 'perplexity', re: /PerplexityBot/i, operator: 'Perplexity', purpose: 'search' },

  // --- Google ---
  { label: 'google-extended', re: /Google-Extended/i, operator: 'Google', purpose: 'training' },
  { label: 'googlebot', re: /Googlebot|Google-InspectionTool/i, operator: 'Google', purpose: 'index' },

  // --- Microsoft ---
  { label: 'bingbot', re: /bingbot|BingPreview/i, operator: 'Microsoft', purpose: 'index' },

  // --- Apple ---
  // Applebot-Extended is the AI-training opt-out UA and is a DIFFERENT crawler
  // from Applebot (which is search indexing). It is already named in robots.txt;
  // it was missing here. Ordered first so the negative lookahead below stays
  // unnecessary.
  { label: 'applebot-extended', re: /Applebot-Extended/i, operator: 'Apple', purpose: 'training' },
  { label: 'applebot', re: /Applebot/i, operator: 'Apple', purpose: 'index' },

  // --- Others ---
  { label: 'amazonbot', re: /Amazonbot/i, operator: 'Amazon', purpose: 'index' },
  { label: 'bytespider', re: /Bytespider/i, operator: 'ByteDance', purpose: 'training' },
  { label: 'meta-ai', re: /meta-externalagent|FacebookBot|facebookexternalhit/i, operator: 'Meta', purpose: 'training' },
  { label: 'meta-fetcher', re: /meta-externalfetcher/i, operator: 'Meta', purpose: 'user-agent' },
  { label: 'ccbot', re: /CCBot/i, operator: 'Common Crawl', purpose: 'training' },
  { label: 'duckassist', re: /DuckAssistBot/i, operator: 'DuckDuckGo', purpose: 'search' },
  { label: 'mistral-user', re: /MistralAI-User/i, operator: 'Mistral', purpose: 'user-agent' },
];

/** Generic bot tokens, checked only after every named crawler misses. */
const GENERIC_BOT = /\b(bot|crawler|spider|slurp|scrapy|python-requests|curl|wget|headless)\b/i;

/**
 * Our own tooling, which hits these pages as a side effect of auditing them.
 * Excluded from counts entirely so measurement never inflates what it measures.
 */
const SELF_UA = /tmolecule-(seo|learn-intel)|AINYC-AEO-Audit\//i;

/**
 * Full classification for one User-Agent.
 *
 * @param {string} ua
 * @returns {{client: string, purpose: CrawlerPurpose, operator: string, isBot: boolean, isSelf: boolean}}
 */
export function classifyCrawler(ua) {
  if (!ua) {
    return { client: 'unknown', purpose: 'none', operator: '', isBot: false, isSelf: false };
  }
  if (SELF_UA.test(ua)) {
    return { client: 'self', purpose: 'none', operator: 'TMolecule', isBot: true, isSelf: true };
  }
  for (const entry of CRAWLER_UA) {
    if (entry.re.test(ua)) {
      return {
        client: entry.label,
        purpose: entry.purpose,
        operator: entry.operator,
        isBot: true,
        isSelf: false,
      };
    }
  }
  if (GENERIC_BOT.test(ua)) {
    return { client: 'other-bot', purpose: 'other', operator: '', isBot: true, isSelf: false };
  }
  return { client: 'human', purpose: 'none', operator: '', isBot: false, isSelf: false };
}

/**
 * Legacy label-only classifier. Kept because Analytics Engine blob4 and the
 * queries over it are keyed on exactly these strings.
 *
 * @param {string} ua
 * @returns {string}
 */
export function classifyUa(ua) {
  return classifyCrawler(ua).client;
}

/**
 * Is this hit a live retrieval during someone's conversation?
 *
 * The single most useful derived signal in this module: it leads citation rate,
 * where `training` traffic does not correlate with it at all.
 *
 * @param {string} ua
 * @returns {boolean}
 */
export function isLiveRetrieval(ua) {
  return classifyCrawler(ua).purpose === 'user-agent';
}
