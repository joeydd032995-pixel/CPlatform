import pino from 'pino';

// Structured logging with a hard redaction list. `serverSeed` must never
// appear in a log line, active or otherwise — not just on the top-level
// request body but anywhere it might be nested (RNG options, seed state
// objects, etc.). `censor` overwrites rather than drops the key so log
// consumers can still see the field existed.
const REDACT_PATHS = [
  'serverSeed',
  '*.serverSeed',
  '*.*.serverSeed',
  'activeServerSeed',
  '*.activeServerSeed',
  'req.body.serverSeed',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
