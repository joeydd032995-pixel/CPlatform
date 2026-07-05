import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GamePage } from './GamePage';

// Regression test for a CodeRabbit-caught bug: GamePage's reveal-phase state
// machine only reaches 'done' (which gates ResultOverlay) via each Viz calling
// onRevealComplete. Keno/Darts/Dice/Roulette/Blackjack initially didn't call
// it at all, so phase got stuck at 'revealing' forever. Dice and Keno now
// run short staged reveals; Roulette's wheel spin is the longest animation.

vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    userId: 'user-1',
    balance: 100,
    refreshBalance: vi.fn(async () => {}),
    newIdentity: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  playGame: vi.fn(async (_userId: string, game: string) => {
    const byGame: Record<string, unknown> = {
      keno: {
        outcome: { drawn: [1, 2, 3], hits: [1, 2], hitCount: 2 },
        payout: 12,
        multiplier: 1.2,
        nonce: 1,
        serverSeedHash: 'a'.repeat(64),
      },
      darts: {
        outcome: { distance: 0.1, rotation: 0.2, zone: 'bullseye', zoneIndex: 0 },
        payout: 150,
        multiplier: 15,
        nonce: 1,
        serverSeedHash: 'a'.repeat(64),
      },
      dice: {
        outcome: { roll: 42, target: 50, direction: 'under', win: true },
        payout: 19.8,
        multiplier: 1.98,
        nonce: 1,
        serverSeedHash: 'a'.repeat(64),
      },
      roulette: {
        outcome: {
          result: 7,
          color: 'red',
          win: true,
          bets: [{ betType: 'straight', numbers: [7], amount: 10, win: true, payout: 350 }],
        },
        payout: 350,
        multiplier: 35,
        nonce: 1,
        serverSeedHash: 'a'.repeat(64),
      },
      blackjack: {
        outcome: {
          playerCards: ['♠A', '♥K'],
          dealerCards: ['♦9', '♣8'],
          playerTotal: 21,
          dealerTotal: 17,
          result: 'blackjack',
        },
        payout: 25,
        multiplier: 2.5,
        nonce: 1,
        serverSeedHash: 'a'.repeat(64),
      },
    };
    return byGame[game];
  }),
  getSeeds: vi.fn(async () => ({ clientSeed: 'client-seed' })),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(status: number, body: { code: string; error: string }) {
      super(body.error);
      this.code = body.code;
    }
  },
}));

describe('GamePage reveal flow (previously-broken single-reveal games)', () => {
  it.each(['keno', 'darts', 'dice', 'roulette', 'blackjack'] as const)(
    'reaches phase=done and renders ResultOverlay after a %s bet',
    async (game) => {
      render(<GamePage game={game} />);

      if (game === 'roulette') {
        // Unlike the other games here, Roulette's stake is derived from
        // chips placed on the felt (defaults to an empty `bets: []`, so
        // Play starts disabled) rather than an independently-typed
        // BetForm amount -- place one chip first so the bet is valid.
        const redBox = await screen.findByRole('button', { name: /red bet/i });
        fireEvent.click(redBox);
      }

      const button = await screen.findByRole('button', { name: /^(bet|spin|deal)$/i });
      fireEvent.click(button);

      const timeout =
        game === 'roulette'
          ? 4500
          : game === 'keno' || game === 'dice' || game === 'blackjack' || game === 'darts'
            ? 3000
            : 2000;

      await waitFor(() => expect(screen.getByText('Result')).toBeInTheDocument(), {
        timeout,
      });
      expect(screen.getByText('Verify this bet')).toBeInTheDocument();
    },
    6000
  );
});
