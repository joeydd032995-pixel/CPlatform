import { describe, expect, it } from 'vitest';
import { RNGOptionsSchema, getFloatGeneratorForVersion, createFloatGenerator } from '../src/rng.js';

const VALID = {
  serverSeed: 'a'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
  version: '1.1' as const,
};

describe('RNGOptionsSchema', () => {
  it('accepts a valid envelope', () => {
    expect(() => RNGOptionsSchema.parse(VALID)).not.toThrow();
  });

  it('rejects a non-hex server seed', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, serverSeed: 'not-hex'.repeat(9) })).toThrow();
  });

  it('rejects a server seed of the wrong length', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, serverSeed: 'a'.repeat(63) })).toThrow();
  });

  it('rejects an empty client seed', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, clientSeed: '' })).toThrow();
  });

  it('rejects a client seed over 64 chars', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, clientSeed: 'x'.repeat(65) })).toThrow();
  });

  it('rejects a negative nonce', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, nonce: -1 })).toThrow();
  });

  it('rejects a non-integer nonce', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, nonce: 1.5 })).toThrow();
  });

  it('rejects an unknown version', () => {
    expect(() => RNGOptionsSchema.parse({ ...VALID, version: '2.0' })).toThrow();
  });

  it('strips version before handing options to a game module (the reconciliation pattern)', () => {
    const parsed = RNGOptionsSchema.parse(VALID);
    const { version, ...generatorOptions } = parsed;
    expect(generatorOptions).toEqual({
      serverSeed: VALID.serverSeed,
      clientSeed: VALID.clientSeed,
      nonce: VALID.nonce,
    });
  });
});

describe('getFloatGeneratorForVersion', () => {
  it('resolves version 1.1 to createFloatGenerator', () => {
    expect(getFloatGeneratorForVersion('1.1')).toBe(createFloatGenerator);
  });
});
