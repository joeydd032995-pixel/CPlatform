import { Redis } from 'ioredis';
import { logger } from '@cplatform/shared';

// Narrow persistence contract that seedService.ts depends on. Keeping this
// as an interface (rather than importing ioredis types directly into
// seedService) means seedService can be unit-tested against an in-memory
// fake with no real Redis involved (see test/helpers/inMemoryStores.ts).
export type SeedTuple = {
  nonce: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
};

export type SeedFields = {
  activeServerSeed: string;
  activeServerSeedHash: string;
  activeClientSeed: string;
  currentNonce: number;
};

export interface SeedStore {
  // Returns true if a fresh hash was created, false if one already existed.
  initIfAbsent(
    userId: string,
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string
  ): Promise<boolean>;

  getFields(userId: string): Promise<SeedFields | null>;

  // Atomically reserves and returns the next unused nonce, along with the
  // seed fields as of that reservation.
  reserveNonce(userId: string): Promise<SeedTuple>;

  // Overwrites the active client seed and resets currentNonce to 0.
  updateClientSeed(userId: string, clientSeed: string): Promise<void>;

  // Atomically archives the current seed to history and installs a new one,
  // returning the just-retired (revealed) seed's fields.
  rotateSeed(
    userId: string,
    newServerSeed: string,
    newServerSeedHash: string,
    rotatedAtIso: string
  ): Promise<{
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    finalNonce: number;
  }>;

  // Raw JSON strings, oldest first (LRANGE 0 -1 order).
  getHistory(userId: string): Promise<string[]>;
}

// Lua scripts registered on the ioredis instance via `defineCommand`. Each
// runs atomically inside Redis, so concurrent calls from multiple Node
// processes can't interleave between the read and the write half of an
// operation the way a plain GET-then-SET pair could.
const SEED_INIT_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('HSET', KEYS[1],
    'activeServerSeed', ARGV[1],
    'activeServerSeedHash', ARGV[2],
    'activeClientSeed', ARGV[3],
    'currentNonce', 0)
  return 1
else
  return 0
end
`;

// Guards against the "hash doesn't exist yet" edge case: rather than
// silently HINCRBY-ing a brand new hash into existence with only
// currentNonce set (and no seed fields), we bail out with a recognizable
// error so the adapter can turn it into a real JS Error. Callers in this
// codebase always run seedService.ensureSeedState first, so this should
// never fire in practice — it's defense in depth, not the primary path.
const RESERVE_NONCE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return redis.error_reply('SEED_NOT_INITIALIZED')
end
local n = redis.call('HINCRBY', KEYS[1], 'currentNonce', 1)
local f = redis.call('HMGET', KEYS[1], 'activeServerSeed', 'activeServerSeedHash', 'activeClientSeed')
if f[1] == false then
  return redis.error_reply('SEED_NOT_INITIALIZED')
end
return {n - 1, f[1], f[2], f[3]}
`;

const ROTATE_SEED_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return redis.error_reply('SEED_NOT_INITIALIZED')
end
local old = redis.call('HMGET', KEYS[1], 'activeServerSeed', 'activeServerSeedHash', 'activeClientSeed', 'currentNonce')
if old[1] == false then
  return redis.error_reply('SEED_NOT_INITIALIZED')
end
local record = cjson.encode({
  serverSeed = old[1],
  serverSeedHash = old[2],
  clientSeed = old[3],
  finalNonce = tonumber(old[4]),
  rotatedAt = ARGV[3]
})
redis.call('RPUSH', KEYS[2], record)
redis.call('HSET', KEYS[1],
  'activeServerSeed', ARGV[1],
  'activeServerSeedHash', ARGV[2],
  'currentNonce', 0)
return old
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    seedInit(
      key: string,
      serverSeed: string,
      serverSeedHash: string,
      clientSeed: string
    ): Promise<number>;
    reserveNonce(key: string): Promise<[number, string, string, string]>;
    rotateSeed(
      hashKey: string,
      historyKey: string,
      newServerSeed: string,
      newServerSeedHash: string,
      rotatedAtIso: string
    ): Promise<[string, string, string, string]>;
  }
}

export function createRedisClient(url: string): Redis {
  const client = new Redis(url);
  client.on('error', (err) => {
    // Never pass seed values into log calls here — only the connection
    // error itself. The shared logger also redacts by key name as a second
    // layer of defense (see packages/shared/src/logger.ts).
    logger.error({ err: err.message }, 'Redis connection error');
  });
  return client;
}

export class RedisSeedStore implements SeedStore {
  constructor(private readonly redis: Redis) {
    this.redis.defineCommand('seedInit', { numberOfKeys: 1, lua: SEED_INIT_LUA });
    this.redis.defineCommand('reserveNonce', { numberOfKeys: 1, lua: RESERVE_NONCE_LUA });
    this.redis.defineCommand('rotateSeed', { numberOfKeys: 2, lua: ROTATE_SEED_LUA });
  }

  private hashKey(userId: string): string {
    return `seed:${userId}`;
  }

  private historyKey(userId: string): string {
    return `seedhistory:${userId}`;
  }

  async initIfAbsent(
    userId: string,
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string
  ): Promise<boolean> {
    const created = await this.redis.seedInit(
      this.hashKey(userId),
      serverSeed,
      serverSeedHash,
      clientSeed
    );
    return created === 1;
  }

  async getFields(userId: string): Promise<SeedFields | null> {
    const data = await this.redis.hmget(
      this.hashKey(userId),
      'activeServerSeed',
      'activeServerSeedHash',
      'activeClientSeed',
      'currentNonce'
    );
    const [activeServerSeed, activeServerSeedHash, activeClientSeed, currentNonce] = data;
    if (activeServerSeed === null || activeServerSeed === undefined) return null;
    return {
      activeServerSeed,
      activeServerSeedHash: activeServerSeedHash ?? '',
      activeClientSeed: activeClientSeed ?? '',
      currentNonce: Number(currentNonce ?? 0),
    };
  }

  async reserveNonce(userId: string): Promise<SeedTuple> {
    try {
      const [nonce, serverSeed, serverSeedHash, clientSeed] = await this.redis.reserveNonce(
        this.hashKey(userId)
      );
      return { nonce: Number(nonce), serverSeed, serverSeedHash, clientSeed };
    } catch (err) {
      throw translateSeedNotInitialized(err, userId);
    }
  }

  async updateClientSeed(userId: string, clientSeed: string): Promise<void> {
    await this.redis.hset(this.hashKey(userId), {
      activeClientSeed: clientSeed,
      currentNonce: 0,
    });
  }

  async rotateSeed(
    userId: string,
    newServerSeed: string,
    newServerSeedHash: string,
    rotatedAtIso: string
  ): Promise<{ serverSeed: string; serverSeedHash: string; clientSeed: string; finalNonce: number }> {
    try {
      const [serverSeed, serverSeedHash, clientSeed, finalNonce] = await this.redis.rotateSeed(
        this.hashKey(userId),
        this.historyKey(userId),
        newServerSeed,
        newServerSeedHash,
        rotatedAtIso
      );
      return { serverSeed, serverSeedHash, clientSeed, finalNonce: Number(finalNonce) };
    } catch (err) {
      throw translateSeedNotInitialized(err, userId);
    }
  }

  async getHistory(userId: string): Promise<string[]> {
    return this.redis.lrange(this.historyKey(userId), 0, -1);
  }
}

function translateSeedNotInitialized(err: unknown, userId: string): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('SEED_NOT_INITIALIZED')) {
    return new Error(`Seed state for user ${userId} was not initialized before this call`);
  }
  return err instanceof Error ? err : new Error(message);
}
