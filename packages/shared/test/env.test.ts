import { describe, expect, it } from 'vitest';
import { parseEnv, parseJurisdictionFlags, EnvValidationError } from '../src/env.js';

const VALID_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/cplatform',
  REDIS_URL: 'redis://localhost:6379',
  PORT: '4000',
  SESSION_SECRET: 'x'.repeat(32),
  RNG_VERSION: '1.1',
  JURISDICTION_FLAGS: '{"us":["mines"]}',
};

describe('parseEnv', () => {
  it('accepts a fully valid environment', () => {
    const env = parseEnv(VALID_ENV);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('test');
  });

  it('defaults PORT when omitted', () => {
    const { PORT, ...rest } = VALID_ENV;
    const env = parseEnv(rest);
    expect(env.PORT).toBe(4000);
  });

  it('defaults RNG_VERSION and JURISDICTION_FLAGS when omitted', () => {
    const { RNG_VERSION, JURISDICTION_FLAGS, ...rest } = VALID_ENV;
    const env = parseEnv(rest);
    expect(env.RNG_VERSION).toBe('1.1');
    expect(env.JURISDICTION_FLAGS).toBe('{}');
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('rejects a non-URL DATABASE_URL', () => {
    expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: 'not-a-url' })).toThrow(EnvValidationError);
  });

  it('rejects a SESSION_SECRET shorter than 32 chars', () => {
    expect(() => parseEnv({ ...VALID_ENV, SESSION_SECRET: 'short' })).toThrow(EnvValidationError);
  });

  it('rejects an unknown RNG_VERSION', () => {
    expect(() => parseEnv({ ...VALID_ENV, RNG_VERSION: '9.9' })).toThrow(EnvValidationError);
  });

  it('never echoes the actual invalid value in the error message', () => {
    const secretValue = 'too-short-secret';
    expect(secretValue.length).toBeLessThan(32);
    try {
      parseEnv({ ...VALID_ENV, SESSION_SECRET: secretValue });
      throw new Error('expected parseEnv to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect((err as Error).message).not.toContain(secretValue);
    }
  });
});

describe('parseJurisdictionFlags', () => {
  it('parses a valid JSON object', () => {
    expect(parseJurisdictionFlags('{"us":["mines"],"eu":["all"]}')).toEqual({
      us: ['mines'],
      eu: ['all'],
    });
  });

  it('rejects invalid JSON', () => {
    expect(() => parseJurisdictionFlags('not json')).toThrow();
  });

  it('rejects a JSON array (must be an object)', () => {
    expect(() => parseJurisdictionFlags('[1,2,3]')).toThrow();
  });

  it('rejects JSON null', () => {
    expect(() => parseJurisdictionFlags('null')).toThrow();
  });
});
