// Provably-fair RNG core.
//
// Two shapes, two audiences:
//   - `RNGOptionsSchema`/`RNGOptions`: the Zod-validated envelope (hex-format
//     seed, bounded client seed, non-negative nonce, versioned) used only at
//     the API boundary (gameService.ts and the /api/verify route).
//   - `GeneratorOptions`: the plain internal shape every game module consumes
//     (no `version` — the caller already resolved which generator to use).
//
// Game modules must import `GeneratorOptions`, `createByteGenerator`, and
// `createFloatGenerator` — never `RNGOptionsSchema`.

import { createHmac, randomBytes, createHash } from 'crypto';
import { z } from 'zod';

// --- API boundary: validated envelope -------------------------------------

export const RNGOptionsSchema = z.object({
  serverSeed: z.string().regex(/^[0-9a-f]{64}$/i, 'Must be 64-char hex'),
  clientSeed: z.string().min(1).max(64),
  nonce: z.number().int().nonnegative(),
  version: z.enum(['1.1']),
});

export type RNGOptions = z.infer<typeof RNGOptionsSchema>;

// --- Internal shape consumed by game modules ------------------------------

export type GeneratorOptions = {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
};

export function* createByteGenerator(
  options: GeneratorOptions
): Generator<number, number, never> {
  let round = 0;

  while (true) {
    const hmac = createHmac('sha256', options.serverSeed);
    hmac.update(`${options.clientSeed}:${options.nonce}:${round}`);
    const digest = hmac.digest();

    for (let i = 0; i < 32; i++) yield digest[i]!;
    round++;
  }
}

export function* createFloatGenerator(
  options: GeneratorOptions
): Generator<number, number, never> {
  const byteGen = createByteGenerator(options);

  while (true) {
    let float = 0;
    for (let i = 0; i < 4; i++) {
      float += byteGen.next().value! / 256 ** (i + 1);
    }
    yield float;
  }
}

// --- Version dispatch ------------------------------------------------------
// The generation algorithm above is version '1.1'. If the algorithm ever
// needs to change, add a new generator function (e.g. createFloatGeneratorV1_2)
// and a new branch here — never mutate an existing version's output, since
// historical bets must remain independently verifiable against the version
// they were played under.

export function getFloatGeneratorForVersion(
  version: RNGOptions['version']
): (options: GeneratorOptions) => Generator<number, number, never> {
  switch (version) {
    case '1.1':
      return createFloatGenerator;
    default: {
      const exhaustive: never = version;
      throw new Error(`Unsupported RNG version: ${exhaustive}`);
    }
  }
}

// --- Seed generation & commitment ------------------------------------------

export const generateServerSeed = (): string => randomBytes(32).toString('hex');

// Pure SHA256 commitment — verifiable without knowing HMAC details.
export const hashServerSeed = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex');

export const generateClientSeed = (): string => randomBytes(16).toString('hex');
