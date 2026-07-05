import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/buildTestApp.js';

// Full flow: run a real round to settlement, reveal its seed via rotation
// (exactly like a real player would need to before verifying), then feed
// the round's recorded startParams/actionLog into /api/verify/round and
// confirm it reproduces the identical final result.

describe('POST /api/verify/round: Mines', () => {
  it('replays a cashed-out round and matches the actual payout/multiplier', async () => {
    const { app, roundDb } = buildTestApp();
    const userId = 'user-verify-mines';

    const startRes = await request(app)
      .post('/api/rounds/mines/start')
      .set('x-user-id', userId)
      .send({ betAmount: 100, mines: 3 })
      .expect(200);

    let body = startRes.body;
    for (let i = 0; i < 20 && body.status === 'OPEN' && body.revealedTiles.length === 0; i++) {
      const revealRes = await request(app)
        .post(`/api/rounds/mines/${body.id}/reveal`)
        .set('x-user-id', userId)
        .send({ version: body.version })
        .expect(200);
      body = revealRes.body;
    }
    if (body.status === 'OPEN') {
      body = (
        await request(app)
          .post(`/api/rounds/mines/${body.id}/cash-out`)
          .set('x-user-id', userId)
          .send({ version: body.version })
          .expect(200)
      ).body;
    }

    const record = roundDb.rounds.get(body.id)!;
    const rotateRes = await request(app).post('/api/seeds/rotate').set('x-user-id', userId).expect(200);

    const verifyRes = await request(app)
      .post('/api/verify/round')
      .send({
        version: '1.1',
        game: 'mines',
        serverSeed: rotateRes.body.serverSeed,
        clientSeed: record.clientSeed,
        nonce: record.nonce,
        startParams: record.startParams,
        actionLog: record.actionLog,
      })
      .expect(200);

    expect(verifyRes.body.serverSeedHash).toBe(rotateRes.body.serverSeedHash);
    expect(verifyRes.body.outcome.hitMine).toBe(body.status === 'BUSTED');
    expect(verifyRes.body.outcome.cashedOut).toBe(body.status === 'CASHED_OUT');
    if (body.status === 'CASHED_OUT') {
      expect(verifyRes.body.multiplier).toBeCloseTo(body.payout / 100, 8);
    } else {
      expect(verifyRes.body.multiplier).toBe(0);
    }
  });
});

describe('POST /api/verify/round: Blackjack', () => {
  it('replays a stand-only round and matches the actual result', async () => {
    const { app, roundDb } = buildTestApp();
    const userId = 'user-verify-bj-stand';

    const startRes = await request(app)
      .post('/api/rounds/blackjack/start')
      .set('x-user-id', userId)
      .send({ betAmount: 100 })
      .expect(200);

    let body = startRes.body;
    let guard = 0;
    while (body.status === 'OPEN' && guard < 20) {
      guard++;
      if (!body.canStand) break;
      body = (
        await request(app)
          .post(`/api/rounds/blackjack/${body.id}/action`)
          .set('x-user-id', userId)
          .send({ version: body.version, action: 'stand' })
          .expect(200)
      ).body;
    }
    expect(body.status).toBe('SETTLED');

    const record = roundDb.rounds.get(body.id)!;
    const rotateRes = await request(app).post('/api/seeds/rotate').set('x-user-id', userId).expect(200);

    const verifyRes = await request(app)
      .post('/api/verify/round')
      .send({
        version: '1.1',
        game: 'blackjack',
        serverSeed: rotateRes.body.serverSeed,
        clientSeed: record.clientSeed,
        nonce: record.nonce,
        startParams: record.startParams,
        actionLog: record.actionLog,
      })
      .expect(200);

    expect(verifyRes.body.settled).toBe(true);
    expect(verifyRes.body.outcome.dealerCards).toEqual((record.serverState as { dealerCards: unknown }).dealerCards);
    expect(verifyRes.body.multiplier).toBeCloseTo(body.payout / 100, 8);
  });

  it('replays a split + double combo and matches the actual result', async () => {
    const { app, roundDb } = buildTestApp();

    for (let i = 0; i < 3000; i++) {
      const userId = `user-verify-bj-split-${i}`;
      const startRes = await request(app)
        .post('/api/rounds/blackjack/start')
        .set('x-user-id', userId)
        .send({ betAmount: 100 })
        .expect(200);

      if (startRes.body.status !== 'OPEN' || !startRes.body.canSplit) continue;

      let body = (
        await request(app)
          .post(`/api/rounds/blackjack/${startRes.body.id}/action`)
          .set('x-user-id', userId)
          .send({ version: startRes.body.version, action: 'split' })
          .expect(200)
      ).body;

      // Try to double the (now active) hand if legal; otherwise just stand
      // through to settlement -- either way we exercise a real multi-action
      // decision history on a split round.
      let guard = 0;
      while (body.status === 'OPEN' && guard < 20) {
        guard++;
        if (body.canDouble) {
          body = (
            await request(app)
              .post(`/api/rounds/blackjack/${body.id}/action`)
              .set('x-user-id', userId)
              .send({ version: body.version, action: 'double' })
              .expect(200)
          ).body;
        } else if (body.canStand) {
          body = (
            await request(app)
              .post(`/api/rounds/blackjack/${body.id}/action`)
              .set('x-user-id', userId)
              .send({ version: body.version, action: 'stand' })
              .expect(200)
          ).body;
        } else {
          break;
        }
      }
      expect(body.status).toBe('SETTLED');

      const record = roundDb.rounds.get(body.id)!;
      const rotateRes = await request(app).post('/api/seeds/rotate').set('x-user-id', userId).expect(200);

      const verifyRes = await request(app)
        .post('/api/verify/round')
        .send({
          version: '1.1',
          game: 'blackjack',
          serverSeed: rotateRes.body.serverSeed,
          clientSeed: record.clientSeed,
          nonce: record.nonce,
          startParams: record.startParams,
          actionLog: record.actionLog,
        })
        .expect(200);

      expect(verifyRes.body.settled).toBe(true);
      expect(verifyRes.body.outcome.hands).toHaveLength(2);
      // The actual total wagered can exceed the original 100 once a hand
      // is doubled -- compare against the real total stake, not the
      // original bet amount, since the replay's multiplier is a ratio of
      // its own (proportionally identical) total stake.
      const finalState = record.serverState as { hands: { bet: number }[]; insuranceBet: number };
      const actualTotalBet =
        finalState.hands.reduce((sum, h) => sum + h.bet, 0) + finalState.insuranceBet;
      expect(verifyRes.body.multiplier).toBeCloseTo(body.payout / actualTotalBet, 6);
      return;
    }
    throw new Error('no split-eligible opening hand found within 3000 attempts');
  });
});
