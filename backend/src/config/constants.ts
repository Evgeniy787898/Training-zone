import type { CompressionDefaults } from '../types/compression.js';
import type {
  AssistantHistoryConfig,
  AiAdvisorContextConfig,
  AiAdvisorMonitoringConfig,
  AssistantLimits,
  BatchOperationDefaults,
  BodySizeDefaults,
  BotInactivityDefaults,
  BotMessageBufferConfig,
  CacheAdaptiveTtlConfig,
  CacheCompressionConfig,
  CacheConfig,
  CacheFallbackConfig,
  CacheMonitoringConfig,
  CacheRuntimeDefaults,
  CacheStampedeProtectionConfig,
  CacheVersioningConfig,
  CacheWarmingConfig,
  CapacityPlanningConfig,
  CircuitBreakerDefaults,
  CsrfDefaults,
  DatabaseAvailabilityDefaults,
  DatabaseRetryDefaults,
  AnomalyAlertConfig,
  FieldSelectionConfig,
  BusinessMetricsConfig,
  ImageProcessorConfig,
  ImageProcessorResizeMode,
  JwtDefaults,
  MaterializedViewConfig,
  MediaCacheConfig,
  MicroservicesConfig,
  MonitoringDefaults,
  SlaConfig,
  PerformanceMetricsConfig,
  ResourceMetricsConfig,
  PaginationConfig,
  ProfileContextCacheConfig,
  RateLimitConfig,
  LoggingConfig,
  RequestTimeoutDefaults,
  SizeUnits,
  SlowQueryDefaults,
  MetricsDashboardConfig,
  UrlValidationLimits,
  ArchiveConfig,
} from '../types/config.js';
import {
  parseBoolean,
  parsePositiveNumberWithFallback,
} from '../utils/envParsers.js';

// Обертка для совместимости с существующим кодом
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  return parsePositiveNumberWithFallback(value, fallback);
};

const parseRatio = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return clampNumber(fallback, 0, 1);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clampNumber(fallback, 0, 1);
  }
  return clampNumber(parsed, 0, 1);
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const parseNumberInRange = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (!value) {
    return clampNumber(fallback, min, max);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clampNumber(fallback, min, max);
  }

  return clampNumber(parsed, min, max);
};

const parseCommaSeparatedList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const allowedLogLevels = ['debug', 'info', 'warn', 'error'] as const;

const parseLogLevel = (value: string | undefined): (typeof allowedLogLevels)[number] => {
  if (!value) {
    return 'info';
  }
  const normalized = value.trim().toLowerCase();
  return (allowedLogLevels as readonly string[]).includes(normalized)
    ? (normalized as (typeof allowedLogLevels)[number])
    : 'info';
};

const parseRedactedPatterns = (value: string | undefined, fallback: RegExp[]): RegExp[] => {
  if (!value) {
    return fallback;
  }
  const entries = value.split(/[,;]/).map((entry) => entry.trim()).filter(Boolean);
  const patterns: RegExp[] = [];
  for (const entry of entries) {
    try {
      patterns.push(new RegExp(entry, 'i'));
    } catch {
      // ignore invalid patterns
    }
  }
  return patterns.length ? patterns : fallback;
};

const parseQuality = (
  value: string | undefined,
  fallback: number,
  limits: { min: number; max: number },
): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clampNumber(Math.floor(parsed), limits.min, limits.max);
};

const canonicalImageFormat = (value: string | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized.startsWith('image/')) {
    return normalized;
  }
  return `image/${normalized}`;
};

const parseImageFormatList = (
  value: string | undefined,
  defaultFormat: string,
): readonly string[] => {
  const parts = value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  const normalized = parts.map((item) => canonicalImageFormat(item, defaultFormat));
  if (!normalized.length) {
    normalized.push(defaultFormat);
  }
  if (!normalized.includes(defaultFormat)) {
    normalized.unshift(defaultFormat);
  }
  return Object.freeze(Array.from(new Set(normalized)));
};

const hexColorRegex = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const normalizeHexColor = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(hexColorRegex);
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }
  if (hex.length === 6) {
    hex = `${hex}FF`;
  }
  return `#${hex.toUpperCase()}`;
};

const buildMicroserviceConfig = (
  name: string,
  defaults: { timeoutMs: number },
): MicroservicesConfig[keyof MicroservicesConfig] => {
  const baseUrl = process.env[`${name}_BASE_URL`] ?? '';
  const enabled = parseBoolean(process.env[`${name}_ENABLED`], Boolean(baseUrl));
  const timeoutMs = parsePositiveInt(process.env[`${name}_TIMEOUT_MS`], defaults.timeoutMs);
  const token = (process.env[`${name}_API_TOKEN`] ?? process.env[`${name}_TOKEN`] ?? '').trim();
  return Object.freeze({
    enabled: enabled && Boolean(baseUrl),
    baseUrl,
    timeoutMs,
    token: token || null,
  });
};

