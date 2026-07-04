import type { BlackjackOutcome, Card } from '@/lib/types';
import type { BlackjackParams } from '@/lib/params';

const RED_SUITS = new Set(['♦', '♥']);

function suitOf(card: Card): string {
  return card.charAt(0);
}

function rankOf(card: Card): string {
  return card.slice(1);
}

function CardFace({ card }: { card: Card }) {
  const suit = suitOf(card);
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      data-testid="blackjack-card"
      className={`flex h-16 w-12 flex-col items-center justify-center rounded border bg-slate-950 text-lg font-bold ${
        isRed ? 'border-red-700 text-red-500' : 'border-slate-600 text-slate-100'
      }`}
    >
      <span>{rankOf(card)}</span>
      <span>{suit}</span>
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
}: {
  outcome: BlackjackOutcome;
  params?: BlackjackParams;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="blackjack-table">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Dealer ({outcome.dealerTotal})</span>
        <div className="flex flex-wrap gap-2">
          {outcome.dealerCards.map((card, index) => (
            <CardFace key={`dealer-${index}`} card={card} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Player ({outcome.playerTotal})</span>
        <div className="flex flex-wrap gap-2">
          {outcome.playerCards.map((card, index) => (
            <CardFace key={`player-${index}`} card={card} />
          ))}
        </div>
      </div>

      <span
        data-testid="blackjack-result"
        className={`inline-block w-fit rounded px-3 py-1 text-sm font-bold ${RESULT_CLASSES[outcome.result]}`}
      >
        {RESULT_LABEL[outcome.result]}
      </span>
    </div>
  );
}
