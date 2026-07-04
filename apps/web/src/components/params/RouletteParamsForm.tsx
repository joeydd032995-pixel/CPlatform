'use client';

import { useState } from 'react';
import type { RouletteBetType, RouletteParams } from '@/lib/params';

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
      zone: needsZone(betType) ? value.zone ?? 0 : undefined,
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
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Bet type
        <select
          value={value.betType}
          onChange={(e) => handleBetTypeChange(e.target.value as RouletteBetType)}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        >
          {BET_TYPES.map((betType) => (
            <option key={betType} value={betType}>
              {betType}
            </option>
          ))}
        </select>
      </label>

      {needsNumbers(value.betType) && (
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {expectedCount === 1 ? 'Number' : `Numbers (comma-separated, ${expectedCount} required)`}
          <input
            type="text"
            value={numbersText}
            onChange={(e) => handleNumbersTextChange(e.target.value)}
            placeholder={expectedCount === 1 ? 'e.g. 17' : 'e.g. 1,2'}
            className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
          />
        </label>
      )}

      {needsZone(value.betType) && (
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Zone
          <select
            value={value.zone ?? 0}
            onChange={(e) => onChange({ ...value, zone: Number(e.target.value) })}
            className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
          >
            <option value={0}>1st (1)</option>
            <option value={1}>2nd (2)</option>
            <option value={2}>3rd (3)</option>
          </select>
        </label>
      )}
    </div>
  );
}
