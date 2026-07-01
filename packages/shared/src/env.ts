import { z } from 'zod';

// Single source of truth for process.env validation, shared by apps/server
// and any script that touches the DB/Redis. Parse once at process start;
// fail fast and loud, but NEVER echo actual values in the failure message
// (a misconfigured SESSION_SECRET or DATABASE_URL logged in cleartext is
// itself a leak).

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  RNG_VERSION: z.enum(['1.1']).default('1.1'),
  // JSON-encoded map of jurisdiction -> enabled game list, e.g.
  // '{"us":["mines"],"eu":["all"]}'. Parsed separately by parseJurisdictionFlags
  // below rather than validated structurally here, since the game-name list
  // depends on packages/games (which packages/shared must not depend on).
  JURISDICTION_FLAGS: z.string().default('{}'),
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvValidationError extends Error {
  constructor(zodError: z.ZodError) {
    // List only which keys failed and why (e.g. "too_small"), never the
    // received value — that's the whole point of not echoing secrets.
    const issues = zodError.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    super(`Invalid environment configuration:\n${issues}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error);
  }
  return result.data;
}

export function parseJurisdictionFlags(raw: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('JURISDICTION_FLAGS must decode to a JSON object');
    }
    return parsed as Record<string, string[]>;
  } catch (err) {
    throw new Error(
      `JURISDICTION_FLAGS is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// Convenience for process entrypoints: parse process.env and exit(1) with a
// safe message on failure instead of letting a stack trace (which could
// include the raw source object in some Node versions) reach stdout.
export function loadEnv(): Env {
  try {
    return parseEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // eslint-disable-next-line no-console
      console.error(err.message);
    } else {
      // eslint-disable-next-line no-console
      console.error('Failed to load environment configuration.');
    }
    process.exit(1);
  }
}
