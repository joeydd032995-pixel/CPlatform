import { z } from 'zod';

// Single source of truth for process.env validation, shared by apps/server
// and any script that touches the DB/Redis. Parse once at process start;
// fail fast and loud, but NEVER echo actual values in the failure message
// (a misconfigured SESSION_SECRET or DATABASE_URL logged in cleartext is
// itself a leak).

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Opt-in demo mode: the server runs entirely on in-memory stores (no
  // Postgres, no Redis) so the platform can be tried out with zero
  // infrastructure. All state resets on restart and is not shared across
  // serverless instances -- never for real money. When true, DATABASE_URL
  // and REDIS_URL become optional (see the refine below); when false they
  // are required exactly as before.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  RNG_VERSION: z.enum(['1.1']).default('1.1'),
  // JSON-encoded map of jurisdiction -> enabled game list, e.g.
  // '{"us":["mines"],"eu":["all"]}'. Parsed separately by parseJurisdictionFlags
  // below rather than validated structurally here, since the game-name list
  // depends on packages/games (which packages/shared must not depend on).
  JURISDICTION_FLAGS: z.string().default('{}'),
  // Comma-separated list of allowed CORS origins, e.g.
  // 'https://app.example.com,https://staging.example.com'. Optional and
  // left unparsed here (just a raw string) -- parseCorsOrigins below turns
  // it into `string[] | undefined` the same way parseJurisdictionFlags
  // turns JURISDICTION_FLAGS into a structured value, so apps/server can
  // tell "not configured" (undefined -- preserve reflect-any-origin dev
  // behavior) apart from "configured with an explicit allowlist".
  CORS_ORIGIN: z.string().optional(),
  // Optional, opt-in platform-wide bet-amount bounds enforced in
  // gameService.playGame (the single chokepoint all 9 games flow through).
  // Unset (either or both) preserves today's behavior of no limit -- the
  // actual bound *values* are a deferred product decision; this only adds
  // the mechanism. Coerced from the env string to a positive number.
  MIN_BET_AMOUNT: z.coerce.number().positive().optional(),
  MAX_BET_AMOUNT: z.coerce.number().positive().optional(),
})
  // If both bounds are configured, min must not exceed max -- otherwise
  // every bet would be rejected, which is almost certainly a
  // misconfiguration rather than an intentional "reject everything".
  .refine(
    (env) =>
      env.MIN_BET_AMOUNT === undefined ||
      env.MAX_BET_AMOUNT === undefined ||
      env.MIN_BET_AMOUNT <= env.MAX_BET_AMOUNT,
    {
      message: 'MIN_BET_AMOUNT must be less than or equal to MAX_BET_AMOUNT',
      path: ['MIN_BET_AMOUNT'],
    }
  )
  // Outside demo mode the platform cannot function without real persistence
  // -- fail fast at parse time with a pointed message rather than letting a
  // missing URL surface later as an opaque connection error.
  .refine((env) => env.DEMO_MODE || env.DATABASE_URL !== undefined, {
    message: 'DATABASE_URL is required unless DEMO_MODE=true',
    path: ['DATABASE_URL'],
  })
  .refine((env) => env.DEMO_MODE || env.REDIS_URL !== undefined, {
    message: 'REDIS_URL is required unless DEMO_MODE=true',
    path: ['REDIS_URL'],
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
  // Vercel's Upstash integration (and some other Redis-provider
  // integrations) name their generated connection-string variable
  // `UPSTASH_URL` rather than `REDIS_URL`, and its "custom prefix" setting
  // doesn't offer a blank/no-prefix option in every version. Rather than
  // requiring every deployment to duplicate the value under a second
  // variable name, fall back to `UPSTASH_URL` only when `REDIS_URL` itself
  // isn't set -- an explicit `REDIS_URL` always wins, so this can't
  // silently override an intentionally-configured value. `||` (not `??`)
  // deliberately also treats an empty string the same as unset -- some
  // deployment tooling sets omitted variables to `""` rather than leaving
  // the key absent, and an empty string is never a valid URL anyway.
  const normalized = {
    ...source,
    REDIS_URL: source.REDIS_URL || source.UPSTASH_URL,
  };
  const result = EnvSchema.safeParse(normalized);
  if (!result.success) {
    throw new EnvValidationError(result.error);
  }
  return result.data;
}

const JurisdictionFlagsSchema = z.record(z.array(z.string()));

export function parseJurisdictionFlags(raw: string): Record<string, string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `JURISDICTION_FLAGS is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const result = JurisdictionFlagsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('JURISDICTION_FLAGS must decode to an object of string arrays');
  }
  return result.data;
}

// Turns the raw comma-separated CORS_ORIGIN env value into an explicit
// origin allowlist. Returns undefined when unset (or blank) so callers can
// distinguish "no allowlist configured" from "configured with zero
// origins" -- an empty array would silently reject every cross-origin
// request, which is a very different, and much easier to misconfigure,
// intent than "not configured yet".
export function parseCorsOrigins(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : undefined;
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
