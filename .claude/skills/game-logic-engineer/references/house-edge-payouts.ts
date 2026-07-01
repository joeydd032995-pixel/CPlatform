// Shared payout utilities (from FinalReviewDoc.txt review iteration, renamed
// per its own feedback: calculateRTP -> expectedRTP).

export function applyHouseEdge(multiplier: number, edge: number = 0.01): number {
  return Math.max(0, multiplier * (1 - edge));
}

export function expectedRTP(houseEdge: number): number {
  return (1 - houseEdge) * 100;
}

// Monte Carlo helper for empirically verifying a game's actual RTP matches
// its theoretical expectedRTP() — see testing-devops-specialist's
// fairness-test-template.ts for the full implementation.
export async function simulateRTP(
  gameFn: (round: number) => { betAmount: number; payout: number },
  rounds: number = 10000
): Promise<number> {
  let totalReturn = 0;
  for (let round = 0; round < rounds; round++) {
    const { betAmount, payout } = gameFn(round);
    totalReturn += payout / betAmount;
  }
  return (totalReturn / rounds) * 100;
}

// --- Games still needing their own payout/multiplier math ------------------
// (outcome generators for all of these already exist in ./games/*.ts)
//
// - Mines: combinatorial payout for "N safe tiles revealed out of 25-mines".
//   Formula shape: multiplier = applyHouseEdge(
//     C(25, N) / C(25 - mines, N)   // probability-inverse across N reveals
//   )
// - Keno: hit-count -> multiplier paytable, one per KenoRisk level.
// - Dice: multiplier = applyHouseEdge(100 / winChance), where winChance is
//   derived from the chosen target and roll-under/over direction.
// - Roulette: standard payout table per bet type (straight 35:1, split 17:1,
//   street 11:1, corner 8:1, column/dozen 2:1, red-black/odd-even/high-low 1:1),
//   each run through applyHouseEdge.
// - HiLo: see games/hilo.ts's resolveHiLo — needs reconciling remaining-card
//   assumption against the with-replacement draw generator.
// - Chicken: per-lane multiplier curve keyed on difficulty + lane index,
//   increasing as death point survives longer.
// - Darts: zone-to-multiplier mapping from the `distance` polar coordinate
//   (bullseye highest, outer ring lowest).
// - Blackjack: standard hand evaluation (bust/blackjack/push/win) with
//   3:2 blackjack payout, run through applyHouseEdge for the base edge.
