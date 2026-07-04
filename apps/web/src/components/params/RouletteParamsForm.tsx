'use client';

import { useState } from 'react';
import type { RouletteBetType, RouletteParams } from '@/lib/params';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Fresh build (no zip Roulette equivalent) using the ported shadcn
// primitives in the same visual voice as the other reskinned games. The
// bet-type/number logic below is reused unchanged from the previous
// RouletteParamsForm -- only the markup is new.
const BET_TYPES: RouletteBetType[] = [
  'straight',
  'split',
  'street',
  'corner',
  'six-line',
  'column',
  'dozen',
  'red',
  'black',
  'odd',
  'even',
  'high',
  'low',
];

const NUMBERS_COUNT: Record<RouletteBetType, number | null> = {
  straight: 1,
  split: 2,
  street: 3,
  corner: 4,
  'six-line': 6,
  column: 0,
  dozen: 0,
  red: 0,
  black: 0,
  odd: 0,
  even: 0,
  high: 0,
  low: 0,
};

function needsZone(betType: RouletteBetType): boolean {
  return betType === 'column' || betType === 'dozen';
}

function needsNumbers(betType: RouletteBetType): boolean {
  return (NUMBERS_COUNT[betType] ?? 0) > 0;
}

export function RouletteParamsForm({
  value,
  onChange,
}: {
  value: RouletteParams;
  onChange: (value: RouletteParams) => void;
}) {
  // Free-text buffer for the numbers input so the user can type
  // intermediate states (e.g. "1,") without losing keystrokes.
  const [numbersText, setNumbersText] = useState(value.numbers.join(','));

  const expectedCount = NUMBERS_COUNT[value.betType];

  const handleBetTypeChange = (betType: RouletteBetType) => {
    const next: RouletteParams = {
      betType,
      numbers: needsNumbers(betType) ? value.numbers : [],
      zone: needsZone(betType) ? (value.zone ?? 0) : undefined,
    };
    onChange(next);
    setNumbersText(next.numbers.join(','));
  };

  const handleNumbersTextChange = (text: string) => {
    setNumbersText(text);
    const numbers = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    onChange({ ...value, numbers });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label>Bet type</Label>
        <Select value={value.betType} onValueChange={(v) => handleBetTypeChange(v as RouletteBetType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BET_TYPES.map((betType) => (
              <SelectItem key={betType} value={betType}>
                {betType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsNumbers(value.betType) && (
        <div className="flex flex-col gap-1">
          <Label>
            {expectedCount === 1 ? 'Number' : `Numbers (comma-separated, ${expectedCount} required)`}
          </Label>
          <Input
            type="text"
            value={numbersText}
            onChange={(e) => handleNumbersTextChange(e.target.value)}
            placeholder={expectedCount === 1 ? 'e.g. 17' : 'e.g. 1,2'}
          />
        </div>
      )}

      {needsZone(value.betType) && (
        <div className="flex flex-col gap-1">
          <Label>Zone</Label>
          <Select
            value={String(value.zone ?? 0)}
            onValueChange={(v) => onChange({ ...value, zone: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">1st (1)</SelectItem>
              <SelectItem value="1">2nd (2)</SelectItem>
              <SelectItem value="2">3rd (3)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
