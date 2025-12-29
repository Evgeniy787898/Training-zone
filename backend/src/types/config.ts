import type { LogLevel } from './logging.js';

export type CacheRuntimeDefaults = Readonly<{
  namespace: string;
  memory: Readonly<{
    sweepIntervalMs: number;
    maxEntries: number;
  }>;
  redis: Readonly<{
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
  }>;
}>;

export type CacheFallbackConfig = Readonly<{
  enabled: boolean;
  failureThreshold: number;
  cooldownMs: number;
  logThrottleMs: number;
}>;

export type CacheEdgePolicy = Readonly<{
  maxAge: number;
  sMaxAge: number;
  staleWhileRevalidate: number;
  staleIfError?: number;
}>;

export type CacheEntry = Readonly<{
  ttlSeconds: number;
  edge?: CacheEdgePolicy;
}>;

export type CacheConfig = Readonly<{
  profile: Readonly<{
    summary: CacheEntry;
  }>;
  achievements: CacheEntry;
  exercises: Readonly<{
    catalog: CacheEntry;
    list: CacheEntry;
  }>;
  training: Readonly<{
    disciplines: CacheEntry;
    programs: CacheEntry;
  }>;
  reports: CacheEntry;
  dailyAdvice: Readonly<{
    list: CacheEntry;
  }>;
  assistant: Readonly<{
    notes: CacheEntry;
  }>;
}>;

export type CacheStampedeProtectionConfig = Readonly<{
  lockTtlSeconds: number;
  waitIntervalMs: number;
  maxWaitMs: number;
  maxJitterSeconds: number;
  maxJitterPercent: number;
}>;

export type CacheMonitoringConfig = Readonly<{
  enabled: boolean;
  reportIntervalMs: number;
  warnThreshold: number;
  criticalThreshold: number;
  minSamples: number;
}>;

export type CacheAdaptiveTtlConfig = Readonly<{
  enabled: boolean;
  fastWindowSeconds: number;
  slowWindowSeconds: number;
  minMultiplier: number;
  maxMultiplier: number;
}>;

export type CacheCompressionConfig = Readonly<{
  enabled: boolean;
  minSizeBytes: number;
  encoding: string;
  brotliQuality: number;
  gzipLevel: number;
}>;

export type CacheVersioningConfig = Readonly<{
  globalVersion: number;
  resources: Readonly<{
    profileSummary: number;
    achievementsPage: number;
    exerciseCatalog: number;
    exerciseList: number;
    dailyAdviceList: number;
    reports: number;
    trainingDisciplines: number;
    trainingPrograms: number;
    assistantNotesPage: number;
  }>;
}>;

export type CacheWarmingConfig = Readonly<{
  enabled: boolean;
  startupDelayMs: number;
  intervalMs: number;
  profileSampleSize: number;
  achievements: Readonly<{
    pageSize: number;
  }>;
}>;

export type MediaCacheConfig = Readonly<{
  exerciseLevels: Readonly<{
    maxAgeSeconds: number;
    edgeMaxAgeSeconds: number;
    staleWhileRevalidateSeconds: number;
    staleIfErrorSeconds: number;
  }>;
}>;

export type ImageProcessorResizeMode = 'contain' | 'cover' | 'fill' | 'stretch' | 'pad';

export type ImageProcessorConfig = Readonly<{
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
  endpoint: string;
  defaults: Readonly<{
    maxWidth: number;
    maxHeight: number;
    quality: number;
    format: string;
    mode: ImageProcessorResizeMode;
    background: string | null;
    stripMetadata: boolean;
  }>;
  limits: Readonly<{
    minDimension: number;
    maxDimension: number;
    minQuality: number;
    maxQuality: number;
  }>;
  allowedFormats: readonly string[];
  allowedResizeModes: readonly ImageProcessorResizeMode[];
}>;

export type PaginationConfig = Readonly<{
  defaultPageSize: number;
  maxPageSize: number;
}>;

export type FieldSelectionConfig = Readonly<{
  maxFields: number;
  maxFieldNameLength: number;
  maxQueryLength: number;
}>;

export type ProfileContextCacheConfig = Readonly<{
  ttlMs: number;
}>;

export type SizeUnits = Readonly<{
  KB: number;
  MB: number;
  GB: number;
}>;

export type BodySizeDefaults = Readonly<{
  jsonBytes: number;
  formBytes: number;
  textBytes: number;
  binaryBytes: number;
  multipartBytes: number;
}>;

export type RateLimitWindowConfig = Readonly<{
  windowMs: number;
  defaultMax: number;
}>;

export type RateLimitConfig = Readonly<{
  memoryCleanupIntervalMs: number;
  global: RateLimitWindowConfig;
  pin: RateLimitWindowConfig;
  assistant: Readonly<{
    chat: RateLimitWindowConfig;
    tts: RateLimitWindowConfig;
    transcribe: RateLimitWindowConfig;
  }>;
  bruteForce: Readonly<{
    maxAttempts: number;
    blockDurationMs: number;
    pruneIntervalMs: number;
  }>;
}>;

export type JwtDefaults = Readonly<{
  expiresIn: string;
  revokedFallbackTtlMs: number;
  revokedCleanupIntervalMs: number;
}>;

export type CsrfDefaults = Readonly<{
  tokenTtlMs: number;
  refreshThresholdMs: number;
  cookieName: string;
  headerNames: readonly string[];
}>;