const resizeModes: readonly ImageProcessorResizeMode[] = ['contain', 'cover', 'fill', 'stretch', 'pad'];

const parseResizeMode = (
  value: string | undefined,
  fallback: ImageProcessorResizeMode,
): ImageProcessorResizeMode => {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase() as ImageProcessorResizeMode;
  return resizeModes.includes(normalized) ? normalized : fallback;
};

const parseResizeModeList = (
  value: string | undefined,
  fallback: ImageProcessorResizeMode,
): readonly ImageProcessorResizeMode[] => {
  const parsed = new Set<ImageProcessorResizeMode>();
  if (value) {
    value
      .split(',')
      .map((mode) => mode.trim().toLowerCase() as ImageProcessorResizeMode)
      .filter((mode): mode is ImageProcessorResizeMode => resizeModes.includes(mode))
      .forEach((mode) => parsed.add(mode));
  }
  if (!parsed.size) {
    parsed.add(fallback);
  }
  if (!parsed.has(fallback)) {
    parsed.add(fallback);
  }
  return Object.freeze(Array.from(parsed));
};

const cacheCompressionEncodings = ['brotli', 'gzip'] as const;
export type CacheCompressionEncoding = (typeof cacheCompressionEncodings)[number];

const parseCacheCompressionEncoding = (value: string | undefined): CacheCompressionEncoding => {
  if (!value) {
    return 'brotli';
  }
  const normalized = value.trim().toLowerCase();
  return (cacheCompressionEncodings.find((encoding) => encoding === normalized) ?? 'brotli') as CacheCompressionEncoding;
};

const parseCacheVersion = (value: string | undefined, fallback = 1): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.floor(parsed);
  return clampNumber(normalized, 1, 1_000_000);
};

export const cacheRuntimeDefaults = Object.freeze({
  namespace: 'tzona',
  memory: Object.freeze({
    sweepIntervalMs: 60_000,
    maxEntries: 5_000,
  }),
  redis: Object.freeze({
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  }),
}) satisfies CacheRuntimeDefaults;

export const cacheFallbackConfig = Object.freeze({
  enabled: parseBoolean(process.env.CACHE_FALLBACK_ENABLED, true),
  failureThreshold: clampNumber(parsePositiveInt(process.env.CACHE_FALLBACK_FAILURE_THRESHOLD, 3), 1, 50),
  cooldownMs: parsePositiveInt(process.env.CACHE_FALLBACK_COOLDOWN_MS, 60_000),
  logThrottleMs: parsePositiveInt(process.env.CACHE_FALLBACK_LOG_THROTTLE_MS, 30_000),
}) satisfies CacheFallbackConfig;

export const cacheConfig = Object.freeze({
  profile: Object.freeze({
    summary: Object.freeze({
      ttlSeconds: 2 * 60,
      edge: Object.freeze({
        maxAge: 30,
        sMaxAge: 120,
        staleWhileRevalidate: 300,
        staleIfError: 600,
      }),
    }),
  }),
  achievements: Object.freeze({
    ttlSeconds: 5 * 60,
    edge: Object.freeze({
      maxAge: 30,
      sMaxAge: 300,
      staleWhileRevalidate: 600,
      staleIfError: 3600,
    }),
  }),
  exercises: Object.freeze({
    catalog: Object.freeze({
      ttlSeconds: 90,
      edge: Object.freeze({
        maxAge: 30,
        sMaxAge: 120,
        staleWhileRevalidate: 300,
        staleIfError: 900,
      }),
    }),
    list: Object.freeze({
      ttlSeconds: 45,
      edge: Object.freeze({
        maxAge: 30,
        sMaxAge: 90,
        staleWhileRevalidate: 180,
        staleIfError: 600,
      }),
    }),
  }),
  training: Object.freeze({
    disciplines: Object.freeze({ ttlSeconds: 5 * 60 }),
    programs: Object.freeze({ ttlSeconds: 5 * 60 }),
  }),
  reports: Object.freeze({
    ttlSeconds: 300,
    edge: Object.freeze({ maxAge: 30, sMaxAge: 300, staleWhileRevalidate: 3600 }),
  }),
  dailyAdvice: Object.freeze({
    list: Object.freeze({
      ttlSeconds: 10 * 60,
    }),
  }),
  assistant: Object.freeze({
    notes: Object.freeze({
      ttlSeconds: 2 * 60,
    }),
    aiAdvice: Object.freeze({
      ttlSeconds: clampNumber(
        parsePositiveInt(process.env.CACHE_ASSISTANT_AI_ADVISOR_TTL_SECONDS, 45),
        10,
        10 * 60,
      ),
    }),
  }),
  analytics: Object.freeze({
    ttlSeconds: 5 * 60,
  }),
}) satisfies CacheConfig;

