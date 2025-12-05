import type { PrismaClient } from '@prisma/client';
import { databaseRetryDefaults } from '../../config/constants.js';
import { isPrismaTransientError } from './databaseErrors.js';

export interface DatabaseRetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
}

let config: DatabaseRetryConfig = {
  maxAttempts: databaseRetryDefaults.maxAttempts,
  initialDelayMs: databaseRetryDefaults.initialDelayMs,
  maxDelayMs: databaseRetryDefaults.maxDelayMs,
  backoffMultiplier: databaseRetryDefaults.backoffMultiplier,
  jitterRatio: databaseRetryDefaults.jitterRatio,
};

const clampPositiveInteger = (value: number, fallback: number, minimum = 1) =>
  Number.isFinite(value) && value >= minimum ? Math.floor(value) : fallback;

const clampPositiveNumber = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clampRatio = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

export const configureDatabaseRetry = (overrides?: Partial<DatabaseRetryConfig>) => {
  if (!overrides) {
    return;
  }
  config = {
    maxAttempts: clampPositiveInteger(
      overrides.maxAttempts ?? config.maxAttempts,
      databaseRetryDefaults.maxAttempts,
      1,
    ),
    initialDelayMs: clampPositiveInteger(
      overrides.initialDelayMs ?? config.initialDelayMs,
      databaseRetryDefaults.initialDelayMs,
      1,
    ),
    maxDelayMs: clampPositiveInteger(
      overrides.maxDelayMs ?? config.maxDelayMs,
      databaseRetryDefaults.maxDelayMs,
      config.initialDelayMs,
    ),
    backoffMultiplier: clampPositiveNumber(
      overrides.backoffMultiplier ?? config.backoffMultiplier,
      databaseRetryDefaults.backoffMultiplier,
    ),
    jitterRatio: clampRatio(overrides.jitterRatio ?? config.jitterRatio, databaseRetryDefaults.jitterRatio),
  };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'unknown';
  }
  const code = typeof (error as any).code === 'string' ? (error as any).code : undefined;
  if (code) {
    return code;
  }
  if (typeof (error as any).message === 'string') {
    return (error as any).message;
  }
  return error.constructor?.name ?? 'unknown';
};

const calculateDelay = (attempt: number) => {
  const base = Math.min(
    config.maxDelayMs,
    Math.round(config.initialDelayMs * Math.pow(config.backoffMultiplier, Math.max(0, attempt - 1))),
  );
  if (config.jitterRatio <= 0) {
    return base;
  }
  const jitter = base * config.jitterRatio;
  const randomOffset = Math.round((Math.random() * jitter * 2 - jitter) || 0);
  return Math.max(0, base + randomOffset);
};

export const withDatabaseRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < config.maxAttempts) {
    attempt++;
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isPrismaTransientError(error) || attempt >= config.maxAttempts) {
        throw error;
      }
      const delay = calculateDelay(attempt);
      console.warn(
        `[database] transient Prisma error (${describeError(error)}), retrying attempt ${attempt + 1}/${config.maxAttempts} in ${delay}ms`,
      );
      await wait(delay);
    }
  }
  throw lastError;
};

export const attachDatabaseRetry = (client: PrismaClient) => {
  client.$use(async (params, next) => {
    return withDatabaseRetry(() => next(params));
  });
};
