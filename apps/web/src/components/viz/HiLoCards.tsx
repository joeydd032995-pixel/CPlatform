import type { HiLoOutcome, Card } from '@/lib/types';
import type { HiLoParams } from '@/lib/params';

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
      data-testid="hilo-card"
      className={`flex h-16 w-12 flex-col items-center justify-center rounded border bg-slate-950 text-lg font-bold ${
        isRed ? 'border-red-700 text-red-500' : 'border-slate-600 text-slate-100'
      }`}
    >
      <span>{rankOf(card)}</span>
      <span>{suit}</span>
    </div>
  );
}

export function HiLoCards({ outcome }: { outcome: HiLoOutcome; params?: HiLoParams }) {
  return (
    <div className="flex flex-col gap-3" data-testid="hilo-cards">
      <div className="flex flex-wrap items-center gap-3">
        {outcome.cards.map((card, index) => {
          const step = outcome.steps[index - 1];
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <CardFace card={card} />
              {step && (
                <span
                  data-testid={`hilo-step-${index - 1}`}
                  className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                    step.correct
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : 'bg-red-900/60 text-red-300'
                  }`}
                >
                  {step.guess} {step.correct ? '✓' : '✗'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <span className={outcome.win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
        {outcome.win ? 'WIN' : 'LOSE'}
      </span>
    </div>
  );
}
