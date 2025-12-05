import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let createCsrfProtectionMiddleware: typeof import('../csrfProtection.js').createCsrfProtectionMiddleware;
let createCsrfToken: typeof import('../../modules/security/csrf.js').createCsrfToken;
let CSRF_COOKIE_NAME: typeof import('../../modules/security/csrf.js').CSRF_COOKIE_NAME;

const PROFILE_ID = 'profile-security-test';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.profile = { id: PROFILE_ID } as any;
    next();
  });
  app.use(createCsrfProtectionMiddleware());
  app.post('/api/secure', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

beforeAll(async () => {
  process.env.CSRF_SECRET ??= 'csrf-secret-value-for-tests-1234567890-abcdefghijkl';
  const middlewareModule = await import('../csrfProtection.js');
  createCsrfProtectionMiddleware = middlewareModule.createCsrfProtectionMiddleware;
  const csrfModule = await import('../../modules/security/csrf.js');
  createCsrfToken = csrfModule.createCsrfToken;
  CSRF_COOKIE_NAME = csrfModule.CSRF_COOKIE_NAME;
});

describe('CSRF protection middleware', () => {
  it('rejects requests without matching CSRF tokens', async () => {
    const app = createApp();

    const resMissing = await request(app).post('/api/secure').send({ foo: 'bar' });
    expect(resMissing.status).toBe(403);
    expect(resMissing.body.error).toBe('csrf_required');

    const cookieToken = createCsrfToken(PROFILE_ID).token;
    const resMismatch = await request(app)
      .post('/api/secure')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${cookieToken}`)
      .set('X-CSRF-Token', 'different-token')
      .send({ foo: 'bar' });

    expect(resMismatch.status).toBe(403);
    expect(resMismatch.body.error).toBe('csrf_mismatch');
  });

  it('allows requests with valid double-submit tokens', async () => {
    const app = createApp();
    const { token } = createCsrfToken(PROFILE_ID);

    const res = await request(app)
      .post('/api/secure')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
      .set('X-CSRF-Token', token)
      .send({ foo: 'bar' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

