import { describe, expect, it } from 'vitest';
import {
  createByteGenerator,
  createFloatGenerator,
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
} from '../src/rng.js';

const FIXED_OPTIONS = {
  serverSeed: 'a'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('createByteGenerator', () => {
  it('is deterministic for identical inputs', () => {
    const a = createByteGenerator(FIXED_OPTIONS);
    const b = createByteGenerator(FIXED_OPTIONS);

    const bytesA = Array.from({ length: 40 }, () => a.next().value);
    const bytesB = Array.from({ length: 40 }, () => b.next().value);

    expect(bytesA).toEqual(bytesB);
  });

  it('produces bytes in [0, 255]', () => {
    const gen = createByteGenerator(FIXED_OPTIONS);
    for (let i = 0; i < 100; i++) {
      const byte = gen.next().value!;
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(255);
    }
  });

  it('changes output when nonce changes', () => {
    const a = createByteGenerator(FIXED_OPTIONS);
    const b = createByteGenerator({ ...FIXED_OPTIONS, nonce: 1 });

    const bytesA = Array.from({ length: 8 }, () => a.next().value);
    const bytesB = Array.from({ length: 8 }, () => b.next().value);

    expect(bytesA).not.toEqual(bytesB);
  });

  it('matches an independently computed fixed vector (regression guard)', () => {
    // Computed outside this codebase via Node's crypto module directly:
    // createHmac('sha256', 'a'.repeat(64)).update('player-1:0:0').digest()
    // If this ever changes, the algorithm changed and every historical bet
    // under RNG version '1.1' is no longer independently verifiable.
    const EXPECTED_FIRST_8_BYTES = [151, 91, 199, 71, 54, 27, 27, 213];

    const gen = createByteGenerator(FIXED_OPTIONS);
    const first8 = Array.from({ length: 8 }, () => gen.next().value);

    expect(first8).toEqual(EXPECTED_FIRST_8_BYTES);
  });
});

describe('createFloatGenerator', () => {
  it('is deterministic for identical inputs', () => {
    const a = createFloatGenerator(FIXED_OPTIONS);
    const b = createFloatGenerator(FIXED_OPTIONS);

    const floatsA = Array.from({ length: 20 }, () => a.next().value);
    const floatsB = Array.from({ length: 20 }, () => b.next().value);

    expect(floatsA).toEqual(floatsB);
  });

  it('produces floats in [0, 1)', () => {
    const gen = createFloatGenerator(FIXED_OPTIONS);
    for (let i = 0; i < 200; i++) {
      const float = gen.next().value!;
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
    }
  });

  it('matches an independently computed fixed vector (regression guard)', () => {
    // Same derivation as the byte-generator fixed vector above, summed as
    // byte[i] / 256**(i+1) for i in 0..3 over the first 4 bytes of the
    // digest — computed independently outside this codebase.
    const EXPECTED_FIRST_FLOAT = 0.5912441776599735;

    const gen = createFloatGenerator(FIXED_OPTIONS);
    expect(gen.next().value).toBe(EXPECTED_FIRST_FLOAT);
  });
});

describe('seed generation & commitment', () => {
  it('generateServerSeed produces 64-char hex', () => {
    const seed = generateServerSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateClientSeed produces 32-char hex', () => {
    const seed = generateClientSeed();
    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('hashServerSeed matches an independently computed SHA256 digest', () => {
    const seed = 'b'.repeat(64);
    // Computed independently via: createHash('sha256').update('b'.repeat(64)).digest('hex')
    // (verifiable with any standalone SHA256 tool, e.g. `echo -n "$(python3 -c "print('b'*64,end='')")" | sha256sum`).
    const EXPECTED_DIGEST = 'a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4';

    expect(hashServerSeed(seed)).toBe(EXPECTED_DIGEST);
  });

  it('hashServerSeed never returns the input seed itself', () => {
    const seed = generateServerSeed();
    expect(hashServerSeed(seed)).not.toBe(seed);
  });
});
