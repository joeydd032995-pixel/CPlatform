'use client';

import type { DiceParams } from '@/lib/params';
import { Slider } from '@/components/ui/slider';
import { ModeTabs } from '@/components/games/GameShell';

const DIRECTIONS = ['over', 'under'] as const;

// Purely decorative pre-bet preview -- shows the current win zone and
// target marker, but no roll has happened yet.
function IdleBar({ target, direction }: { target: number; direction: 'over' | 'under' }) {
  const winZoneStyle =
    direction === 'over'
      ? { left: `${target}%`, width: `${100 - target}%` }
      : { left: '0%', width: `${target}%` };

  return (
    <div className="relative h-6 w-full overflow-hidden rounded bg-muted" aria-hidden="true">
      <div className="absolute inset-y-0 bg-emerald-700/30" style={winZoneStyle} />
      <div className="absolute top-0 h-full w-0.5 bg-muted-foreground/50" style={{ left: `${target}%` }} />
    </div>
  );
}

export function DiceParamsForm({
  value,
  onChange,
}: {
  value: DiceParams;
  onChange: (value: DiceParams) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
          <span>TARGET</span>
          <span>{value.target.toFixed(2)}</span>
        </div>
        <Slider
          min={0.01}
          max={99.99}
          step={0.01}
          value={[value.target]}
          onValueChange={(vals) => onChange({ ...value, target: vals[0] ?? value.target })}
        />
      </div>
      <div>
        <div className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          DIRECTION
        </div>
        <ModeTabs
          modes={DIRECTIONS}
          value={value.direction}
          onChange={(direction) => onChange({ ...value, direction })}
        />
      </div>
      <IdleBar target={value.target} direction={value.direction} />
    </div>
  );
}
