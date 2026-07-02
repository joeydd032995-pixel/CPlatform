import { describe, it, expect } from 'vitest';
import { hashServerSeed } from '@cplatform/core-rng';
import { createSeedService } from '../src/seedService.js';
import { InMemorySeedStore } from './helpers/inMemoryStores.js';

describe('seedService', () => {
  it('ensure-once: double ensure keeps the same hash', async () => {
    const service = createSeedService(new InMemorySeedStore());
    const userId = 'user-1';

    await service.ensureSeedState(userId);
    const first = await service.getPublicSeedState(userId);

    await service.ensureSeedState(userId);
    const second = await service.getPublicSeedState(userId);

    expect(second.serverSeedHash).toBe(first.serverSeedHash);
    expect(second.clientSeed).toBe(first.clientSeed);
  });

  it('public state never leaks the raw active server seed', async () => {
    const store = new InMemorySeedStore();
    const service = createSeedService(store);
    const userId = 'user-2';

    await service.ensureSeedState(userId);
    const fields = await store.getFields(userId);
    expect(fields).not.toBeNull();
    const rawSeed = fields!.activeServerSeed;

    const publicState = await service.getPublicSeedState(userId);
    const serialized = JSON.stringify(publicState);

    expect(serialized).not.toContain(rawSeed);
    expect(publicState).not.toHaveProperty('activeServerSeed');
    expect(publicState).toHaveProperty('serverSeedHash');
  });

  it('updateClientSeed resets nonce to 0 and truncates seeds over 64 chars', async () => {
    const store = new InMemorySeedStore();
    const service = createSeedService(store);
    const userId = 'user-3';

    await service.ensureSeedState(userId);
    // Burn a couple of nonces first so we can prove the reset actually happens.
    await service.reserveNextNonce(userId);
    await service.reserveNextNonce(userId);

    const longSeed = 'a'.repeat(100);
    await service.updateClientSeed(userId, longSeed);

    const state = await service.getPublicSeedState(userId);
    expect(state.nonce).toBe(0);
    expect(state.clientSeed).toBe('a'.repeat(64));
    expect(state.clientSeed.length).toBe(64);
  });

  it('rotateServerSeed returns the old seed, hash matches, and it is appended to history', async () => {
    const store = new InMemorySeedStore();
    const service = createSeedService(store);
    const userId = 'user-4';

    await service.ensureSeedState(userId);
    const beforeRotation = await service.getPublicSeedState(userId);

    const revealed = await service.rotateServerSeed(userId);

    expect(hashServerSeed(revealed.serverSeed)).toBe(beforeRotation.serverSeedHash);
    expect(revealed.serverSeedHash).toBe(beforeRotation.serverSeedHash);

    const afterRotation = await service.getPublicSeedState(userId);
    expect(afterRotation.serverSeedHash).not.toBe(beforeRotation.serverSeedHash);
    expect(afterRotation.nonce).toBe(0);
    expect(afterRotation.previousSeeds).toHaveLength(1);
    expect(afterRotation.previousSeeds[0]?.serverSeedHash).toBe(beforeRotation.serverSeedHash);
  });

  it('reserveNextNonce returns 0, 1, 2 sequentially', async () => {
    const service = createSeedService(new InMemorySeedStore());
    const userId = 'user-5';

    await service.ensureSeedState(userId);
    const a = await service.reserveNextNonce(userId);
    const b = await service.reserveNextNonce(userId);
    const c = await service.reserveNextNonce(userId);

    expect([a.nonce, b.nonce, c.nonce]).toEqual([0, 1, 2]);
  });
});
