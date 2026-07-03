import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  playGame,
  getSeeds,
  rotateSeed,
  setClientSeed,
  verifyBet,
  getMe,
  ApiError,
} from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playGame', () => {
  it('POSTs to /api/games/:game with x-user-id, idempotency-key, and a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await playGame('user-1', 'mines', { betAmount: 10, params: { mines: 3, picks: 1 } }, 'idem-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/games/mines');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-user-id']).toBe('user-1');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('idem-1');
    expect(JSON.parse(init.body as string)).toEqual({
      betAmount: 10,
      params: { mines: 3, picks: 1 },
    });
  });

  it('throws a typed ApiError carrying the code from a non-2xx JSON body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'INSUFFICIENT_BALANCE', error: 'nope' }, 400));
    vi.stubGlobal('fetch', fetchMock);

    await expect(playGame('user-1', 'mines', { betAmount: 10, params: {} })).rejects.toMatchObject(
      { code: 'INSUFFICIENT_BALANCE' }
    );
  });

  it('rejects with an instance of ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'UNKNOWN_GAME', error: 'nope' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await playGame('user-1', 'nope', { betAmount: 10, params: {} });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});

describe('getSeeds / rotateSeed / setClientSeed', () => {
  it('GETs /api/seeds with x-user-id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ serverSeedHash: 'h', clientSeed: 'c', nonce: 0, previousSeeds: [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getSeeds('user-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/seeds');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-user-id']).toBe('user-1');
  });

  it('POSTs /api/seeds/rotate with an idempotency key when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', finalNonce: 5, rotatedAt: '2024-01-01' })
    );
    vi.stubGlobal('fetch', fetchMock);

    await rotateSeed('user-1', 'idem-2');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/seeds/rotate');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('idem-2');
  });

  it('POSTs /api/seeds/client-seed with the new client seed in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ serverSeedHash: 'h', clientSeed: 'new-seed', nonce: 0, previousSeeds: [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await setClientSeed('user-1', 'new-seed');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/seeds/client-seed');
    expect(JSON.parse(init.body as string)).toEqual({ clientSeed: 'new-seed' });
  });
});

describe('verifyBet', () => {
  it('POSTs to /api/verify without a user-id header, pinning version 1.1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        verified: true,
        game: 'mines',
        nonce: 0,
        serverSeedHash: 'h',
        outcome: {},
        multiplier: 1,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await verifyBet({
      serverSeed: 'a'.repeat(64),
      clientSeed: 'c',
      nonce: 0,
      game: 'mines',
      params: { mines: 3, picks: 1 },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/verify');
    expect((init.headers as Record<string, string>)['x-user-id']).toBeUndefined();
    expect(JSON.parse(init.body as string)).toMatchObject({ version: '1.1' });
  });
});

describe('getMe', () => {
  it('GETs /api/me with x-user-id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ userId: 'user-1', balance: 100 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getMe('user-1');

    expect(result).toEqual({ userId: 'user-1', balance: 100 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect((init.headers as Record<string, string>)['x-user-id']).toBe('user-1');
  });
});
