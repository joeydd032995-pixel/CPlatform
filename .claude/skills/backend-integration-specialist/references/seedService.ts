import { Redis } from 'ioredis';
import { generateServerSeed, generateClientSeed, hashServerSeed } from '../../core/rng';
import type { UserSeedState, RevealedSeedRecord } from '../../core/types';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function getSeedState(userId: string): Promise<UserSeedState> {
  const key = `seed:${userId}`;
  const data = await redis.get(key);

  if (!data) {
    const serverSeed = generateServerSeed();
    const state: UserSeedState = {
      userId,
      activeServerSeed: serverSeed,
      activeServerSeedHash: hashServerSeed(serverSeed),
      activeClientSeed: generateClientSeed(),
      currentNonce: 0,
      previousSeeds: [],
    };
    await redis.set(key, JSON.stringify(state));
    return state;
  }

  return JSON.parse(data);
}

export async function getPublicSeedState(userId: string) {
  const state = await getSeedState(userId);
  return {
    serverSeedHash: state.activeServerSeedHash,
    clientSeed: state.activeClientSeed,
    nonce: state.currentNonce,
    previousSeeds: state.previousSeeds,
  };
}

export async function updateClientSeed(userId: string, newClientSeed: string) {
  const state = await getSeedState(userId);
  state.activeClientSeed = newClientSeed.slice(0, 64);
  state.currentNonce = 0;
  await redis.set(`seed:${userId}`, JSON.stringify(state));
}

export async function rotateServerSeed(userId: string): Promise<RevealedSeedRecord> {
  const state = await getSeedState(userId);
  const revealed: RevealedSeedRecord = {
    serverSeed: state.activeServerSeed,
    serverSeedHash: state.activeServerSeedHash,
    clientSeed: state.activeClientSeed,
    finalNonce: state.currentNonce,
    rotatedAt: new Date(),
  };
  state.previousSeeds.push(revealed);

  const newSeed = generateServerSeed();
  state.activeServerSeed = newSeed;
  state.activeServerSeedHash = hashServerSeed(newSeed);
  state.currentNonce = 0;

  await redis.set(`seed:${userId}`, JSON.stringify(state));
  return revealed;
}

export async function incrementNonce(userId: string): Promise<number> {
  const key = `nonce:${userId}`;
  return await redis.incr(key);
}
