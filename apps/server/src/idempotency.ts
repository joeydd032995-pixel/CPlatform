import type { Redis } from 'ioredis';

const PENDING_SENTINEL = '__pending__';
// Short TTL for the in-flight marker: if the process crashes or hangs
// between begin() and complete(), the pending sentinel must not outlive a
// realistic request duration, or every retry with the same key gets stuck
// behind a 409 IdempotencyConflictError for the full window with no way to
// recover. The completed *result* gets a much longer TTL below, since
// caching a real answer for retries to replay is the whole point.
const PENDING_TTL_SECONDS = 60;
const RESULT_TTL_SECONDS = 86400;

export type BeginResult = 'started' | 'pending' | { cached: string };

export interface IdempotencyStore {
  begin(userId: string, key: string): Promise<BeginResult>;
  complete(userId: string, key: string, resultJson: string): Promise<void>;
}

function redisKey(userId: string, key: string): string {
  return `idem:${userId}:${key}`;
}

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: Redis) {}

  async begin(userId: string, key: string): Promise<BeginResult> {
    const rKey = redisKey(userId, key);
    const set = await this.redis.set(rKey, PENDING_SENTINEL, 'EX', PENDING_TTL_SECONDS, 'NX');
    if (set === 'OK') return 'started';

    const existing = await this.redis.get(rKey);
    if (existing === null || existing === PENDING_SENTINEL) return 'pending';
    return { cached: existing };
  }

  async complete(userId: string, key: string, resultJson: string): Promise<void> {
    // Keep the same TTL so a completed idempotency record doesn't linger
    // forever, but still outlives any reasonable client retry window.
    await this.redis.set(redisKey(userId, key), resultJson, 'EX', RESULT_TTL_SECONDS);
  }
}
