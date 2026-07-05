'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { startBlackjackRound, blackjackAction, getSeeds, ApiError } from '@/lib/api-client';
import type { BlackjackRoundView, BlackjackAction } from '@/lib/types';
import { GameShell, ControlsSection, PlayButton, SecondaryButton, BetInput } from '@/components/games/GameShell';
import { GameSessionHeader } from './GameSessionHeader';
import { ErrorBoundary } from './ErrorBoundary';
import { BlackjackRoundTable } from '@/components/viz/BlackjackRoundTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RevealPhase } from './reveal-phase';
import { controlsLocked } from './reveal-phase';

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

export function BlackjackRoundPage() {
  const { userId, refreshBalance } = useUser();
  const [betText, setBetText] = useState('10');
  const [round, setRound] = useState<BlackjackRoundView | null>(null);
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState('');

  const locked = controlsLocked(phase);

  useEffect(() => {
    if (!userId) return;
    getSeeds(userId)
      .then((state) => setClientSeed(state.clientSeed))
      .catch(() => setClientSeed(''));
  }, [userId, round?.status]);

  const betAmount = Number(betText);
  const betValid = Number.isFinite(betAmount) && betAmount > 0;

  const handleDeal = async () => {
    if (!userId || !betValid) return;
    setError(null);
    setPhase('action-pending');
    try {
      const started = await startBlackjackRound(userId, { betAmount }, crypto.randomUUID());
      setRound(started);
      setPhase(started.status === 'OPEN' ? 'awaiting-decision' : 'done');
      await refreshBalance();
    } catch (err) {
      setError(friendlyError(err));
      setPhase('idle');
    }
  };

  const handleAction = async (action: BlackjackAction) => {
    if (!userId || !round) return;
    setError(null);
    setPhase('action-pending');
    try {
      const updated = await blackjackAction(userId, round.id, round.version, action);
      setRound(updated);
      setPhase(updated.status === 'OPEN' ? 'awaiting-decision' : 'done');
      if (updated.status !== 'OPEN') await refreshBalance();
      else if (action === 'double' || action === 'split' || action === 'insurance') {
        await refreshBalance();
      }
    } catch (err) {
      setError(friendlyError(err));
      setPhase('awaiting-decision');
    }
  };

  const handlePlayAgain = () => {
    setRound(null);
    setError(null);
    setPhase('idle');
  };

  const shell = (
    <GameShell
      controls={
        <>
          {!round && userId && (
            <ControlsSection title="Bet" locked={locked}>
              <BetInput text={betText} onTextChange={setBetText} disabled={locked} />
              <PlayButton
                label="DEAL"
                loadingLabel="DEALING..."
                onClick={handleDeal}
                disabled={locked || !betValid}
                loading={phase === 'action-pending'}
              />
            </ControlsSection>
          )}

          {round && round.status === 'OPEN' && (
            <ControlsSection title="Your move" locked={false}>
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton onClick={() => handleAction('hit')} disabled={locked || !round.canHit}>
                  Hit
                </SecondaryButton>
                <SecondaryButton onClick={() => handleAction('stand')} disabled={locked || !round.canStand}>
                  Stand
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => handleAction('double')}
                  disabled={locked || !round.canDouble}
                >
                  Double
                </SecondaryButton>
                <SecondaryButton onClick={() => handleAction('split')} disabled={locked || !round.canSplit}>
                  Split
                </SecondaryButton>
              </div>
              {round.canTakeInsurance && (
                <SecondaryButton
                  onClick={() => handleAction('insurance')}
                  disabled={locked || !round.canTakeInsurance}
                >
                  Take Insurance (${(round.hands[0]!.bet / 2).toFixed(2)})
                </SecondaryButton>
              )}
            </ControlsSection>
          )}

          {round && round.status !== 'OPEN' && (
            <ControlsSection title="Result" locked={false}>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Payout</span>
                  <span className="font-mono tabular-nums">${(round.payout ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <PlayButton label="PLAY AGAIN" onClick={handlePlayAgain} />
            </ControlsSection>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </>
      }
      surface={
        round ? (
          <BlackjackRoundTable round={round} />
        ) : (
          <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-brand-muted ring-1 ring-brand/20" />
            <p className="text-lg font-semibold tracking-tight">Blackjack</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Set your bet, then deal to start making real hit/stand/double/split decisions.
            </p>
          </div>
        )
      }
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <GameSessionHeader title="Blackjack" phase={phase} clientSeed={clientSeed} />
      <ErrorBoundary>{shell}</ErrorBoundary>
    </div>
  );
}
