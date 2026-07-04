import type { Express } from 'express';
import { logger } from '@cplatform/shared';
import { createApp } from '../src/createApp.js';

// Vercel serverless entrypoint. Vercel's Node.js runtime invokes the
// default export as (req, res) per request -- an Express app instance is
// itself callable with that exact signature, so no adapter is needed.
//
// createApp() is awaited once at module scope (not inside a per-request
// handler): Vercel keeps a warm function instance alive across consecutive
// invocations and re-executes this module only on a cold start, so the
// Postgres/Redis connections createApp() opens are reused across warm
// requests instead of being reopened every time -- the same reasoning that
// makes a persistent Node server efficient applies here across a warm
// instance's lifetime, it's just bounded by Vercel's instance lifecycle
// instead of a long-running process.
//
// createApp() can reject (the production CORS_ORIGIN guard throws, or
// Redis/Prisma setup fails). Left unhandled, that's an unhandledRejection
// during the window before the first request attaches await, and -- since
// module-scope state persists across warm invocations -- a permanently
// poisoned promise that every subsequent request would re-throw with no
// diagnostic. The .catch() below only silences the "unhandled" warning;
// the handler still surfaces (and logs) the real failure per-request, and
// reassigns appPromise so a later invocation can retry the cold start
// instead of being stuck forever on one transient failure.
let appPromise: Promise<Express> = createApp();
appPromise.catch((err) => logger.error({ err }, 'createApp() failed during cold start'));

export default async function handler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
): Promise<void> {
  let app: Express;
  try {
    app = await appPromise;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize app in serverless handler');
    appPromise = createApp();
    appPromise.catch(() => {});
    res.statusCode = 500;
    res.end('Internal Server Error');
    return;
  }
  app(req, res);
}
