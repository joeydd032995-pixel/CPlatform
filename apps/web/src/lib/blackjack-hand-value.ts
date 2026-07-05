import type { Card } from '@/lib/types';

// Client-side mirror of packages/games/src/blackjack.ts's handValue/
// getCardRankValue (never imported at runtime -- see lib/params.ts's header
// comment for why: @cplatform/games pulls in Node's `crypto` via
// @cplatform/core-rng, which can't ship in a client bundle). Used only to
// display a running hand total for the round-based Blackjack table; the
// server's own computation is always the authority for settlement.
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardRankValue(card: Card): number {
  const rank = card.slice(1);
  const index = RANKS.indexOf(rank);
  return index + 1; // 1 (Ace) through 13 (King)
}

export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    const rank = cardRankValue(card);
    if (rank === 1) {
      aceCount += 1;
      total += 1;
    } else {
      total += Math.min(rank, 10);
    }
  }

  if (aceCount > 0 && total + 10 <= 21) {
    return { total: total + 10, soft: true };
  }
  return { total, soft: false };
}
