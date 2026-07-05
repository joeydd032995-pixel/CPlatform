import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRevealSequence } from './use-reveal-sequence';

describe('useRevealSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('jumps to total and completes immediately when not staged', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useRevealSequence({ total: 3, intervalMs: 100, staged: false, onRevealComplete: onComplete })
    );

    expect(result.current).toBe(3);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('steps through staged reveal then completes', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useRevealSequence({ total: 3, intervalMs: 100, staged: true, onRevealComplete: onComplete })
    );

    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(3);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});