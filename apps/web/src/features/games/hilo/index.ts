import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ HiLoParamsForm }, { HiLoCards }] = await Promise.all([
    import('@/components/params/HiLoParamsForm'),
    import('@/components/viz/HiLoCards'),
  ]);
  return { ParamsForm: HiLoParamsForm, Viz: HiLoCards };
}