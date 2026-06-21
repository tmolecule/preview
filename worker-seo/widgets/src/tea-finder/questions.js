/**
 * Tea Finder quiz questions. Each option carries a `score` map adding points to
 * a product key ('spice-rush' | 'immunitea'). Routing is on REAL, factual
 * differentiators pulled from the PDPs — not health needs:
 *
 *   Spice Rush Collagen Black Tea : morning / chai-spiced / collagen / NOT vegan
 *   ImmuniTea Defense Tea         : everyday / turmeric adaptogens / vegan
 *
 * Both are black-tea based (so caffeine is not a differentiator and isn't asked).
 *
 * COMPLIANCE: preference only. "Everyday wellness ritual" is an occasion, not an
 * immunity claim; naming ingredients (collagen, turmeric, amla) is composition,
 * not an outcome claim.
 */
export const QUESTIONS = [
  {
    id: 'occasion',
    prompt: "What's this cup for?",
    options: [
      { label: 'My morning — something to reach for instead of coffee', score: { 'spice-rush': 3 } },
      { label: 'An everyday wellness ritual, any time of day', score: { immunitea: 3 } },
      { label: 'Honestly, both', score: {} },
    ],
  },
  {
    id: 'flavor',
    prompt: 'Which flavor pulls you in?',
    options: [
      { label: 'Warm & spiced — chai, ginger, cinnamon', score: { 'spice-rush': 3 } },
      { label: 'Earthy & golden — turmeric-forward', score: { immunitea: 3 } },
      { label: 'No strong preference', score: {} },
    ],
  },
  {
    id: 'want',
    prompt: 'What do you most want in the cup?',
    options: [
      { label: 'Collagen peptides', score: { 'spice-rush': 3 } },
      { label: 'Standardized adaptogens — turmeric, amla, terminalia', score: { immunitea: 3 } },
      { label: 'Just a really good black tea', score: { 'spice-rush': 1, immunitea: 1 } },
    ],
  },
  {
    id: 'dietary',
    prompt: 'Any dietary line we should respect?',
    note: 'Spice Rush contains collagen (from animal sources); ImmuniTea is plant-based.',
    options: [
      { label: 'Plant-based / vegan only', score: { immunitea: 4 } },
      { label: 'No restriction', score: {} },
    ],
  },
];
