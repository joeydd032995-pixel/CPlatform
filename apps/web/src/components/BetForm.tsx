'use client';

import { useState } from 'react';
import type { ZodType } from 'zod';
import { toast } from 'sonner';
import { BetAmountSchema } from '@/lib/params';
import { playLoadingLabel } from '@/lib/play-labels';
import { playGame, ApiError } from '@/lib/api-client';
import type { PlayGameResult } from '@/lib/types';
import type { GameName } from '@/lib/games';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BetInput, PlayButton } from '@/components/games/GameShell';

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
  paramsSchema,
  onResult,
  refreshBalance,
  derivedBetAmount,
  variant = 'card',
  disabled = false,
  playLabel = 'PLACE BET',
}: {
  game: GameName;
  userId: string;
  params: unknown;
  paramsSchema?: ZodType;
  onResult: (result: PlayGameResult) => void;
  refreshBalance: () => Promise<void>;
  derivedBetAmount?: number;
  variant?: 'card' | 'inline';
  disabled?: boolean;
  playLabel?: string;
}) {
  const [betAmountText, setBetAmountText] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const hasDerivedAmount = derivedBetAmount !== undefined;
  const betAmount = hasDerivedAmount ? derivedBetAmount : Number(betAmountText);
  const betAmountResult = BetAmountSchema.safeParse(betAmount);
  const betAmountError = betAmountResult.success
    ? null
    : (betAmountResult.error.issues[0]?.message ?? 'Invalid bet amount');

  const paramsParsed = paramsSchema?.safeParse(params);
  const paramsValid = paramsSchema === undefined || (paramsParsed?.success ?? false);
  const paramsError =
    paramsParsed && !paramsParsed.success
      ? (paramsParsed.error.issues[0]?.message ?? 'Invalid game parameters')
      : null;

  const canSubmit = betAmountResult.success && paramsValid && !loading && !disabled;

  const handleBet = async () => {
    if (!betAmountResult.success || !paramsValid) return;
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
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      const message = friendlyError(err);
      setError(message);
      toast.error(message);
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_BALANCE') {
          await refreshBalance();
        }
        setIdempotencyKey(crypto.randomUUID());
      }
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <div className="flex flex-col gap-4">
      {hasDerivedAmount ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border">
            <span className="text-muted-foreground">Total stake</span>
            <span className="font-mono font-semibold tabular-nums">{derivedBetAmount}</span>
          </div>
          {betAmountError && <span className="text-xs text-destructive">{betAmountError}</span>}
        </div>
      ) : (
        <BetInput
          text={betAmountText}
          onTextChange={setBetAmountText}
          error={betAmountError}
          disabled={disabled}
        />
      )}

      {paramsError && <span className="text-xs text-destructive">{paramsError}</span>}

      <PlayButton
        label={playLabel}
        loadingLabel={playLoadingLabel(playLabel)}
        onClick={handleBet}
        disabled={!canSubmit}
        loading={loading}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <section
        className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/30 p-4"
        aria-busy={disabled}
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Place Bet
        </h2>
        {formBody}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place Bet</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}