const rawStampedeJitterPercent = Number(process.env.CACHE_STAMPEDE_MAX_JITTER_PERCENT);
const normalizedStampedeJitterPercent = Number.isFinite(rawStampedeJitterPercent)
  ? rawStampedeJitterPercent
  : 15;

export const cacheStampedeProtectionConfig = Object.freeze({
  lockTtlSeconds: clampNumber(parsePositiveInt(process.env.CACHE_STAMPEDE_LOCK_TTL_SECONDS, 5), 1, 60),
  waitIntervalMs: clampNumber(parsePositiveInt(process.env.CACHE_STAMPEDE_WAIT_INTERVAL_MS, 50), 10, 1000),
  maxWaitMs: clampNumber(parsePositiveInt(process.env.CACHE_STAMPEDE_MAX_WAIT_MS, 1500), 100, 10_000),
  maxJitterSeconds: clampNumber(parsePositiveInt(process.env.CACHE_STAMPEDE_MAX_JITTER_SECONDS, 10), 0, 120),
  maxJitterPercent: clampNumber(normalizedStampedeJitterPercent, 0, 80) / 100,
}) satisfies CacheStampedeProtectionConfig;

export const cacheMonitoringConfig = Object.freeze({
  enabled: parseBoolean(process.env.CACHE_MONITORING_ENABLED, true),
  reportIntervalMs: parsePositiveInt(process.env.CACHE_MONITORING_INTERVAL_MS, 60_000),
  warnThreshold: parseRatio(process.env.CACHE_MONITORING_WARN_THRESHOLD, 0.8),
  criticalThreshold: parseRatio(process.env.CACHE_MONITORING_CRITICAL_THRESHOLD, 0.5),
  minSamples: parsePositiveInt(process.env.CACHE_MONITORING_MIN_SAMPLES, 200),
}) satisfies CacheMonitoringConfig;

const adaptiveTtlFastWindow = clampNumber(
  parsePositiveInt(process.env.CACHE_ADAPTIVE_TTL_FAST_WINDOW_SECONDS, 120),
  10,
  3_600,
);
const adaptiveTtlSlowWindowBase = clampNumber(
  parsePositiveInt(process.env.CACHE_ADAPTIVE_TTL_SLOW_WINDOW_SECONDS, 3_600),
  60,
  24 * 60 * 60,
);

export const cacheAdaptiveTtlConfig = Object.freeze({
  enabled: parseBoolean(process.env.CACHE_ADAPTIVE_TTL_ENABLED, true),
  fastWindowSeconds: adaptiveTtlFastWindow,
  slowWindowSeconds: Math.max(adaptiveTtlSlowWindowBase, adaptiveTtlFastWindow + 1),
  minMultiplier: parseNumberInRange(process.env.CACHE_ADAPTIVE_TTL_MIN_MULTIPLIER, 0.5, 0.1, 1),
  maxMultiplier: parseNumberInRange(process.env.CACHE_ADAPTIVE_TTL_MAX_MULTIPLIER, 2, 1, 5),
}) satisfies CacheAdaptiveTtlConfig;

export const cacheCompressionConfig = Object.freeze({
  enabled: parseBoolean(process.env.CACHE_COMPRESSION_ENABLED, true),
  minSizeBytes: clampNumber(parsePositiveInt(process.env.CACHE_COMPRESSION_MIN_SIZE_BYTES, 4 * 1024), 256, 10 * 1024 * 1024),
  encoding: parseCacheCompressionEncoding(process.env.CACHE_COMPRESSION_ENCODING),
  brotliQuality: parseQuality(process.env.CACHE_COMPRESSION_BROTLI_QUALITY, 5, { min: 1, max: 11 }),
  gzipLevel: clampNumber(parsePositiveInt(process.env.CACHE_COMPRESSION_GZIP_LEVEL, 6), 1, 9),
}) satisfies CacheCompressionConfig;

