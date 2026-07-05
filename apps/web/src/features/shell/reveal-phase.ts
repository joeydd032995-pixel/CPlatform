export type RevealPhase =
  | 'idle'
  | 'dealing'
  | 'revealing'
  | 'done'
  // Round-state games only (Mines cash-out, Blackjack decisions): the round
  // is open and awaiting the player's next action -- controls are live.
  | 'awaiting-decision'
  // Round-state games only: an action request is in flight -- controls
  // locked, distinct from `dealing`/`revealing` which pace a one-shot
  // game's already-known outcome.
  | 'action-pending';

export const DEALING_PAUSE_MS = 450;

export function controlsLocked(phase: RevealPhase): boolean {
  return phase === 'dealing' || phase === 'revealing' || phase === 'action-pending';
}