import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BlackjackRoundPage } from './BlackjackRoundPage';

vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    userId: 'user-1',
    balance: 1000,
    refreshBalance: vi.fn(async () => {}),
    newIdentity: vi.fn(),
  }),
}));

const startBlackjackRound = vi.fn();
const blackjackAction = vi.fn();

vi.mock('@/lib/api-client', () => ({
  startBlackjackRound: (...args: unknown[]) => startBlackjackRound(...args),
  blackjackAction: (...args: unknown[]) => blackjackAction(...args),
  getSeeds: vi.fn(async () => ({ clientSeed: 'client-seed' })),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(status: number, body: { code: string; error: string }) {
      super(body.error);
      this.code = body.code;
    }
  },
}));

describe('BlackjackRoundPage', () => {
  it('runs deal -> stand, showing the result and a Play Again button', async () => {
    startBlackjackRound.mockResolvedValueOnce({
      id: 'round-1',
      game: 'blackjack',
      status: 'OPEN',
      betAmount: 10,
      hands: [{ cards: ['♠5', '♥9'], bet: 10, status: 'active' }],
      activeHandIndex: 0,
      dealerCards: ['♣7'],
      insuranceTaken: false,
      insuranceBet: 0,
      canHit: true,
      canStand: true,
      canDouble: true,
      canSplit: false,
      canTakeInsurance: false,
      payout: null,
      version: 0,
    });
    blackjackAction.mockResolvedValueOnce({
      id: 'round-1',
      game: 'blackjack',
      status: 'SETTLED',
      betAmount: 10,
      hands: [
        {
          cards: ['♠5', '♥9'],
          bet: 10,
          status: 'stood',
          result: 'win',
          payout: 19.8,
        },
      ],
      activeHandIndex: 0,
      dealerCards: ['♣7', '♦8'],
      insuranceTaken: false,
      insuranceBet: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canTakeInsurance: false,
      payout: 19.8,
      version: 1,
    });

    render(<BlackjackRoundPage />);

    const dealButton = await screen.findByRole('button', { name: /deal/i });
    fireEvent.click(dealButton);

    const standButton = await screen.findByRole('button', { name: /^stand$/i });
    await waitFor(() => expect(standButton).not.toBeDisabled());
    fireEvent.click(standButton);

    await screen.findByRole('button', { name: /play again/i });
    expect(startBlackjackRound).toHaveBeenCalledWith('user-1', { betAmount: 10 }, expect.any(String));
    expect(blackjackAction).toHaveBeenCalledWith('user-1', 'round-1', 0, 'stand');
    expect(screen.getByText(/win/i)).toBeInTheDocument();
  });

  it('renders an immediately-settled natural without crashing', async () => {
    startBlackjackRound.mockResolvedValueOnce({
      id: 'round-2',
      game: 'blackjack',
      status: 'SETTLED',
      betAmount: 10,
      hands: [
        {
          cards: ['♠A', '♥K'],
          bet: 10,
          status: 'stood',
          result: 'blackjack',
          payout: 24.75,
        },
      ],
      activeHandIndex: 0,
      dealerCards: ['♣7', '♦8'],
      insuranceTaken: false,
      insuranceBet: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canTakeInsurance: false,
      payout: 24.75,
      version: 0,
    });

    render(<BlackjackRoundPage />);

    const dealButton = await screen.findByRole('button', { name: /deal/i });
    fireEvent.click(dealButton);

    await screen.findByRole('button', { name: /play again/i });
    expect(screen.getByText(/blackjack!/i)).toBeInTheDocument();
  });
});
