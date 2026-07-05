import type { LoadedGameModule } from '../types';

export async function load(): Promise<LoadedGameModule> {
  const [{ BlackjackParamsForm }, { BlackjackTable }] = await Promise.all([
    import('@/components/params/BlackjackParamsForm'),
    import('@/components/viz/BlackjackTable'),
  ]);
  return { ParamsForm: BlackjackParamsForm, Viz: BlackjackTable };
}