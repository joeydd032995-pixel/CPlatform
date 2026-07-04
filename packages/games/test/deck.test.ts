import { describe, expect, it } from 'vitest';
import {
  deck,
  cardIdToCard,
  cardToCardId,
  getCardRankValue,
  getCardRank,
  getCardSuit,
  isCard,
} from '../src/deck.js';

describe('deck', () => {
  it('has exactly 52 unique cards', () => {
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('rank values run 1 (A) through 13 (K)', () => {
    expect(getCardRankValue('♦A')).toBe(1);
    expect(getCardRankValue('♦2')).toBe(2);
    expect(getCardRankValue('♦10')).toBe(10);
    expect(getCardRankValue('♦J')).toBe(11);
    expect(getCardRankValue('♦Q')).toBe(12);
    expect(getCardRankValue('♦K')).toBe(13);
  });

  it('round-trips cardId -> card -> cardId for every index', () => {
    for (let id = 0; id < 52; id++) {
      const card = cardIdToCard(id);
      expect(cardToCardId(card)).toBe(id);
    }
  });

  it('round-trips card -> cardId -> card for every card', () => {
    for (const card of deck) {
      const id = cardToCardId(card);
      expect(cardIdToCard(id)).toBe(card);
    }
  });

  it('getCardRank / getCardSuit agree with the card string', () => {
    const card = deck[0]!;
    const rank = getCardRank(card);
    const suit = getCardSuit(card);
    expect(`${suit}${rank}`).toBe(card);
  });

  it('rejects an invalid cardId', () => {
    expect(() => cardIdToCard(52)).toThrow();
    expect(() => cardIdToCard(-1)).toThrow();
  });

  it('isCard distinguishes real cards from garbage strings', () => {
    expect(isCard(deck[0]!)).toBe(true);
    expect(isCard('not-a-card')).toBe(false);
  });
});
