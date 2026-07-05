// Pure replay helpers backing POST /api/verify/round -- given a round's
// revealed seed material, its bet-time params, and its full recorded
// actionLog, these fold that exact decision sequence through the same
// packages/games primitives roundService.ts used live, reproducing the
// identical final state.
//
// Fairness note (Blackjack in particular): because real decisions branch
// the float-draw stream, the same (serverSeed, clientSeed, nonce) does NOT
// determine one single canonical outcome the way every one-shot game does
// -- it determines a *family* of possible outcomes, parameterized by which
// decisions were made. That's an unavoidable property of any interactive
// game built on a sequential draw stream, and it's still fully verifiable:
// anyone can replay the *exact same recorded decisions* against the
// revealed seed and must land on the identical result, which proves the
// server didn't bias any individual card draw based on how favorable it
// would be. This is a different (not weaker) fairness guarantee than the
// one-shot games' "recompute the one true outcome" story, and should be
// explained as such wherever this route's result is surfaced to a player.

import type { GeneratorOptions } from '@cplatform/core-rng';
import {
  MinesRoundStartParamsSchema,
  deriveMinesRoundState,
  evaluateMinesReveal,
  minesMultiplier,
  dealInitial,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  playerInsurance,
  advanceToNextHandOrDealer,
  settleHands,
} from '@cplatform/games';

type ActionLogEntry = { type: string };

export function replayMinesRound(
  generatorOpts: GeneratorOptions,
  startParams: unknown,
  actionLog: ActionLogEntry[]
) {
  const parsed = MinesRoundStartParamsSchema.parse(startParams);
  const round = deriveMinesRoundState(generatorOpts, parsed.mines);

  let revealedCount = 0;
  let hitMine = false;
  let cashedOut = false;
  let cashOutMultiplier: number | null = null;

  for (const action of actionLog) {
    if (hitMine || cashedOut) break;
    if (action.type === 'reveal') {
      revealedCount += 1;
      const result = evaluateMinesReveal(round, parsed.mines, revealedCount);
      if (result.hitMine) hitMine = true;
    } else if (action.type === 'cash_out') {
      cashedOut = true;
      cashOutMultiplier = minesMultiplier(parsed.mines, revealedCount);
    }
  }

  const multiplier = hitMine
    ? 0
    : cashedOut
      ? (cashOutMultiplier ?? 1)
      : revealedCount > 0
        ? minesMultiplier(parsed.mines, revealedCount)
        : 1;

  return {
    outcome: {
      mines: parsed.mines,
      minePositions: round.minePositions,
      revealOrder: round.revealOrder.slice(0, revealedCount),
      hitMine,
      cashedOut,
    },
    multiplier,
  };
}

export function replayBlackjackRound(generatorOpts: GeneratorOptions, actionLog: ActionLogEntry[]) {
  // betAmount fixed at 1, matching the one-shot verify route -- payout
  // scales linearly with bet, so a multiplier computed at betAmount=1 is
  // exactly what any real bet amount would have produced.
  let state = dealInitial(generatorOpts, 1);

  for (const action of actionLog) {
    if (state.phase === 'settled') break;
    switch (action.type) {
      case 'deal':
        continue;
      case 'hit':
        state = playerHit(generatorOpts, state);
        break;
      case 'stand':
        state = playerStand(generatorOpts, state);
        break;
      case 'double':
        state = playerDouble(generatorOpts, state).state;
        break;
      case 'split':
        state = playerSplit(generatorOpts, state).state;
        break;
      case 'insurance': {
        const r = playerInsurance(state);
        state = advanceToNextHandOrDealer(generatorOpts, r.state);
        break;
      }
      default:
        // Unknown/corrupt action-log entry -- stop replaying rather than
        // silently skip, so a mismatched log is visible as an incomplete
        // (unsettled) result rather than a false match.
        return { outcome: null, multiplier: null, settled: false };
    }
  }

  if (state.phase !== 'settled') {
    return { outcome: null, multiplier: null, settled: false };
  }

  const { outcome, totalPayout } = settleHands(state);
  const totalBet = state.hands.reduce((sum, h) => sum + h.bet, 0) + state.insuranceBet;
  return { outcome, multiplier: totalPayout / totalBet, settled: true };
}
