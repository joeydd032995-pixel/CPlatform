'use client';

import type { BlackjackRoundView, Card } from '@/lib/types';
import { handValue } from '@/lib/blackjack-hand-value';
import { cn } from '@/lib/utils';

const RED_SUITS = new Set(['♦', '♥']);

function suitOf(card: Card): string {
  return card.charAt(0);
}

function rankOf(card: Card): string {
  return card.slice(1);
}

function CardFace({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
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

const RESULT_LABEL: Record<string, string> = {
  blackjack: 'Blackjack!',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
};

const RESULT_CLASSES: Record<string, string> = {
  blackjack: 'bg-yellow-600 text-white',
  win: 'bg-emerald-700 text-white',
  push: 'bg-slate-700 text-white',
  lose: 'bg-red-800 text-white',
};

// Round-based Blackjack: the server has already redacted the dealer's hole
// card while the round is OPEN (see roundService.ts's toPublicBlackjackView)
// -- this component doesn't stage/pace a reveal like the one-shot
// BlackjackTable does, it just renders exactly the current server-truth
// state on every render (each action is its own discrete server round-trip,
// not something that needs client-side animation pacing).
export function BlackjackRoundTable({ round }: { round: BlackjackRoundView }) {
  const settled = round.status !== 'OPEN';

  return (
    <div
      className="flex h-full min-h-[380px] flex-col justify-between gap-4 rounded-xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-5 ring-1 ring-emerald-700/40"
      data-testid="blackjack-round-table"
    >
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm text-emerald-100/80">
          Dealer {settled ? `(${handValue(round.dealerCards).total})` : ''}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {round.dealerCards.map((card, index) => (
            <CardFace key={`dealer-${index}`} card={card} />
          ))}
          {!settled && <CardFace hidden />}
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

      <div className="flex flex-col gap-3">
        {round.hands.map((hand, handIndex) => {
          const { total } = handValue(hand.cards);
          const isActive = round.status === 'OPEN' && handIndex === round.activeHandIndex;
          return (
            <div
              key={handIndex}
              className={cn(
                'flex flex-col gap-1 rounded-lg p-1',
                isActive && 'ring-2 ring-brand/60'
              )}
            >
              <span className="text-sm text-emerald-100/80">
                {round.hands.length > 1 ? `Hand ${handIndex + 1} ` : 'Player '}({total})
                {hand.bet !== round.betAmount && ` · $${hand.bet.toFixed(2)}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {hand.cards.map((card, index) => (
                  <CardFace key={`hand-${handIndex}-${index}`} card={card} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {round.insuranceTaken && (
        <span className="w-fit rounded bg-white/10 px-2 py-1 text-xs text-emerald-100/80">
          Insurance: ${round.insuranceBet.toFixed(2)}
        </span>
      )}

      {settled && (
        <div className="flex flex-col gap-1">
          {round.hands.map((hand, index) => {
            if (!hand.result) return null;
            return (
              <span
                key={index}
                data-testid="blackjack-round-result"
                className={cn(
                  'inline-block w-fit rounded px-3 py-1 text-sm font-bold',
                  RESULT_CLASSES[hand.result]
                )}
              >
                {round.hands.length > 1 ? `Hand ${index + 1}: ` : ''}
                {RESULT_LABEL[hand.result]}
                {hand.payout != null && ` ($${hand.payout.toFixed(2)})`}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
