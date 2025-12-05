import type { PrismaClient } from '@prisma/client';
import { databaseAvailabilityDefaults } from '../../config/constants.js';
import { isPrismaConnectivityError } from './databaseErrors.js';

export interface DatabaseAvailabilityConfig {
  degradedCooldownMs: number;
  retryAfterMs: number;
  healthSnapshotTtlMs: number;
}

interface DatabaseErrorSnapshot {
  code?: string;
  message?: string;
  target?: string;
  at: number;
}

interface DatabaseAvailabilitySnapshot {
  status: 'available' | 'degraded';
  degradedUntil?: number;
  retryAfterMs?: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  lastError?: DatabaseErrorSnapshot;
}

interface DatabaseAvailabilityState {
  status: 'available' | 'degraded';
  degradedUntil: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  lastError?: DatabaseErrorSnapshot;
}

let config: DatabaseAvailabilityConfig = {
  degradedCooldownMs: databaseAvailabilityDefaults.degradedCooldownMs,
  retryAfterMs: databaseAvailabilityDefaults.retryAfterMs,
  healthSnapshotTtlMs: databaseAvailabilityDefaults.healthSnapshotTtlMs,
};

const state: DatabaseAvailabilityState = {
  status: 'available',
  degradedUntil: 0,
};

let lastSnapshot: DatabaseAvailabilitySnapshot | null = null;
let lastSnapshotGeneratedAt = 0;

const clampPositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

export const configureDatabaseAvailability = (overrides?: Partial<DatabaseAvailabilityConfig>) => {
  if (!overrides) {
    return;
  }
  config = {
    degradedCooldownMs: clampPositive(
      overrides.degradedCooldownMs ?? config.degradedCooldownMs,
      databaseAvailabilityDefaults.degradedCooldownMs,
    ),
    retryAfterMs: clampPositive(
      overrides.retryAfterMs ?? config.retryAfterMs,
      databaseAvailabilityDefaults.retryAfterMs,
    ),
    healthSnapshotTtlMs: clampPositive(
      overrides.healthSnapshotTtlMs ?? config.healthSnapshotTtlMs,
      databaseAvailabilityDefaults.healthSnapshotTtlMs,
    ),
  };
};

const normalizeErrorSnapshot = (error: unknown): DatabaseErrorSnapshot => {
  if (!error || typeof error !== 'object') {
    return { at: Date.now(), message: typeof error === 'string' ? error : undefined };
  }

  const code = typeof (error as any).code === 'string' ? (error as any).code : undefined;
  const message = typeof (error as any).message === 'string' ? (error as any).message : undefined;
  const target = typeof (error as any).meta?.target === 'string' ? (error as any).meta.target : undefined;
  return { code, message, target, at: Date.now() };
};

const refreshDegradedState = () => {
  if (state.status === 'degraded' && state.degradedUntil <= Date.now()) {
    state.status = 'available';
    state.degradedUntil = 0;
    lastSnapshot = null;
  }
};

export const getDatabaseAvailabilitySnapshot = (): DatabaseAvailabilitySnapshot => {
  refreshDegradedState();
  const now = Date.now();
  if (lastSnapshot && now - lastSnapshotGeneratedAt < config.healthSnapshotTtlMs) {
    return lastSnapshot;
  }
  const remainingMs = state.status === 'degraded' ? Math.max(0, state.degradedUntil - now) : 0;
  lastSnapshot = {
    status: state.status,
    degradedUntil: state.degradedUntil || undefined,
    retryAfterMs: remainingMs || undefined,
    lastFailureAt: state.lastFailureAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
  };
  lastSnapshotGeneratedAt = now;
  return lastSnapshot;
};

export const isDatabaseTemporarilyUnavailable = () => {
  refreshDegradedState();
  return state.status === 'degraded';
};

const enterDegradedMode = (error: unknown) => {
  const snapshot = normalizeErrorSnapshot(error);
  state.status = 'degraded';
  state.degradedUntil = Date.now() + config.degradedCooldownMs;
  state.lastFailureAt = snapshot.at;
  state.lastError = snapshot;
  lastSnapshot = null;
  const reason = snapshot.code || snapshot.message || 'unknown reason';
  console.error(
    `[database] Entering degraded mode for ${config.degradedCooldownMs}ms due to connectivity issue (${reason})`,
  );
};

const markHealthy = () => {
  const wasDegraded = state.status === 'degraded';
  state.status = 'available';
  state.degradedUntil = 0;
  state.lastSuccessAt = Date.now();
  lastSnapshot = null;
  if (wasDegraded) {
    const outageMs = state.lastFailureAt ? state.lastSuccessAt - state.lastFailureAt : undefined;
    console.warn(
      outageMs
        ? `[database] Connectivity restored after ${outageMs}ms outage`
        : '[database] Connectivity restored after temporary outage',
    );
  }
};

export const attachDatabaseAvailabilityTracking = (client: PrismaClient) => {
  client.$use(async (params, next) => {
    try {
      const result = await next(params);
      markHealthy();
      return result;
    } catch (error) {
      if (isPrismaConnectivityError(error)) {
        enterDegradedMode(error);
      }
      throw error;
    }
  });
};
