'use client';

import { useEffect, useState } from 'react';
import type { DiceOutcome } from '@/lib/types';
import type { DiceParams } from '@/lib/params';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// Adapted from the gameframe-studio-x reference's TargetGame.tsx shell
// (big colored result number + history-style framing) to Dice's real
// target/direction/roll mechanic -- there's no Dice equivalent in the zip.
export function DiceBar({
  outcome,
  staged = false,
  onRevealComplete,
}: {
  outcome: DiceOutcome;
  params?: DiceParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const skipAnimation = !staged || reducedMotion;
  const { roll, target, direction, win } = outcome;
  const [displayRoll, setDisplayRoll] = useState(skipAnimation ? roll : 0);
  const [rolling, setRolling] = useState(!skipAnimation);

  useEffect(() => {
    if (skipAnimation) {
      setDisplayRoll(roll);
      setRolling(false);
      onRevealComplete?.();
      return;
    }

    setDisplayRoll(0);
    setRolling(true);
    const { steps, stepMs } = REVEAL_TIMING.dice;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const progress = step / steps;
      const eased = 1 - (1 - progress) ** 3;
      setDisplayRoll(roll * eased);
      if (step >= steps) {
        clearInterval(timer);
        setDisplayRoll(roll);
        setRolling(false);
        onRevealComplete?.();
      }
    }, stepMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipAnimation, roll]);

  const winZoneStyle =
    direction === 'over'
      ? { left: `${target}%`, width: `${100 - target}%` }
      : { left: '0%', width: `${target}%` };

  const showResult = !rolling;

  return (
    <div className="flex h-full min-h-[380px] flex-col justify-center gap-6" data-testid="dice-bar">
      <div
        className={`text-center text-6xl font-bold tabular-nums transition-colors duration-200 ${
          showResult ? (win ? 'text-emerald-400' : 'text-red-500') : 'text-foreground'
        }`}
      >
        {displayRoll.toFixed(2)}
      </div>
      <div className="relative h-6 w-full overflow-hidden rounded bg-muted">
        <div
          className="absolute inset-y-0 bg-emerald-700/50"
          style={winZoneStyle}
          data-testid="dice-win-zone"
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-white transition-[left] duration-75"
          style={{ left: `${displayRoll}%` }}
          data-testid="dice-roll-marker"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Target: {direction} {target.toFixed(2)}
        </span>
        {showResult && (
          <span className={win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
            {win ? 'WIN' : 'LOSE'}
          </span>
        )}
      </div>
    </div>
  );
}