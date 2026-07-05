import { asLoadedGameModule, type LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ MinesParamsForm }, { MinesGrid }] = await Promise.all([
    import('@/components/params/MinesParamsForm'),
    import('@/components/viz/MinesGrid'),
  ]);
  return asLoadedGameModule({ ParamsForm: MinesParamsForm, Viz: MinesGrid });
}