/**
 * Collagen-per-day calculator — how much collagen protein you consume.
 *
 * COMPLIANCE (no-medical-claims, food/supplement): this reports a CONTENT figure
 * — grams of collagen protein consumed — never a health outcome. The studied
 * daily range is shown to give the number context; it describes how much research
 * TENDS to use, not a promised result. No skin/joint/hair outcome claims anywhere.
 *
 * Spice Rush figure is verified from the PDP metafield "Collagen per serving: 10 g"
 * (20 servings, $9.99 → ~$0.50/cup). Hydrolyzed bovine collagen peptides.
 */

export const SPICE_RUSH = {
  collagenPerCupG: 10, // verified: 10 g hydrolyzed bovine collagen per serving
  servingsPerPack: 20,
  packPriceUsd: 9.99,
};

// Range commonly used in published collagen-peptide research (describes study
// design, NOT a recommendation or an outcome). ~2.5–15 g/day is widely cited.
export const STUDIED_RANGE_G = { low: 2.5, high: 15 };

export const DEFAULTS = { cupsPerDay: 1 };

export function compute(input) {
  const cups = Math.max(1, Math.min(4, Number(input.cupsPerDay) || 1));
  const dailyG = SPICE_RUSH.collagenPerCupG * cups;
  const weeklyG = dailyG * 7;
  // Where the daily amount sits on the 0–15 g studied scale (for a marker).
  const pctOfScale = Math.max(4, Math.min(100, Math.round((dailyG / STUDIED_RANGE_G.high) * 100)));
  const inStudiedRange = dailyG >= STUDIED_RANGE_G.low;
  return {
    cupsPerDay: cups,
    perCupG: SPICE_RUSH.collagenPerCupG,
    dailyG,
    weeklyG,
    pctOfScale,
    inStudiedRange,
    studiedLow: STUDIED_RANGE_G.low,
    studiedHigh: STUDIED_RANGE_G.high,
  };
}
