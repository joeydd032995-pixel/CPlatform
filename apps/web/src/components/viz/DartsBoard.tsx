'use client';

import { useEffect, useRef } from 'react';
import type { DartsOutcome } from '@/lib/types';
import type { DartsParams } from '@/lib/params';

const SIZE = 320;
const BOARD_RADIUS_SCALE = 0.5; // distance=0.5 maps to the canvas edge.

// Ring boundaries in the same `distance` units as outcome.distance (see
// packages/games/src/darts.ts's DARTS_ZONES; u = 4*distance^2, so
// distance = sqrt(u)/2). Listed innermost-first as (name, outerRadius).
const RINGS: Array<{ name: string; outerDistance: number; multiplier: number }> = [
  { name: 'bullseye', outerDistance: Math.sqrt(0.02) / 2, multiplier: 15 },
  { name: 'inner', outerDistance: Math.sqrt(0.1) / 2, multiplier: 4 },
  { name: 'middle', outerDistance: Math.sqrt(0.3) / 2, multiplier: 1.2 },
  { name: 'outer', outerDistance: Math.sqrt(0.6) / 2, multiplier: 0.3 },
  { name: 'rim', outerDistance: 0.5, multiplier: 0.1 },
];

const RING_COLORS = ['#dc2626', '#f97316', '#facc15', '#22c55e', '#1e293b'];

export function DartsBoard({ outcome }: { outcome: DartsOutcome; params?: DartsParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { distance, rotation, zone, zoneIndex } = outcome;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = SIZE;
    canvas.height = SIZE;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const centerX = SIZE / 2;
    const centerY = SIZE / 2;
    const pixelsPerUnit = (SIZE / 2) / BOARD_RADIUS_SCALE;

    // Draw rings outermost-first so smaller rings paint over larger ones.
    for (let i = RINGS.length - 1; i >= 0; i--) {
      const ring = RINGS[i]!;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring.outerDistance * pixelsPerUnit, 0, Math.PI * 2);
      ctx.fillStyle = RING_COLORS[i] ?? '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Dart marker at polar (distance, rotation * 2*PI).
    const angle = rotation * 2 * Math.PI;
    const dartX = centerX + distance * pixelsPerUnit * Math.cos(angle);
    const dartY = centerY + distance * pixelsPerUnit * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(dartX, dartY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [distance, rotation]);

  const multiplier = RINGS[zoneIndex]?.multiplier ?? RINGS[RINGS.length - 1]!.multiplier;

  return (
    <div className="flex flex-col items-center gap-3" data-testid="darts-board">
      <canvas
        ref={canvasRef}
        data-testid="darts-canvas"
        className="max-w-full rounded border border-slate-700"
      />
      <div className="text-sm text-slate-300">
        Zone: <span className="font-semibold capitalize">{zone}</span> — {multiplier}x
      </div>
    </div>
  );
}
