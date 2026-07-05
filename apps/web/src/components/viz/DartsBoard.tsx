'use client';

import { useEffect, useState } from 'react';
import type { DartsOutcome } from '@/lib/types';
import type { DartsParams } from '@/lib/params';
import { MultiplierChip } from '@/components/games/GameShell';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

const ZONE_LEGEND: Array<{ name: DartsOutcome['zone']; multiplier: number }> = [
  { name: 'bullseye', multiplier: 15 },
  { name: 'inner', multiplier: 4 },
  { name: 'middle', multiplier: 1.2 },
  { name: 'outer', multiplier: 0.3 },
  { name: 'rim', multiplier: 0.1 },
];

function dartTransform(distance: number, rotation: number): string {
  const angleDeg = rotation * 360;
  const radiusPct = Math.min(distance / 0.5, 1) * 45;
  return `rotate(${angleDeg}deg) translate(${radiusPct}%) rotate(-${angleDeg}deg)`;
}

export function DartsBoard({
  outcome,
  staged = false,
  onRevealComplete,
}: {
  outcome: DartsOutcome;
  params?: DartsParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const skipAnimation = !staged || reducedMotion;
  const { distance, rotation, zone } = outcome;

  const [progress, setProgress] = useState(skipAnimation ? 1 : 0);
  const [landed, setLanded] = useState(skipAnimation);

  useEffect(() => {
    if (skipAnimation) {
      setProgress(1);
      setLanded(true);
      onRevealComplete?.();
      return;
    }

    setProgress(0);
    setLanded(false);
    const { steps, stepMs } = REVEAL_TIMING.darts;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const eased = 1 - (1 - step / steps) ** 2;
      setProgress(eased);
      if (step >= steps) {
        clearInterval(timer);
        setProgress(1);
        setLanded(true);
        onRevealComplete?.();
      }
    }, stepMs);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipAnimation, distance, rotation]);

  const displayDistance = distance * progress;
  const displayRotation = rotation * progress;

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
          className={cn(
            'absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]',
            landed && 'scale-110'
          )}
          style={{
            transform: dartTransform(displayDistance, displayRotation),
            transition: landed ? 'transform 100ms ease-out' : undefined,
          }}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        Zone:{' '}
        <span className="font-semibold capitalize text-foreground">
          {landed ? zone : '…'}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {ZONE_LEGEND.map((z) => (
          <MultiplierChip
            key={z.name}
            value={`${z.name} ${z.multiplier}x`}
            tone={landed && z.name === zone ? 'green' : 'neutral'}
            active={landed && z.name === zone}
          />
        ))}
      </div>
    </div>
  );
}