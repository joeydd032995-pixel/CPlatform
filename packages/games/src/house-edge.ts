// Shared payout utilities (ported from
// .claude/skills/game-logic-engineer/references/house-edge-payouts.ts).
//
// Unit contract (the two functions intentionally use different scales,
// matching their respective domains):
//   - `edge` here is a FRACTION in [0,1) (e.g. 0.01 = 1% house edge),
//     matching how it's threaded through every game's payout formula.
//   - `expectedRTP` returns a PERCENTAGE in [0,100] (e.g. 99), matching how
//     RTP is conventionally reported/displayed. Callers comparing an
//     observed fractional return (payout/betAmount) against it must divide
//     by 100 first — see packages/games/test/*.test.ts's RTP sanity checks.

export function applyHouseEdge(multiplier: number, edge: number = 0.01): number {
  return Math.max(0, multiplier * (1 - edge));
}

export function expectedRTP(houseEdge: number): number {
  return (1 - houseEdge) * 100;
}
