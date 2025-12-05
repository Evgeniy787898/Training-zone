import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import authRouter from '../../routes/auth.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.traceId = 'validation-trace';
    next();
  });
  app.use('/api/auth', authRouter);
  return app;
};

describe('Auth route validation', () => {
  it('rejects malformed x-profile-id header for verify-pin', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/auth/verify-pin')
      .set('x-profile-id', 'invalid-uuid')
      .send({ pin: '1234' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'validation_failed',
        classification: 'validation',
        resource: '/verify-pin',
      },
    });
  });
});
