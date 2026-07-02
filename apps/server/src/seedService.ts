import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
} from '@cplatform/core-rng';
import type { PublicSeedState, RevealedSeedRecord } from '@cplatform/core-rng';
import type { SeedStore, SeedTuple } from './seedStore.js';

export interface SeedService {
  ensureSeedState(userId: string): Promise<void>;
  getPublicSeedState(userId: string): Promise<PublicSeedState>;
  updateClientSeed(userId: string, newClientSeed: string): Promise<void>;
  rotateServerSeed(userId: string): Promise<RevealedSeedRecord>;
  reserveNextNonce(userId: string): Promise<SeedTuple>;
}

function parseHistory(raw: string[]): RevealedSeedRecord[] {
  return raw.map((entry) => {
    const parsed = JSON.parse(entry) as {
      serverSeed: string;
      serverSeedHash: string;
      clientSeed: string;
      finalNonce: number;
      rotatedAt: string;
    };
    return {
      serverSeed: parsed.serverSeed,
      serverSeedHash: parsed.serverSeedHash,
      clientSeed: parsed.clientSeed,
      finalNonce: parsed.finalNonce,
      rotatedAt: new Date(parsed.rotatedAt),
    };
  });
}

export function createSeedService(store: SeedStore): SeedService {
  async function ensureSeedState(userId: string): Promise<void> {
    // Idempotent: if a hash already exists for this user, initIfAbsent is a
    // no-op (returns false) and we just move on. Candidate seed material is
    // generated up front and thrown away on the losing side of a race,
    // which is fine — it's cheap and never persisted anywhere.
    const candidateServerSeed = generateServerSeed();
    const candidateServerSeedHash = hashServerSeed(candidateServerSeed);
    const candidateClientSeed = generateClientSeed();
    await store.initIfAbsent(
      userId,
      candidateServerSeed,
      candidateServerSeedHash,
      candidateClientSeed
    );
  }

  async function getPublicSeedState(userId: string): Promise<PublicSeedState> {
    await ensureSeedState(userId);
    const fields = await store.getFields(userId);
    if (!fields) {
      throw new Error(`Seed state for user ${userId} unexpectedly missing after ensure`);
    }
    const history = await store.getHistory(userId);
    return {
      // NOTE: activeServerSeed is intentionally never read here — only the
      // hash is exposed publicly, per the "never expose a live seed" rule.
      serverSeedHash: fields.activeServerSeedHash,
      clientSeed: fields.activeClientSeed,
      nonce: fields.currentNonce,
      previousSeeds: parseHistory(history),
    };
  }

  async function updateClientSeed(userId: string, newClientSeed: string): Promise<void> {
    await ensureSeedState(userId);
    await store.updateClientSeed(userId, newClientSeed.slice(0, 64));
  }

  async function rotateServerSeed(userId: string): Promise<RevealedSeedRecord> {
    await ensureSeedState(userId);
    const newServerSeed = generateServerSeed();
    const newServerSeedHash = hashServerSeed(newServerSeed);
    const rotatedAt = new Date();
    const old = await store.rotateSeed(
      userId,
      newServerSeed,
      newServerSeedHash,
      rotatedAt.toISOString()
    );
    // The raw old server seed IS returned here on purpose: rotation retires
    // it, so revealing it is the whole point (it lets players independently
    // verify every bet made against it).
    return {
      serverSeed: old.serverSeed,
      serverSeedHash: old.serverSeedHash,
      clientSeed: old.clientSeed,
      finalNonce: old.finalNonce,
      rotatedAt,
    };
  }

  async function reserveNextNonce(userId: string): Promise<SeedTuple> {
    await ensureSeedState(userId);
    return store.reserveNonce(userId);
  }

  return {
    ensureSeedState,
    getPublicSeedState,
    updateClientSeed,
    rotateServerSeed,
    reserveNextNonce,
  };
}
