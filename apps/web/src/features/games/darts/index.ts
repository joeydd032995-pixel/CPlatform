import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ DartsParamsForm }, { DartsBoard }] = await Promise.all([
    import('@/components/params/DartsParamsForm'),
    import('@/components/viz/DartsBoard'),
  ]);
  return { ParamsForm: DartsParamsForm, Viz: DartsBoard };
}