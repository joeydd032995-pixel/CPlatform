// Shared payout utilities (ported from
// .claude/skills/game-logic-engineer/references/house-edge-payouts.ts).

export function applyHouseEdge(multiplier: number, edge: number = 0.01): number {
  return Math.max(0, multiplier * (1 - edge));
}

export function expectedRTP(houseEdge: number): number {
  return (1 - houseEdge) * 100;
}
