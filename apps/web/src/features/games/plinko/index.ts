import { asLoadedGameModule, type LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ PlinkoParamsForm }, { PlinkoBoard }] = await Promise.all([
    import('@/components/params/PlinkoParamsForm'),
    import('@/components/viz/PlinkoBoard'),
  ]);
  return asLoadedGameModule({ ParamsForm: PlinkoParamsForm, Viz: PlinkoBoard });
}