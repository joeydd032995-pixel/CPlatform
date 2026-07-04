import type { Express } from 'express';
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
const appPromise: Promise<Express> = createApp();

export default async function handler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
): Promise<void> {
  const app = await appPromise;
  app(req, res);
}
