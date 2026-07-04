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

// Purely decorative pre-bet preview -- the board at rest, no dart thrown
// yet (that only happens once a bet is placed).
function IdleBoard() {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <div
        className="relative h-40 w-40 rounded-full ring-8 ring-slate-800"
        style={{
          background:
            'conic-gradient(#f97316 0 20%, #ef4444 20% 40%, #f97316 40% 60%, #ef4444 60% 80%, #f97316 80% 100%)',
        }}
      >
        <div
          className="absolute inset-6 rounded-full ring-4 ring-slate-800"
          style={{
            background:
              'conic-gradient(#0f172a 0 25%, #ef4444 25% 30%, #0f172a 30% 55%, #f97316 55% 60%, #0f172a 60% 100%)',
          }}
        />
        <div className="absolute inset-10 grid place-items-center rounded-full bg-slate-900">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}

export function DartsParamsForm({}: {
  value: DartsParams;
  onChange: (value: DartsParams) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>Throw a single dart at the board — no configuration needed.</p>
      <IdleBoard />
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1">Zone</th>
            <th className="py-1">Multiplier</th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone) => (
            <tr key={zone.name} className="border-b border-border">
              <td className="py-1">{zone.name}</td>
              <td className="py-1">{zone.multiplier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
