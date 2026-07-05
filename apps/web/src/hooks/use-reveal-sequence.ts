'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type UseRevealSequenceOptions = {
  /** Final step count (animation runs from 0 → total). */
  total: number;
  intervalMs: number;
  staged?: boolean;
  onRevealComplete?: () => void;
  /** Called after each step increment (1-based step index). */
  onStep?: (step: number) => void;
  /** Changing this restarts the sequence (e.g. new outcome identity). */
  resetKey?: unknown;
};

/**
 * Shared staged-reveal driver. Honors `staged` and prefers-reduced-motion:
 * when animation is skipped, jumps to `total` and calls `onRevealComplete` once.
 */
export function useRevealSequence({
  total,
  intervalMs,
  staged = false,
  onRevealComplete,
  onStep,
  resetKey,
}: UseRevealSequenceOptions): number {
  const reducedMotion = useReducedMotion();
  const skipAnimation = !staged || reducedMotion;
  const [count, setCount] = useState(() => (skipAnimation ? total : 0));
  const onCompleteRef = useRef(onRevealComplete);
  const onStepRef = useRef(onStep);
  onCompleteRef.current = onRevealComplete;
  onStepRef.current = onStep;

  useEffect(() => {
    if (skipAnimation) {
      setCount(total);
      onCompleteRef.current?.();
      return;
    }

    setCount(0);
    if (total === 0) {
      onCompleteRef.current?.();
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setCount(index);
      onStepRef.current?.(index);
      if (index >= total) {
        clearInterval(timer);
        onCompleteRef.current?.();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [skipAnimation, total, intervalMs, resetKey]);

  return count;
}