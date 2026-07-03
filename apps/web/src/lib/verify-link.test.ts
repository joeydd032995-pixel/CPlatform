import { describe, expect, it } from 'vitest';
import { buildVerifyLink, parseVerifySearchParams } from './verify-link';

describe('buildVerifyLink', () => {
  it('builds a URL with game, nonce, clientSeed, and JSON-encoded params', () => {
    const href = buildVerifyLink({
      game: 'mines',
      nonce: 42,
      clientSeed: 'my-client-seed',
      params: { mines: 3, picks: 1 },
    });

    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/verify');
    expect(url.searchParams.get('game')).toBe('mines');
    expect(url.searchParams.get('nonce')).toBe('42');
    expect(url.searchParams.get('clientSeed')).toBe('my-client-seed');
    expect(JSON.parse(url.searchParams.get('params') ?? '')).toEqual({ mines: 3, picks: 1 });
    expect(url.searchParams.has('serverSeed')).toBe(false);
  });

  it('includes serverSeed only when provided', () => {
    const href = buildVerifyLink({
      game: 'dice',
      nonce: 1,
      clientSeed: 'c',
      params: {},
      serverSeed: 'a'.repeat(64),
    });

    const url = new URL(href, 'http://localhost');
    expect(url.searchParams.get('serverSeed')).toBe('a'.repeat(64));
  });
});

describe('parseVerifySearchParams', () => {
  it('round-trips params JSON built by buildVerifyLink', () => {
    const href = buildVerifyLink({
      game: 'roulette',
      nonce: 7,
      clientSeed: 'seed',
      params: { betType: 'red', numbers: [] },
    });
    const url = new URL(href, 'http://localhost');
    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });

    const parsed = parseVerifySearchParams(searchParams);

    expect(parsed.game).toBe('roulette');
    expect(parsed.nonce).toBe(7);
    expect(parsed.clientSeed).toBe('seed');
    expect(parsed.params).toEqual({ betType: 'red', numbers: [] });
  });

  it('tolerates missing/malformed fields', () => {
    const parsed = parseVerifySearchParams({ params: 'not json' });
    expect(parsed.game).toBeUndefined();
    expect(parsed.nonce).toBeUndefined();
    expect(parsed.params).toBeUndefined();
  });
});
