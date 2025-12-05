import type { PrismaClient } from '@prisma/client';
import { applyStringSanitization } from './stringSanitization.js';
import { applyJsonOptimization } from './jsonOptimization.js';
import { applyXssProtection } from '../modules/security/xssProtection.js';
import { applySensitiveDataEncryption } from './sensitiveDataEncryption.js';
import { ensureEncryptionConfigured } from '../modules/security/encryption.js';
import { attachDatabaseAvailabilityTracking } from '../modules/database/databaseAvailability.js';
import { attachDatabaseRetry } from '../modules/database/databaseRetry.js';
import { attachPrismaSlowQueryLogging } from './prismaQueryLogging.js';
import { hardenPrismaAgainstSqlInjection } from '../modules/database/prismaGuards.js';
import type { SafePrismaClient } from '../types/prisma.js';

export interface PrismaEnhancerOptions {
  enableRetry?: boolean;
  enableAvailabilityTracking?: boolean;
  enableSlowQueryLogging?: boolean;
}

export const preparePrismaClient = (
  client: PrismaClient,
  options: PrismaEnhancerOptions = {},
): SafePrismaClient => {
  applyStringSanitization(client);
  applyJsonOptimization(client);
  applyXssProtection(client);
  applySensitiveDataEncryption(client);
  ensureEncryptionConfigured();

  if (options.enableRetry !== false) {
    attachDatabaseRetry(client);
  }

  if (options.enableAvailabilityTracking !== false) {
    attachDatabaseAvailabilityTracking(client);
  }

  if (options.enableSlowQueryLogging !== false) {
    attachPrismaSlowQueryLogging(client);
  }

  return hardenPrismaAgainstSqlInjection(client);
};

