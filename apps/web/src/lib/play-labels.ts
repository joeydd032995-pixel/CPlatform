import type { GameName } from './games';

export function playLabelFor(game: GameName): string {
  switch (game) {
    case 'roulette':
      return 'SPIN';
    case 'blackjack':
      return 'DEAL';
    default:
      return 'BET';
  }
}

export function playLoadingLabel(label: string): string {
  switch (label) {
    case 'SPIN':
      return 'SPINNING...';
    case 'DEAL':
      return 'DEALING...';
    default:
      return 'PLACING BET...';
  }
}