export type UrlValidationLimits = Readonly<{
  maxParamLength: number;
  maxQueryValueLength: number;
}>;

export type AssistantHistoryConfig = Readonly<{
  maxMessages: number;
  ttlMs: number;
}>;

export type AiAdvisorContextConfig = Readonly<{
  maxEntries: number;
  ttlMs: number;
  maxCharacters: number;
}>;

export type AiAdvisorMonitoringConfig = Readonly<{
  latency: Readonly<{
    warnMs: number;
    criticalMs: number;
  }>;
  cost: Readonly<{
    warnUsd: number;
    criticalUsd: number;
  }>;
}>;

export type AssistantLimits = Readonly<{
  notePreviewChars: number;
}>;

export type BotInactivityDefaults = Readonly<{
  intervalMs: number;
  thresholdMinutes: number;
  batchLimit: number;
  snippetPreviewChars: number;
}>;

export type BotMessageBufferConfig = Readonly<{
  ttlMs: number;
}>;

export type DatabaseAvailabilityDefaults = Readonly<{
  degradedCooldownMs: number;
  retryAfterMs: number;
  healthSnapshotTtlMs: number;
}>;

export type DatabaseRetryDefaults = Readonly<{
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
}>;

export type CircuitBreakerDefaults = Readonly<{
  failureThreshold: number;
  successThreshold: number;
  openStateDurationMs: number;
  halfOpenMaxConcurrent: number;
}>;

export type MonitoringDefaults = Readonly<{
  dedupeTtlMs: number;
  minSeverityForAlerts: 'info' | 'warning' | 'critical';
  webhookTimeoutMs: number;
}>;

export type PerformanceMetricsConfig = Readonly<{
  latencySampleSize: number;
  throughputWindowMs: number;
  slowRequestThresholdMs: number;
  slowRequestSampleSize: number;
}>;

export type ResourceMetricsConfig = Readonly<{
  sampleIntervalMs: number;
  snapshotTtlMs: number;
}>;

export type BusinessMetricsConfig = Readonly<{
  lookbackDays: number;
  cacheTtlMs: number;
}>;

export type MetricsDashboardConfig = Readonly<{
  sampleIntervalMs: number;
  historySize: number;
}>;

export type AnomalyAlertConfig = Readonly<{
  latencyWarnMs: number;
  latencyCriticalMs: number;
  errorRateWarn: number;
  errorRateCritical: number;
  cpuWarn: number;
  cpuCritical: number;
  memoryWarn: number;
  memoryCritical: number;
}>;

export type SlaTarget = Readonly<{
  id: string;
  method: string;
  route: string;
  availabilityTarget: number; // 0-1
  p95TargetMs: number;
}>;

export type SlaConfig = Readonly<{
  targets: readonly SlaTarget[];
  sampleWindowMs: number;
}>;

export type CapacityPlanningConfig = Readonly<{
  targetCpuUtilization: number; // 0-1
  targetMemoryUtilization: number; // 0-1
  maxThroughputPerInstance: number;
}>;

export type ArchiveConfig = Readonly<{
  operationLogRetentionDays: number;
  observabilityRetentionDays: number;
  batchSize: number;
  dryRun: boolean;
}>;

export type LogRotationConfig = Readonly<{
  maxBytes: number;
  maxFiles: number;
}>;

export type LoggingConfig = Readonly<{
  enabled: boolean;
  level: LogLevel;
  echoToConsole: boolean;
  filePath: string;
  rotation: LogRotationConfig;
  redactedKeys: string[];
  alertOnError: boolean;
  redactedPatterns: RegExp[];
}>;

export type RequestTimeoutDefaults = Readonly<{
  softTimeoutMs: number;
  hardTimeoutMs: number;
  headerName: string;
}>;

export type SlowQueryDefaults = Readonly<{
  thresholdMs: number;
  historySize: number;
  logFilePath: string;
  paramsPreviewLength: number;
  sampleRate: number;
  captureStackTraces: boolean;
  monitoringEnabled: boolean;
  monitoringSeverity: string;
}>;

export type BatchOperationDefaults = Readonly<{
  chunkSize: number;
  trainingSessionExercises: Readonly<{
    upsertChunkSize: number;
  }>;
}>;

export type MaterializedViewConfig = Readonly<{
  sessionVolume: Readonly<{
    viewName: string;
    refreshIntervalMs: number;
  }>;
  rpeDistribution: Readonly<{
    viewName: string;
    refreshIntervalMs: number;
  }>;
}>;

export type MicroserviceClientConfig = Readonly<{
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  token: string | null;
}>;


export type DatabaseAvailabilityConfig = DatabaseAvailabilityDefaults;
export type DatabaseRetryConfig = DatabaseRetryDefaults;
export type CircuitBreakerConfig = CircuitBreakerDefaults;
export type RequestTimeoutConfig = RequestTimeoutDefaults;

export type HttpClientConfig = Readonly<{
  enableGlobalDispatcher: boolean;
  maxSockets: number;
  maxFreeSockets: number;
  timeout: number;
  freeSocketTimeout: number;
  keepAlive: boolean;
  keepAliveInitialDelay: number;
  keepAliveMaxTimeoutMs: number;
}>;

export type MicroservicesConfig = Readonly<{
  aiAdvisor: MicroserviceClientConfig;
  imageProcessor: MicroserviceClientConfig;
  analytics: MicroserviceClientConfig;
}>;