export const cacheVersioningConfig = Object.freeze({
  globalVersion: parseCacheVersion(process.env.CACHE_VERSION_GLOBAL, 1),
  resources: Object.freeze({
    profileSummary: parseCacheVersion(process.env.CACHE_VERSION_PROFILE_SUMMARY, 1),
    achievementsPage: parseCacheVersion(process.env.CACHE_VERSION_ACHIEVEMENTS_PAGE, 1),
    exerciseCatalog: parseCacheVersion(process.env.CACHE_VERSION_EXERCISE_CATALOG, 1),
    exerciseList: parseCacheVersion(process.env.CACHE_VERSION_EXERCISE_LIST, 2), // v2: Added iconUrl and iconUrlHover
    dailyAdviceList: parseCacheVersion(process.env.CACHE_VERSION_DAILY_ADVICE_LIST, 1),
    reports: parseCacheVersion(process.env.CACHE_VERSION_REPORTS, 1),
    trainingDisciplines: parseCacheVersion(process.env.CACHE_VERSION_TRAINING_DISCIPLINES, 1),
    trainingPrograms: parseCacheVersion(process.env.CACHE_VERSION_TRAINING_PROGRAMS, 1),
    assistantNotesPage: parseCacheVersion(process.env.CACHE_VERSION_ASSISTANT_NOTES_PAGE, 1),
    aiAdvisorAdvice: parseCacheVersion(process.env.CACHE_VERSION_AI_ADVISOR_ADVICE, 1),
    analytics: parseCacheVersion(process.env.CACHE_VERSION_ANALYTICS, 1),
  }),
}) satisfies CacheVersioningConfig;

export const cacheWarmingConfig = Object.freeze({
  enabled: parseBoolean(process.env.CACHE_WARMING_ENABLED, true),
  startupDelayMs: parsePositiveInt(process.env.CACHE_WARMING_STARTUP_DELAY_MS, 10_000),
  intervalMs: parsePositiveInt(process.env.CACHE_WARMING_INTERVAL_MS, 15 * 60 * 1000),
  profileSampleSize: clampNumber(parsePositiveInt(process.env.CACHE_WARMING_PROFILE_SAMPLE, 25), 1, 200),
  achievements: Object.freeze({
    pageSize: clampNumber(parsePositiveInt(process.env.CACHE_WARMING_ACHIEVEMENTS_PAGE_SIZE, 20), 5, 100),
  }),
}) satisfies CacheWarmingConfig;

export const mediaCacheConfig = Object.freeze({
  exerciseLevels: Object.freeze({
    maxAgeSeconds: 365 * 24 * 60 * 60,
    edgeMaxAgeSeconds: 30 * 24 * 60 * 60,
    staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
    staleIfErrorSeconds: 60 * 60,
  }),
}) satisfies MediaCacheConfig;

const imageProcessorDimensionMax = parsePositiveInt(process.env.IMAGE_PROCESSOR_MAX_DIMENSION, 2048);
const imageProcessorQualityLimits = Object.freeze({ min: 30, max: 95 });
const imageProcessorDefaultFormat = canonicalImageFormat(
  process.env.IMAGE_PROCESSOR_DEFAULT_FORMAT,
  'image/webp',
);
const imageProcessorAllowedFormats = parseImageFormatList(
  process.env.IMAGE_PROCESSOR_ALLOWED_FORMATS,
  imageProcessorDefaultFormat,
);
const imageProcessorDefaultMode = parseResizeMode(
  process.env.IMAGE_PROCESSOR_DEFAULT_MODE,
  'contain',
);
const imageProcessorAllowedModes = parseResizeModeList(
  process.env.IMAGE_PROCESSOR_ALLOWED_MODES,
  imageProcessorDefaultMode,
);
const imageProcessorDefaultBackground = normalizeHexColor(
  process.env.IMAGE_PROCESSOR_DEFAULT_BACKGROUND,
);

const imageProcessorStripMetadataDefault = parseBoolean(
  process.env.IMAGE_PROCESSOR_STRIP_METADATA_DEFAULT,
  true,
);

export const imageProcessorConfig = Object.freeze({
  enabled: parseBoolean(process.env.IMAGE_PROCESSOR_ENABLED, true),
  baseUrl: (process.env.IMAGE_PROCESSOR_URL || 'http://image-processor:3002').trim(),
  timeoutMs: parsePositiveInt(process.env.IMAGE_PROCESSOR_TIMEOUT_MS, 10_000),
  cacheTtlSeconds: parsePositiveInt(process.env.IMAGE_PROCESSOR_CACHE_TTL_SECONDS, 6 * 60 * 60),
  endpoint: '/api/process-image',
  defaults: Object.freeze({
    maxWidth: clampNumber(
      parsePositiveInt(process.env.IMAGE_PROCESSOR_DEFAULT_MAX_WIDTH, 1280),
      64,
      imageProcessorDimensionMax,
    ),
    maxHeight: clampNumber(
      parsePositiveInt(process.env.IMAGE_PROCESSOR_DEFAULT_MAX_HEIGHT, 1280),
      64,
      imageProcessorDimensionMax,
    ),
    quality: parseQuality(
      process.env.IMAGE_PROCESSOR_DEFAULT_QUALITY,
      85,
      imageProcessorQualityLimits,
    ),
    format: imageProcessorDefaultFormat,
    mode: imageProcessorDefaultMode,
    background: imageProcessorDefaultBackground,
    stripMetadata: imageProcessorStripMetadataDefault,
  }),
  limits: Object.freeze({
    minDimension: 64,
    maxDimension: imageProcessorDimensionMax,
    minQuality: imageProcessorQualityLimits.min,
    maxQuality: imageProcessorQualityLimits.max,
  }),
  allowedFormats: imageProcessorAllowedFormats,
  allowedResizeModes: imageProcessorAllowedModes,
}) satisfies ImageProcessorConfig;

