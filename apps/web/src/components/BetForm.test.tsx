import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BetForm } from './BetForm';

vi.mock('@/lib/api-client', () => ({
  playGame: vi.fn(),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(status: number, body: { code: string; error: string }) {
      super(body.error);
      this.code = body.code;
    }
  },
}));

describe('BetForm', () => {
  it('disables submit and shows an inline error for an invalid bet amount', () => {
    render(
      <BetForm
        game="mines"
        userId="user-1"
        params={{ mines: 3, picks: 1 }}
        onResult={() => {}}
        refreshBalance={async () => {}}
      />
    );

    const input = screen.getByPlaceholderText('Bet Amount');
    fireEvent.change(input, { target: { value: '-5' } });

    const button = screen.getByRole('button', { name: /place bet/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/greater than 0/i)).toBeInTheDocument();
  });

  it('enables submit for a valid bet amount', () => {
    render(
      <BetForm
        game="mines"
        userId="user-1"
        params={{ mines: 3, picks: 1 }}
        onResult={() => {}}
        refreshBalance={async () => {}}
      />
    );

    const input = screen.getByPlaceholderText('Bet Amount');
    fireEvent.change(input, { target: { value: '25' } });

    const button = screen.getByRole('button', { name: /place bet/i });
    expect(button).not.toBeDisabled();
  });
});
