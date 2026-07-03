'use client';

import { useEffect, useRef } from 'react';
import type { PlinkoOutcome } from '@/lib/types';
import type { PlinkoParams } from '@/lib/params';

const WIDTH = 480;
const HEIGHT_PER_ROW = 24;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 40;
const PEG_RADIUS = 3;
const BALL_RADIUS = 5;

// Static draw only (no animation): a peg triangle for `rows`, a polyline of
// outcome.path's left/right descent, and a slot row with multiplierIndex
// highlighted.
export function PlinkoBoard({ outcome, params }: { outcome: PlinkoOutcome; params: PlinkoParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { rows } = params;
  const { path, multiplierIndex } = outcome;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const height = TOP_MARGIN + rows * HEIGHT_PER_ROW + BOTTOM_MARGIN;
    canvas.width = WIDTH;
    canvas.height = height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, WIDTH, height);

    const centerX = WIDTH / 2;
    const spacing = WIDTH / (rows + 4);

    // Draw peg triangle: row r has r+1 pegs, centered.
    ctx.fillStyle = '#475569';
    for (let row = 0; row <= rows; row++) {
      const pegCount = row + 1;
      const y = TOP_MARGIN + row * HEIGHT_PER_ROW;
      for (let i = 0; i < pegCount; i++) {
        const x = centerX + (i - row / 2) * spacing;
        ctx.beginPath();
        ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw the ball's descent polyline: at each row, position shifts by
    // +/- half a peg spacing depending on left/right.
    let x = centerX;
    const points: Array<[number, number]> = [[x, TOP_MARGIN]];
    path.forEach((move, index) => {
      const y = TOP_MARGIN + (index + 1) * HEIGHT_PER_ROW;
      x += move === 'right' ? spacing / 2 : -spacing / 2;
      points.push([x, y]);
    });

    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(([px, py], index) => {
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const [finalX, finalY] = points[points.length - 1] ?? [centerX, TOP_MARGIN];
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(finalX, finalY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Slot row: rows+1 slots along the bottom, multiplierIndex highlighted.
    const slotCount = rows + 1;
    const slotWidth = WIDTH / slotCount;
    const slotY = height - BOTTOM_MARGIN + 8;
    for (let i = 0; i < slotCount; i++) {
      ctx.fillStyle = i === multiplierIndex ? '#16a34a' : '#1e293b';
      ctx.fillRect(i * slotWidth, slotY, slotWidth - 2, BOTTOM_MARGIN - 12);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(i * slotWidth, slotY, slotWidth - 2, BOTTOM_MARGIN - 12);
    }
  }, [rows, path, multiplierIndex]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="plinko-board"
      className="w-full max-w-full rounded border border-slate-700"
    />
  );
}