export const paginationConfig = Object.freeze({
  defaultPageSize: 20,
  maxPageSize: 100,
}) satisfies PaginationConfig;

export const fieldSelectionConfig = Object.freeze({
  maxFields: 20,
  maxFieldNameLength: 64,
  maxQueryLength: 512,
}) satisfies FieldSelectionConfig;

export const profileContextCacheConfig = Object.freeze({
  ttlMs: 60_000,
}) satisfies ProfileContextCacheConfig;

export const sizeUnits = Object.freeze({
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
}) satisfies SizeUnits;

export const bodySizeDefaults = Object.freeze({
  jsonBytes: sizeUnits.MB,
  formBytes: sizeUnits.MB,
  textBytes: 256 * sizeUnits.KB,
  binaryBytes: 256 * sizeUnits.KB,
  multipartBytes: 150 * sizeUnits.MB, // For ZIP file uploads
}) satisfies BodySizeDefaults;

export const rateLimitConfig = Object.freeze({
  memoryCleanupIntervalMs: 60_000,
  global: Object.freeze({
    windowMs: 60_000,
    defaultMax: 120,
  }),
  pin: Object.freeze({
    windowMs: 60_000,
    defaultMax: 10,
  }),
  assistant: Object.freeze({
    chat: Object.freeze({
      windowMs: 60_000,
      defaultMax: 20, // 20 chat requests per minute per user
    }),
    tts: Object.freeze({
      windowMs: 60_000,
      defaultMax: 10, // 10 TTS requests per minute per user
    }),
    transcribe: Object.freeze({
      windowMs: 60_000,
      defaultMax: 15, // 15 voice transcriptions per minute per user
    }),
  }),
  bruteForce: Object.freeze({
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000,
    pruneIntervalMs: 5 * 60 * 1000,
  }),
}) satisfies RateLimitConfig;

export const jwtDefaults = Object.freeze({
  expiresIn: '30d',
  revokedFallbackTtlMs: 30 * 24 * 60 * 60 * 1000,
  revokedCleanupIntervalMs: 5 * 60 * 1000,
}) satisfies JwtDefaults;

export const csrfDefaults = Object.freeze({
  tokenTtlMs: 12 * 60 * 60 * 1000,
  refreshThresholdMs: 60 * 60 * 1000,
  cookieName: 'tzona_csrf',
  headerNames: Object.freeze(['x-csrf-token', 'x-xsrf-token']),
}) satisfies CsrfDefaults;

export const urlValidationLimits = Object.freeze({
  maxParamLength: 512,
  maxQueryValueLength: 2048,
}) satisfies UrlValidationLimits;

export const assistantHistoryConfig = Object.freeze({
  maxMessages: 12,
  ttlMs: 48 * 60 * 60 * 1000,
}) satisfies AssistantHistoryConfig;

const aiAdvisorContextMaxChars = clampNumber(
  parsePositiveInt(process.env.AI_ADVISOR_CONTEXT_MAX_CHARS, 3_200),
  500,
  20_000,
);

export const aiAdvisorContextConfig = Object.freeze({
  maxEntries: clampNumber(parsePositiveInt(process.env.AI_ADVISOR_CONTEXT_MAX_ENTRIES, 6), 1, 12),
  ttlMs: parsePositiveInt(process.env.AI_ADVISOR_CONTEXT_TTL_MS, 7 * 24 * 60 * 60 * 1000),
  maxCharacters: aiAdvisorContextMaxChars,
}) satisfies AiAdvisorContextConfig;

const aiAdvisorLatencyWarnMs = clampNumber(parsePositiveInt(process.env.AI_ADVISOR_LATENCY_WARN_MS, 3_000), 500, 300_000);
const aiAdvisorLatencyCriticalMs = clampNumber(
  parsePositiveInt(process.env.AI_ADVISOR_LATENCY_CRITICAL_MS, Math.max(6_000, aiAdvisorLatencyWarnMs)),
  aiAdvisorLatencyWarnMs,
  600_000,
);
const aiAdvisorCostWarnUsd = parseNumberInRange(process.env.AI_ADVISOR_COST_WARN_USD, 0.05, 0, 1_000);
const aiAdvisorCostCriticalUsd = Math.max(
  aiAdvisorCostWarnUsd,
  parseNumberInRange(process.env.AI_ADVISOR_COST_CRITICAL_USD, 0.2, aiAdvisorCostWarnUsd, 1_000),
);

