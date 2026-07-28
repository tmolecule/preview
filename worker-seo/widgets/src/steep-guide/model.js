/**
 * Steep Guide — water temperature, steep time and leaf:water ratio by tea type.
 *
 * COMPLIANCE: preparation guidance only (temperature, time, ratio), which
 * no-medical-claims explicitly permits. No sleep, focus, calm, energy, jitters,
 * or other health-outcome language anywhere in labels, notes or copy — this is
 * a reference-lookup tool, not a benefits tool.
 *
 * SOURCING — every figure below traces to a real, resolving authority. URLs
 * verified `curl -sI -L <url>` -> HTTP 200 on 2026-07-28. Do not add or edit a
 * row without recording its source here in the same way.
 *
 * ── Green tea — VERIFIED (Appendix A canonical row, tm-caffeine-steep-tool-pages plan) ──
 * - Tea Association of the USA, "Brewing Tea": https://www.teausa.org/brewingtea
 *   -> "165°-185°F", "approximately one minute" (general guidelines: "one
 *   teaspoon or one tea bag per cup"). [200]
 * - Ippodo Tea (Japanese sencha standard): https://ippodotea.com/ [200]
 *   -> 176°F (80°C) / 60 s is the house sencha standard cited in the plan.
 * - Healthline (generic Western guidance):
 *   https://www.healthline.com/nutrition/how-to-steep-tea [200]
 *   -> table: "Green tea | 3–4 minutes | 175°F (79°C)".
 * Genuine variance: Japanese convention is a brief ~1-minute steep; generic
 * Western guidance is a longer 3–4 minutes. Both are real and cited — this is
 * intentional, not an error.
 *
 * ── Matcha usucha (thin) — sourced 2026-07-28 ──
 * - Ippodo Tea, "Matcha Usucha (Classic Matcha)":
 *   https://ippodotea.com/blogs/recipes-to-brew-japanese-tea/usucha-thin-matcha [200]
 *   -> "Sift matcha 2g (0.07 oz) ... 1 level teaspoon", "Add hot water 60 mL
 *   (2 oz) 80°C (176°F)", "Whisk 15 seconds".
 *
 * ── Matcha koicha (thick) — sourced 2026-07-28 ──
 * - Ippodo Tea, "Matcha Koicha (Thick Matcha)":
 *   https://ippodotea.com/blogs/recipes-to-brew-japanese-tea/koicha [200]
 *   -> "Sift matcha 4g (0.14 oz) ... 2 level teaspoons", "Add hot water 30 mL
 *   (1 oz) 80°C (176°F)", "Whisk 15 seconds" (mixed/tamped, not whisked to
 *   froth). NOTE: the plan's original unverified draft guessed a 30-second
 *   whisk for koicha — the sourced figure is 15 seconds, same as usucha. That
 *   guess is corrected here, not carried forward.
 *
 * ── Black tea — sourced 2026-07-28 ──
 * - Tea Association of the USA, "Brewing Tea": https://www.teausa.org/brewingtea [200]
 *   -> "bring fresh, cold tap water to a full boil (212°F) ... use one
 *   teaspoon or one tea bag per cup ... brew by the clock 3 to 5 minutes".
 * - Healthline: https://www.healthline.com/nutrition/how-to-steep-tea [200]
 *   -> table: "Black tea | 3–4 minutes | 195°F (91°C)".
 * Genuine variance: TAUSA calls for a full rolling boil; Healthline's generic
 * table is ~15-17°F cooler. Both published; record the range rather than pick one.
 *
 * ── Oolong tea — sourced 2026-07-28 ──
 * - Tea Association of the USA, "Brewing Tea" (guidelines for "big oolongs"):
 *   https://www.teausa.org/brewingtea [200]
 *   -> "between 180-190 degree water ... oolongs 5-7 minutes".
 * - Healthline: https://www.healthline.com/nutrition/how-to-steep-tea [200]
 *   -> table: "Oolong tea | 3–5 minutes | 195°F (91°C)".
 * Genuine variance: TAUSA's large-leaf guidance runs cooler and longer than
 * Healthline's generic figure — oolong spans rolled and strip-style leaf, so
 * both are legitimate depending on the leaf.
 *
 * ── White tea — sourced 2026-07-28 ──
 * - Tea Association of the USA, "Brewing Tea" (guidelines for "big ... white
 *   teas"): https://www.teausa.org/brewingtea [200]
 *   -> "between 180-190 degree water ... white tea 3-4 minutes".
 * - Healthline: https://www.healthline.com/nutrition/how-to-steep-tea [200]
 *   -> table: "White tea | 4–5 minutes | 175°F (79°C)".
 * Genuine variance: TAUSA runs hotter and shorter than Healthline's generic
 * figure for delicate white leaf. Both published; recorded, not reconciled.
 *
 * Leaf:water ratios for black/oolong/white use TAUSA's general brewing
 * guideline ("one teaspoon or one tea bag per cup"), stated once ahead of the
 * per-type special guidance and not overridden for any type — so it is the
 * TAUSA-sourced ratio for all three, not an invented figure.
 */

