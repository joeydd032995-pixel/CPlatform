import { describe, expect, it } from 'vitest';
import { calculateHiloResults, resolveHiLo, resolveHiLoGame } from '../src/hilo.js';
import { getCardRankValue, cardIdToCard, deck } from '../src/deck.js';

const BASE = {
  serverSeed: 'f'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveHiLoGame', () => {
  it('is deterministic for identical inputs', () => {
    const params = { guesses: ['higher' as const] };
    const a = resolveHiLoGame(BASE, params, 100);
    const b = resolveHiLoGame(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects empty guesses', () => {
    expect(() => resolveHiLoGame(BASE, { guesses: [] }, 100)).toThrow();
  });

  it('rejects 52 guesses', () => {
    expect(() =>
      resolveHiLoGame(BASE, { guesses: Array(52).fill('higher') }, 100)
    ).toThrow();
  });

  it('accepts 51 guesses', () => {
    expect(() =>
      resolveHiLoGame(BASE, { guesses: Array(51).fill('equal') }, 100)
    ).not.toThrow();
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveHiLoGame(BASE, { guesses: ['higher'] }, 0)).toThrow();
  });

  it('win = all steps correct; payout = win ? bet*multiplier : 0', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const { outcome, multiplier, payout } = resolveHiLoGame(
        { ...BASE, nonce },
        { guesses: ['higher', 'lower', 'equal'] },
        100
      );
      const win = outcome.steps.every((s) => s.correct);
      expect(outcome.win).toBe(win);
      expect(payout).toBe(win ? 100 * multiplier : 0);
    }
  });

  it('draws guesses.length + 1 cards, a strict prefix of the reference stream', () => {
    const guesses = ['higher', 'lower', 'equal', 'higher'] as const;
    const { outcome } = resolveHiLoGame(BASE, { guesses: [...guesses] }, 100);
    expect(outcome.cards).toHaveLength(guesses.length + 1);

    const reference = calculateHiloResults({ ...BASE, limit: guesses.length + 1 });
    expect(outcome.cards).toEqual(reference);
  });

  it('multi-step multiplier is the product of each step multiplier', () => {
    const guesses = ['higher', 'lower', 'equal'] as const;
    const { outcome, multiplier } = resolveHiLoGame(BASE, { guesses: [...guesses] }, 100);

    let expectedMultiplier = 1;
    for (let i = 0; i < guesses.length; i++) {
      expectedMultiplier *= resolveHiLo(outcome.cards[i]!, guesses[i]!);
    }
    expect(multiplier).toBeCloseTo(expectedMultiplier, 10);
  });
});

describe('resolveHiLo spot values', () => {
  it('higher on an Ace == 0.99 * 52/48', () => {
    expect(resolveHiLo('♦A', 'higher')).toBeCloseTo((0.99 * 52) / 48, 10);
  });

  it('equal == 0.99 * 13 == 12.87', () => {
    expect(resolveHiLo('♦7', 'equal')).toBeCloseTo(12.87, 10);
  });

  it('higher on a King == 0 (auto-loss, legal blind-strategy bet)', () => {
    expect(resolveHiLo('♦K', 'higher')).toBe(0);
  });

  it('lower on an Ace == 0 (auto-loss, legal blind-strategy bet)', () => {
    expect(resolveHiLo('♦A', 'lower')).toBe(0);
  });
});

describe('hilo analytic EV per step', () => {
  it('p * m == 0.99 for every guess type and every rank with p > 0', () => {
    const guesses = ['higher', 'lower', 'equal'] as const;
    for (const card of deck) {
      const rank = getCardRankValue(card);
      for (const guess of guesses) {
        let favorable = 0;
        if (guess === 'higher') favorable = (13 - rank) * 4;
        else if (guess === 'lower') favorable = (rank - 1) * 4;
        else favorable = 4;

        const prob = favorable / 52;
        const multiplier = resolveHiLo(card, guess);
        if (prob > 0) {
          expect(Math.abs(prob * multiplier - 0.99)).toBeLessThan(1e-9);
        } else {
          expect(multiplier).toBe(0);
        }
      }
    }
  });
});

describe('hilo card draw uniformity', () => {
  it('card ids are uniform over 0..51 across 25k rounds', () => {
    const counts = new Array(52).fill(0);
    const rounds = 25000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const [card] = calculateHiloResults({ ...BASE, nonce, limit: 1 });
      const id = deck.indexOf(card!);
      counts[id]++;
    }

    const expected = rounds / 52;
    for (const count of counts) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });

  it('cardIdToCard covers the full 52-card deck', () => {
    for (let id = 0; id < 52; id++) {
      expect(deck.includes(cardIdToCard(id))).toBe(true);
    }
  });
});

describe('hilo MC RTP', () => {
  it('guesses=["equal"] converges near 0.99 over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveHiLoGame(
        { ...BASE, nonce },
        { guesses: ['equal'] },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.99 - 0.03);
    expect(observedRTP).toBeLessThan(0.99 + 0.03);
  });
});