export const aiAdvisorMonitoringConfig = Object.freeze({
  latency: Object.freeze({ warnMs: aiAdvisorLatencyWarnMs, criticalMs: aiAdvisorLatencyCriticalMs }),
  cost: Object.freeze({ warnUsd: aiAdvisorCostWarnUsd, criticalUsd: aiAdvisorCostCriticalUsd }),
}) satisfies AiAdvisorMonitoringConfig;

export const assistantLimits = Object.freeze({
  notePreviewChars: 120,
}) satisfies AssistantLimits;

export const botInactivityDefaults = Object.freeze({
  intervalMs: 5 * 60 * 1000,
  thresholdMinutes: 60,
  batchLimit: 20,
  snippetPreviewChars: 120,
}) satisfies BotInactivityDefaults;

export const botMessageBufferConfig = Object.freeze({
  ttlMs: 12 * 60 * 60 * 1000,
}) satisfies BotMessageBufferConfig;

export const databaseAvailabilityDefaults = Object.freeze({
  degradedCooldownMs: 30 * 1000,
  retryAfterMs: 15 * 1000,
  healthSnapshotTtlMs: 5 * 1000,
}) satisfies DatabaseAvailabilityDefaults;

export const databaseRetryDefaults = Object.freeze({
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2_000,
  backoffMultiplier: 2,
  jitterRatio: 0.25,
}) satisfies DatabaseRetryDefaults;

export const circuitBreakerDefaults = Object.freeze({
  failureThreshold: 5,
  successThreshold: 2,
  openStateDurationMs: 30_000,
  halfOpenMaxConcurrent: 1,
}) satisfies CircuitBreakerDefaults;

export const monitoringDefaults = Object.freeze({
  dedupeTtlMs: 60_000,
  minSeverityForAlerts: 'critical',
  webhookTimeoutMs: 5_000,
}) satisfies MonitoringDefaults;

export const anomalyAlertDefaults = Object.freeze({
  latencyWarnMs: clampNumber(parsePositiveInt(process.env.ANOMALY_LATENCY_WARN_MS, 3_000), 200, 120_000),
  latencyCriticalMs: clampNumber(parsePositiveInt(process.env.ANOMALY_LATENCY_CRITICAL_MS, 8_000), 500, 300_000),
  errorRateWarn: clampNumber(parsePositiveInt(process.env.ANOMALY_ERROR_RATE_WARN_BPS, 50), 0, 1_000) / 1_000,
  errorRateCritical: clampNumber(parsePositiveInt(process.env.ANOMALY_ERROR_RATE_CRITICAL_BPS, 200), 0, 1_000) / 1_000,
  cpuWarn: clampNumber(parsePositiveInt(process.env.ANOMALY_CPU_WARN_PERCENT, 70), 1, 100),
  cpuCritical: clampNumber(parsePositiveInt(process.env.ANOMALY_CPU_CRITICAL_PERCENT, 90), 1, 100),
  memoryWarn: clampNumber(parsePositiveInt(process.env.ANOMALY_MEMORY_WARN_PERCENT, 75), 1, 100),
  memoryCritical: clampNumber(parsePositiveInt(process.env.ANOMALY_MEMORY_CRITICAL_PERCENT, 90), 1, 100),
}) satisfies AnomalyAlertConfig;

export const performanceMetricsDefaults = Object.freeze({
  latencySampleSize: clampNumber(parsePositiveInt(process.env.PERF_METRICS_LATENCY_SAMPLE_SIZE, 500), 50, 5_000),
  throughputWindowMs: clampNumber(
    parsePositiveInt(process.env.PERF_METRICS_THROUGHPUT_WINDOW_MS, 60_000),
    5_000,
    10 * 60 * 1000,
  ),
  slowRequestThresholdMs: clampNumber(
    parsePositiveInt(process.env.PERF_METRICS_SLOW_THRESHOLD_MS, 2_000),
    100,
    5 * 60 * 1000,
  ),
  slowRequestSampleSize: clampNumber(parsePositiveInt(process.env.PERF_METRICS_SLOW_SAMPLE_SIZE, 20), 5, 200),
}) satisfies PerformanceMetricsConfig;

export const resourceMetricsDefaults = Object.freeze({
  sampleIntervalMs: clampNumber(parsePositiveInt(process.env.RESOURCE_METRICS_SAMPLE_INTERVAL_MS, 5_000), 500, 60_000),
  snapshotTtlMs: clampNumber(parsePositiveInt(process.env.RESOURCE_METRICS_SNAPSHOT_TTL_MS, 1_000), 200, 10_000),
}) satisfies ResourceMetricsConfig;

