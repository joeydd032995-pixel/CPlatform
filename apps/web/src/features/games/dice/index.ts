import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ DiceParamsForm }, { DiceBar }] = await Promise.all([
    import('@/components/params/DiceParamsForm'),
    import('@/components/viz/DiceBar'),
  ]);
  return { ParamsForm: DiceParamsForm, Viz: DiceBar };
}