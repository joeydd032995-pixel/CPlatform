'use client';

import type { ComponentType } from 'react';
import type { PlayGameResult } from '@/lib/types';
import type { RouletteParams } from '@/lib/params';
import { RouletteFelt } from '@/components/viz/RouletteFelt';
import { RouletteWheelFace } from '@/components/viz/RouletteWheel';
import type { RevealPhase } from './reveal-phase';
import { DealingSkeleton } from './DealingSkeleton';
import { ResultOverlay } from './ResultOverlay';

type VizComponent = ComponentType<{
  outcome: Record<string, unknown>;
  params: Record<string, unknown>;
  staged?: boolean;
  onRevealComplete?: () => void;
}>;

export function GameSurface({
  gameLabel,
  game,
  phase,
  params,
  result,
  clientSeed,
  Viz,
  onRevealComplete,
  onParamsChange,
  controlsDisabled = false,
}: {
  gameLabel: string;
  game: string;
  phase: RevealPhase;
  params: Record<string, unknown>;
  result: PlayGameResult | null;
  clientSeed: string;
  Viz: VizComponent;
  onRevealComplete: () => void;
  onParamsChange?: (params: Record<string, unknown>) => void;
  controlsDisabled?: boolean;
}) {
  if (!result) {
    if (game === 'roulette' && onParamsChange) {
      return (
        <div className="flex h-full min-h-[380px] w-full flex-col items-center gap-4 overflow-x-auto pb-2">
          <RouletteWheelFace size={150} className="shrink-0" />
          <RouletteFelt
            value={params as RouletteParams}
            onChange={(next) => onParamsChange(next)}
            disabled={controlsDisabled}
          />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-muted ring-1 ring-brand/20" />
        <p className="text-lg font-semibold tracking-tight">{gameLabel}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Configure your bet in the panel, then place it to play.
        </p>
      </div>
    );
  }

  if (phase === 'dealing') {
    return <DealingSkeleton game={game} />;
  }

  return (
    <div className="relative flex min-h-[380px] w-full flex-col overflow-x-auto overflow-y-visible">
      <Viz
        outcome={result.outcome as unknown as Record<string, unknown>}
        params={params}
        staged={phase === 'revealing'}
        onRevealComplete={onRevealComplete}
      />
      {phase === 'done' && (
        <ResultOverlay
          result={result}
          game={game}
          clientSeed={clientSeed}
          params={params}
        />
      )}
    </div>
  );
}