export const businessMetricsDefaults = Object.freeze({
  lookbackDays: clampNumber(parsePositiveInt(process.env.BUSINESS_METRICS_LOOKBACK_DAYS, 14), 1, 90),
  cacheTtlMs: clampNumber(parsePositiveInt(process.env.BUSINESS_METRICS_CACHE_TTL_MS, 30_000), 1_000, 10 * 60 * 1000),
}) satisfies BusinessMetricsConfig;

export const metricsDashboardDefaults = Object.freeze({
  sampleIntervalMs: clampNumber(parsePositiveInt(process.env.METRICS_DASHBOARD_SAMPLE_INTERVAL_MS, 60_000), 5_000, 10 * 60 * 1000),
  historySize: clampNumber(parsePositiveInt(process.env.METRICS_DASHBOARD_HISTORY_SIZE, 120), 10, 1_000),
}) satisfies MetricsDashboardConfig;

export const slaDefaults = Object.freeze({
  sampleWindowMs: clampNumber(parsePositiveInt(process.env.SLA_SAMPLE_WINDOW_MS, 5 * 60 * 1000), 10_000, 24 * 60 * 60 * 1000),
  targets: [
    { id: 'profile', method: 'GET', route: '/api/profile/summary', availabilityTarget: 0.995, p95TargetMs: 1200 },
    { id: 'sessions', method: 'GET', route: '/api/sessions', availabilityTarget: 0.99, p95TargetMs: 1500 },
    { id: 'daily-advice', method: 'GET', route: '/api/daily-advice', availabilityTarget: 0.99, p95TargetMs: 1200 },
  ],
}) satisfies SlaConfig;

export const capacityPlanningDefaults = Object.freeze({
  targetCpuUtilization: clampNumber(parsePositiveInt(process.env.CAPACITY_TARGET_CPU_PERCENT, 70), 10, 95) / 100,
  targetMemoryUtilization: clampNumber(parsePositiveInt(process.env.CAPACITY_TARGET_MEMORY_PERCENT, 75), 10, 95) / 100,
  maxThroughputPerInstance: clampNumber(
    parsePositiveInt(process.env.CAPACITY_MAX_TPUT_PER_INSTANCE, 50),
    1,
    10_000,
  ),
}) satisfies CapacityPlanningConfig;

const defaultRedactedKeys = Object.freeze([
  'authorization',
  'cookie',
  'token',
  'refreshtoken',
  'accesstoken',
  'pin',
  'password',
  'secret',
  'apikey',
  'sessionid',
]);

const defaultRedactedPatterns: RegExp[] = [
  /bearer\s+[a-z0-9\-._]+/i,
  /sk-[a-z0-9]{20,}/i,
  /gh[p|s]_[a-z0-9]{20,}/i,
];

export const loggingConfig = Object.freeze({
  enabled: parseBoolean(process.env.LOG_ENABLED, true),
  level: parseLogLevel(process.env.LOG_LEVEL),
  echoToConsole: parseBoolean(process.env.LOG_ECHO_TO_CONSOLE, process.env.NODE_ENV !== 'production'),
  filePath: process.env.LOG_FILE_PATH || 'logs/application.ndjson',
  rotation: Object.freeze({
    maxBytes: Math.max(parsePositiveInt(process.env.LOG_FILE_MAX_BYTES, 5 * 1024 * 1024), 64 * 1024),
    maxFiles: parseNumberInRange(process.env.LOG_FILE_MAX_BACKUPS, 5, 1, 20),
  }),
  redactedKeys: parseCommaSeparatedList(process.env.LOG_REDACT_KEYS, [...defaultRedactedKeys]),
  alertOnError: parseBoolean(process.env.LOG_ALERT_ON_ERROR, true),
  redactedPatterns: parseRedactedPatterns(process.env.LOG_REDACT_PATTERNS, defaultRedactedPatterns),
}) satisfies LoggingConfig;

export const microserviceClients = Object.freeze({
  aiAdvisor: buildMicroserviceConfig('AI_ADVISOR', { timeoutMs: 6_000 }),
  analytics: buildMicroserviceConfig('ANALYTICS', { timeoutMs: 5_000 }),
  imageProcessor: buildMicroserviceConfig('IMAGE_PROCESSOR', { timeoutMs: 10_000 }),
}) satisfies MicroservicesConfig;

export const requestTimeoutDefaults = Object.freeze({
  softTimeoutMs: 240_000,   // 4 minutes soft warning
  hardTimeoutMs: 300_000,   // 5 minutes hard limit (for large ZIP uploads)
  headerName: 'x-request-timeout-ms',
}) satisfies RequestTimeoutDefaults;

