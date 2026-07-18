/**
 * Exact statistical helpers for AI-citation rate reporting.
 *
 * Every citation / mention rate we publish is a proportion over a SMALL sample
 * (a prompt panel of 6-100 queries). A bare fraction like "4/6" reads as 67%
 * and invites a conclusion the sample cannot support: the 95% interval on 4/6
 * runs from 30% to 90%. These helpers exist so the report, the alert, and the
 * month-over-month comparison all attach the SAME interval instead of each
 * hand-rolling one — or worse, printing a naked percentage.
 *
 * Pure functions, no I/O, no deps — safe to import in a Worker or a test.
 */

export interface ConfidenceInterval {
  /** Lower bound, clamped to [0, 1]. */
  low: number;
  /** Upper bound, clamped to [0, 1]. */
  high: number;
}

/** z for a two-sided 95% interval. */
export const Z_95 = 1.96;

/** Round to `dp` places, normalising -0 to 0. */
function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return (Math.round(value * f) + 0) / f;
}

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the normal (Wald) interval because it behaves at the extremes
 * our panels actually hit. At `successes = 0` Wald collapses to the degenerate
 * [0, 0] — which would let us publish "TMolecule's true citation rate is
 * exactly zero" off a 6-prompt sample. Wilson returns [0, upper] instead, and
 * never overshoots [0, 1].
 *
 * Returns `null` when `n === 0`. A proportion over no samples is undefined and
 * the caller must render "no data" rather than a fabricated interval.
 *
 * CAVEAT the caller must respect: this treats the n observations as
 * independent Bernoulli draws. Our observations CLUSTER — the same prompt
 * re-run across sweeps is correlated with itself, and prompts within a topic
 * are correlated with each other. The true interval is therefore WIDER than
 * what this returns. The rigorous version is a cluster bootstrap over sweeps,
 * which only becomes meaningful at 5+ sweeps. Until then Wilson is the honest
 * reproducible floor, not the last word.
 */
export function wilsonInterval(
  successes: number,
  n: number,
  z: number = Z_95,
): ConfidenceInterval | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = Math.max(0, Math.min(successes, n));
  const p = s / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    low: round(Math.max(0, center - margin)),
    high: round(Math.min(1, center + margin)),
  };
}

export interface RateSummary {
  successes: number;
  n: number;
  /** Point estimate, or null when n === 0. */
  rate: number | null;
  interval: ConfidenceInterval | null;
  /** Report-ready, e.g. "67% (30-90%, n=6)" or "no data". */
  label: string;
}

/** Summarise a proportion for a report line or an email. */
export function summariseRate(successes: number, n: number): RateSummary {
  const interval = wilsonInterval(successes, n);
  if (interval === null) {
    return { successes, n, rate: null, interval: null, label: 'no data' };
  }
  const rate = successes / n;
  const pct = (v: number) => Math.round(v * 100);
  return {
    successes,
    n,
    rate: round(rate),
    interval,
    label: `${pct(rate)}% (${pct(interval.low)}-${pct(interval.high)}%, n=${n})`,
  };
}

export interface RateComparison {
  before: RateSummary;
  after: RateSummary;
  /** after.rate - before.rate, or null if either sample is empty. */
  delta: number | null;
  /** 95% interval on the DIFFERENCE of the two proportions (Newcombe). */
  deltaInterval: ConfidenceInterval | null;
  /**
   * True when the difference interval contains zero — i.e. the observed move
   * is consistent with no real change. This is the guard against reporting a
   * sampling wobble as a win.
   */
  withinNoise: boolean;
  /** Report-ready verdict line. */
  label: string;
}

/**
 * Compare two rates and say whether the move is real.
 *
 * Uses Newcombe's method 10 (score-interval based) for the difference of two
 * independent proportions, rather than the naive "do the two Wilson intervals
 * overlap" test. Naive overlap is badly over-conservative: two intervals can
 * overlap while the difference is still significant, so it would tell us
 * "within noise" on moves that are real.
 *
 * Note `deltaInterval` spans [-1, 1] — it is a difference, not a proportion,
 * so it is NOT clamped to [0, 1] the way `wilsonInterval` is.
 */
export function compareRates(
  before: { successes: number; n: number },
  after: { successes: number; n: number },
): RateComparison {
  const b = summariseRate(before.successes, before.n);
  const a = summariseRate(after.successes, after.n);

  if (!b.interval || !a.interval) {
    return {
      before: b,
      after: a,
      delta: null,
      deltaInterval: null,
      withinNoise: true,
      label: 'no data',
    };
  }

  // Work from the RAW proportions, not the rounded ones on the summaries —
  // differencing two 4dp-rounded rates compounds the error into the delta.
  const bRate = Math.max(0, Math.min(before.successes, before.n)) / before.n;
  const aRate = Math.max(0, Math.min(after.successes, after.n)) / after.n;
  const delta = aRate - bRate;

  // Newcombe: propagate each proportion's own asymmetric score-interval
  // distance, pairing the lower bound of one with the upper of the other.
  const lower =
    delta -
    Math.sqrt((aRate - a.interval.low) ** 2 + (b.interval.high - bRate) ** 2);
  const upper =
    delta +
    Math.sqrt((a.interval.high - aRate) ** 2 + (bRate - b.interval.low) ** 2);

  const deltaInterval = {
    low: round(Math.max(-1, lower)),
    high: round(Math.min(1, upper)),
  };
  const withinNoise = deltaInterval.low <= 0 && deltaInterval.high >= 0;

  const pp = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}pp`;
  const label = withinNoise
    ? `${pp(delta)} — within noise (95% CI ${pp(deltaInterval.low)} to ${pp(deltaInterval.high)})`
    : `${pp(delta)} — real change (95% CI ${pp(deltaInterval.low)} to ${pp(deltaInterval.high)})`;

  return { before: b, after: a, delta: round(delta), deltaInterval, withinNoise, label };
}

/**
 * How many prompts does the panel need for a given precision?
 *
 * Returns n such that the 95% half-width is about `targetHalfWidth` (in
 * proportion units, so 0.10 = +/-10 percentage points) at the assumed
 * underlying rate. Uses the normal approximation, which is close enough for
 * planning and slightly conservative once you re-check with Wilson.
 *
 * `assumedP` defaults to 0.5 — the variance-maximising worst case. Pass your
 * current point estimate for a tighter (less safe) number.
 */
export function requiredPanelSize(
  targetHalfWidth: number,
  assumedP = 0.5,
  z: number = Z_95,
): number {
  if (!(targetHalfWidth > 0) || targetHalfWidth >= 1) {
    throw new Error('targetHalfWidth must be in (0, 1)');
  }
  const p = Math.min(Math.max(assumedP, 0), 1);
  return Math.ceil((z * z * p * (1 - p)) / (targetHalfWidth * targetHalfWidth));
}
