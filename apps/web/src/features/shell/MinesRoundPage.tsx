'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { startMinesRound, minesReveal, minesCashOut, getSeeds, ApiError } from '@/lib/api-client';
import type { MinesRoundView } from '@/lib/types';
import { MINES_GAME_TILES_COUNT } from '@/lib/params';
import { GameShell, ControlsSection, PlayButton, SecondaryButton, BetInput } from '@/components/games/GameShell';
import { GameSessionHeader } from './GameSessionHeader';
import { ErrorBoundary } from './ErrorBoundary';
import { MinesRoundGrid } from '@/components/viz/MinesRoundGrid';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RevealPhase } from './reveal-phase';
import { controlsLocked } from './reveal-phase';

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

export function MinesRoundPage() {
  const { userId, refreshBalance } = useUser();
  const [betText, setBetText] = useState('10');
  const [mines, setMines] = useState(3);
  const [round, setRound] = useState<MinesRoundView | null>(null);
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

  const handleStart = async () => {
    if (!userId || !betValid) return;
    setError(null);
    setPhase('action-pending');
    try {
      const started = await startMinesRound(
        userId,
        { betAmount, mines },
        crypto.randomUUID()
      );
      setRound(started);
      setPhase('awaiting-decision');
      await refreshBalance();
    } catch (err) {
      setError(friendlyError(err));
      setPhase('idle');
    }
  };

  const handleReveal = async () => {
    if (!userId || !round) return;
    setError(null);
    setPhase('action-pending');
    try {
      const updated = await minesReveal(userId, round.id, round.version);
      setRound(updated);
      setPhase(updated.status === 'OPEN' ? 'awaiting-decision' : 'done');
      if (updated.status !== 'OPEN') await refreshBalance();
    } catch (err) {
      setError(friendlyError(err));
      setPhase('awaiting-decision');
    }
  };

  const handleCashOut = async () => {
    if (!userId || !round) return;
    setError(null);
    setPhase('action-pending');
    try {
      const updated = await minesCashOut(userId, round.id, round.version);
      setRound(updated);
      setPhase('done');
      await refreshBalance();
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

  const maxPicks = MINES_GAME_TILES_COUNT - mines;

  const shell = (
    <GameShell
      controls={
        <>
          <ControlsSection title="Parameters" locked={locked || !!round}>
            <div>
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
                <span>MINES</span>
                <span>{mines}</span>
              </div>
              <Slider
                min={1}
                max={24}
                step={1}
                value={[mines]}
                onValueChange={(vals) => setMines(vals[0] ?? mines)}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">Up to {maxPicks} safe tiles.</p>
            </div>
          </ControlsSection>

          {!round && userId && (
            <ControlsSection title="Bet" locked={locked}>
              <BetInput text={betText} onTextChange={setBetText} disabled={locked} />
              <PlayButton
                label="START ROUND"
                loadingLabel="STARTING..."
                onClick={handleStart}
                disabled={locked || !betValid}
                loading={phase === 'action-pending'}
              />
            </ControlsSection>
          )}

          {round && round.status === 'OPEN' && (
            <ControlsSection title="This round" locked={false}>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bet</span>
                  <span className="font-mono tabular-nums">${round.betAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revealed</span>
                  <span className="font-mono tabular-nums">{round.revealedTiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Multiplier</span>
                  <span className="font-mono tabular-nums">x{round.currentMultiplier.toFixed(4)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Cash-out value</span>
                  <span className="font-mono tabular-nums">
                    ${(round.betAmount * round.currentMultiplier).toFixed(2)}
                  </span>
                </div>
              </div>
              <PlayButton
                label="REVEAL TILE"
                loadingLabel="REVEALING..."
                onClick={handleReveal}
                disabled={locked}
                loading={phase === 'action-pending'}
              />
              <SecondaryButton
                onClick={handleCashOut}
                disabled={locked || round.revealedTiles.length === 0}
              >
                Cash Out
              </SecondaryButton>
            </ControlsSection>
          )}

          {round && round.status !== 'OPEN' && (
            <ControlsSection title="Result" locked={false}>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outcome</span>
                  <span className="font-semibold">
                    {round.status === 'CASHED_OUT' ? 'Cashed out' : 'Busted'}
                  </span>
                </div>
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
          <MinesRoundGrid
            round={round}
            onReveal={round.status === 'OPEN' ? handleReveal : undefined}
            disabled={locked}
          />
        ) : (
          <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-brand-muted ring-1 ring-brand/20" />
            <p className="text-lg font-semibold tracking-tight">Mines</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Set your bet and mine count, then start the round to begin revealing tiles.
            </p>
          </div>
        )
      }
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <GameSessionHeader title="Mines" phase={phase} clientSeed={clientSeed} />
      <ErrorBoundary>{shell}</ErrorBoundary>
    </div>
  );
}
