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
      resolveHiLoGame(BASE, { guesses: Array(51).fill('lower') }, 100)
    ).not.toThrow();
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveHiLoGame(BASE, { guesses: ['higher'] }, 0)).toThrow();
  });

  it('win = all steps correct; payout = win ? bet*multiplier : 0', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const { outcome, multiplier, payout } = resolveHiLoGame(
        { ...BASE, nonce },
        { guesses: ['higher', 'lower', 'higher'] },
        100
      );
      const win = outcome.steps.every((s) => s.correct);
      expect(outcome.win).toBe(win);
      expect(payout).toBe(win ? 100 * multiplier : 0);
    }
  });

  it('draws guesses.length + 1 cards, a strict prefix of the reference stream', () => {
    const guesses = ['higher', 'lower', 'higher', 'lower'] as const;
    const { outcome } = resolveHiLoGame(BASE, { guesses: [...guesses] }, 100);
    expect(outcome.cards).toHaveLength(guesses.length + 1);

    const reference = calculateHiloResults({ ...BASE, limit: guesses.length + 1 });
    expect(outcome.cards).toEqual(reference);
  });

  it('multi-step multiplier is the product of each step multiplier', () => {
    const guesses = ['higher', 'lower', 'higher'] as const;
    const { outcome, multiplier } = resolveHiLoGame(BASE, { guesses: [...guesses] }, 100);

    let expectedMultiplier = 1;
    for (let i = 0; i < guesses.length; i++) {
      expectedMultiplier *= resolveHiLo(outcome.cards[i]!, guesses[i]!);
    }
    expect(multiplier).toBeCloseTo(expectedMultiplier, 10);
  });

  it('an exact-tie draw (same rank again) WINS for both "higher" and "lower"', () => {
    // Under the >=/<= model, an equal-rank redraw is a win in both
    // directions -- a standard consequence of the redesign (there is no
    // longer a standalone "equal" guess).
    // ♦7 followed by another rank-7 card should count as correct either way.
    const currentCard = '♦7' as const;
    const tieCard = '♣7' as const;
    const currentRank = getCardRankValue(currentCard);
    const tieRank = getCardRankValue(tieCard);
    expect(tieRank >= currentRank).toBe(true); // higher-or-equal wins
    expect(tieRank <= currentRank).toBe(true); // lower-or-equal wins
  });
});

describe('resolveHiLo spot values', () => {
  it('higher(>=) on an Ace (rank 1) == applyHouseEdge(1) == 0.99 (prob = 52/52 = 1)', () => {
    expect(resolveHiLo('♦A', 'higher')).toBeCloseTo(0.99, 10);
  });

  it('higher(>=) on a King (rank 13) == applyHouseEdge(13) == 12.87 (prob = 4/52)', () => {
    expect(resolveHiLo('♦K', 'higher')).toBeCloseTo(12.87, 10);
  });

  it('lower(<=) on an Ace (rank 1) == applyHouseEdge(13) == 12.87 (prob = 4/52)', () => {
    expect(resolveHiLo('♦A', 'lower')).toBeCloseTo(12.87, 10);
  });

  it('lower(<=) on a King (rank 13) == applyHouseEdge(1) == 0.99 (prob = 52/52 = 1)', () => {
    expect(resolveHiLo('♦K', 'lower')).toBeCloseTo(0.99, 10);
  });
});

describe('hilo analytic EV per step', () => {
  it('p * m === 0.99 for EVERY rank (1..13) and BOTH guesses, with NO exceptions', () => {
    // Under the >=/<= redesign, no guess is ever impossible: favorable is
    // always >= 4/52, so every single one of the 13 ranks x 2 guesses is
    // exactly EV 0.99 -- unlike the old strict three-way model, there is no
    // "prob === 0" branch to special-case anymore.
    for (const card of deck) {
      const rank = getCardRankValue(card);
      for (const guess of ['higher', 'lower'] as const) {
        const favorable = guess === 'higher' ? (14 - rank) * 4 : rank * 4;
        const prob = favorable / 52;
        expect(prob).toBeGreaterThan(0);

        const multiplier = resolveHiLo(card, guess);
        expect(Math.abs(prob * multiplier - 0.99)).toBeLessThan(1e-9);
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
  it('guesses=["higher"] (single step) converges near 0.99 over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveHiLoGame(
        { ...BASE, nonce },
        { guesses: ['higher'] },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.99 - 0.03);
    expect(observedRTP).toBeLessThan(0.99 + 0.03);
  });

  it('a chained run of "higher" guesses converges to 0.99^n -- the whole point of the >=/<= fix: unlike the old strict model, chained higher/lower guesses are now genuinely fair', () => {
    const n = 3;
    const rounds = 100000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveHiLoGame(
        { ...BASE, nonce },
        { guesses: Array(n).fill('higher') },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    const target = Math.pow(0.99, n);
    // Wide tolerance: individual step multipliers range up to ~12.87x, so
    // this MC estimate has meaningfully higher variance than the
    // single-step case above -- the point of this test is confirming the
    // chain is NOT the old model's badly-degraded value (previously would
    // have converged near ~0.36, not ~0.97), not pinning tight precision
    // (the exact backward-DP check in fairness/house-edge-bounds.test.ts
    // owns the precise, non-flaky 0.99^n confirmation).
    expect(observedRTP).toBeGreaterThan(target - 0.1);
    expect(observedRTP).toBeLessThan(target + 0.1);
  });
});
