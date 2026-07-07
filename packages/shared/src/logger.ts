import pino from 'pino';

// Structured logging with a recursive, depth-independent redactor.
//
// fast-redact (pino's built-in `redact` option) only matches FIXED path
// depths — 'a.b.serverSeed' won't catch 'a.b.c.serverSeed'. Enumerating
// every possible depth is fragile and unbounded, so instead we redact by
// KEY NAME via a `formatters.log` hook that walks the entire log object
// recursively before it's serialized. This catches `serverSeed`/
// `activeServerSeed` wherever they appear, no matter how deeply nested
// (seed state objects, RNG options, request bodies, etc.), and can't be
// bypassed by an unanticipated shape the way a fixed-path list can.
const SENSITIVE_KEYS = new Set([
  'serverSeed',
  'activeServerSeed',
  'authorization',
  'cookie',
]);

const REDACTED = '[REDACTED]';

function deepRedact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, seen));
  }

  // `formatters.log` runs before pino applies its own `err` serializer, so
  // an Error instance passed through this redactor is still a real Error --
  // `message`/`stack` are non-enumerable on it, so the generic
  // Object.entries walk below silently drops them, leaving every logged
  // error looking like `{}` (or just whatever extra enumerable properties
  // it happens to carry, e.g. Prisma's `clientVersion`). Extract the
  // standard fields explicitly instead of relying on pino's serializer
  // pipeline, consistent with this file's own by-key-name approach.
  if (value instanceof Error) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const out: Record<string, unknown> = {
      type: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const [key, val] of Object.entries(value)) {
      // `name` is commonly a custom class's own enumerable property
      // (`this.name = 'FooError'`) and already covered by `type` above --
      // skip it to avoid a redundant duplicate field in the log output.
      if (key === 'name') continue;
      out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : deepRedact(val, seen);
    }
    return out;
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : deepRedact(val, seen);
    }
    return out;
  }

  return value;
}

// Factory (rather than a bare singleton) so tests can build a logger from
// this exact production config against a capturing stream, instead of
// duplicating the redaction setup — see packages/shared/test/logger.test.ts.
export function createLogger(destination?: pino.DestinationStream): pino.Logger {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    // pino registers its own default `err`-key serializer unconditionally
    // (independent of whatever formatters.log already produced) and applies
    // it to any property literally named `err` *after* formatters.log runs.
    // deepRedact already turns an Error into a plain `{type, message,
    // stack, ...}` object below -- pino's default serializer then duck-types
    // that plain object as "error-like" (it has string message/stack) and
    // re-derives `type` from `constructor.name`, which is `'Object'` for a
    // plain object literal, silently corrupting the real error name. An
    // identity pass-through here disables that redundant re-serialization.
    serializers: { err: (value: unknown) => value },
    formatters: {
      log(object) {
        return deepRedact(object) as Record<string, unknown>;
      },
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export type Logger = typeof logger;

// Exported so tests exercise the real redaction logic rather than a
// duplicated copy of it (see packages/shared/test/logger.test.ts).
export { deepRedact, SENSITIVE_KEYS };
