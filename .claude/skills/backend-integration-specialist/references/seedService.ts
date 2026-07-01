import { Redis } from 'ioredis';
import { generateServerSeed, generateClientSeed, hashServerSeed } from '../../core/rng';
import type { UserSeedState, RevealedSeedRecord } from '../../core/types';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function getSeedState(userId: string): Promise<UserSeedState> {
  const key = `seed:${userId}`;
  const data = await redis.get(key);

  let state: UserSeedState;
  if (!data) {
    const serverSeed = generateServerSeed();
    const candidate: UserSeedState = {
      userId,
      activeServerSeed: serverSeed,
      activeServerSeedHash: hashServerSeed(serverSeed),
      activeClientSeed: generateClientSeed(),
      currentNonce: 0,
      previousSeeds: [],
    };

    // Atomic create-if-absent: if a concurrent first-time bet already won
    // the race, `NX` fails and we read its state back instead of
    // overwriting it — an unconditional SET here would strand the loser's
    // seed hash with no raw seed ever stored for later verification.
    const created = await redis.set(key, JSON.stringify(candidate), 'NX');
    state = created === null
      ? JSON.parse((await redis.get(key))!)
      : candidate;
  } else {
    state = JSON.parse(data);
  }

  // The live nonce counter is `nonce:${userId}` (see incrementNonce below) —
  // kept separate from this JSON blob so it can be incremented atomically.
  // Merge it in here so every caller sees the current nonce instead of the
  // stale `currentNonce` last written into the blob.
  const liveNonce = await redis.get(`nonce:${userId}`);
  if (liveNonce !== null) state.currentNonce = Number(liveNonce);

  return state;
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
  await redis.set(`nonce:${userId}`, 0);
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
  await redis.set(`nonce:${userId}`, 0);
  return revealed;
}

// Callers MUST await this before considering a bet finalized (see the
// `KNOWN GAPS` note in gameService.ts) — its return value now correctly
// feeds back into getSeedState/getPublicSeedState above.
export async function incrementNonce(userId: string): Promise<number> {
  const key = `nonce:${userId}`;
  return await redis.incr(key);
}
