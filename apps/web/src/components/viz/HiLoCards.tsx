'use client';

import { useState } from 'react';
import type { HiLoOutcome, Card } from '@/lib/types';
import type { HiLoGuess, HiLoParams } from '@/lib/params';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useRevealSequence } from '@/hooks/use-reveal-sequence';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

const RED_SUITS = new Set(['♦', '♥']);

// `higher` = "higher or equal" (>= current rank); `lower` = "lower or equal"
// (<= current rank). A tied redraw wins both directions -- there is no
// standalone "equal" guess.
const GUESS_SYMBOLS: Record<HiLoGuess, string> = {
  higher: '≥ Higher or equal',
  lower: '≤ Lower or equal',
};

function suitOf(card: Card): string {
  return card.charAt(0);
}

function rankOf(card: Card): string {
  return card.slice(1);
}

function CardFace({
  card,
  big = false,
  flipIn = false,
}: {
  card: Card;
  big?: boolean;
  flipIn?: boolean;
}) {
  const suit = suitOf(card);
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      data-testid="hilo-card"
      className={cn(
        'flex flex-col items-center justify-center rounded-md border bg-white font-bold shadow',
        big ? 'h-24 w-16 text-2xl' : 'h-16 w-12 text-lg',
        isRed ? 'text-red-600' : 'text-slate-900',
        flipIn && 'animate-card-flip-in'
      )}
    >
      <span>{rankOf(card)}</span>
      <span>{suit}</span>
    </div>
  );
}

// Staged reveal: the server already returned the full card sequence and
// every step's correctness in one response. This animates showing cards[0]
// as "current", then stepping through outcome.steps/cards[1..] one at a
// time, stopping early at the first incorrect step (matches outcome.win).
export function HiLoCards({
  outcome,
  staged = false,
  onRevealComplete,
}: {
  outcome: HiLoOutcome;
  params?: HiLoParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [latestFlipKey, setLatestFlipKey] = useState(0);

  const revealedSteps = useRevealSequence({
    total: outcome.steps.length,
    intervalMs: REVEAL_TIMING.hilo,
    staged,
    onRevealComplete,
    resetKey: outcome,
    onStep: () => setLatestFlipKey((key) => key + 1),
  });

  const visibleCardCount = Math.min(revealedSteps + 1, outcome.cards.length);
  const visibleCards = outcome.cards.slice(0, visibleCardCount);

  return (
    <div className="flex h-full min-h-[380px] flex-col gap-4" data-testid="hilo-cards">
      <div className="flex flex-wrap items-end gap-3">
        {visibleCards.map((card, index) => {
          const step = outcome.steps[index - 1];
          const isLatest = index === visibleCards.length - 1;
          const shouldFlip = staged && !reducedMotion && isLatest && index > 0;

          return (
            <div
              key={`${index}-${isLatest && shouldFlip ? latestFlipKey : 0}`}
              className="flex flex-col items-center gap-1"
            >
              <CardFace card={card} big={isLatest} flipIn={shouldFlip} />
              {step && (
                <span
                  data-testid={`hilo-step-${index - 1}`}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-semibold',
                    step.correct
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : 'bg-red-900/60 text-red-300'
                  )}
                >
                  {GUESS_SYMBOLS[step.guess]} {step.correct ? '✓' : '✗'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {revealedSteps >= outcome.steps.length && (
        <span className={outcome.win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
          {outcome.win ? 'WIN' : 'LOSE'}
        </span>
      )}
    </div>
  );
}