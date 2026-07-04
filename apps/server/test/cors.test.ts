import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers/buildTestApp.js';

describe('CORS allowlist', () => {
  it('reflects any origin when CORS_ORIGIN is unset (dev default)', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/healthz').set('Origin', 'https://anything.example.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://anything.example.com');
  });

  it('echoes an allowed origin when an explicit allowlist is configured', async () => {
    const { app } = buildTestApp({ corsOrigins: ['https://app.example.com', 'https://staging.example.com'] });

    const res = await request(app).get('/healthz').set('Origin', 'https://app.example.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });

  it('omits the ACAO header for an origin not on the allowlist', async () => {
    const { app } = buildTestApp({ corsOrigins: ['https://app.example.com'] });

    const res = await request(app).get('/healthz').set('Origin', 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
