// Card-draw generator (`calculateHiloResults`) ported from
// .claude/skills/game-logic-engineer/references/games/hilo.ts verbatim —
// each card is drawn Math.floor(float * 52) INDEPENDENTLY WITH
// REPLACEMENT from the full 52-card deck (no shrinking deck / shuffle).
// Only the RNG import/naming has been fixed to match the real
// @cplatform/core-rng package. The generator is SACRED and unchanged by the
// redesign below.
//
// Because each draw is independent from the full deck (the same card can
// reappear), the denominator in resolveHiLo is a CONSTANT 52, not a
// shrinking "remaining cards" count.
//
// --- Fairness redesign: "higher-or-equal" (>=) / "lower-or-equal" (<=) ----
//
// INTENTIONAL DEVIATION from the reference `resolveHiLo` in
// games/hilo.ts (Snippets.txt/nuts.gg), which modeled three STRICT guesses
// {higher: (13-rank)*4, lower: (rank-1)*4, equal: 4} for a single-step UI.
// That reference model has a real fairness bug once guesses are chained:
// "higher" on a King (rank 13) has favorable = (13-13)*4 = 0 -- a legal but
// probability-0 auto-loss (EV 0, not 0.99) -- and likewise "lower" on an
// Ace. A multi-step chain that happens to land on a King/Ace mid-sequence
// then loses far more of its EV than the flat 0.99^n a player would
// reasonably expect, because it keeps hitting these impossible
// intermediate states.
//
// The product owner's fix (after a fairness audit) replaces the three-way
// {higher, lower, equal} model with the industry-standard two-way model:
// `higher` means "higher OR equal" (>= current rank) and `lower` means
// "lower OR equal" (<= current rank). Every rank then has favorable >= 4
// (the current rank's own suits always count), so prob is always > 0 and
// EVERY step -- for every rank, both guesses -- is exactly EV 0.99, with NO
// exceptions. This is what makes an n-step chain of the same guess
// telescope to exactly 0.99^n instead of collapsing on unlucky intermediate
// cards. Under this model, an exact tie (drawing the same rank again) now
// WINS for both directions -- a standard, expected consequence of the
// >=/<= design (there is no longer a standalone "equal" guess).

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

export type HiLoGuess = 'higher' | 'lower';

export const resolveHiLo = (
  currentCard: Card,
  guess: HiLoGuess,
  remainingCards: number = 52
): number => {
  const rank = getCardRankValue(currentCard);
  // `higher` = "higher or equal" (>= current rank, including the current
  // rank's other 3 suits); `lower` = "lower or equal" (<= current rank).
  // Both always include the current rank itself, so favorable is always
  // >= 4 -- no guess is ever impossible.
  const favorable = guess === 'higher' ? (14 - rank) * 4 : rank * 4;

  const prob = favorable / remainingCards;
  // `prob` is now ALWAYS > 0 (minimum 4/52, e.g. "higher" on a King or
  // "lower" on an Ace), so the `prob > 0` branch below is unreachable in
  // practice. Kept defensively (rather than dropped) in case a future
  // caller passes a non-default `remainingCards` of 0 or a corrupted rank.
  return prob > 0 ? applyHouseEdge(1 / prob, HILO_HOUSE_EDGE) : 0;
};

// --- Params / resolve ------------------------------------------------------

export const HiLoGuessSchema = z.enum(['higher', 'lower']);

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

    // `higher` wins on >= (an equal draw wins); `lower` wins on <=.
    const correct =
      guess === 'higher' ? nextRank >= previousRank : nextRank <= previousRank;

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
