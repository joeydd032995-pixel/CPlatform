import { describe, expect, it } from 'vitest';
import { parseEnv, parseJurisdictionFlags, parseCorsOrigins, EnvValidationError } from '../src/env.js';

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

  it('leaves CORS_ORIGIN undefined when omitted', () => {
    const env = parseEnv(VALID_ENV);
    expect(env.CORS_ORIGIN).toBeUndefined();
  });

  it('accepts a CORS_ORIGIN string', () => {
    const env = parseEnv({ ...VALID_ENV, CORS_ORIGIN: 'https://a.example.com,https://b.example.com' });
    expect(env.CORS_ORIGIN).toBe('https://a.example.com,https://b.example.com');
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('falls back to UPSTASH_URL when REDIS_URL is unset', () => {
    const { REDIS_URL, ...rest } = VALID_ENV;
    const env = parseEnv({ ...rest, UPSTASH_URL: 'rediss://default:token@upstash.example.com:6379' });
    expect(env.REDIS_URL).toBe('rediss://default:token@upstash.example.com:6379');
  });

  it('prefers an explicit REDIS_URL over UPSTASH_URL when both are set', () => {
    const env = parseEnv({ ...VALID_ENV, UPSTASH_URL: 'rediss://default:token@upstash.example.com:6379' });
    expect(env.REDIS_URL).toBe(VALID_ENV.REDIS_URL);
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

describe('bet amount limits', () => {
  it('leaves MIN_BET_AMOUNT and MAX_BET_AMOUNT undefined when both omitted', () => {
    const env = parseEnv(VALID_ENV);
    expect(env.MIN_BET_AMOUNT).toBeUndefined();
    expect(env.MAX_BET_AMOUNT).toBeUndefined();
  });

  it('accepts only MIN_BET_AMOUNT set', () => {
    const env = parseEnv({ ...VALID_ENV, MIN_BET_AMOUNT: '1' });
    expect(env.MIN_BET_AMOUNT).toBe(1);
    expect(env.MAX_BET_AMOUNT).toBeUndefined();
  });

  it('accepts only MAX_BET_AMOUNT set', () => {
    const env = parseEnv({ ...VALID_ENV, MAX_BET_AMOUNT: '1000' });
    expect(env.MAX_BET_AMOUNT).toBe(1000);
    expect(env.MIN_BET_AMOUNT).toBeUndefined();
  });

  it('accepts both set with MIN_BET_AMOUNT <= MAX_BET_AMOUNT', () => {
    const env = parseEnv({ ...VALID_ENV, MIN_BET_AMOUNT: '1', MAX_BET_AMOUNT: '1000' });
    expect(env.MIN_BET_AMOUNT).toBe(1);
    expect(env.MAX_BET_AMOUNT).toBe(1000);
  });

  it('rejects MIN_BET_AMOUNT > MAX_BET_AMOUNT', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, MIN_BET_AMOUNT: '1000', MAX_BET_AMOUNT: '1' })
    ).toThrow(EnvValidationError);
  });

  it('rejects a non-positive MIN_BET_AMOUNT', () => {
    expect(() => parseEnv({ ...VALID_ENV, MIN_BET_AMOUNT: '0' })).toThrow(EnvValidationError);
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

  it('rejects a value that is not a string array', () => {
    expect(() => parseJurisdictionFlags('{"us":true}')).toThrow();
  });

  it('rejects a value array containing non-strings', () => {
    expect(() => parseJurisdictionFlags('{"us":[1,2]}')).toThrow();
  });
});

describe('parseCorsOrigins', () => {
  it('returns undefined when the raw value is undefined', () => {
    expect(parseCorsOrigins(undefined)).toBeUndefined();
  });

  it('parses a single origin', () => {
    expect(parseCorsOrigins('https://app.example.com')).toEqual(['https://app.example.com']);
  });

  it('parses multiple comma-separated origins and trims whitespace', () => {
    expect(parseCorsOrigins('https://a.example.com, https://b.example.com ,https://c.example.com')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
      'https://c.example.com',
    ]);
  });

  it('treats a blank string as unconfigured (undefined), not an empty allowlist', () => {
    expect(parseCorsOrigins('')).toBeUndefined();
  });

  it('treats a comma-only string as unconfigured (undefined)', () => {
    expect(parseCorsOrigins(' , , ')).toBeUndefined();
  });
});
