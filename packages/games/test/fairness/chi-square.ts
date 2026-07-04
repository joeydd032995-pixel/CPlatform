// Shared statistical helpers for the deep fairness suite. Extends
// `.claude/skills/testing-devops-specialist/references/fairness-test-template.ts`'s
// `chiSquareUniformity`/`runDistributionTest`/`simulateRTP` (ported, not
// re-derived) with:
//   - a goodness-of-fit statistic against an arbitrary (non-uniform)
//     expected distribution, needed for Darts (zone probabilities are NOT
//     uniform) and Chicken (deathPoint is an order statistic, not uniform,
//     for any difficulty above 'easy');
//   - a chi-square critical-value table/approximation so tests can assert
//     "the statistic is below the critical value at alpha=0.01" instead of
//     the loose +/-20% bucket checks the existing per-game tests use;
//   - a Pearson correlation coefficient, for the serial-correlation /
//     cross-stream independence checks.
//
// This file is a plain helper module (no `*.test.ts` suffix) so vitest's
// `test/**/*.test.ts` include glob does not try to run it directly.

/** Chi-square goodness-of-fit against a uniform distribution (ported verbatim
 * from the skill's fairness-test-template.ts). */
export function chiSquareUniformity(observed: number[]): number {
  if (observed.length === 0) {
    throw new RangeError('observed must not be empty');
  }
  const total = observed.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    throw new RangeError('observed must contain at least one count');
  }
  const expectedPerBucket = total / observed.length;

  return observed.reduce((chiSquared, count) => {
    const diff = count - expectedPerBucket;
    return chiSquared + (diff * diff) / expectedPerBucket;
  }, 0);
}

/** Chi-square goodness-of-fit against an arbitrary expected distribution
 * given as probabilities (must sum to ~1). Generalizes
 * `chiSquareUniformity` for games whose theoretical distribution is known
 * but not flat (Darts zones, Chicken deathPoint order statistics, Keno
 * hit-count tables, ...). */
export function chiSquareGoodnessOfFit(
  observed: number[],
  expectedProbabilities: number[]
): number {
  if (observed.length === 0 || observed.length !== expectedProbabilities.length) {
    throw new RangeError(
      'observed and expectedProbabilities must be non-empty and the same length'
    );
  }
  const total = observed.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    throw new RangeError('observed must contain at least one count');
  }

  return observed.reduce((chiSquared, count, index) => {
    const expected = expectedProbabilities[index]! * total;
    if (expected <= 0) {
      // A bucket the model says is impossible but that was actually
      // observed is an automatic, glaring failure -- surface it as +Infinity
      // rather than dividing by zero silently.
      return count > 0 ? Infinity : chiSquared;
    }
    const diff = count - expected;
    return chiSquared + (diff * diff) / expected;
  }, 0);
}

/**
 * Upper-tail chi-square critical value at the given significance level.
 *
 * Exact values (from standard published chi-square tables) are hardcoded
 * for the specific degrees-of-freedom this suite actually uses, at
 * alpha=0.01 -- the confidence level CLAUDE.md's testing rules call for.
 * For any other (df, alpha) combination, falls back to the Wilson-Hilferty
 * cube-root normal approximation:
 *
 *   chi2(df, alpha) ~= df * (1 - 2/(9df) + z_alpha * sqrt(2/(9df)))^3
 *
 * where z_alpha is the standard normal upper-alpha quantile. This
 * approximation is accurate to within ~0.5% for df >= 4, which is
 * comfortably tighter than the safety margins used in this suite's
 * assertions (we compare against the exact/approximate critical value
 * with no additional slack needed, since every test here uses a FIXED
 * seed and is therefore fully deterministic -- there is no run-to-run
 * variance to buffer against, only the approximation's own small error).
 */
const EXACT_CHI_SQUARE_CRITICAL_001: Record<number, number> = {
  // df: critical value at alpha = 0.01
  4: 13.277,
  10: 23.209,
  11: 24.725,
  15: 30.578,
  17: 33.409,
  19: 36.191,
  24: 42.980,
  36: 58.619,
  39: 62.428,
  40: 63.691,
  51: 77.386,
};

// z_0.01 (one-sided upper-tail 99th percentile of the standard normal).
const Z_ALPHA_001 = 2.326347874;

function wilsonHilfertyChiSquareCritical(df: number, zAlpha: number): number {
  const term = 2 / (9 * df);
  const base = 1 - term + zAlpha * Math.sqrt(term);
  return df * base * base * base;
}

export function chiSquareCriticalValue(df: number, alpha: number = 0.01): number {
  if (df <= 0) throw new RangeError('df must be positive');
  if (alpha === 0.01) {
    const exact = EXACT_CHI_SQUARE_CRITICAL_001[df];
    if (exact !== undefined) return exact;
    return wilsonHilfertyChiSquareCritical(df, Z_ALPHA_001);
  }
  if (alpha === 0.05) return wilsonHilfertyChiSquareCritical(df, 1.644853627);
  throw new RangeError(`No z-quantile wired up for alpha=${alpha}`);
}

/** Pearson correlation coefficient between two equal-length numeric series.
 * Used to check lag-1 serial (auto)correlation of the float generator
 * across nonces, and cross-stream independence between domain-separated
 * RNG streams (e.g. Mines' mine-position stream vs its
 * `:reveal-order`-suffixed stream). */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new RangeError('xs and ys must be equal-length arrays of length >= 2');
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
}

/** nCr, duplicated locally (not imported from src/combinatorics.ts) only
 * where a test needs it purely to compute an EXPECTED theoretical
 * probability for a chi-square/EV check -- keeping the test's expected
 * value independent of the implementation being tested avoids a test that
 * would trivially pass even if the source's own nCr had a bug. Games that
 * already re-export nCr as public API (Mines, Chicken, Keno) still import
 * the real one directly for their resolve()-level assertions; this copy is
 * only for cross-checking distribution shapes.
 */
export function nCrLocal(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}
