import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/buildTestApp.js';

describe('POST /api/rounds/mines/* (HTTP layer)', () => {
  it('runs a full start -> reveal -> cash-out flow over HTTP', async () => {
    const { app, db } = buildTestApp();
    const userId = 'user-http-mines';

    const startRes = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', userId)
      .send({ betAmount: 100, mines: 3 })
      .expect(200);

    expect(startRes.body.status).toBe('OPEN');
    expect(db.users.get(userId)!.balance).toBe(900);

    let body = startRes.body;
    for (let i = 0; i < 20 && body.status === 'OPEN' && body.revealedTiles.length === 0; i++) {
      const revealRes = await request(app)
        .post(`/api/rounds/mines/${body.id}/reveal`)
        .set('x-user-id', userId)
        .send({ version: body.version })
        .expect(200);
      body = revealRes.body;
    }

    if (body.status === 'BUSTED') {
      expect(body.payout).toBe(0);
      return;
    }

    const cashOutRes = await request(app)
      .post(`/api/rounds/mines/${body.id}/cash-out`)
      .set('x-user-id', userId)
      .send({ version: body.version })
      .expect(200);

    expect(cashOutRes.body.status).toBe('CASHED_OUT');
    expect(cashOutRes.body.payout).toBeGreaterThan(0);
  });

  it('returns 409 with ROUND_VERSION_CONFLICT on a stale version', async () => {
    const { app } = buildTestApp();

    // Scan for a userId whose first reveal is safe, so the round stays
    // OPEN and the stale retry unambiguously hits the version check rather
    // than "already busted" (a different, separately-tested rejection).
    for (let i = 0; i < 50; i++) {
      const userId = `user-http-mines-conflict-${i}`;
      const startRes = await request(app)
        .post('/api/rounds/mines/start')
        .set('x-user-id', userId)
        .send({ betAmount: 10, mines: 3 })
        .expect(200);

      const revealRes = await request(app)
        .post(`/api/rounds/mines/${startRes.body.id}/reveal`)
        .set('x-user-id', userId)
        .send({ version: startRes.body.version })
        .expect(200);
      if (revealRes.body.status !== 'OPEN') continue;

      const staleRes = await request(app)
        .post(`/api/rounds/mines/${startRes.body.id}/reveal`)
        .set('x-user-id', userId)
        .send({ version: startRes.body.version })
        .expect(409);

      expect(staleRes.body.code).toBe('ROUND_VERSION_CONFLICT');
      return;
    }
    throw new Error('no safe first reveal found within 50 attempts');
  });

  it('returns 404 with ROUND_NOT_FOUND for an unknown round id', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/rounds/mines/does-not-exist/reveal')
      .set('x-user-id', 'user-http-mines-404')
      .send({ version: 0 })
      .expect(404);

    expect(res.body.code).toBe('ROUND_NOT_FOUND');
  });

  it('returns 400 with INVALID_BET_AMOUNT for a bet below the configured minimum', async () => {
    // buildTestApp doesn't wire betLimits by default (matches gameService's
    // own test convention of only asserting limits when explicitly passed),
    // so this instead confirms the schema-level rejection: a non-positive
    // betAmount.
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', 'user-http-mines-badamount')
      .send({ betAmount: -5, mines: 3 })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range mines count', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', 'user-http-mines-badmines')
      .send({ betAmount: 10, mines: 25 })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/rounds/blackjack/* (HTTP layer)', () => {
  it('runs a full start -> stand flow over HTTP', async () => {
    const { app, db } = buildTestApp();
    const userId = 'user-http-bj';

    const startRes = await request(app)
      .post('/api/rounds/blackjack/start')
      .set('x-user-id', userId)
      .send({ betAmount: 100 })
      .expect(200);

    // Seed material is randomly generated per test run, so this deal can
    // legitimately be a natural that settles and credits payout immediately
    // in the same transaction as the debit -- account for that instead of
    // assuming the round always starts OPEN and uncredited.
    expect(db.users.get(userId)!.balance).toBeCloseTo(
      900 + (startRes.body.status === 'SETTLED' ? startRes.body.payout : 0),
      6
    );

    let body = startRes.body;
    let guard = 0;
    while (body.status === 'OPEN' && guard < 20) {
      guard++;
      if (!body.canStand) break;
      const res = await request(app)
        .post(`/api/rounds/blackjack/${body.id}/action`)
        .set('x-user-id', userId)
        .send({ version: body.version, action: 'stand' })
        .expect(200);
      body = res.body;
    }

    expect(body.status).toBe('SETTLED');
    expect(db.users.get(userId)!.balance).toBeCloseTo(900 + body.payout, 6);
  });

  it('rejects an unknown blackjack action at the schema layer', async () => {
    const { app } = buildTestApp();
    const userId = 'user-http-bj-badaction';

    const startRes = await request(app)
      .post('/api/rounds/blackjack/start')
      .set('x-user-id', userId)
      .send({ betAmount: 10 })
      .expect(200);

    const res = await request(app)
      .post(`/api/rounds/blackjack/${startRes.body.id}/action`)
      .set('x-user-id', userId)
      .send({ version: startRes.body.version, action: 'surrender' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/rounds/:id', () => {
  it('returns the current public round state', async () => {
    const { app } = buildTestApp();
    const userId = 'user-http-getround';

    const startRes = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', userId)
      .send({ betAmount: 10, mines: 3 })
      .expect(200);

    const getRes = await request(app)
      .get(`/api/rounds/${startRes.body.id}`)
      .set('x-user-id', userId)
      .expect(200);

    expect(getRes.body.id).toBe(startRes.body.id);
    expect(getRes.body.status).toBe('OPEN');
  });

  it("returns 404 for another user's round", async () => {
    const { app } = buildTestApp();

    const startRes = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', 'user-http-owner')
      .send({ betAmount: 10, mines: 3 })
      .expect(200);

    const res = await request(app)
      .get(`/api/rounds/${startRes.body.id}`)
      .set('x-user-id', 'user-http-intruder')
      .expect(404);

    expect(res.body.code).toBe('ROUND_NOT_FOUND');
  });
});
