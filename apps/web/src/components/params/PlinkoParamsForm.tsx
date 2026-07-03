'use client';

import type { PlinkoParams } from '@/lib/params';

export function PlinkoParamsForm({
  value,
  onChange,
}: {
  value: PlinkoParams;
  onChange: (value: PlinkoParams) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Rows (8-16)
        <input
          type="number"
          min={8}
          max={16}
          value={value.rows}
          onChange={(e) => onChange({ ...value, rows: Number(e.target.value) })}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Risk
        <select
          value={value.risk}
          onChange={(e) => onChange({ ...value, risk: e.target.value as PlinkoParams['risk'] })}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
    </div>
  );
}
