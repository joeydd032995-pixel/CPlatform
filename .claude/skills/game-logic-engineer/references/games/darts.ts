// Verbatim reference (nuts.gg). Returns a polar-coordinate-style throw:
// `distance` (0-0.5, sqrt-distributed for realistic clustering near center)
// and `rotation` (0-1, full circle).

import { RNGOptions, floatsGenerator } from "./provably-fair.ts";

export const calculateDartThrow = (options: RNGOptions) => {
  const floats = floatsGenerator(options);

  const distance = Math.sqrt(floats.next().value) * 0.5;
  const rotation = floats.next().value;

  return { distance, rotation };
};
