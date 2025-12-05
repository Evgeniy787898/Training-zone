import { env, validateEnvironment } from './env.js';
import {
  cacheAdaptiveTtlConfig,
  cacheCompressionConfig,
  cacheConfig,
  cacheFallbackConfig,
  cacheStampedeProtectionConfig,
  cacheVersioningConfig,
  cacheWarmingConfig,
  httpClientConfig,
  loggingConfig,
  monitoringDefaults,
  rateLimitConfig,
} from './constants.js';
import { applyEnvironmentProfile, type EnvironmentStage } from './environmentProfiles.js';
import type {
  CacheConfig,
  CacheRuntimeDefaults,
  HttpClientConfig,
  MonitoringDefaults,
  RateLimitConfig,
  LoggingConfig,
} from '../types/config.js';

export type AppConfig = {
  app: {
    stage: EnvironmentStage;
    nodeEnv: typeof env.NODE_ENV;
    port: number;
    host: string;
    frontendOrigins: string[];
    mediaBaseUrl: string | null;
    mediaCdnBaseUrl: string | null;
  };
  database: {
    primaryUrl: string | null;
    poolUrl: string | null;
    directUrl: string | null;
  };
  security: {
    encryptionSecret: string;
    encryptionFallbackSecret: string | null;
    jwtSecretRegistry: string | null;
    jwtActiveKeyId: string | null;
    jwtLegacyKeyId: string | null;
    jwtFallbackSecret: string | null;
    csrfSecret: string;
    csrfFallbackSecret: string | null;
  };
  cache: {
    strategy: CacheConfig & CacheRuntimeDefaults;
    fallback: typeof cacheFallbackConfig;
    stampede: typeof cacheStampedeProtectionConfig;
    adaptiveTtl: typeof cacheAdaptiveTtlConfig;
    compression: typeof cacheCompressionConfig;
    versioning: typeof cacheVersioningConfig;
    warming: typeof cacheWarmingConfig;
  };
  monitoring: MonitoringDefaults & {
    webhookUrl?: string;
    webhookAuthHeader?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
  };
  httpClient: HttpClientConfig;
  rateLimits: RateLimitConfig;
  logging: LoggingConfig;
};

let cachedConfig: AppConfig | null = null;

const toList = (value: string | null | undefined): string[] =>
  value
    ? value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    : [];

const buildMonitoringConfig = (): AppConfig['monitoring'] => {
  const base: MonitoringDefaults = monitoringDefaults;
  return {
    ...base,
    webhookUrl: process.env.MONITORING_WEBHOOK_URL || undefined,
    webhookAuthHeader: process.env.MONITORING_WEBHOOK_AUTH_HEADER || undefined,
    telegramBotToken: process.env.ALERT_TELEGRAM_BOT_TOKEN || process.env.MONITORING_TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: process.env.ALERT_TELEGRAM_CHAT_ID || process.env.MONITORING_TELEGRAM_CHAT_ID || undefined,
    minSeverityForAlerts:
      (process.env.MONITORING_ALERT_MIN_SEVERITY as typeof base.minSeverityForAlerts | undefined) ||
      base.minSeverityForAlerts,
    dedupeTtlMs: Number(process.env.MONITORING_DEDUPE_TTL_MS) || base.dedupeTtlMs,
    webhookTimeoutMs: Number(process.env.MONITORING_WEBHOOK_TIMEOUT_MS) || base.webhookTimeoutMs,
  };
};

const buildCacheRuntime = (): CacheConfig & CacheRuntimeDefaults => ({
  ...cacheConfig,
  runtime: (cacheConfig as any).runtime,
  defaultTtlMs: (cacheConfig as any).defaultTtlMs,
  namespace: (cacheConfig as any).namespace,
} as any);

const buildDatabaseConfig = () => {
  const validated = validateEnvironment();
  const candidatePool =
    validated.PRISMA_POOL_URL ||
    validated.DATABASE_POOL_URL ||
    validated.DIRECT_URL ||
    validated.PRISMA_DIRECT_URL ||
    validated.DATABASE_DIRECT_URL ||
    null;
  const candidatePrimary =
    validated.PRISMA_RUNTIME_URL ||
    validated.PRISMA_POOL_URL ||
    validated.DATABASE_POOL_URL ||
    validated.DATABASE_URL ||
    validated.DIRECT_URL ||
    validated.PRISMA_DIRECT_URL ||
    validated.DATABASE_DIRECT_URL ||
    null;

  return {
    primaryUrl: candidatePrimary,
    poolUrl: candidatePool,
    directUrl: validated.PRISMA_DIRECT_URL || validated.DATABASE_DIRECT_URL || validated.DIRECT_URL || null,
  };
};

export const getConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const frontendOrigins = toList(env.FRONTEND_URL);

  const baseConfig: AppConfig = {
    app: {
      stage: env.APP_ENV,
      nodeEnv: env.NODE_ENV,
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      frontendOrigins,
      mediaBaseUrl: env.MEDIA_BASE_URL || null,
      mediaCdnBaseUrl: env.MEDIA_CDN_BASE_URL || null,
    },
    database: buildDatabaseConfig(),
    security: {
      encryptionSecret: env.ENCRYPTION_SECRET,
      encryptionFallbackSecret: env.ENCRYPTION_SECRET_PREVIOUS || null,
      jwtSecretRegistry: env.JWT_SECRET_KEYS || null,
      jwtActiveKeyId: env.JWT_SECRET_ACTIVE_ID || null,
      jwtLegacyKeyId: env.JWT_SECRET_LEGACY_ID || null,
      jwtFallbackSecret: env.JWT_SECRET || null,
      csrfSecret: env.CSRF_SECRET,
      csrfFallbackSecret: env.CSRF_SECRET_PREVIOUS || null,
    },
    cache: {
      strategy: buildCacheRuntime(),
      fallback: cacheFallbackConfig,
      stampede: cacheStampedeProtectionConfig,
      adaptiveTtl: cacheAdaptiveTtlConfig,
      compression: cacheCompressionConfig,
      versioning: cacheVersioningConfig,
      warming: cacheWarmingConfig,
    },
    monitoring: buildMonitoringConfig(),
    httpClient: httpClientConfig,
    rateLimits: rateLimitConfig,
    logging: loggingConfig,
  };

  cachedConfig = applyEnvironmentProfile(env.APP_ENV, baseConfig);

  return cachedConfig;
};

export const resetConfig = (): void => {
  cachedConfig = null;
};