export const slowQueryDefaults = Object.freeze({
  thresholdMs: 250,
  historySize: 200,
  logFilePath: 'logs/prisma-slow-queries.ndjson',
  paramsPreviewLength: 500,
  sampleRate: 0,
  captureStackTraces: false,
  monitoringEnabled: true,
  monitoringSeverity: 'warning',
}) satisfies SlowQueryDefaults;

export const archiveDefaults = Object.freeze({
  operationLogRetentionDays: parsePositiveInt(process.env.ARCHIVE_OPERATION_LOG_DAYS, 90),
  observabilityRetentionDays: parsePositiveInt(process.env.ARCHIVE_OBSERVABILITY_DAYS, 60),
  batchSize: parsePositiveInt(process.env.ARCHIVE_BATCH_SIZE, 1_000),
  dryRun: parseBoolean(process.env.ARCHIVE_DRY_RUN, false),
}) satisfies ArchiveConfig;

export const compressionDefaults = Object.freeze({
  enabled: true,
  thresholdBytes: 1024,
  preferBrotli: true,
  brotliQuality: 5,
  gzipLevel: 6,
  compressibleContentTypes: Object.freeze<RegExp[]>([
    /^text\//i,
    /^application\/(json|javascript|xml|x-www-form-urlencoded)/i,
    /^image\/svg\+xml/i,
    /^application\/(wasm|manifest\+json)/i,
  ]),
  excludedContentTypes: Object.freeze<RegExp[]>([
    /^image\//i,
    /^audio\//i,
    /^video\//i,
    /multipart\/form-data/i,
    /application\/octet-stream/i,
    /^text\/event-stream/i,
  ]),
}) as CompressionDefaults;

export const httpClientConfig = {
  enableGlobalDispatcher: parseBoolean(process.env.HTTP_KEEP_ALIVE, true),
  maxSockets: parsePositiveInt(process.env.HTTP_MAX_SOCKETS, 100),
  maxFreeSockets: parsePositiveInt(process.env.HTTP_MAX_FREE_SOCKETS, 10),
  timeout: parsePositiveInt(process.env.HTTP_TIMEOUT, 30_000),
  freeSocketTimeout: parsePositiveInt(process.env.HTTP_FREE_SOCKET_TIMEOUT, 4_000),
  keepAlive: parseBoolean(process.env.HTTP_KEEP_ALIVE, true),
  keepAliveInitialDelay: parsePositiveInt(process.env.HTTP_KEEP_ALIVE_INITIAL_DELAY, 1_000),
  keepAliveMaxTimeoutMs: parsePositiveInt(process.env.HTTP_KEEP_ALIVE_MAX_TIMEOUT_MS, 60_000),
  pipelining: parsePositiveInt(process.env.HTTP_PIPELINING, 1),
  connectTimeoutMs: parsePositiveInt(process.env.HTTP_CONNECT_TIMEOUT_MS, 3_000),
  headersTimeoutMs: parsePositiveInt(
    process.env.HTTP_HEADERS_TIMEOUT_MS,
    requestTimeoutDefaults.hardTimeoutMs,
  ),
  bodyTimeoutMs: parsePositiveInt(process.env.HTTP_BODY_TIMEOUT_MS, requestTimeoutDefaults.hardTimeoutMs + 2_000),
  keepAliveTimeoutMs: parsePositiveInt(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS, 10_000),

} as const;

export const batchOperationDefaults = Object.freeze({
  chunkSize: 25,
  trainingSessionExercises: Object.freeze({
    upsertChunkSize: 25,
  }),
}) satisfies BatchOperationDefaults;

export const materializedViewConfig = Object.freeze({
  sessionVolume: Object.freeze({
    viewName: 'session_volume_mv',
    // Increased from 2 to 15 minutes to prevent timeouts on remote Supabase
    refreshIntervalMs: parsePositiveInt(
      process.env.MATERIALIZED_VIEW_SESSION_VOLUME_REFRESH_MS,
      15 * 60 * 1000,
    ),
  }),
  profileSummary: Object.freeze({
    viewName: 'profile_summary_mv',
    refreshIntervalMs: parsePositiveInt(
      process.env.MATERIALIZED_VIEW_PROFILE_SUMMARY_REFRESH_MS,
      15 * 60 * 1000,
    ),
  }),
  rpeDistribution: Object.freeze({
    viewName: 'profile_rpe_distribution_mv',
    // Increased from 2 to 15 minutes to prevent timeouts on remote Supabase
    refreshIntervalMs: parsePositiveInt(
      process.env.MATERIALIZED_VIEW_RPE_REFRESH_MS,
      15 * 60 * 1000,
    ),
  }),
}) satisfies MaterializedViewConfig;
