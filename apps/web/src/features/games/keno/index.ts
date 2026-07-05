import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ KenoParamsForm }, { KenoBoard }] = await Promise.all([
    import('@/components/params/KenoParamsForm'),
    import('@/components/viz/KenoBoard'),
  ]);
  return { ParamsForm: KenoParamsForm, Viz: KenoBoard };
}