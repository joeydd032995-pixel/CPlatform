export type { GameName } from './params';

export type {
  ParamsFormProps,
  VizProps,
  LoadedGameModule,
} from '@/features/games/types';

export type { GameRegistryMeta } from '@/features/games/registry';

export {
  gameRegistry,
  gamesRegistry,
  GAME_NAMES,
  isGameName,
  getGameMeta,
} from '@/features/games/registry';

export { loadGameModule } from '@/features/games/loadGameModule';