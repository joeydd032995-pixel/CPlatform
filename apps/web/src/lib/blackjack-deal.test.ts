import { describe, expect, it } from 'vitest';
import { buildBlackjackDealSequence, visibleCardsForSide } from './blackjack-deal';

describe('buildBlackjackDealSequence', () => {
  it('interleaves initial deal then player hits then dealer hits', () => {
    const player = ['♠A', '♥K', '♦5'] as const;
    const dealer = ['♣9', '♠8', '♥3'] as const;
    const sequence = buildBlackjackDealSequence(player, dealer);

    expect(sequence).toEqual([
      { side: 'player', index: 0 },
      { side: 'dealer', index: 0 },
      { side: 'player', index: 1 },
      { side: 'dealer', index: 1 },
      { side: 'player', index: 2 },
      { side: 'dealer', index: 2 },
    ]);

    expect(visibleCardsForSide(sequence, 2, 'player')).toBe(1);
    expect(visibleCardsForSide(sequence, 4, 'dealer')).toBe(2);
    expect(visibleCardsForSide(sequence, 6, 'player')).toBe(3);
  });
});