export const TEAS = [
  {
    key: 'green',
    label: 'Green tea',
    tempF: '165–185°F',
    tempC: '74–85°C',
    time: '~1 min',
    ratio: '1 tsp (2 g) leaf / 8 oz water',
    note: 'The brief ~1-minute steep is the Japanese sencha convention (Tea Association of the USA; Ippodo). Generic Western guidance calls for a longer, cooler steep — 175°F, 3–4 min (Healthline). Both are published; leaf style and taste decide which to use.',
  },
  {
    key: 'matchaUsucha',
    label: 'Matcha — usucha (thin)',
    tempF: '176°F',
    tempC: '80°C',
    time: 'whisk 15 sec',
    ratio: '2 g (1 tsp) matcha / 2 oz (60 ml) water',
    note: 'Ippodo Tea’s standard thin-matcha recipe: sift 2 g into a bowl, add 2 oz water cooled to 176°F (80°C), whisk vigorously 15 seconds in an "M" motion.',
  },
  {
    key: 'matchaKoicha',
    label: 'Matcha — koicha (thick)',
    tempF: '176°F',
    tempC: '80°C',
    time: 'mix 15 sec',
    ratio: '4 g (2 tsp) matcha / 1 oz (30 ml) water',
    note: 'Ippodo Tea’s thick-matcha recipe: sift 4 g, add just 1 oz of 176°F (80°C) water, and mix/tamp gently (not whisked to a froth) for 15 seconds.',
  },
  {
    key: 'black',
    label: 'Black tea',
    tempF: '195–212°F',
    tempC: '91–100°C',
    time: '3–5 min',
    ratio: '1 tsp (or 1 bag) / 8 oz water',
    note: 'Tea Association of the USA calls for a full boil (212°F) for 3–5 min; Healthline’s generic guidance is a touch cooler at 195°F for 3–4 min. Both are published; the range above spans them.',
  },
  {
    key: 'oolong',
    label: 'Oolong tea',
    tempF: '180–195°F',
    tempC: '82–91°C',
    time: '3–7 min',
    ratio: '1 tsp / 8 oz water',
    note: 'Tea Association of the USA’s large-leaf guidance is 180–190°F for 5–7 min; Healthline’s generic figure runs hotter and shorter — 195°F for 3–5 min. Oolong spans rolled and strip-style leaf, so both are legitimate; start low and short, then adjust.',
  },
  {
    key: 'white',
    label: 'White tea',
    tempF: '175–190°F',
    tempC: '79–88°C',
    time: '3–5 min',
    ratio: '1 tsp / 8 oz water',
    note: 'Tea Association of the USA’s large-leaf guidance is 180–190°F for 3–4 min; Healthline’s generic figure is cooler and slightly longer — 175°F for 4–5 min. Both published for this delicate leaf; the range above spans them.',
  },
];

export const DEFAULTS = { tea: 'green' };

export function teaByKey(key) {
  return TEAS.find((t) => t.key === key) || TEAS[0];
}
