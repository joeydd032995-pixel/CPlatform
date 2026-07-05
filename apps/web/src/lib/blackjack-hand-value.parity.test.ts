// node-env test: imports the REAL handValue from '@cplatform/games' at
// runtime (fine here, unlike a browser bundle -- see params.parity.test.ts's
// header comment) and cross-checks it against this file's client-safe
// mirror across representative hands, to catch drift.
import { describe, expect, it } from 'vitest';
import * as real from '@cplatform/games';
import { handValue } from './blackjack-hand-value';
import type { Card } from './types';

describe('blackjack handValue parity', () => {
  // it.each spreads array-of-arrays fixtures as separate callback args, so
  // each hand (itself an array) is wrapped in a single-element tuple here.
  const fixtures: [Card[]][] = [
    [['♦2', '♦5']],
    [['♦K', '♦Q']],
    [['♦A', '♦6']],
    [['♦A', '♦9', '♦5']],
    [['♦A', '♥A', '♦9']],
    [['♦A', '♥A', '♦9', '♠K']],
    [['♠A', '♠A', '♠A', '♠A']],
    [['♣10', '♣J']],
    [['♣2', '♣3', '♣4', '♣5', '♣6']],
  ];

  it.each(fixtures)('%j', (cards) => {
    const realResult = real.handValue(cards);
    const localResult = handValue(cards);
    expect(localResult).toEqual(realResult);
  });
});
