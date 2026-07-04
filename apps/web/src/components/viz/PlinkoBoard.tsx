'use client';

import { useEffect, useState } from 'react';
import type { PlinkoOutcome } from '@/lib/types';
import type { PlinkoParams } from '@/lib/params';
import { MultiplierChip } from '@/components/games/GameShell';

const STEP_INTERVAL_MS = 220;

// NOTE: this deliberately switches Plinko's board rendering from the
// previous Canvas-based implementation to plain DOM/CSS, matching the
// gameframe-studio-x reference's dot-pyramid visual. The underlying data
// (outcome.path, a ('left'|'right')[] the server already fully computed)
// is unchanged -- only the rendering technology moved from <canvas> to a
// CSS grid of peg dots + an absolutely-positioned ball div.
export function PlinkoBoard({
  outcome,
  params,
  staged = false,
  onRevealComplete,
}: {
  outcome: PlinkoOutcome;
  params: PlinkoParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const { rows } = params;
  const { path, multiplierIndex } = outcome;

  const [step, setStep] = useState(staged ? 0 : path.length);

  useEffect(() => {
    if (!staged) {
      setStep(path.length);
      return;
    }
    setStep(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= path.length) {
        clearInterval(timer);
        onRevealComplete?.();
      }
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, path]);

  // Ball horizontal position (0-100%) after `step` moves, nudging by a
  // shrinking amount per row so it stays roughly centered over the peg
  // triangle, landing on the slot indicated by multiplierIndex.
  let ballX = 50;
  for (let i = 0; i < step; i++) {
    const nudge = 50 / (rows + 2);
    ballX += path[i] === 'right' ? nudge / 2 : -nudge / 2;
  }
  ballX = Math.min(96, Math.max(4, ballX));
  const ballY = rows === 0 ? 0 : (step / rows) * 82;

  const slotCount = rows + 1;
  const slots = Array.from({ length: slotCount }, (_, i) => i);
  const landed = step >= path.length;

  return (
    <div className="flex h-full min-h-[380px] flex-col" data-testid="plinko-board">
      <div className="relative flex-1">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex justify-center gap-6" style={{ paddingTop: r === 0 ? 12 : 20 }}>
            {Array.from({ length: r + 3 }).map((_, c) => (
              <span key={c} className="h-1.5 w-1.5 rounded-full bg-white/70" />
            ))}
          </div>
        ))}
        <div
          className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] transition-all duration-200"
          style={{ left: `${ballX}%`, top: `${ballY}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1">
        {slots.map((i) => (
          <MultiplierChip
            key={i}
            value={`slot ${i}`}
            tone={landed && i === multiplierIndex ? 'pink' : 'neutral'}
            active={landed && i === multiplierIndex}
          />
        ))}
      </div>
    </div>
  );
}
