'use client';

import type { DiceParams } from '@/lib/params';
import { Slider } from '@/components/ui/slider';
import { ModeTabs } from '@/components/games/GameShell';

const DIRECTIONS = ['over', 'under'] as const;

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
    </div>
  );
}
