'use client';

import type { HiLoGuess, HiLoParams } from '@/lib/params';

const GUESSES: HiLoGuess[] = ['higher', 'lower', 'equal'];
const MAX_GUESSES = 51;

export function HiLoParamsForm({
  value,
  onChange,
}: {
  value: HiLoParams;
  onChange: (value: HiLoParams) => void;
}) {
  const addGuess = (guess: HiLoGuess) => {
    if (value.guesses.length >= MAX_GUESSES) return;
    onChange({ guesses: [...value.guesses, guess] });
  };

  const removeGuess = (index: number) => {
    onChange({ guesses: value.guesses.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-slate-300">
        Guess sequence ({value.guesses.length}/{MAX_GUESSES})
      </div>

      <div className="flex flex-wrap gap-2" data-testid="hilo-guess-chips">
        {value.guesses.map((guess, index) => (
          <button
            key={`${guess}-${index}`}
            type="button"
            onClick={() => removeGuess(index)}
            title="Remove"
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs capitalize text-slate-200 hover:bg-red-900/40 hover:border-red-700"
          >
            {index + 1}. {guess} ×
          </button>
        ))}
        {value.guesses.length === 0 && (
          <span className="text-xs text-slate-500">No guesses added yet</span>
        )}
      </div>

      <div className="flex gap-2">
        {GUESSES.map((guess) => (
          <button
            key={guess}
            type="button"
            disabled={value.guesses.length >= MAX_GUESSES}
            onClick={() => addGuess(guess)}
            className="flex-1 rounded border border-slate-700 bg-slate-900 p-2 text-sm capitalize text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {guess}
          </button>
        ))}
      </div>
    </div>
  );
}
