import { asLoadedGameModule, type LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ ChickenParamsForm }, { ChickenLanes }] = await Promise.all([
    import('@/components/params/ChickenParamsForm'),
    import('@/components/viz/ChickenLanes'),
  ]);
  return asLoadedGameModule({ ParamsForm: ChickenParamsForm, Viz: ChickenLanes });
}