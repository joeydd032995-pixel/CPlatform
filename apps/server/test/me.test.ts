import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/buildTestApp.js';

describe('GET /api/me', () => {
  it('returns the caller balance as a plain number', async () => {
    const { app, db } = buildTestApp();

    const res = await request(app).get('/api/me').set('x-user-id', 'user-me').expect(200);

    expect(res.body).toEqual({ userId: 'user-me', balance: 1000 });
    expect(db.users.get('user-me')?.balance).toBe(1000);
  });

  it('reflects balance changes made by prior bets', async () => {
    const { app } = buildTestApp();

    await request(app)
      .post('/api/games/dice')
      .set('x-user-id', 'user-bettor')
      .send({ betAmount: 10, params: { target: 50, direction: 'under' } })
      .expect(200);

    const res = await request(app).get('/api/me').set('x-user-id', 'user-bettor').expect(200);

    expect(res.body.userId).toBe('user-bettor');
    expect(typeof res.body.balance).toBe('number');
    expect(res.body.balance).not.toBe(1000);
  });

  it('rejects a request with no x-user-id header', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/me').expect(401);

    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('auto-provisions a new user even in production (no separate signup flow exists)', async () => {
    const { app, db } = buildTestApp({ NODE_ENV: 'production' });

    const res = await request(app).get('/api/me').set('x-user-id', 'never-seen-user').expect(200);

    expect(res.body).toEqual({ userId: 'never-seen-user', balance: 1000 });
    expect(db.users.get('never-seen-user')?.balance).toBe(1000);
  });
});
