'use client';

import type { DiceParams } from '@/lib/params';

export function DiceParamsForm({
  value,
  onChange,
}: {
  value: DiceParams;
  onChange: (value: DiceParams) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Target (0-100)
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value.target}
          onChange={(e) => onChange({ ...value, target: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-slate-300">
        Direction
        <div className="flex overflow-hidden rounded border border-slate-700">
          {(['over', 'under'] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => onChange({ ...value, direction })}
              className={`flex-1 p-2 capitalize ${
                value.direction === direction
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-300'
              }`}
            >
              {direction}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
