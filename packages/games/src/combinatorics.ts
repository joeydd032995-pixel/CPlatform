// Small combinatorics helper shared by payout formulas that need
// "N choose K" without overflowing via factorials of large n (e.g. 25!).

export function nCr(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kEff = Math.min(k, n - k);

  let result = 1;
  for (let i = 0; i < kEff; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}
