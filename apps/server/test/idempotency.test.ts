import { describe, it, expect } from 'vitest';
import { InMemoryIdempotencyStore } from './helpers/inMemoryStores.js';

describe('idempotency', () => {
  it('begin -> started, then pending while in-flight, then cached after complete', async () => {
    const store = new InMemoryIdempotencyStore();
    const userId = 'user-1';
    const key = 'key-1';

    const first = await store.begin(userId, key);
    expect(first).toBe('started');

    const second = await store.begin(userId, key);
    expect(second).toBe('pending');

    await store.complete(userId, key, JSON.stringify({ ok: true }));

    const third = await store.begin(userId, key);
    expect(third).toEqual({ cached: JSON.stringify({ ok: true }) });
  });

  it('different keys/users do not collide', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.begin('user-a', 'key-1')).toBe('started');
    expect(await store.begin('user-b', 'key-1')).toBe('started');
    expect(await store.begin('user-a', 'key-2')).toBe('started');
  });
});
