/**
 * Caffeine comparator — caffeine content of common teas vs coffee.
 *
 * COMPLIANCE: caffeine content is purely factual / structural, which SCOPE.md
 * explicitly allows ("caffeine content … build freely here"). No sleep, anxiety,
 * focus, or other health-outcome claims anywhere in labels, results or tooltips.
 *
 * Figures are representative per ~8 oz (237 ml) cup, in mg, drawn from published
 * tea/coffee caffeine measurements (USDA, Mayo Clinic, commercial-tea infusion
 * studies). Brewing strength, leaf grade and steep time all move the real number,
 * so every drink carries a typical LOW–HIGH range, not a single figure.
 *
 * Green tea (2026-07-28 reconciliation): low/high corrected to 30–50 mg (avg
 * unchanged at 35) to match the cited Healthline figure ("between 30 and 50
 * milligrams... around 35 mg", https://www.healthline.com/nutrition/caffeine-in-green-tea,
 * verified 200 + content-checked). The prior 25–45 mg range had no source that
 * actually stated it after the bogus fdc.nal.usda.gov search-page citation was
 * removed; this value must stay identical across every seed/*.json page, this
 * widget, and the caffeine-comparator noscript fallback in src/template.js.
 */

export const DRINKS = [
  { key: 'rooibos',  label: 'Rooibos / herbal',  low: 0,  high: 0,   avg: 0,  trueTea: false, free: true },
  { key: 'decaf',    label: 'Decaf coffee',       low: 2,  high: 5,   avg: 3,  trueTea: false },
  { key: 'white',    label: 'White tea',          low: 15, high: 30,  avg: 25, trueTea: true },
  { key: 'green',    label: 'Green tea',          low: 30, high: 50,  avg: 35, trueTea: true },
  { key: 'oolong',   label: 'Oolong tea',         low: 30, high: 50,  avg: 40, trueTea: true },
  { key: 'black',    label: 'Black tea',          low: 40, high: 70,  avg: 50, trueTea: true },
  { key: 'puerh',    label: 'Pu-erh tea',         low: 30, high: 70,  avg: 60, trueTea: true },
  { key: 'matcha',       label: 'Matcha (1 tsp)',        low: 60,  high: 80,  avg: 65,  trueTea: true },
  { key: 'matchaLatte',  label: 'Matcha latte (2 tsp)',  low: 120, high: 160, avg: 130, trueTea: true },
  { key: 'espresso',     label: 'Espresso (1 shot)',     low: 60,  high: 80,  avg: 63,  trueTea: false },
  { key: 'coffee',   label: 'Brewed coffee',      low: 80, high: 100, avg: 95, trueTea: false },
];

export const COFFEE_AVG = 95;  // brewed-coffee reference, mg/cup
export const DAILY_REF = 400;  // mg — figure the U.S. FDA has cited for healthy adults

export const DEFAULTS = { drink: 'black', cupsPerDay: 2 };

export function drinkByKey(key) {
  return DRINKS.find((d) => d.key === key) || DRINKS[0];
}

/** @param {typeof DEFAULTS} input */
export function compute(input) {
  const d = drinkByKey(input.drink);
  const cups = Math.max(1, Number(input.cupsPerDay) || 1);
  const dailyAvg = d.avg * cups;
  return {
    drink: d,
    cupsPerDay: cups,
    perCupAvg: d.avg,
    perCupLow: d.low,
    perCupHigh: d.high,
    dailyAvg,
    dailyLow: d.low * cups,
    dailyHigh: d.high * cups,
    vsCoffeePct: COFFEE_AVG > 0 ? Math.round((d.avg / COFFEE_AVG) * 100) : 0,
    pctOfDailyRef: Math.round((dailyAvg / DAILY_REF) * 100),
    free: !!d.free,
  };
}
