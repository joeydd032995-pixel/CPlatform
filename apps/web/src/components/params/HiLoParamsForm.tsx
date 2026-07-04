'use client';

import type { HiLoGuess, HiLoParams } from '@/lib/params';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const GUESSES: HiLoGuess[] = ['higher', 'lower'];
const MAX_GUESSES = 51;

// `higher` means "higher or equal" (>= current rank) and `lower` means
// "lower or equal" (<= current rank) -- an exact tie wins both directions.
const GUESS_LABELS: Record<HiLoGuess, string> = {
  higher: 'Higher or equal (≥)',
  lower: 'Lower or equal (≤)',
};

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
      <div className="text-sm text-muted-foreground">
        Guess sequence ({value.guesses.length}/{MAX_GUESSES})
      </div>

      <div className="flex flex-wrap gap-2" data-testid="hilo-guess-chips">
        {value.guesses.map((guess, index) => (
          <Badge
            key={`${guess}-${index}`}
            variant="secondary"
            className="cursor-pointer hover:bg-red-900/40"
            onClick={() => removeGuess(index)}
            title="Remove"
          >
            {index + 1}. {GUESS_LABELS[guess]} ×
          </Badge>
        ))}
        {value.guesses.length === 0 && (
          <span className="text-xs text-muted-foreground">No guesses added yet</span>
        )}
      </div>

      <div className="flex gap-2">
        {GUESSES.map((guess) => (
          <Button
            key={guess}
            type="button"
            variant="outline"
            className="flex-1"
            disabled={value.guesses.length >= MAX_GUESSES}
            onClick={() => addGuess(guess)}
          >
            + {GUESS_LABELS[guess]}
          </Button>
        ))}
      </div>
    </div>
  );
}
