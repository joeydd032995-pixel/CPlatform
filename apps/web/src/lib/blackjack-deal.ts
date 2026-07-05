import type { Card } from '@/lib/types';

export type BlackjackDealStep = {
  side: 'player' | 'dealer';
  index: number;
};

/** Mirrors packages/games/src/blackjack.ts deal order for staged UI reveals. */
export function buildBlackjackDealSequence(
  playerCards: readonly Card[],
  dealerCards: readonly Card[]
): BlackjackDealStep[] {
  const sequence: BlackjackDealStep[] = [];

  if (playerCards[0]) sequence.push({ side: 'player', index: 0 });
  if (dealerCards[0]) sequence.push({ side: 'dealer', index: 0 });
  if (playerCards[1]) sequence.push({ side: 'player', index: 1 });
  if (dealerCards[1]) sequence.push({ side: 'dealer', index: 1 });

  for (let i = 2; i < playerCards.length; i++) {
    sequence.push({ side: 'player', index: i });
  }
  for (let i = 2; i < dealerCards.length; i++) {
    sequence.push({ side: 'dealer', index: i });
  }

  return sequence;
}

export function visibleCardsForSide(
  sequence: readonly BlackjackDealStep[],
  revealedCount: number,
  side: BlackjackDealStep['side']
): number {
  let maxIndex = -1;
  for (let i = 0; i < revealedCount && i < sequence.length; i++) {
    const step = sequence[i]!;
    if (step.side === side) maxIndex = Math.max(maxIndex, step.index);
  }
  return maxIndex + 1;
}