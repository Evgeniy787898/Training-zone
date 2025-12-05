import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';
import type { PrismaClient } from '@prisma/client';

import { createTraceContextMiddleware } from '../../middleware/traceContext.js';
import { profileContextMiddleware } from '../../middleware/profileContext.js';
import { createErrorHandler } from '../../middleware/errorHandler.js';
import { bodySizeLimits, describeBodySize } from '../../modules/security/bodySizeLimits.js';
import { DependencyContainer, diTokens } from '../../services/container.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionService } from '../../services/sessionService.js';
import achievementsRouter from '../../routes/achievements.js';
import profileRouter from '../../routes/profile.js';
import sessionsRouter from '../../routes/sessions.js';
import reportsRouter from '../../routes/reports.js';
import dailyAdviceRouter from '../../routes/dailyAdvice.js';
import type { SafePrismaClient } from '../../types/prisma.js';

const ensureEnv = (key: string, value: string) => {
  if (!process.env[key] || process.env[key]!.length === 0) {
    process.env[key] = value;
  }
};

export const ensureFullStackTestEnvironment = () => {
  ensureEnv('NODE_ENV', 'test');
  ensureEnv('SUPABASE_URL', 'https://example.supabase.co');
  ensureEnv('SUPABASE_ANON_KEY', 'supabase-anon-key-for-tests');
  ensureEnv('SUPABASE_SERVICE_KEY', 'supabase-service-key-for-tests');
  ensureEnv('TELEGRAM_BOT_TOKEN', '123456789:test-token-for-tests-abcdefghijkl');
  ensureEnv('TELEGRAM_WEBAPP_SECRET', 'telegram-webapp-secret-value-for-tests-1234567890');
  ensureEnv('ENCRYPTION_SECRET', 'encryption-secret-for-tests-please-change');
  ensureEnv('JWT_SECRET_KEYS', 'test-active:jwt-secret-for-tests-1234567890');
  ensureEnv('JWT_SECRET_ACTIVE_ID', 'test-active');
  ensureEnv('JWT_SECRET', 'legacy-jwt-secret-for-tests-1234567890');
  ensureEnv('CSRF_SECRET', 'csrf-secret-value-for-tests-1234567890-abcdefghijkl');
  ensureEnv('FRONTEND_URL', 'http://localhost:4173');
  ensureEnv('WEBAPP_URL', 'https://app.tzona.local');
  ensureEnv('MEDIA_BASE_URL', 'https://cdn.tzona.local/media');
  ensureEnv('MEDIA_CDN_BASE_URL', 'https://cdn.tzona.local');
  ensureEnv('CACHE_NAMESPACE', 'tzona-test-suite');
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../../..');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');

export const applyTestMigrations = (databaseUrl: string) => {
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--schema', schemaPath], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
};

export const createTestPrismaClient = async (databaseUrl: string) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
  await prisma.$connect();
  return prisma;
};

export const createFullStackTestApp = (prisma: PrismaClient) => {
  const app = express();
  const baseContainer = new DependencyContainer(null);
  baseContainer.registerValue(diTokens.prisma, prisma as unknown as SafePrismaClient);
  baseContainer.registerFactory(diTokens.sessionRepository, () => new SessionRepository(prisma as unknown as SafePrismaClient));
  baseContainer.registerFactory(diTokens.sessionService, (container) => {
    const repository = container.resolve(diTokens.sessionRepository);
    return new SessionService(repository);
  });

  app.use(createTraceContextMiddleware());
  app.use(express.json());
  app.use((req, _res, next) => {
    req.prisma = prisma as unknown as SafePrismaClient;
    req.container = baseContainer.createScope();
    next();
  });

  const protectedApi = express.Router();
  protectedApi.use(profileContextMiddleware(prisma as unknown as SafePrismaClient));
  protectedApi.use('/sessions', sessionsRouter);
  protectedApi.use('/profile', profileRouter);
  protectedApi.use('/achievements', achievementsRouter);
  protectedApi.use('/daily-advice', dailyAdviceRouter);
  protectedApi.use('/reports', reportsRouter);

  app.use('/api', protectedApi);
  app.use(createErrorHandler({ defaultBodyLimit: bodySizeLimits.default, describeBodySize }));

  return app;
};
