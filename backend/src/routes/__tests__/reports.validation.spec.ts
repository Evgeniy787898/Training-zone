import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import reportsRouter from '../../routes/reports.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.traceId = 'reports-trace';
    next();
  });
  app.use('/api/reports', reportsRouter);
  return app;
};

describe('Reports route validation', () => {
  it('rejects invalid range query parameter', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/api/reports/volume_trend')
      .query({ range: 'bad-format' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'validation_failed',
        classification: 'validation',
        resource: '/volume_trend',
      },
    });
  });
});
