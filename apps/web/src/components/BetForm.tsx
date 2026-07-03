'use client';

import { useState } from 'react';
import { BetAmountSchema } from '@/lib/params';
import { playGame, ApiError } from '@/lib/api-client';
import type { PlayGameResult } from '@/lib/types';
import type { GameName } from '@/lib/games';

// Maps ApiError codes to friendly, non-technical copy. Falls back to the
// server's own message for anything not explicitly listed (e.g.
// VALIDATION_ERROR issues, which are already human-readable).
const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Insufficient balance for this bet.',
  INVALID_BET_AMOUNT: 'That bet amount is not valid.',
  INVALID_BET_PARAMS: 'Those game parameters are not valid.',
  UNKNOWN_GAME: 'That game is not available.',
  GAME_NOT_AVAILABLE: 'This game is not available in your jurisdiction.',
  IDEMPOTENCY_CONFLICT: 'A previous bet with this request is still processing — please wait.',
  RATE_LIMITED: 'Too many requests — please slow down.',
  UNAUTHENTICATED: 'You need an identity to play — please refresh the page.',
};

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.code] ?? err.message;
  }
  return 'Something went wrong placing that bet. Please try again.';
}

export function BetForm({
  game,
  userId,
  params,
  onResult,
  refreshBalance,
}: {
  game: GameName;
  userId: string;
  params: unknown;
  onResult: (result: PlayGameResult) => void;
  refreshBalance: () => Promise<void>;
}) {
  const [betAmount, setBetAmount] = useState(10);
  const [betAmountText, setBetAmountText] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generated per new user-initiated bet; reused across retries of the same
  // in-flight/failed attempt so the server's idempotency store can dedupe a
  // flaky-network retry into a single bet.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const betAmountResult = BetAmountSchema.safeParse(betAmount);
  const betAmountError = betAmountResult.success
    ? null
    : betAmountResult.error.issues[0]?.message ?? 'Invalid bet amount';

  const canSubmit = betAmountResult.success && !loading;

  const handleBetAmountChange = (text: string) => {
    setBetAmountText(text);
    const parsed = Number(text);
    setBetAmount(parsed);
  };

  const handleBet = async () => {
    if (!betAmountResult.success) return;
    setLoading(true);
    setError(null);
    try {
      const result = await playGame(
        userId,
        game,
        { betAmount: betAmountResult.data, params },
        idempotencyKey
      );
      onResult(result);
      await refreshBalance();
      // Bet succeeded -- the next bet is a new, user-initiated action, so it
      // gets a fresh idempotency key.
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(friendlyError(err));
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_BALANCE') {
          await refreshBalance();
        }
        // The server definitively responded with an error, so no bet was
        // created — but its idempotency store may hold a "pending" marker
        // for this key for up to a minute. A corrected retry (lower amount,
        // fixed params) must therefore use a FRESH key, or it would bounce
        // off a spurious 409 conflict. Regenerating here is safe precisely
        // because a definitive error response means no duplicate can exist.
        setIdempotencyKey(crypto.randomUUID());
      }
      // On a network-level failure (no server response), the outcome is
      // unknown — the bet may have been created. Deliberately keep the same
      // idempotencyKey so a retry is deduped by the server rather than
      // creating a duplicate bet.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-xl font-bold text-slate-100">Place Bet</h2>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Bet Amount
        <input
          type="number"
          value={betAmountText}
          onChange={(e) => handleBetAmountChange(e.target.value)}
          className={`rounded border p-2 text-slate-100 ${
            betAmountError ? 'border-red-600 bg-red-950/30' : 'border-slate-700 bg-slate-950'
          }`}
          placeholder="Bet Amount"
        />
        {betAmountError && <span className="text-xs text-red-400">{betAmountError}</span>}
      </label>

      <button
        onClick={handleBet}
        disabled={!canSubmit}
        className="rounded bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Placing Bet...' : 'Place Bet'}
      </button>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
