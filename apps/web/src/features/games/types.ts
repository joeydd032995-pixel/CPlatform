import type { ComponentType } from 'react';

export type ParamsFormProps<P = Record<string, unknown>> = {
  value: P;
  onChange: (value: P) => void;
};

export type VizProps<O = Record<string, unknown>, P = Record<string, unknown>> = {
  outcome: O;
  params: P;
  staged?: boolean;
  onRevealComplete?: () => void;
};

export type LoadedGameModule = {
  ParamsForm: ComponentType<ParamsFormProps<Record<string, unknown>>>;
  Viz: ComponentType<VizProps<Record<string, unknown>, Record<string, unknown>>>;
};