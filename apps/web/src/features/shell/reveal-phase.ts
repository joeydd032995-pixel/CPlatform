export type RevealPhase = 'idle' | 'dealing' | 'revealing' | 'done';

export const DEALING_PAUSE_MS = 450;

export function controlsLocked(phase: RevealPhase): boolean {
  return phase === 'dealing' || phase === 'revealing';
}