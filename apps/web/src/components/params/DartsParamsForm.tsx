'use client';

import type { DartsParams } from '@/lib/params';

// Darts has no configurable params (DartsParamsSchema is z.object({}).strict()
// server-side) — this form only surfaces the fixed zone paytable so players
// know the odds before throwing.
const ZONES: Array<{ name: string; multiplier: string }> = [
  { name: 'Bullseye', multiplier: '15x' },
  { name: 'Inner', multiplier: '4x' },
  { name: 'Middle', multiplier: '1.2x' },
  { name: 'Outer', multiplier: '0.3x' },
  { name: 'Rim', multiplier: '0.1x' },
];

export function DartsParamsForm({}: {
  value: DartsParams;
  onChange: (value: DartsParams) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <p>Throw a single dart at the board — no configuration needed.</p>
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="py-1">Zone</th>
            <th className="py-1">Multiplier</th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone) => (
            <tr key={zone.name} className="border-b border-slate-800">
              <td className="py-1">{zone.name}</td>
              <td className="py-1">{zone.multiplier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
