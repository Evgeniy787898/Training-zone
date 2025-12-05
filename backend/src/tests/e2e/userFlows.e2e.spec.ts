import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';

import { closeCache } from '../../modules/infrastructure/cache.js';
import {
  applyTestMigrations,
  createFullStackTestApp,
  createTestPrismaClient,
  ensureFullStackTestEnvironment,
} from '../utils/fullStackTestHarness.js';
import { TrainingSessionStatus } from '../../types/sessions.js';

ensureFullStackTestEnvironment();
const defaultDatabaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/tzona_e2e';
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? defaultDatabaseUrl;
process.env.E2E_DATABASE_URL = e2eDatabaseUrl;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = e2eDatabaseUrl;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = e2eDatabaseUrl;
}
if (!process.env.SHADOW_DATABASE_URL) {
  process.env.SHADOW_DATABASE_URL = e2eDatabaseUrl;
}

let prisma: PrismaClient;
let app: express.Express;

beforeAll(async () => {
  applyTestMigrations(e2eDatabaseUrl);
  prisma = await createTestPrismaClient(e2eDatabaseUrl);
  app = createFullStackTestApp(prisma);
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.trainingSessionExercise.deleteMany(),
    prisma.trainingSession.deleteMany(),
    prisma.metric.deleteMany(),
    prisma.achievement.deleteMany(),
    prisma.profile.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
  await closeCache();
});

const createProfile = async () => {
  const profileId = randomUUID();
  const profile = await prisma.profile.create({
    data: {
      id: profileId,
      telegramId: BigInt(Date.now()),
      firstName: 'E2E',
      timezone: 'UTC',
    },
  });
  return profile;
};

const authHeaders = (profileId: string) => ({
  'x-profile-id': profileId,
});

describe('End-to-end user flows', () => {
  it('returns profile summary with adherence metrics', async () => {
    const profile = await createProfile();

    const today = new Date();
    const previousDay = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await prisma.trainingSession.createMany({
      data: [
        {
          id: randomUUID(),
          profileId: profile.id,
          plannedAt: today,
          status: TrainingSessionStatus.done,
        },
        {
          id: randomUUID(),
          profileId: profile.id,
          plannedAt: previousDay,
          status: TrainingSessionStatus.skipped,
        },
      ],
    });

    await prisma.metric.create({
      data: {
        id: randomUUID(),
        profileId: profile.id,
        metricType: 'weight',
        value: new Prisma.Decimal(82.4),
        recordedAt: today,
      },
    });

    const response = await request(app).get('/api/profile/summary').set(authHeaders(profile.id));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.adherence.completed_sessions).toBe(1);
    expect(response.body.data.adherence.total_sessions).toBe(2);
    expect(response.body.data.metrics[0].metricType).toBe('weight');
    expect(response.body.meta.traceId).toBeDefined();
  });

  it('creates and lists sessions end-to-end', async () => {
    const profile = await createProfile();
    const plannedAt = new Date().toISOString();

    const createResponse = await request(app)
      .post('/api/sessions')
      .set(authHeaders(profile.id))
      .send({
        planned_at: plannedAt,
        status: TrainingSessionStatus.done,
        notes: 'End-to-end session',
      });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data.session.status).toBe(TrainingSessionStatus.done);

    const storedSessions = await prisma.trainingSession.findMany({ where: { profileId: profile.id } });
    expect(storedSessions).toHaveLength(1);

    const weekResponse = await request(app)
      .get('/api/sessions/week')
      .query({ date: plannedAt })
      .set(authHeaders(profile.id));

    expect(weekResponse.status).toBe(200);
    expect(weekResponse.body.data.sessions).toHaveLength(1);
    expect(weekResponse.body.data.sessions[0].id).toBe(createResponse.body.data.session.id);
  });

  it('paginates and filters achievements', async () => {
    const profile = await createProfile();

    const achievements = Array.from({ length: 3 }).map((_, index) => ({
      id: randomUUID(),
      profileId: profile.id,
      title: `Achievement ${index + 1}`,
      description: 'E2E test achievement',
      awardedAt: new Date(Date.now() - index * 1000),
    }));

    await prisma.achievement.createMany({ data: achievements });

    const response = await request(app)
      .get('/api/achievements')
      .query({ page: 1, page_size: 2, fields: 'title,awardedAt' })
      .set(authHeaders(profile.id));

    expect(response.status).toBe(200);
    expect(response.body.data.achievements).toHaveLength(2);
    for (const achievement of response.body.data.achievements) {
      expect(Object.keys(achievement)).toEqual(['title', 'awardedAt']);
    }
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.has_more).toBe(true);
  });
});
