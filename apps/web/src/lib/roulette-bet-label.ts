// Shared human-readable labeling for a single roulette bet leg, used by both
// RouletteParamsForm's current-bets summary and RouletteResult's per-bet
// breakdown table, so the two stay visually consistent without duplicating
// the switch.
import type { RouletteBetType } from '@/lib/params';

const ZONE_ORDINAL = ['1st', '2nd', '3rd'] as const;

export function describeRouletteBet(
  betType: RouletteBetType,
  numbers: number[],
  zone?: number
): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  switch (betType) {
    case 'straight':
      return `Straight ${sorted[0] ?? ''}`;
    case 'split':
      return `Split ${sorted.join('/')}`;
    case 'street':
      return `Street ${sorted.join('-')}`;
    case 'corner':
      return `Corner ${sorted.join('/')}`;
    case 'six-line':
      return `Six Line ${sorted[0]}-${sorted[sorted.length - 1]}`;
    case 'dozen':
      return `${ZONE_ORDINAL[zone ?? 0] ?? ''} Dozen`.trim();
    case 'column':
      return `${ZONE_ORDINAL[zone ?? 0] ?? ''} Column`.trim();
    case 'red':
      return 'Red';
    case 'black':
      return 'Black';
    case 'odd':
      return 'Odd';
    case 'even':
      return 'Even';
    case 'high':
      return '19-36';
    case 'low':
      return '1-18';
  }
}

// Dedupe key used to decide whether a felt click stacks onto an existing bet
// entry (same betType + zone + sorted numbers) or creates a new one.
export function betDedupeKey(betType: RouletteBetType, numbers: number[], zone?: number): string {
  return `${betType}|${zone ?? ''}|${[...numbers].sort((a, b) => a - b).join(',')}`;
}
