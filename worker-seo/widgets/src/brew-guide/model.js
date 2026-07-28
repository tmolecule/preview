/**
 * Brew Guide model — the single source of truth for the brewing calculator.
 *
 * Scales a TMolecule spiced black-tea brew (e.g. Spice Rush Collagen Black Tea)
 * to a chosen number of servings, format and strength, and — optionally — adds
 * the whole-spice amounts for a from-scratch masala chai.
 *
 * COMPLIANCE: this is PREPARATION GUIDANCE only — temperatures, times, ratios and
 * quantities. Per no-medical-claims, brewing/preparation parameters are explicitly
 * fine. The single health-adjacent line (the collagen/heat note in index.js) is
 * research-framed, not an outcome claim. Every figure here is an editable estimate.
 *
 * All volumes are fluid ounces of FINISHED drink per serving (one ~8 oz cup).
 */

export const DEFAULTS = {
  servings: 2,
  format: 'latte', // 'hot' | 'iced' | 'latte' | 'concentrate'
  strength: 'standard', // 'light' | 'standard' | 'strong'
  fromScratch: false, // add whole-spice masala blend on top of the sachet
};

// Sachets and base steep time per finished serving, by strength.
const STRENGTH = {
  light: { sachets: 1, steepMin: 3 },
  standard: { sachets: 1, steepMin: 4 },
  strong: { sachets: 2, steepMin: 5 },
};

// How an 8 oz serving is composed per format, plus a steep bump for the
// formats that brew strong then get diluted (iced over ice, milk in a latte,
// batch concentrate).
const FORMAT = {
  hot: { label: 'Hot cup', waterOz: 8, milkOz: 0, iceOz: 0, steepBump: 0 },
  iced: { label: 'Iced', waterOz: 5, milkOz: 0, iceOz: 4, steepBump: 1 },
  latte: { label: 'Latte', waterOz: 4, milkOz: 4, iceOz: 0, steepBump: 1 },
  concentrate: { label: 'Concentrate (batch)', waterOz: 3, milkOz: 0, iceOz: 0, steepBump: 2 },
};

// Whole-spice additions for a from-scratch masala chai, per serving.
const SPICES = [
  { name: 'Green cardamom pods', per: 2, unit: '' },
  { name: 'Cinnamon stick', per: 0.5, unit: '' },
  { name: 'Fresh ginger', per: 1, unit: 'thin slice' },
  { name: 'Whole cloves', per: 1, unit: '' },
  { name: 'Black peppercorns', per: 2, unit: '' },
];

const BLACK_TEA_TEMP_F = 205; // just off a boil; °C derived below

const round1 = (x) => Math.round(x * 10) / 10;

/** @param {typeof DEFAULTS} input */
export function compute(input) {
  const servings = Math.max(1, Math.round(Number(input.servings) || 1));
  const s = STRENGTH[input.strength] || STRENGTH.standard;
  const f = FORMAT[input.format] || FORMAT.hot;

  const tempF = BLACK_TEA_TEMP_F;
  const tempC = Math.round(((tempF - 32) * 5) / 9);

  const spices = input.fromScratch
    ? SPICES.map((sp) => ({ name: sp.name, qty: round1(sp.per * servings), unit: sp.unit }))
    : [];

  return {
    servings,
    format: input.format,
    formatLabel: f.label,
    strength: input.strength,
    sachets: s.sachets * servings,
    steepMin: s.steepMin + f.steepBump,
    waterOz: f.waterOz * servings,
    milkOz: f.milkOz * servings,
    iceOz: f.iceOz * servings,
    tempF,
    tempC,
    spices,
    isLatte: input.format === 'latte',
    isIced: input.format === 'iced',
    isConcentrate: input.format === 'concentrate',
  };
}

/** Build the ordered method steps for the current result (preparation only). */
export function steps(r) {
  const out = [];
  const sachetWord = r.sachets === 1 ? 'sachet' : 'sachets';
  out.push(`Heat ${r.waterOz} oz water to about ${r.tempF}°F (${r.tempC}°C) — just off the boil, not a rolling boil.`);
  if (r.spices.length) {
    out.push('Simmer the whole spices in the hot water for 2–3 minutes to open them up.');
  }
  out.push(`Add ${r.sachets} ${sachetWord} and steep ${r.steepMin} minutes.`);
  if (r.isLatte) out.push(`Froth and add ${r.milkOz} oz milk (whole or oat hold the spice best).`);
  if (r.isIced) out.push(`Pour the hot, strong brew over ${r.iceOz} oz ice and stir.`);
  if (r.isConcentrate) out.push('Cool and refrigerate the concentrate; dilute 1:1 with water or milk to serve.');
  out.push('Sweeten to taste and serve.');
  return out;
}
