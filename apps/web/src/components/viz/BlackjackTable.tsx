import type { BlackjackOutcome, Card } from '@/lib/types';
import type { BlackjackParams } from '@/lib/params';
import { cn } from '@/lib/utils';

// TEMPORARY: the zip reference's HIT/STAND/SPLIT/DOUBLE button row is
// intentionally NOT ported here. Our backend (packages/games/src/
// blackjack.ts) is a fixed auto-play resolver with zero player decisions --
// it takes an empty params object and returns the fully-played-out hand in
// one response. The single action available is the shared BetForm's
// "PLACE BET" button (this game's "Deal"), which triggers that one-shot
// resolve and this component then reveals both fully-played hands. Replace
// this note + the missing button row with real HIT/STAND/SPLIT/DOUBLE
// wiring once a round-state backend (mid-hand player decisions) exists.

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
      className={cn(
        'flex h-24 w-16 flex-col justify-between rounded-md border bg-white p-2 font-bold shadow-xl',
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
}: {
  outcome: BlackjackOutcome;
  params?: BlackjackParams;
}) {
  return (
    <div className="flex h-full min-h-[380px] flex-col justify-between gap-4" data-testid="blackjack-table">
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm text-muted-foreground">Dealer ({outcome.dealerTotal})</span>
        <div className="flex flex-wrap justify-end gap-2">
          {outcome.dealerCards.map((card, index) => (
            <CardFace key={`dealer-${index}`} card={card} />
          ))}
        </div>
      </div>

      <div className="mx-auto rounded border border-white/10 bg-white/5 px-6 py-1 text-center">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground">
          BLACKJACK PAYS 3 TO 2
        </div>
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground/60">
          INSURANCE PAYS 2 TO 1
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Player ({outcome.playerTotal})</span>
        <div className="flex flex-wrap gap-2">
          {outcome.playerCards.map((card, index) => (
            <CardFace key={`player-${index}`} card={card} />
          ))}
        </div>
      </div>

      <span
        data-testid="blackjack-result"
        className={cn(
          'inline-block w-fit rounded px-3 py-1 text-sm font-bold',
          RESULT_CLASSES[outcome.result]
        )}
      >
        {RESULT_LABEL[outcome.result]}
      </span>
    </div>
  );
}
