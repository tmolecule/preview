// Single source of truth for the Learn content taxonomy.
//
// Axis 1 — PILLARS: top-level hubs that own a URL segment (/ingredients, /benefits, …).
//          Product-agnostic so the corpus can grow from tea into the wider
//          wellness/functional-foods space without restructuring.
// Axis 2 — INTENTS: reusable page templates. A page declares one intent; the
//          renderer can attach intent-specific blocks (safety table, EU/US
//          regulatory comparison, etc.).
//
// A seed page carries: { pillar, cluster, intent, related[], product_bridge }
// plus optional structured blocks (safety, regulatory) consumed by the renderer.

export const PILLARS = [
  {
    slug: 'ingredients',
    label: 'Ingredients',
    title: 'Ingredients & botanicals',
    blurb: 'What is actually in the cup — collagen, black tea, the warming spices and botanicals — and what the research says about each.'
  },
  {
    slug: 'benefits',
    label: 'Benefits & Goals',
    title: 'Benefits & wellness goals',
    blurb: 'Outcome-first guides: skin and beauty, gut and digestion, energy, joints, sleep and healthy weight — and what to drink for each.'
  },
  {
    slug: 'blends',
    label: 'Teas & Blends',
    title: 'Teas, blends & formats',
    blurb: 'What to drink: chai, matcha, black, green, oolong, rooibos and functional blends — defined, compared and explained.'
  },
  {
    slug: 'recipes',
    label: 'Recipes & Rituals',
    title: 'Recipes & rituals',
    blurb: 'How to prepare and when to drink — brewing guides, recipes and daily rituals that fit a busy morning.'
  },
  {
    slug: 'living',
    label: 'Healthy Living',
    title: 'Healthy living',
    blurb: 'Eating well, functional nutrition and the everyday habits behind a healthier you.'
  }
];

export const PILLAR_BY_SLUG = Object.fromEntries(PILLARS.map(p => [p.slug, p]));

// Reserved single-segment paths the router resolves to a hub instead of an article.
export const HUB_SLUGS = new Set(PILLARS.map(p => p.slug));

// Page templates. `label` is the human chip shown in UI / breadcrumbs.
export const INTENTS = {
  'definition': { label: 'What is it' },
  'comparison': { label: 'Comparison' },
  'benefits':   { label: 'Benefits' },
  'mechanism':  { label: 'How it works' },
  'use-case':   { label: 'Use case' },
  'question':   { label: 'Question' },
  'recipe':     { label: 'Recipe' },
  'routine':    { label: 'Ritual' },
  // Population-aware safety template. One page answers "is <X> safe?" across the
  // canonical population groups below, so coverage is consistent and extractable.
  'safety':     { label: 'Is it safe?' },
  // Regulatory-status template. "Is <X> banned in the EU?" — contrasts EU vs US
  // status and the rationale behind the difference.
  'eu-status':  { label: 'Banned in the EU?' }
};

// Canonical population groups every "Is it safe?" page should address. Keeping
// this list fixed means each safety page covers the same audiences in the same
// order — good for readers and for LLM extraction.
export const SAFETY_POPULATIONS = [
  { key: 'adults',        label: 'Healthy adults' },
  { key: 'women',         label: 'Women' },
  { key: 'pregnant',      label: 'Pregnant women' },
  { key: 'breastfeeding', label: 'Breastfeeding women' },
  { key: 'children',      label: 'Children' },
  { key: 'seniors',       label: 'Older adults (65+)' }
];

// Status vocabulary for safety rows and regulatory blocks.
export const SAFETY_STATUS = {
  safe:    { label: 'Generally fine', tone: 'ok' },
  caution: { label: 'Use caution',    tone: 'warn' },
  consult: { label: 'Ask a provider', tone: 'warn' },
  avoid:   { label: 'Best avoided',   tone: 'bad' }
};

export const REGULATORY_STATUS = {
  permitted:  { label: 'Permitted', tone: 'ok' },
  restricted: { label: 'Restricted', tone: 'warn' },
  banned:     { label: 'Banned', tone: 'bad' }
};

export function getPillar(data) {
  return data && data.pillar ? (PILLAR_BY_SLUG[data.pillar] || null) : null;
}

export function isHubSlug(slug) {
  return HUB_SLUGS.has(slug);
}

export function intentLabel(intent) {
  return (intent && INTENTS[intent]) ? INTENTS[intent].label : null;
}
