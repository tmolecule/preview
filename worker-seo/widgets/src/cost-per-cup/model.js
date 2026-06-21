/**
 * Cost-per-cup economic model — the single source of truth.
 *
 * Compares a TMolecule collagen tea (e.g. Spice Rush Collagen Black Tea) against
 * the two things people commonly replace with it: a daily café latte, or a
 * DIY "coffee + a scoop of collagen powder" morning. Live $/cup, monthly and
 * annual totals, and the savings vs the chosen baseline.
 *
 * COMPLIANCE: this is an arithmetic PRICE comparison only. It compares the COST
 * of assembling a morning drink — it makes no claim that the tea is nutritionally
 * equivalent to collagen powder, and no medical/performance claim. Every figure
 * is an editable, user-controllable ESTIMATE. All costs are USD.
 *
 * Defaults (all user-editable in the UI):
 *  - Tea: a representative collagen-tea box (~$29) of ~20 sachets → ~$1.45/cup.
 *  - Café latte: ~$5.50 is a typical US medium specialty latte.
 *  - DIY: home-brewed coffee ~$0.50/cup + a collagen-powder scoop from a ~$40
 *    tub of ~30 servings (~$1.33) → ~$1.83/cup assembled.
 */

export const DEFAULTS = {
  cupsPerDay: 1,
  baseline: 'cafe', // 'cafe' | 'diy'
  tm: {
    boxPrice: 29.0, // per box
    cupsPerBox: 20, // sachets per box
  },
  cafe: {
    lattePrice: 5.5, // per café latte
  },
  diy: {
    coffeePerCup: 0.5, // home-brewed coffee
    powderTubPrice: 40.0, // collagen powder tub
    servingsPerTub: 30, // scoops per tub
  },
};

/** Cost of one TMolecule cup. */
export function tmPerCup(tm) {
  return tm.boxPrice / tm.cupsPerBox;
}

/** Cost of one cup of the chosen baseline. */
export function baselinePerCup(input) {
  if (input.baseline === 'diy') {
    return input.diy.coffeePerCup + input.diy.powderTubPrice / input.diy.servingsPerTub;
  }
  return input.cafe.lattePrice;
}

/** @param {typeof DEFAULTS} input */
export function compute(input) {
  const { cupsPerDay, baseline } = input;
  const cupsPerYear = cupsPerDay * 365;

  const tmCup = tmPerCup(input.tm);
  const baseCup = baselinePerCup(input);

  const tmAnnual = tmCup * cupsPerYear;
  const baseAnnual = baseCup * cupsPerYear;

  const savingsAnnual = baseAnnual - tmAnnual;

  return {
    cupsPerDay,
    baseline,
    baselineLabel: baseline === 'diy' ? 'Coffee + collagen powder' : 'Café latte',
    cupsPerYear,
    tmPerCup: tmCup,
    basePerCup: baseCup,
    tmAnnual,
    baseAnnual,
    tmMonthly: tmAnnual / 12,
    baseMonthly: baseAnnual / 12,
    savingsAnnual,
    savingsMonthly: savingsAnnual / 12,
    savingsPerCup: baseCup - tmCup,
  };
}
