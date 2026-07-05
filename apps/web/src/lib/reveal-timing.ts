// Centralized reveal pacing for staged game visualizations.
// Values align with globals.css motion tokens (--duration-reveal, etc.).

export const REVEAL_TIMING = {
  mines: 300,
  plinko: 220,
  hilo: 500,
  keno: 180,
  chicken: 220,
  blackjack: 320,
  dice: {
    steps: 24,
    stepMs: 35,
  },
  darts: {
    steps: 18,
    stepMs: 28,
  },
  hiloFlipMs: 400,
} as const;

export function diceRollDurationMs(): number {
  return REVEAL_TIMING.dice.steps * REVEAL_TIMING.dice.stepMs;
}

export function dartsThrowDurationMs(): number {
  return REVEAL_TIMING.darts.steps * REVEAL_TIMING.darts.stepMs;
}