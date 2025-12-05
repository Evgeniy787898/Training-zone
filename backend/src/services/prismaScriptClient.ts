import type { SafePrismaClient } from '../types/prisma.js';
import { validateEnvironment } from '../config/env.js';
import { createPrismaClientWithPooling } from './prismaConnection.js';
import { preparePrismaClient } from './prismaEnhancer.js';

export interface ScriptPrismaClientOptions {
  databaseUrl?: string;
  preferPool?: boolean;
  warmupTimeoutMs?: number;
  logLevels?: ('info' | 'warn' | 'error')[];
}

const resolveFirst = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return null;
};

export const createScriptPrismaClient = async (
  options: ScriptPrismaClientOptions = {},
): Promise<SafePrismaClient> => {
  const env = validateEnvironment();

  const overrideUrl = options.databaseUrl ?? null;
  const poolUrl = resolveFirst(
    overrideUrl,
    env.PRISMA_POOL_URL,
    env.PRISMA_RUNTIME_URL,
    env.DATABASE_POOL_URL,
    env.DATABASE_URL,
  );
  const directUrl = resolveFirst(
    overrideUrl,
    env.PRISMA_DIRECT_URL,
    env.DIRECT_URL,
    env.DATABASE_DIRECT_URL,
    env.DATABASE_URL,
  );

  if (!poolUrl && !directUrl) {
    throw new Error('DATABASE_URL не задан. Укажите переменную окружения или передайте databaseUrl в createScriptPrismaClient().');
  }

  const preferPool = options.preferPool ?? Boolean(poolUrl);
  const { client } = await createPrismaClientWithPooling({
    poolUrl: preferPool ? poolUrl : null,
    directUrl: directUrl ?? poolUrl,
    preferPool,
    fallbackOnFailure: true,
    warmupTimeoutMs: options.warmupTimeoutMs ?? 2000,
    connectionHeadroom: 0,
    logLevels: options.logLevels ?? ['error'],
  });

  return preparePrismaClient(client, {
    enableAvailabilityTracking: false,
    enableSlowQueryLogging: false,
  });
};

