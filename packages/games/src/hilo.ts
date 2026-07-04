// Generator + resolveHiLo ported from
// .claude/skills/game-logic-engineer/references/games/hilo.ts verbatim —
// each card is drawn Math.floor(float * 52) INDEPENDENTLY WITH
// REPLACEMENT from the full 52-card deck (no shrinking deck / shuffle).
// Only the RNG import/naming has been fixed to match the real
// @cplatform/core-rng package.
//
// Because each draw is independent from the full deck (the same card can
// reappear), the denominator in resolveHiLo is a CONSTANT 52, not a
// shrinking "remaining cards" count, and "equal" has 4 favorable outcomes
// (all 4 suits of the same rank, including the exact card just drawn).
//
// Quirk (intentionally preserved, not "fixed"): guessing "higher" when the
// current card is a King (rank 13) is a legal auto-loss — favorable =
// (13-13)*4 = 0, so prob = 0 and the step multiplier is 0. Likewise
// "lower" on an Ace (rank 1) is an auto-loss. These are real, valid bets
// under a "blind strategy" UI that lets a player select higher/lower
// before seeing whether it's even possible.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { type Card, drawCardFromFloat, getCardRankValue } from './deck.js';
import { applyHouseEdge } from './house-edge.js';
import { validateBetAmount } from './bet-amount.js';

export const HILO_GAME_MAX_ROUNDS_SOFT_LIMIT = 52;

export type CalculateHiloResultsOptions = GeneratorOptions & {
  limit?: number;
};

export const calculateHiloResults = ({
  limit = HILO_GAME_MAX_ROUNDS_SOFT_LIMIT,
  ...rngOptions
}: CalculateHiloResultsOptions): readonly Card[] => {
  const floatsRng = createFloatGenerator(rngOptions);

  return Array(limit)
    .fill(0)
    .map(() => drawCardFromFloat(floatsRng.next().value));
};

export const HILO_HOUSE_EDGE = 0.01;

export type HiLoGuess = 'higher' | 'lower' | 'equal';

export const resolveHiLo = (
  currentCard: Card,
  guess: HiLoGuess,
  remainingCards: number = 52
): number => {
  const rank = getCardRankValue(currentCard);
  let favorable = 0;

  if (guess === 'higher') favorable = (13 - rank) * 4;
  else if (guess === 'lower') favorable = (rank - 1) * 4;
  else if (guess === 'equal') favorable = 4; // Same rank, with replacement

  const prob = favorable / remainingCards;
  return prob > 0 ? applyHouseEdge(1 / prob, HILO_HOUSE_EDGE) : 0;
};

// --- Params / resolve ------------------------------------------------------

export const HiLoGuessSchema = z.enum(['higher', 'lower', 'equal']);

export const HiLoParamsSchema = z.object({
  guesses: z.array(HiLoGuessSchema).min(1).max(51),
});

export type HiLoParams = z.infer<typeof HiLoParamsSchema>;

export type HiLoStep = {
  guess: HiLoGuess;
  correct: boolean;
};

export type HiLoOutcome = {
  cards: Card[];
  steps: HiLoStep[];
  win: boolean;
};

export function resolveHiLoGame(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: HiLoOutcome; multiplier: number; payout: number } {
  const parsed = validateHiLoParams(params);
  validateBetAmount('hilo', betAmount);

  // Draw a strict prefix of the reference's 52-card stream: one card to
  // start, plus one more per guess.
  const cards = calculateHiloResults({
    ...generatorOpts,
    limit: parsed.guesses.length + 1,
  }) as Card[];

  const steps: HiLoStep[] = [];
  let multiplier = 1;

  for (let i = 0; i < parsed.guesses.length; i++) {
    const guess = parsed.guesses[i]!;
    const previousCard = cards[i]!;
    const nextCard = cards[i + 1]!;

    const previousRank = getCardRankValue(previousCard);
    const nextRank = getCardRankValue(nextCard);

    let correct: boolean;
    if (guess === 'higher') correct = nextRank > previousRank;
    else if (guess === 'lower') correct = nextRank < previousRank;
    else correct = nextRank === previousRank;

    steps.push({ guess, correct });

    // Step multiplier is computed regardless of correctness (mines-style):
    // it's the fair (house-edge-adjusted) payout for THAT guess on THAT
    // card, independent of what was actually drawn next.
    const stepMultiplier = resolveHiLo(previousCard, guess);
    multiplier *= stepMultiplier;
  }

  const win = steps.every((step) => step.correct);
  const payout = win ? betAmount * multiplier : 0;

  return {
    outcome: { cards: cards as Card[], steps, win },
    multiplier,
    payout,
  };
}

function validateHiLoParams(params: unknown): HiLoParams {
  const result = HiLoParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('hilo', result.error.message);
  }
  return result.data;
}
