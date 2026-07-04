'use client';

import type { ChickenParams } from '@/lib/params';
import { CHICKEN_DIFFICULTY_TO_SLICE, CHICKEN_LANES_COUNT } from '@/lib/params';
import { Slider } from '@/components/ui/slider';
import { ModeTabs } from '@/components/games/GameShell';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;

// Purely decorative pre-bet preview -- the lane track at rest, no death
// point revealed and no lanes advanced yet (that's only known once a bet
// is placed).
function IdleLanes({ lanes }: { lanes: number }) {
  const allLanes = Array.from({ length: CHICKEN_LANES_COUNT }, (_, index) => index + 1);
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
      {allLanes.map((lane) => (
        <div
          key={lane}
          className={`flex h-10 w-10 items-center justify-center rounded border text-xs font-bold ${
            lane <= lanes
              ? 'border-border bg-card text-muted-foreground'
              : 'border-border/50 bg-card/50 text-muted-foreground/30'
          }`}
        >
          {lane}
        </div>
      ))}
    </div>
  );
}

export function ChickenParamsForm({
  value,
  onChange,
}: {
  value: ChickenParams;
  onChange: (value: ChickenParams) => void;
}) {
  const maxLanes = CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE[value.difficulty];

  const handleDifficultyChange = (difficulty: ChickenParams['difficulty']) => {
    const clampedMax = CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE[difficulty];
    onChange({ difficulty, lanes: Math.min(value.lanes, clampedMax) });
  };

  return (
    <div className="flex flex-col gap-4">
      <ModeTabs modes={DIFFICULTIES} value={value.difficulty} onChange={handleDifficultyChange} />
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
          <span>LANES</span>
          <span>{value.lanes}</span>
        </div>
        <Slider
          min={1}
          max={maxLanes}
          step={1}
          value={[value.lanes]}
          onValueChange={(vals) => onChange({ ...value, lanes: vals[0] ?? value.lanes })}
        />
      </div>
      <IdleLanes lanes={value.lanes} />
    </div>
  );
}
