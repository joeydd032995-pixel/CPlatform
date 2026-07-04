'use client';

import type { ChickenParams } from '@/lib/params';
import { CHICKEN_DIFFICULTY_TO_SLICE, CHICKEN_LANES_COUNT } from '@/lib/params';

const DIFFICULTIES: ChickenParams['difficulty'][] = ['easy', 'medium', 'hard', 'expert'];

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
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Difficulty
        <select
          value={value.difficulty}
          onChange={(e) => handleDifficultyChange(e.target.value as ChickenParams['difficulty'])}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Lanes (1-{maxLanes})
        <input
          type="number"
          min={1}
          max={maxLanes}
          value={value.lanes}
          onChange={(e) => {
            const lanes = Number(e.target.value);
            onChange({ ...value, lanes: Math.min(Math.max(lanes, 1), maxLanes) });
          }}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        />
      </label>
    </div>
  );
}
