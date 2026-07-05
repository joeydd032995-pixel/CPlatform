import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ RouletteControls }, { RouletteResult }] = await Promise.all([
    import('@/components/params/RouletteControls'),
    import('@/components/viz/RouletteResult'),
  ]);
  return { ParamsForm: RouletteControls, Viz: RouletteResult };
}

export { RouletteChipProvider } from './chip-context';