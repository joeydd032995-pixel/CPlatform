'use client';

import type { BlackjackOutcome, Card } from '@/lib/types';
import type { BlackjackParams } from '@/lib/params';
import { buildBlackjackDealSequence, visibleCardsForSide } from '@/lib/blackjack-deal';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useRevealSequence } from '@/hooks/use-reveal-sequence';
import { cn } from '@/lib/utils';

// TEMPORARY: the zip reference's HIT/STAND/SPLIT/DOUBLE button row is
// intentionally NOT ported here. Our backend (packages/games/src/
// blackjack.ts) is a fixed auto-play resolver with zero player decisions --

const RED_SUITS = new Set(['♦', '♥']);

function suitOf(card: Card): string {
  return card.charAt(0);
}

function rankOf(card: Card): string {
  return card.slice(1);
}

function CardFace({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <div
        data-testid="blackjack-card"
        data-hidden="true"
        className="flex h-24 w-16 items-center justify-center rounded-md border border-white/20 bg-gradient-to-br from-violet-900 to-violet-950 font-bold shadow-xl"
      >
        <span className="text-lg text-white/70">?</span>
      </div>
    );
  }

  const suit = suitOf(card);
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      data-testid="blackjack-card"
      className={cn(
        'flex h-24 w-16 flex-col justify-between rounded-md border bg-white p-2 font-bold shadow-xl animate-card-flip-in',
        isRed ? 'text-red-600' : 'text-slate-900'
      )}
    >
      <span className="text-lg leading-none">{rankOf(card)}</span>
      <span className="self-end leading-none">{suit}</span>
    </div>
  );
}

const RESULT_LABEL: Record<BlackjackOutcome['result'], string> = {
  blackjack: 'Blackjack!',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
};

const RESULT_CLASSES: Record<BlackjackOutcome['result'], string> = {
  blackjack: 'bg-yellow-600 text-white',
  win: 'bg-emerald-700 text-white',
  push: 'bg-slate-700 text-white',
  lose: 'bg-red-800 text-white',
};

export function BlackjackTable({
  outcome,
  staged = false,
  onRevealComplete,
}: {
  outcome: BlackjackOutcome;
  params?: BlackjackParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const dealSequence = buildBlackjackDealSequence(outcome.playerCards, outcome.dealerCards);
  const revealedCount = useRevealSequence({
    total: dealSequence.length,
    intervalMs: REVEAL_TIMING.blackjack,
    staged,
    onRevealComplete,
    resetKey: outcome,
  });

  const playerVisible = visibleCardsForSide(dealSequence, revealedCount, 'player');
  const dealerVisible = visibleCardsForSide(dealSequence, revealedCount, 'dealer');
  const dealComplete = revealedCount >= dealSequence.length;

  const holeCardStep = dealSequence.findIndex((step) => step.side === 'dealer' && step.index === 1);
  const showDealerHole = holeCardStep < 0 || revealedCount > holeCardStep;

  const playerCards = outcome.playerCards.slice(0, playerVisible);
  const dealerCards = outcome.dealerCards.slice(0, dealerVisible);

  const playerTotal = dealComplete
    ? outcome.playerTotal
    : playerCards.length > 0
      ? '…'
      : 0;
  const dealerTotal = dealComplete
    ? outcome.dealerTotal
    : dealerCards.length > 0
      ? '…'
      : 0;

  return (
    <div
      className="flex h-full min-h-[380px] flex-col justify-between gap-4 rounded-xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-5 ring-1 ring-emerald-700/40"
      data-testid="blackjack-table"
    >
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm text-emerald-100/80">Dealer ({dealerTotal})</span>
        <div className="flex flex-wrap justify-end gap-2">
          {dealerCards.map((card, index) => (
            <CardFace
              key={`dealer-${index}`}
              card={card}
              hidden={index === 1 && !showDealerHole}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto rounded border border-white/10 bg-black/20 px-6 py-1 text-center">
        <div className="text-[10px] font-bold tracking-widest text-emerald-100/70">
          BLACKJACK PAYS 3 TO 2
        </div>
        <div className="text-[10px] font-bold tracking-widest text-emerald-100/50">
          INSURANCE PAYS 2 TO 1
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-emerald-100/80">Player ({playerTotal})</span>
        <div className="flex flex-wrap gap-2">
          {playerCards.map((card, index) => (
            <CardFace key={`player-${index}`} card={card} />
          ))}
        </div>
      </div>

      {dealComplete && (
        <span
          data-testid="blackjack-result"
          className={cn(
            'inline-block w-fit rounded px-3 py-1 text-sm font-bold',
            RESULT_CLASSES[outcome.result]
          )}
        >
          {RESULT_LABEL[outcome.result]}
        </span>
      )}
    </div>
  );
}