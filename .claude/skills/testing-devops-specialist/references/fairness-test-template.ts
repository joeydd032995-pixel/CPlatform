// Fairness test template: chi-square uniformity test + Monte Carlo RTP
// simulation. `Agent_Info.txt`'s original version was just a placeholder
// comment (`const chiSquared = ... // implement statistical test`) — this
// fills it in with a real, reusable implementation.

/**
 * Chi-square goodness-of-fit test against a uniform distribution.
 * `observed` are bucket counts (e.g. how many times each roulette number,
 * each mines position, each plinko multiplier index, etc. occurred).
 * Returns the chi-square statistic; compare against a critical value table
 * for (buckets - 1) degrees of freedom at your chosen confidence level
 * (e.g. ~significantly less than the critical value means "fails to reject
 * uniformity", i.e. the RNG looks fair).
 */
export function chiSquareUniformity(observed: number[]): number {
  if (observed.length === 0) {
    throw new RangeError('observed must not be empty');
  }
  const totalObservations = observed.reduce((sum, count) => sum + count, 0);
  if (totalObservations === 0) {
    throw new RangeError('observed must contain at least one count');
  }
  const expectedPerBucket = totalObservations / observed.length;

  return observed.reduce((chiSquared, count) => {
    const diff = count - expectedPerBucket;
    return chiSquared + (diff * diff) / expectedPerBucket;
  }, 0);
}

/**
 * Runs `rounds` simulated bets through `gameFn` (which must return per-round
 * outcome data) and buckets results into `bucketCount` categories via
 * `bucketFn`, then returns the chi-square statistic against uniformity.
 *
 * Example (Roulette, 37 numbers, fixed serverSeed/clientSeed, nonce = round):
 *   const stat = runDistributionTest({
 *     rounds: 37000,
 *     bucketCount: 37,
 *     gameFn: (round) => calculateRouletteResult({ serverSeed, clientSeed, nonce: round }),
 *     bucketFn: (result) => result,
 *   });
 */
export function runDistributionTest<T>({
  rounds,
  bucketCount,
  gameFn,
  bucketFn,
}: {
  rounds: number;
  bucketCount: number;
  gameFn: (round: number) => T;
  bucketFn: (result: T) => number;
}): number {
  if (bucketCount <= 0) {
    throw new RangeError('bucketCount must be positive');
  }
  const buckets = new Array(bucketCount).fill(0);

  for (let round = 0; round < rounds; round++) {
    const result = gameFn(round);
    const bucketIndex = bucketFn(result);
    if (!Number.isInteger(bucketIndex) || bucketIndex < 0 || bucketIndex >= bucketCount) {
      throw new RangeError(`bucketFn returned invalid bucket index ${bucketIndex}`);
    }
    buckets[bucketIndex] += 1;
  }

  return chiSquareUniformity(buckets);
}

/**
 * Monte Carlo RTP simulation — runs `gameFn` for `rounds` simulated bets and
 * returns the empirical return-to-player percentage. Compare against the
 * game's theoretical `expectedRTP()` (see game-logic-engineer's
 * house-edge-payouts.ts) — they should converge as `rounds` grows.
 */
export async function simulateRTP(
  gameFn: (round: number) => { betAmount: number; payout: number },
  rounds: number = 10000
): Promise<number> {
  let totalReturn = 0;

  for (let round = 0; round < rounds; round++) {
    const { betAmount, payout } = gameFn(round);
    if (betAmount <= 0) {
      throw new RangeError('betAmount must be positive');
    }
    totalReturn += payout / betAmount;
  }

  return (totalReturn / rounds) * 100;
}
