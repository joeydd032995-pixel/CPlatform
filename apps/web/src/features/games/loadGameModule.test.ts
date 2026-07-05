import { describe, expect, it } from 'vitest';
import { loadGameModule } from './loadGameModule';
import { GAME_NAMES } from './registry';

describe('loadGameModule', () => {
  it.each(GAME_NAMES)('loads ParamsForm and Viz for %s', async (game) => {
    const mod = await loadGameModule(game);
    expect(mod.ParamsForm).toBeTypeOf('function');
    expect(mod.Viz).toBeTypeOf('function');
  });
});