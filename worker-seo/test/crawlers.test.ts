import { describe, expect, it } from 'bun:test';
import { CRAWLER_UA, classifyCrawler, classifyUa, isLiveRetrieval } from '../src/crawlers.js';

// Real-world UA strings, abbreviated but structurally faithful.
const UA = {
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  oaiSearch: 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
  chatgptUser: 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
  claudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  claudeUser: 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  claudeSearch: 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0)',
  perplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)',
  perplexityUser: 'Mozilla/5.0 (compatible; Perplexity-User/1.0)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googleExtended: 'Mozilla/5.0 (compatible; Google-Extended/1.0)',
  applebot: 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
  applebotExtended: 'Mozilla/5.0 (compatible; Applebot-Extended/0.1)',
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  curl: 'curl/8.4.0',
  self: 'tmolecule-seo/1.0 (self-audit)',
};

describe('purpose taxonomy', () => {
  it('separates training from search from live retrieval within one operator', () => {
    // OpenAI runs all three. Collapsing them into "an OpenAI bot came" throws
    // away the only distinction that predicts citations.
    expect(classifyCrawler(UA.gptbot).purpose).toBe('training');
    expect(classifyCrawler(UA.oaiSearch).purpose).toBe('search');
    expect(classifyCrawler(UA.chatgptUser).purpose).toBe('user-agent');
  });

  it('classifies Anthropic crawlers by role', () => {
    expect(classifyCrawler(UA.claudeBot).purpose).toBe('training');
    expect(classifyCrawler(UA.claudeSearch).purpose).toBe('search');
    expect(classifyCrawler(UA.claudeUser).purpose).toBe('user-agent');
  });

  it('classifies Perplexity crawlers by role', () => {
    expect(classifyCrawler(UA.perplexityBot).purpose).toBe('search');
    expect(classifyCrawler(UA.perplexityUser).purpose).toBe('user-agent');
  });

  it('does not call a classic search crawler an AI one', () => {
    expect(classifyCrawler(UA.googlebot).purpose).toBe('index');
    expect(classifyCrawler(UA.googleExtended).purpose).toBe('training');
  });

  it('records the operator alongside the purpose', () => {
    expect(classifyCrawler(UA.gptbot).operator).toBe('OpenAI');
    expect(classifyCrawler(UA.claudeUser).operator).toBe('Anthropic');
  });
});

describe('specificity ordering', () => {
  it('matches Claude-User before the generic ClaudeBot pattern', () => {
    expect(classifyCrawler(UA.claudeUser).client).toBe('claude-user');
  });

  it('matches Perplexity-User before PerplexityBot', () => {
    expect(classifyCrawler(UA.perplexityUser).client).toBe('perplexity-user');
  });

  it('distinguishes Applebot-Extended from Applebot', () => {
    // Different crawlers with different jobs: Extended is the AI-training
    // opt-out UA, plain Applebot is search indexing.
    expect(classifyCrawler(UA.applebotExtended).client).toBe('applebot-extended');
    expect(classifyCrawler(UA.applebotExtended).purpose).toBe('training');
    expect(classifyCrawler(UA.applebot).client).toBe('applebot');
    expect(classifyCrawler(UA.applebot).purpose).toBe('index');
  });

  it('has no duplicate labels', () => {
    const labels = CRAWLER_UA.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('humans and generic bots', () => {
  it('leaves real browsers alone', () => {
    expect(classifyCrawler(UA.chrome).client).toBe('human');
    expect(classifyCrawler(UA.chrome).isBot).toBe(false);
    expect(classifyCrawler(UA.safariIphone).client).toBe('human');
    expect(classifyCrawler(UA.safariIphone).isBot).toBe(false);
  });

  it('does not mistake iPhone Safari for Applebot', () => {
    // Both contain "Apple"; only one is a crawler.
    expect(classifyCrawler(UA.safariIphone).purpose).toBe('none');
  });

  it('falls back to other-bot for unnamed tooling', () => {
    expect(classifyCrawler(UA.curl).client).toBe('other-bot');
    expect(classifyCrawler(UA.curl).isBot).toBe(true);
    expect(classifyCrawler(UA.curl).purpose).toBe('other');
  });

  it('treats an empty UA as unknown, not as a bot', () => {
    expect(classifyCrawler('').client).toBe('unknown');
    expect(classifyCrawler('').isBot).toBe(false);
  });
});

describe('self-exclusion', () => {
  it('flags our own auditor so measurement never inflates what it measures', () => {
    const self = classifyCrawler(UA.self);
    expect(self.isSelf).toBe(true);
    expect(self.client).toBe('self');
  });

  it('does not flag anybody else as self', () => {
    expect(classifyCrawler(UA.gptbot).isSelf).toBe(false);
    expect(classifyCrawler(UA.chrome).isSelf).toBe(false);
  });
});

describe('isLiveRetrieval', () => {
  it('is true only for conversation-time fetches', () => {
    expect(isLiveRetrieval(UA.chatgptUser)).toBe(true);
    expect(isLiveRetrieval(UA.claudeUser)).toBe(true);
    expect(isLiveRetrieval(UA.perplexityUser)).toBe(true);
  });

  it('is false for training and index crawls', () => {
    expect(isLiveRetrieval(UA.gptbot)).toBe(false);
    expect(isLiveRetrieval(UA.claudeBot)).toBe(false);
    expect(isLiveRetrieval(UA.googlebot)).toBe(false);
    expect(isLiveRetrieval(UA.chrome)).toBe(false);
  });
});

describe('blob4 backwards compatibility', () => {
  // scripts/learn-pageviews.sh reads blob4 by value. These labels shipped
  // before the purpose dimension existed and must not drift.
  it('preserves the pre-existing labels exactly', () => {
    expect(classifyUa(UA.gptbot)).toBe('gptbot');
    expect(classifyUa(UA.oaiSearch)).toBe('oai-searchbot');
    expect(classifyUa(UA.chatgptUser)).toBe('chatgpt-user');
    expect(classifyUa(UA.claudeBot)).toBe('claudebot');
    expect(classifyUa(UA.perplexityBot)).toBe('perplexity');
    expect(classifyUa(UA.googleExtended)).toBe('google-extended');
    expect(classifyUa(UA.googlebot)).toBe('googlebot');
    expect(classifyUa(UA.applebot)).toBe('applebot');
    expect(classifyUa(UA.chrome)).toBe('human');
    expect(classifyUa(UA.curl)).toBe('other-bot');
  });

  it('DELIBERATELY reclassifies AI user-agents that used to read as human', () => {
    // Claude-User and Perplexity-User carry no "bot" token, so the old generic
    // fallback labelled them 'human' and double2 counted them as real visitors.
    // Correcting this changes blob4 for those UAs — intended, and the reason
    // live-retrieval counts will step up the day this deploys.
    expect(classifyUa(UA.claudeUser)).not.toBe('human');
    expect(classifyUa(UA.perplexityUser)).not.toBe('human');
    expect(classifyCrawler(UA.claudeUser).isBot).toBe(true);
  });
});
