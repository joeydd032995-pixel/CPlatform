'use client';

import type { PlinkoParams } from '@/lib/params';
import { Slider } from '@/components/ui/slider';
import { ModeTabs } from '@/components/games/GameShell';

const RISKS = ['low', 'medium', 'high'] as const;

// Purely decorative pre-bet preview -- the peg pyramid at rest, no ball
// dropped yet (a real drop only happens once a bet is placed).
function IdlePyramid({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex justify-center gap-6">
          {Array.from({ length: r + 3 }).map((_, c) => (
            <span key={c} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PlinkoParamsForm({
  value,
  onChange,
}: {
  value: PlinkoParams;
  onChange: (value: PlinkoParams) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
          <span>ROWS</span>
          <span>{value.rows}</span>
        </div>
        <Slider
          min={8}
          max={16}
          step={1}
          value={[value.rows]}
          onValueChange={(vals) => onChange({ ...value, rows: vals[0] ?? value.rows })}
        />
      </div>
      <div>
        <div className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          RISK
        </div>
        <ModeTabs
          modes={RISKS}
          value={value.risk}
          onChange={(risk) => onChange({ ...value, risk })}
        />
      </div>
      <IdlePyramid rows={value.rows} />
    </div>
  );
}
