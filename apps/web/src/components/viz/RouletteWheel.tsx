'use client';

import { useEffect, useState } from 'react';
import { REAL_RED_NUMBERS } from '@/lib/params';
import { cn } from '@/lib/utils';

// Real physical European single-zero pocket order (NOT numeric order) --
// authenticity detail requested for the visual wheel. Each slice occupies
// 360/37 ~= 9.73deg.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const SLICE_DEG = 360 / WHEEL_ORDER.length;

// baseSpins*360 full turns before landing, purely a cosmetic "how many times
// the wheel visibly spins" knob (6-8 per plan).
const BASE_SPINS = 7;
const SPIN_DURATION_MS = 3500;

function pocketColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return REAL_RED_NUMBERS.has(n) ? 'red' : 'black';
}

const COLOR_HEX: Record<'red' | 'black' | 'green', string> = {
  red: '#dc2626',
  black: '#0f172a',
  green: '#059669',
};

// Angle (deg, clockwise from the 12-o'clock / 0deg reference used by the
// conic-gradient's own 0deg start) at which a given result's slice CENTER
// sits before any spin rotation is applied.
export function angleForResult(result: number): number {
  const index = WHEEL_ORDER.indexOf(result);
  return index * SLICE_DEG + SLICE_DEG / 2;
}

// Presentational, at-rest wheel face (ring + colored pockets + number
// labels). No animation/rotation logic here -- both the idle preview
// (RouletteParamsForm's IdleWheel) and the live spinning wheel below render
// this same piece, the latter wrapped in a rotating container.
export function RouletteWheelFace({
  size = 240,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gradient = WHEEL_ORDER.map((n, i) => {
    const from = i * SLICE_DEG;
    const to = from + SLICE_DEG;
    return `${COLOR_HEX[pocketColor(n)]} ${from}deg ${to}deg`;
  }).join(', ');

  const labelRadius = size / 2 - 16;

  return (
    <div
      className={cn('relative rounded-full ring-4 ring-yellow-600/60 shadow-inner', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      />
      {WHEEL_ORDER.map((n, i) => {
        const angle = i * SLICE_DEG + SLICE_DEG / 2;
        return (
          <div
            key={n}
            className="absolute left-1/2 top-1/2 text-[9px] font-bold leading-none text-white"
            style={{
              transform: `rotate(${angle}deg) translate(0, -${labelRadius}px) rotate(${-angle}deg) translate(-50%, -50%)`,
            }}
          >
            {n}
          </div>
        );
      })}
      <div className="absolute inset-[38%] rounded-full bg-slate-900 ring-2 ring-yellow-600/60" />
    </div>
  );
}

// The spinning wrapper used by RouletteResult. Rendered separately from
// RouletteWheelFace so the idle-state preview never pays for/depends on the
// animation state machine below.
export function RouletteWheel({
  result,
  staged,
  onRevealComplete,
  size = 240,
}: {
  result: number;
  staged?: boolean;
  onRevealComplete?: () => void;
  size?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!staged) {
      // Non-staged fallback (e.g. VerifyForm's reuse of this Viz): render
      // already at rest on the final result, no animation, call
      // onRevealComplete immediately -- matching every other Viz's
      // non-staged fallback (see MinesGrid.tsx/HiLoCards.tsx).
      setAnimate(false);
      setRotation(BASE_SPINS * 360 - angleForResult(result));
      onRevealComplete?.();
      return;
    }

    setAnimate(false);
    setRotation(0);
    // Defer the rotation change to the next frame so the browser registers
    // the "0" starting rotation before the transition to the target kicks
    // in (otherwise the transition can be skipped/collapsed).
    const raf = requestAnimationFrame(() => {
      setAnimate(true);
      setRotation(BASE_SPINS * 360 - angleForResult(result));
    });
    const timer = setTimeout(() => onRevealComplete?.(), SPIN_DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, result]);

  return (
    <div className="relative flex flex-col items-center gap-2" data-testid="roulette-wheel">
      <div className="absolute -top-1 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rotate-45 bg-yellow-400 shadow" />
      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: animate
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.65, 0.2, 1)`
            : 'none',
        }}
      >
        <RouletteWheelFace size={size} />
      </div>
    </div>
  );
}
