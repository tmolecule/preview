import { describe, expect, it } from 'bun:test';
import {
  compareRates,
  requiredPanelSize,
  summariseRate,
  wilsonInterval,
} from '../src/statistics';

/**
 * Expected bounds below are the published Wilson 95% values for these
 * (successes, n) pairs — they are fixed reference points, not outputs
 * captured from this implementation.
 */
describe('wilsonInterval', () => {
  it('matches published values for a balanced sample', () => {
    const ci = wilsonInterval(50, 100)!;
    expect(ci.low).toBeCloseTo(0.4038, 4);
    expect(ci.high).toBeCloseTo(0.5962, 4);
  });

  it('matches published values for a small sample', () => {
    const ci = wilsonInterval(5, 10)!;
    expect(ci.low).toBeCloseTo(0.2366, 4);
    expect(ci.high).toBeCloseTo(0.7634, 4);
  });

  it('does not collapse to [0,0] on zero successes (the Wald failure)', () => {
    const ci = wilsonInterval(0, 6)!;
    expect(ci.low).toBe(0);
    expect(ci.high).toBeCloseTo(0.3903, 4);
  });

  it('does not overshoot 1 on all successes', () => {
    const ci = wilsonInterval(1, 1)!;
    expect(ci.low).toBeCloseTo(0.2065, 4);
    expect(ci.high).toBe(1);
  });

  it('returns null for an empty sample rather than fabricating an interval', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(3, -1)).toBeNull();
    expect(wilsonInterval(1, NaN)).toBeNull();
  });

  it('clamps successes into [0, n]', () => {
    expect(wilsonInterval(99, 6)).toEqual(wilsonInterval(6, 6));
    expect(wilsonInterval(-5, 6)).toEqual(wilsonInterval(0, 6));
  });

  it('widens as the sample shrinks at a fixed rate', () => {
    const wide = wilsonInterval(2, 4)!;
    const narrow = wilsonInterval(50, 100)!;
    expect(wide.high - wide.low).toBeGreaterThan(narrow.high - narrow.low);
  });
});

describe('summariseRate', () => {
  // The live WhollyKaw Perplexity baseline. 4/6 reads as 67% but the sample
  // cannot rule out a true rate as low as 30%.
  it('labels the WK 4/6 baseline with its real uncertainty', () => {
    const s = summariseRate(4, 6);
    expect(s.rate).toBeCloseTo(0.6667, 4);
    expect(s.label).toBe('67% (30-90%, n=6)');
  });

  // The live TMolecule baseline. Zero observed citations is NOT evidence of a
  // zero rate — it is consistent with anything up to 39%.
  it('labels the TM 0/6 baseline without claiming a true zero', () => {
    const s = summariseRate(0, 6);
    expect(s.rate).toBe(0);
    expect(s.label).toBe('0% (0-39%, n=6)');
  });

  it('renders "no data" for an empty panel', () => {
    expect(summariseRate(0, 0).label).toBe('no data');
    expect(summariseRate(0, 0).rate).toBeNull();
  });
});

describe('compareRates', () => {
  it('calls a one-prompt improvement on a 6-prompt panel within noise', () => {
    const c = compareRates({ successes: 4, n: 6 }, { successes: 5, n: 6 });
    expect(c.withinNoise).toBe(true);
    expect(c.delta).toBeCloseTo(0.1667, 4);
    expect(c.label).toContain('within noise');
  });

  it('calls a large move on a 100-prompt panel a real change', () => {
    const c = compareRates({ successes: 10, n: 100 }, { successes: 50, n: 100 });
    expect(c.withinNoise).toBe(false);
    expect(c.deltaInterval!.low).toBeGreaterThan(0);
    expect(c.label).toContain('real change');
  });

  it('detects a real regression, not just a gain', () => {
    const c = compareRates({ successes: 50, n: 100 }, { successes: 10, n: 100 });
    expect(c.withinNoise).toBe(false);
    expect(c.delta).toBeLessThan(0);
    expect(c.deltaInterval!.high).toBeLessThan(0);
  });

  it('reports no data when either side is empty', () => {
    const c = compareRates({ successes: 0, n: 0 }, { successes: 5, n: 10 });
    expect(c.label).toBe('no data');
    expect(c.withinNoise).toBe(true);
    expect(c.deltaInterval).toBeNull();
  });

  it('keeps the difference interval on the [-1, 1] scale, not clamped to [0,1]', () => {
    const c = compareRates({ successes: 100, n: 100 }, { successes: 0, n: 100 });
    expect(c.deltaInterval!.low).toBeLessThan(0);
    expect(c.deltaInterval!.low).toBeGreaterThanOrEqual(-1);
  });

  it('is symmetric in magnitude when the panels are swapped', () => {
    const up = compareRates({ successes: 10, n: 100 }, { successes: 50, n: 100 });
    const down = compareRates({ successes: 50, n: 100 }, { successes: 10, n: 100 });
    expect(up.delta).toBeCloseTo(-down.delta!, 6);
    expect(up.withinNoise).toBe(down.withinNoise);
  });
});

describe('requiredPanelSize', () => {
  it('sizes the panel for +/-10pp at the worst-case rate', () => {
    expect(requiredPanelSize(0.1)).toBe(97);
  });

  it('needs a smaller panel when the rate is away from 0.5', () => {
    expect(requiredPanelSize(0.13, 0.6667)).toBe(51);
    expect(requiredPanelSize(0.13, 0.6667)).toBeLessThan(requiredPanelSize(0.13));
  });

  it('grows quadratically as the target tightens', () => {
    const loose = requiredPanelSize(0.2);
    const tight = requiredPanelSize(0.1);
    expect(tight / loose).toBeGreaterThan(3.5);
    expect(tight / loose).toBeLessThan(4.5);
  });

  it('rejects a nonsensical target', () => {
    expect(() => requiredPanelSize(0)).toThrow();
    expect(() => requiredPanelSize(1)).toThrow();
    expect(() => requiredPanelSize(-0.1)).toThrow();
  });
});
