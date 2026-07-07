import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/createApp.js';

// createApp() is deliberately untested in its real-infrastructure path
// (Postgres/Redis), but its DEMO_MODE branch touches no infrastructure at
// all -- so it can (and should) be exercised end-to-end here, since this is
// exactly the wiring a DEMO_MODE=true deployment runs in production.

const ENV_KEYS = ['DEMO_MODE', 'DATABASE_URL', 'REDIS_URL', 'SESSION_SECRET', 'CORS_ORIGIN'] as const;
const saved: Record<string, string | undefined> = {};

let app: Express;

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.DEMO_MODE = 'true';
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  process.env.SESSION_SECRET = 'x'.repeat(32);
  app = await createApp();
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('DEMO_MODE createApp wiring (no Postgres, no Redis)', () => {
  it('serves /healthz', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('auto-provisions a brand-new visitor with the 11,000 starting balance', async () => {
    const res = await request(app).get('/api/me').set('x-user-id', 'demo-visitor-1').expect(200);
    expect(res.body).toEqual({ userId: 'demo-visitor-1', balance: 11000 });
  });

  it('plays a one-shot game end to end and moves the balance', async () => {
    const userId = 'demo-visitor-2';
    const bet = await request(app)
      .post('/api/games/dice')
      .set('x-user-id', userId)
      .send({ betAmount: 100, params: { target: 50, direction: 'under' } })
      .expect(200);

    const me = await request(app).get('/api/me').set('x-user-id', userId).expect(200);
    expect(me.body.balance).toBeCloseTo(11000 - 100 + bet.body.payout, 6);
  });

  it('runs a multi-request Mines round (start -> cash-out path reachable)', async () => {
    const userId = 'demo-visitor-3';
    const started = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', userId)
      .send({ betAmount: 50, mines: 3 })
      .expect(200);
    expect(started.body.status).toBe('OPEN');

    const revealed = await request(app)
      .post(`/api/rounds/mines/${started.body.id}/reveal`)
      .set('x-user-id', userId)
      .send({ version: started.body.version })
      .expect(200);
    expect(['OPEN', 'BUSTED']).toContain(revealed.body.status);
  });

  it('supports the full provably-fair seeds flow (view, rotate revealing the old seed)', async () => {
    const userId = 'demo-visitor-4';
    const seeds = await request(app).get('/api/seeds').set('x-user-id', userId).expect(200);
    expect(seeds.body.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);

    const rotated = await request(app).post('/api/seeds/rotate').set('x-user-id', userId).expect(200);
    expect(rotated.body.serverSeed).toMatch(/^[0-9a-f]{64}$/);
  });
});
