'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useUser } from '@/lib/user-context';
import { gameRegistry, loadGameModule, type GameName } from '@/lib/games';
import type { LoadedGameModule } from '@/features/games/types';
import { RouletteChipProvider } from '@/features/games/roulette/chip-context';
import { playLabelFor } from '@/lib/play-labels';
import { getSeeds } from '@/lib/api-client';
import type { PlayGameResult } from '@/lib/types';
import { BetForm } from '@/components/BetForm';
import { GameShell, ControlsSection } from './GameShell';
import { GameSurface } from './GameSurface';
import { GameSessionHeader } from './GameSessionHeader';
import { GamePageSkeleton } from './GamePageSkeleton';
import { controlsLocked, DEALING_PAUSE_MS, type RevealPhase } from './reveal-phase';
import { cn } from '@/lib/utils';

export function GamePage({ game }: { game: GameName }) {
  const meta = gameRegistry[game];
  const { userId, refreshBalance } = useUser();

  const [gameModule, setGameModule] = useState<LoadedGameModule | null>(null);
  const [params, setParams] = useState(meta.defaults);
  const [result, setResult] = useState<PlayGameResult | null>(null);
  const [clientSeed, setClientSeed] = useState<string>('');
  const [phase, setPhase] = useState<RevealPhase>('idle');

  const locked = controlsLocked(phase);

  useEffect(() => {
    let cancelled = false;
    setGameModule(null);
    void loadGameModule(game).then((mod) => {
      if (!cancelled) setGameModule(mod);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  useEffect(() => {
    setParams(meta.defaults);
    setResult(null);
    setPhase('idle');
  }, [game, meta.defaults]);

  useEffect(() => {
    if (!userId) return;
    getSeeds(userId)
      .then((state) => setClientSeed(state.clientSeed))
      .catch(() => setClientSeed(''));
  }, [userId, result]);

  useEffect(() => {
    if (phase !== 'dealing') return;
    const timer = setTimeout(() => setPhase('revealing'), DEALING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleResult = (next: PlayGameResult) => {
    setResult(next);
    setPhase('dealing');
  };

  if (!gameModule) {
    return <GamePageSkeleton title={meta.label} />;
  }

  const ParamsForm = gameModule.ParamsForm;
  const Viz = gameModule.Viz;

  const shell = (
    <GameShell
      controls={
        <>
          <ControlsSection title={game === 'roulette' ? 'Chips & Bets' : 'Parameters'} locked={locked}>
            <ParamsForm value={params} onChange={setParams} />
          </ControlsSection>

          {userId && (
            <BetForm
              game={game}
              userId={userId}
              params={params}
              paramsSchema={meta.schema}
              onResult={handleResult}
              refreshBalance={refreshBalance}
              derivedBetAmount={meta.deriveBetAmount?.(params)}
              variant="inline"
              disabled={locked}
              playLabel={playLabelFor(game)}
            />
          )}
        </>
      }
      surface={
        <GameSurface
          gameLabel={meta.label}
          game={game}
          phase={phase}
          params={params}
          result={result}
          clientSeed={clientSeed}
          onParamsChange={setParams}
          controlsDisabled={locked}
          Viz={
            Viz as ComponentType<{
              outcome: Record<string, unknown>;
              params: Record<string, unknown>;
              staged?: boolean;
              onRevealComplete?: () => void;
            }>
          }
          onRevealComplete={() => setPhase('done')}
        />
      }
    />
  );

  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 sm:px-6 lg:px-8',
        game === 'roulette' ? 'max-w-7xl' : 'max-w-6xl'
      )}
    >
      <GameSessionHeader title={meta.label} phase={phase} clientSeed={clientSeed} />
      {game === 'roulette' ? <RouletteChipProvider>{shell}</RouletteChipProvider> : shell}
    </div>
  );
}