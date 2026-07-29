/**
 * Sugar-saved / café-swap calculator.
 *
 * COMPLIANCE (no-medical-claims): this is a sugar-grams, calories-from-sugar and
 * dollars comparison — arithmetic, not a health claim. No weight-loss, blood-sugar
 * or any outcome language. Café figures are REPRESENTATIVE (they vary by chain and
 * size), so they're labelled as such.
 *
 * Café chai latte sugar: a large café chai latte is commonly ~40 g total sugar
 * (range ~30–50 g across chains/sizes). Spice Rush has 0 g ADDED sugar.
 * Spice Rush cup cost: $9.99 / 20 servings ≈ $0.50. Café chai ≈ $5.50.
 */

export const CAFE = {
  sugarPerDrinkG: 40,   // representative large café chai latte
  sugarLowG: 30,
  sugarHighG: 50,
  priceUsd: 5.5,
};
export const SPICE_RUSH = {
  addedSugarG: 0,
  cupCostUsd: 9.99 / 20, // ≈ 0.50
};
export const SUGAR_CAL_PER_G = 4;
export const GRAMS_PER_TSP = 4.2; // teaspoons of sugar, a relatable unit
export const GRAMS_PER_LB = 453.6;
export const WEEKS_PER_YEAR = 52;

export const DEFAULTS = { drinksPerWeek: 5 };

export function compute(input) {
  const perWeek = Math.max(1, Math.min(14, Number(input.drinksPerWeek) || 1));
  const perYear = perWeek * WEEKS_PER_YEAR;
  const sugarSavedG = perYear * CAFE.sugarPerDrinkG;
  return {
    drinksPerWeek: perWeek,
    drinksPerYear: perYear,
    sugarSavedG,
    sugarSavedLbs: Math.round((sugarSavedG / GRAMS_PER_LB) * 10) / 10,
    sugarSavedTsp: Math.round(sugarSavedG / GRAMS_PER_TSP),
    calSaved: Math.round(sugarSavedG * SUGAR_CAL_PER_G),
    moneySaved: Math.round(perYear * (CAFE.priceUsd - SPICE_RUSH.cupCostUsd)),
    perDrinkSugar: CAFE.sugarPerDrinkG,
    sugarLow: CAFE.sugarLowG,
    sugarHigh: CAFE.sugarHighG,
  };
}
