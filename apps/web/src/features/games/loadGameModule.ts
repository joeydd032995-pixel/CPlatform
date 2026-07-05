import type { GameName } from '@/lib/params';
import type { LoadedGameModule } from './types';

type GameLoader = () => Promise<LoadedGameModule>;

const loaders: Record<GameName, GameLoader> = {
  mines: () => import('./mines').then((m) => m.load()),
  plinko: () => import('./plinko').then((m) => m.load()),
  dice: () => import('./dice').then((m) => m.load()),
  roulette: () => import('./roulette').then((m) => m.load()),
  keno: () => import('./keno').then((m) => m.load()),
  chicken: () => import('./chicken').then((m) => m.load()),
  darts: () => import('./darts').then((m) => m.load()),
  hilo: () => import('./hilo').then((m) => m.load()),
  blackjack: () => import('./blackjack').then((m) => m.load()),
};

export function loadGameModule(game: GameName): Promise<LoadedGameModule> {
  return loaders[game]();
}