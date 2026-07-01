// core/rng.ts — canonical provably-fair RNG core.
//
// Reconciles the two variants reviewed during design:
//   - The Zod-validated `RNGOptions` envelope (hex-format seed, bounded
//     client seed, non-negative nonce, versioned) used at the API boundary.
//   - Snippets.txt's leaner `bytesGenerator`/`floatsGenerator` shape, which
//     is what game modules actually consume (plain serverSeed/clientSeed/nonce,
//     no `version` needed once you're past the boundary).
//
// Game modules should import `GeneratorOptions`, `createByteGenerator`, and
// `createFloatGenerator` — NOT `RNGOptionsSchema`, which is for API input
// validation only.

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
// Deliberately does not require `version` — game modules don't need to know
// the RNG version, only the caller (gameService) that picks which generator
// to invoke based on it.

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

    for (let i = 0; i < 32; i++) yield digest[i];
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

// --- Seed generation & commitment ------------------------------------------

export const generateServerSeed = (): string => randomBytes(32).toString('hex');

// Pure SHA256 commitment — verifiable without knowing HMAC details.
export const hashServerSeed = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex');

export const generateClientSeed = (): string => randomBytes(16).toString('hex');
