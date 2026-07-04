'use client';

import { useEffect } from 'react';
import type { DartsOutcome } from '@/lib/types';
import type { DartsParams } from '@/lib/params';
import { MultiplierChip } from '@/components/games/GameShell';

// Conic-gradient dartboard ported visually from the gameframe-studio-x
// reference; single-reveal (empty params, one throw, no natural staged
// narrative). Rotation/distance come straight from the already-resolved
// outcome -- the dart position/spin isn't randomized client-side.
const ZONE_LEGEND: Array<{ name: DartsOutcome['zone']; multiplier: number }> = [
  { name: 'bullseye', multiplier: 15 },
  { name: 'inner', multiplier: 4 },
  { name: 'middle', multiplier: 1.2 },
  { name: 'outer', multiplier: 0.3 },
  { name: 'rim', multiplier: 0.1 },
];

export function DartsBoard({
  outcome,
  onRevealComplete,
}: {
  outcome: DartsOutcome;
  params?: DartsParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const { distance, rotation, zone } = outcome;
  const angleDeg = rotation * 360;
  // distance is in [0, 0.5) units where 0.5 maps to the board's outer rim.
  const radiusPct = Math.min(distance / 0.5, 1) * 45;

  useEffect(() => {
    onRevealComplete?.();
  }, [onRevealComplete]);

  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-4" data-testid="darts-board">
      <div
        className="relative h-64 w-64 rounded-full ring-8 ring-slate-800"
        style={{
          background:
            'conic-gradient(#f97316 0 20%, #ef4444 20% 40%, #f97316 40% 60%, #ef4444 60% 80%, #f97316 80% 100%)',
        }}
      >
        <div
          className="absolute inset-6 rounded-full ring-4 ring-slate-800"
          style={{
            background:
              'conic-gradient(#0f172a 0 25%, #ef4444 25% 30%, #0f172a 30% 55%, #f97316 55% 60%, #0f172a 60% 100%)',
          }}
        />
        <div className="absolute inset-16 grid place-items-center rounded-full bg-slate-900">
          <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
        </div>
        <div
          data-testid="darts-marker"
          className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
          style={{
            transform: `rotate(${angleDeg}deg) translate(${radiusPct}%) rotate(-${angleDeg}deg)`,
          }}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        Zone: <span className="font-semibold capitalize text-foreground">{zone}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {ZONE_LEGEND.map((z) => (
          <MultiplierChip
            key={z.name}
            value={`${z.name} ${z.multiplier}x`}
            tone={z.name === zone ? 'green' : 'neutral'}
            active={z.name === zone}
          />
        ))}
      </div>
    </div>
  );
}
