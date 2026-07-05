import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MinesRoundPage } from './MinesRoundPage';

vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    userId: 'user-1',
    balance: 1000,
    refreshBalance: vi.fn(async () => {}),
    newIdentity: vi.fn(),
  }),
}));

const startMinesRound = vi.fn();
const minesReveal = vi.fn();
const minesCashOut = vi.fn();

vi.mock('@/lib/api-client', () => ({
  startMinesRound: (...args: unknown[]) => startMinesRound(...args),
  minesReveal: (...args: unknown[]) => minesReveal(...args),
  minesCashOut: (...args: unknown[]) => minesCashOut(...args),
  getSeeds: vi.fn(async () => ({ clientSeed: 'client-seed' })),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(status: number, body: { code: string; error: string }) {
      super(body.error);
      this.code = body.code;
    }
  },
}));

describe('MinesRoundPage', () => {
  it('runs start -> reveal -> cash out, showing the result and a Play Again button', async () => {
    startMinesRound.mockResolvedValueOnce({
      id: 'round-1',
      game: 'mines',
      status: 'OPEN',
      betAmount: 10,
      mines: 3,
      revealedTiles: [],
      minePositions: null,
      currentMultiplier: 1,
      payout: null,
      version: 0,
    });
    minesReveal.mockResolvedValueOnce({
      id: 'round-1',
      game: 'mines',
      status: 'OPEN',
      betAmount: 10,
      mines: 3,
      revealedTiles: [7],
      minePositions: null,
      currentMultiplier: 1.2,
      payout: null,
      version: 1,
    });
    minesCashOut.mockResolvedValueOnce({
      id: 'round-1',
      game: 'mines',
      status: 'CASHED_OUT',
      betAmount: 10,
      mines: 3,
      revealedTiles: [7],
      minePositions: [2, 4, 9],
      currentMultiplier: 1.2,
      payout: 12,
      version: 2,
    });

    render(<MinesRoundPage />);

    const startButton = await screen.findByRole('button', { name: /start round/i });
    fireEvent.click(startButton);

    const revealButton = await screen.findByRole('button', { name: /reveal tile/i });
    fireEvent.click(revealButton);

    const cashOutButton = await screen.findByRole('button', { name: /cash out/i });
    await waitFor(() => expect(cashOutButton).not.toBeDisabled());
    fireEvent.click(cashOutButton);

    await screen.findByRole('button', { name: /play again/i });
    expect(startMinesRound).toHaveBeenCalledWith('user-1', { betAmount: 10, mines: 3 }, expect.any(String));
    expect(minesCashOut).toHaveBeenCalledWith('user-1', 'round-1', 1);
  });

  it('shows a bust result without crashing', async () => {
    startMinesRound.mockResolvedValueOnce({
      id: 'round-2',
      game: 'mines',
      status: 'OPEN',
      betAmount: 10,
      mines: 24,
      revealedTiles: [],
      minePositions: null,
      currentMultiplier: 1,
      payout: null,
      version: 0,
    });
    minesReveal.mockResolvedValueOnce({
      id: 'round-2',
      game: 'mines',
      status: 'BUSTED',
      betAmount: 10,
      mines: 24,
      revealedTiles: [3],
      minePositions: Array.from({ length: 24 }, (_, i) => i).filter((n) => n !== 3),
      currentMultiplier: 1,
      payout: 0,
      version: 1,
    });

    render(<MinesRoundPage />);

    const startButton = await screen.findByRole('button', { name: /start round/i });
    fireEvent.click(startButton);

    const revealButton = await screen.findByRole('button', { name: /reveal tile/i });
    fireEvent.click(revealButton);

    await screen.findByRole('button', { name: /play again/i });
    expect(screen.getByText('Busted')).toBeInTheDocument();
  });
});
