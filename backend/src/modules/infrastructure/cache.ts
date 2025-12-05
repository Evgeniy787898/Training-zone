import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, brotliDecompress, constants as zlibConstants, gzip, gunzip } from 'node:zlib';

import type { CacheCompressionEncoding } from '../../config/constants.js';
import {
  cacheCompressionConfig,
  cacheFallbackConfig,
  cacheRuntimeDefaults,
  cacheStampedeProtectionConfig,
} from '../../config/constants.js';
import type { MonitoringEventInput } from '../../types/monitoring.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';
import { recordCacheHit, recordCacheMiss, shutdownCacheMetrics } from './cacheMetrics.js';
import { recordMonitoringEvent } from './monitoring.js';
import {
  parseBoolean,
  parsePositiveNumberWithFallback,
} from '../../utils/envParsers.js';

const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const CACHE_COMPRESSED_PREFIX = '!cmp:';

type RedisClient = {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  quit(): Promise<void>;
};

type CacheStoreOptions = {
  namespace: string;
  redisUrl: string | null;
  redis: {
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
  };
  memory: {
    sweepIntervalMs: number;
    maxEntries: number;
  };
};

export type CacheRedisConfig = {
  url: string;
  options: CacheStoreOptions['redis'];
};

type MemoryEntry<T> = {
  data: T;
  expiresAt: number;
};

type CacheFallbackMode = 'disabled' | 'unknown' | 'ready' | 'fallback';

type CacheFallbackState = {
  enabled: boolean;
  mode: CacheFallbackMode;
  failureCount: number;
  lastFailureAt: number | null;
  fallbackUntil: number | null;
  reason: string | null;
};

export type CacheFallbackSnapshot = Readonly<CacheFallbackState>;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type StampedeLockHandle =
  | { acquired: false }
  | { acquired: true; via: 'redis'; key: string; token: string }
  | { acquired: true; via: 'local'; key: string };

class MemoryCache {
  private readonly store = new Map<string, MemoryEntry<unknown>>();
  private readonly sweepIntervalMs: number;
  private readonly maxEntries: number;
  private readonly sweeper: ReturnType<typeof createRecurringTask>;

  constructor(options: { sweepIntervalMs: number; maxEntries: number }) {
    this.sweepIntervalMs = Math.max(1_000, options.sweepIntervalMs);
    this.maxEntries = Math.max(100, options.maxEntries);
    this.sweeper = createRecurringTask({
      name: 'memory-cache-sweeper',
      intervalMs: this.sweepIntervalMs,
      run: () => {
        this.sweepExpired();
        this.evictIfNeeded();
      },
    });
  }

  getSize(): number {
    return this.store.size;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
    this.store.set(key, { data: value, expiresAt });
    this.evictIfNeeded();
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  close(): void {
    this.sweeper.dispose();
    this.store.clear();
  }

  private evictIfNeeded(): void {
    if (this.store.size <= this.maxEntries) {
      return;
    }
    // Remove expired entries first.
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    if (this.store.size <= this.maxEntries) {
      return;
    }
    const oldestKey = this.store.keys().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

export type CacheLayerSnapshot = {
  namespace: string;
  redis: {
    configured: boolean;
    url?: string;
  };
  fallback: CacheFallbackSnapshot;
  memoryEntries: number;
  inflightLoads: number;
};

function logCacheError(message: string, error: unknown): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  console.error(message, error);
}

// Обертки для совместимости с существующим кодом
function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  return parseBoolean(value, fallback);
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  return parsePositiveNumberWithFallback(value, fallback);
}

function resolveCacheOptions(): CacheStoreOptions {
  const namespace = (process.env.CACHE_NAMESPACE || cacheRuntimeDefaults.namespace).trim() || cacheRuntimeDefaults.namespace;
  const redisUrl = process.env.CACHE_REDIS_URL || process.env.REDIS_URL || null;
  console.log('[DEBUG] Cache Config:', { namespace, redisUrl, envRedisUrl: process.env.CACHE_REDIS_URL });
  return {
    namespace,
    redisUrl,
    redis: {
      maxRetriesPerRequest: parseNumberEnv(
        process.env.CACHE_REDIS_MAX_RETRIES_PER_REQUEST,
        cacheRuntimeDefaults.redis.maxRetriesPerRequest,
      ),
      enableReadyCheck: parseBooleanEnv(
        process.env.CACHE_REDIS_ENABLE_READY_CHECK,
        cacheRuntimeDefaults.redis.enableReadyCheck,
      ),
      lazyConnect: parseBooleanEnv(
        process.env.CACHE_REDIS_LAZY_CONNECT,
        cacheRuntimeDefaults.redis.lazyConnect,
      ),
    },
    memory: {
      sweepIntervalMs: parseNumberEnv(
        process.env.CACHE_MEMORY_SWEEP_INTERVAL_MS,
        cacheRuntimeDefaults.memory.sweepIntervalMs,
      ),
      maxEntries: parseNumberEnv(
        process.env.CACHE_MEMORY_MAX_ENTRIES,
        cacheRuntimeDefaults.memory.maxEntries,
      ),
    },
  };
}

class CacheStore {
  private readonly options: CacheStoreOptions;
  private redisClient: RedisClient | null = null;
  private redisInitPromise: Promise<RedisClient | null> | null = null;
  private readonly memory: MemoryCache;
  private readonly stampede = cacheStampedeProtectionConfig;
  private readonly compression = cacheCompressionConfig;
  private readonly fallbackConfig = cacheFallbackConfig;
  private fallbackState: CacheFallbackState;
  private readonly inflightLoads = new Map<string, Promise<unknown>>();
  private readonly localLocks = new Map<string, number>();
  private readonly fallbackListeners = new Set<(state: CacheFallbackSnapshot) => void>();
  private lastFallbackLogAt = 0;

  constructor(options: CacheStoreOptions) {
    this.options = options;
    this.memory = new MemoryCache(options.memory);
    this.fallbackState = {
      enabled: this.fallbackConfig.enabled,
      mode: this.fallbackConfig.enabled ? 'unknown' : 'disabled',
      failureCount: 0,
      lastFailureAt: null,
      fallbackUntil: null,
      reason: null,
    };
  }

  getNamespace(): string {
    return this.options.namespace;
  }

  getRedisConfig(): CacheRedisConfig | null {
    if (!this.options.redisUrl) {
      return null;
    }
    return {
      url: this.options.redisUrl,
      options: this.options.redis,
    };
  }

  getSnapshot(): CacheLayerSnapshot {
    return {
      namespace: this.options.namespace,
      redis: {
        configured: Boolean(this.options.redisUrl),
        url: this.options.redisUrl ?? undefined,
      },
      fallback: this.fallbackState,
      memoryEntries: this.memory.getSize(),
      inflightLoads: this.inflightLoads.size,
    };
  }

  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = this.formatKey(key);
    const redis = await this.getRedisClient();
    if (redis) {
      try {
        const raw = await redis.get(namespacedKey);
        this.recordRedisSuccess();
        if (raw) {
          const parsed = await this.deserializeCachedValue<T>(raw);
          if (parsed !== null) {
            recordCacheHit('redis');
            return parsed;
          }
        }
      } catch (error) {
        this.recordRedisFailure('[cache] redis get failed', { key: namespacedKey, error });
      }
    }
    const memoryValue = this.memory.get<T>(namespacedKey);
    if (memoryValue !== null) {
      recordCacheHit('memory');
      return memoryValue;
    }
    recordCacheMiss();
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const namespacedKey = this.formatKey(key);
    const redis = await this.getRedisClient();
    if (redis) {
      try {
        const serialized = await this.serializeForRedis(value);
        await redis.set(namespacedKey, serialized, 'EX', Math.max(1, ttlSeconds));
        this.recordRedisSuccess();
      } catch (error) {
        this.recordRedisFailure('[cache] redis set failed', { key: namespacedKey, error });
      }
    }
    this.memory.set(namespacedKey, value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    const namespacedKey = this.formatKey(key);
    const redis = await this.getRedisClient();
    if (redis) {
      try {
        await redis.del(namespacedKey);
        this.recordRedisSuccess();
      } catch (error) {
        this.recordRedisFailure('[cache] redis del failed', { key: namespacedKey, error });
      }
    }
    this.memory.delete(namespacedKey);
  }

  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const namespacedKey = this.formatKey(key);
    const inflight = this.inflightLoads.get(namespacedKey) as Promise<T> | undefined;
    if (inflight) {
      return inflight;
    }
    const loader = this.loadWithStampedeProtection(key, namespacedKey, ttlSeconds, factory);
    this.inflightLoads.set(namespacedKey, loader);
    try {
      return await loader;
    } finally {
      this.inflightLoads.delete(namespacedKey);
    }
  }

  async close(): Promise<void> {
    await this.disposeRedisClient();
    this.memory.close();
    this.inflightLoads.clear();
    this.localLocks.clear();
    shutdownCacheMetrics();
  }

  private async loadWithStampedeProtection<T>(
    key: string,
    namespacedKey: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const lockHandle = await this.acquireStampedeLock(namespacedKey);
    if (lockHandle.acquired) {
      return this.runFactoryAndCache(key, ttlSeconds, factory, lockHandle);
    }
    const awaited = await this.waitForCacheFill<T>(key, this.stampede.maxWaitMs);
    if (awaited !== null) {
      return awaited;
    }
    const retryHandle = await this.acquireStampedeLock(namespacedKey);
    return this.runFactoryAndCache(key, ttlSeconds, factory, retryHandle.acquired ? retryHandle : null);
  }

  private async runFactoryAndCache<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
    lockHandle: StampedeLockHandle | null,
  ): Promise<T> {
    const safeTtl = this.applyStampedeSafeTtl(ttlSeconds);
    try {
      const value = await factory();
      await this.set(key, value, safeTtl);
      return value;
    } finally {
      if (lockHandle && lockHandle.acquired) {
        await this.releaseStampedeLock(lockHandle);
      }
    }
  }

  private async acquireStampedeLock(namespacedKey: string): Promise<StampedeLockHandle> {
    const now = Date.now();
    this.cleanupLocalLocks(now);
    const lockKey = this.buildLockKey(namespacedKey);
    const redis = await this.getRedisClient();
    if (redis) {
      const token = randomUUID();
      try {
        const result = await redis.set(lockKey, token, 'EX', this.stampede.lockTtlSeconds, 'NX');
        if (result === 'OK') {
          return { acquired: true, via: 'redis', key: lockKey, token };
        }
      } catch (error) {
        this.recordRedisFailure('[cache] failed to acquire redis stampede lock', { lockKey, error });
      }
    }
    const existingExpiry = this.localLocks.get(lockKey) ?? 0;
    if (existingExpiry > now) {
      return { acquired: false };
    }
    this.localLocks.set(lockKey, now + this.stampede.lockTtlSeconds * 1000);
    return { acquired: true, via: 'local', key: lockKey };
  }

  private async releaseStampedeLock(handle: StampedeLockHandle): Promise<void> {
    if (!handle.acquired) {
      return;
    }
    if (handle.via === 'redis') {
      const redis = await this.getRedisClient();
      if (!redis) {
        return;
      }
      try {
        await redis.del(handle.key);
      } catch (error) {
        this.recordRedisFailure('[cache] failed to release redis stampede lock', { key: handle.key, error });
      }
      return;
    }
    this.localLocks.delete(handle.key);
  }

  private async waitForCacheFill<T>(key: string, maxWaitMs: number): Promise<T | null> {
    if (maxWaitMs <= 0) {
      return null;
    }
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
      await sleep(this.stampede.waitIntervalMs);
    }
    return null;
  }

  private applyStampedeSafeTtl(ttlSeconds: number): number {
    const percentJitter = Math.floor(ttlSeconds * this.stampede.maxJitterPercent);
    const jitterCap = Math.min(percentJitter, this.stampede.maxJitterSeconds);
    if (jitterCap <= 0) {
      return ttlSeconds;
    }
    const jitter = Math.floor(Math.random() * (jitterCap + 1));
    return Math.max(1, ttlSeconds - jitter);
  }

  private cleanupLocalLocks(now: number): void {
    for (const [key, expiresAt] of this.localLocks.entries()) {
      if (expiresAt <= now) {
        this.localLocks.delete(key);
      }
    }
  }

  private buildLockKey(namespacedKey: string): string {
    return `${namespacedKey}:lock`;
  }

  private formatKey(key: string): string {
    return `${this.options.namespace}:${key}`;
  }

  getFallbackSnapshot(): CacheFallbackSnapshot {
    return { ...this.fallbackState };
  }

  onFallbackStateChange(listener: (state: CacheFallbackSnapshot) => void): () => void {
    this.fallbackListeners.add(listener);
    return () => {
      this.fallbackListeners.delete(listener);
    };
  }

  isRedisFallbackActive(): boolean {
    if (!this.fallbackConfig.enabled) {
      return false;
    }
    if (this.fallbackState.mode !== 'fallback') {
      return false;
    }
    if (this.fallbackState.fallbackUntil && Date.now() >= this.fallbackState.fallbackUntil) {
      this.transitionFallbackToUnknown();
      return false;
    }
    return true;
  }

  private shouldBypassRedis(): boolean {
    return this.isRedisFallbackActive();
  }

  private async disposeRedisClient(): Promise<void> {
    const client = this.redisClient;
    this.redisClient = null;
    this.redisInitPromise = null;
    if (!client) {
      return;
    }
    try {
      await client.quit();
    } catch (error) {
      logCacheError('[cache] failed to close redis connection', error);
    }
  }

  private recordRedisFailure(message: string, error: unknown): void {
    logCacheError(message, error);
    if (!this.fallbackConfig.enabled) {
      return;
    }
    const now = Date.now();
    const failureCount = this.fallbackState.failureCount + 1;
    this.fallbackState = {
      ...this.fallbackState,
      failureCount,
      lastFailureAt: now,
      reason: message,
    };
    if (failureCount >= this.fallbackConfig.failureThreshold) {
      this.activateRedisFallback(message);
    }
  }

  private recordRedisSuccess(): void {
    if (!this.fallbackConfig.enabled) {
      return;
    }
    const prevMode = this.fallbackState.mode;
    if (prevMode === 'ready' && this.fallbackState.failureCount === 0) {
      return;
    }
    this.fallbackState = {
      ...this.fallbackState,
      mode: 'ready',
      failureCount: 0,
      lastFailureAt: null,
      fallbackUntil: null,
      reason: null,
    };
    this.notifyFallbackListeners();
    if (prevMode === 'fallback') {
      this.logFallbackEvent('[cache] redis cache connection restored');
      this.emitCacheMonitoringEvent({
        category: 'cache',
        severity: 'info',
        message: 'Redis cache connection restored',
        resource: 'cache.redis',
      });
    }
  }

  private activateRedisFallback(reason: string): void {
    if (!this.fallbackConfig.enabled) {
      return;
    }
    const now = Date.now();
    if (this.fallbackState.mode === 'fallback' && this.fallbackState.fallbackUntil && this.fallbackState.fallbackUntil > now) {
      return;
    }
    this.disposeRedisClient().catch((error) => {
      logCacheError('[cache] failed to dispose redis client during fallback', error);
    });
    this.fallbackState = {
      ...this.fallbackState,
      mode: 'fallback',
      failureCount: 0,
      lastFailureAt: now,
      fallbackUntil: now + this.fallbackConfig.cooldownMs,
      reason,
    };
    this.logFallbackEvent(`[cache] redis unavailable (${reason}); using in-memory cache only`);
    this.notifyFallbackListeners();
    this.emitCacheMonitoringEvent({
      category: 'cache',
      severity: 'warning',
      message: 'Redis cache fallback activated',
      resource: 'cache.redis',
      metadata: {
        reason,
        fallbackUntil: this.fallbackState.fallbackUntil,
      },
    });
  }

  private transitionFallbackToUnknown(): void {
    if (!this.fallbackConfig.enabled) {
      return;
    }
    if (this.fallbackState.mode !== 'fallback') {
      return;
    }
    this.fallbackState = {
      ...this.fallbackState,
      mode: 'unknown',
      fallbackUntil: null,
    };
    this.notifyFallbackListeners();
  }

  private notifyFallbackListeners(): void {
    if (this.fallbackListeners.size === 0) {
      return;
    }
    const snapshot = this.getFallbackSnapshot();
    for (const listener of this.fallbackListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        logCacheError('[cache] fallback listener error', error);
      }
    }
  }

  private logFallbackEvent(message: string): void {
    const now = Date.now();
    if (now - this.lastFallbackLogAt < this.fallbackConfig.logThrottleMs) {
      return;
    }
    this.lastFallbackLogAt = now;
    console.warn(message);
  }

  private emitCacheMonitoringEvent(event: MonitoringEventInput): void {
    recordMonitoringEvent(undefined, event).catch((error) => {
      logCacheError('[cache] failed to record monitoring event', error);
    });
  }

  private async getRedisClient(): Promise<RedisClient | null> {
    if (this.redisClient) {
      return this.redisClient;
    }
    if (!this.options.redisUrl) {
      return null;
    }
    if (this.shouldBypassRedis()) {
      return null;
    }
    if (!this.redisInitPromise) {
      this.redisInitPromise = this.initializeRedis();
    }
    this.redisClient = await this.redisInitPromise;
    return this.redisClient;
  }

  private async initializeRedis(): Promise<RedisClient | null> {
    try {
      const redisModule = (await import('ioredis')) as {
        default: new (connection: string, options?: Record<string, unknown>) => RedisClient;
      };
      const Redis = redisModule.default;
      const client = new Redis(this.options.redisUrl!, {
        maxRetriesPerRequest: this.options.redis.maxRetriesPerRequest,
        enableReadyCheck: this.options.redis.enableReadyCheck,
        lazyConnect: this.options.redis.lazyConnect,
      });
      await client.connect();
      console.log('[cache] connected to redis');
      this.recordRedisSuccess();
      return client;
    } catch (error) {
      this.recordRedisFailure('[cache] failed to initialize redis', error);
      return null;
    }
  }

  private async serializeForRedis(value: unknown): Promise<string> {
    const json = JSON.stringify(value);
    if (!this.shouldCompressPayload(json)) {
      return json;
    }
    const compressed = await this.compressPayload(json);
    return compressed ?? json;
  }

  private async deserializeCachedValue<T>(raw: string): Promise<T | null> {
    if (!this.isCompressedPayload(raw)) {
      return this.safeJsonParse<T>(raw);
    }
    const decompressed = await this.decompressPayload(raw);
    if (decompressed === null) {
      return null;
    }
    return this.safeJsonParse<T>(decompressed);
  }

  private async compressPayload(json: string): Promise<string | null> {
    const encoding = this.compression.encoding;
    const source = Buffer.from(json, 'utf8');
    try {
      const buffer =
        encoding === 'brotli'
          ? await brotliCompressAsync(source, {
            [zlibConstants.BROTLI_PARAM_QUALITY]: this.compression.brotliQuality,
          })
          : await gzipAsync(source, { level: this.compression.gzipLevel });
      return `${CACHE_COMPRESSED_PREFIX}${encoding}:${buffer.toString('base64')}`;
    } catch (error) {
      logCacheError('[cache] failed to compress value', error);
      return null;
    }
  }

  private async decompressPayload(raw: string): Promise<string | null> {
    const payload = raw.slice(CACHE_COMPRESSED_PREFIX.length);
    const separatorIndex = payload.indexOf(':');
    if (separatorIndex <= 0) {
      logCacheError('[cache] malformed compressed payload header', { rawSnippet: raw.slice(0, 32) });
      return null;
    }
    const encoding = payload.slice(0, separatorIndex) as CacheCompressionEncoding;
    const base64 = payload.slice(separatorIndex + 1);
    if (!base64) {
      logCacheError('[cache] compressed payload missing body', { rawSnippet: raw.slice(0, 32) });
      return null;
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (error) {
      logCacheError('[cache] failed to decode compressed payload', error);
      return null;
    }
    try {
      const decompressed =
        encoding === 'brotli' ? await brotliDecompressAsync(buffer) : await gunzipAsync(buffer);
      return decompressed.toString('utf8');
    } catch (error) {
      logCacheError('[cache] failed to decompress payload', error);
      return null;
    }
  }

  private shouldCompressPayload(json: string): boolean {
    if (!this.compression.enabled) {
      return false;
    }
    return Buffer.byteLength(json, 'utf8') >= this.compression.minSizeBytes;
  }

  private isCompressedPayload(raw: string): boolean {
    return raw.startsWith(CACHE_COMPRESSED_PREFIX);
  }

  private safeJsonParse<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logCacheError('[cache] failed to parse cached value', error);
      return null;
    }
  }
}

const cacheStore = new CacheStore(resolveCacheOptions());

export function getCacheNamespace(): string {
  return cacheStore.getNamespace();
}

export function getCacheRedisConfig(): CacheRedisConfig | null {
  return cacheStore.getRedisConfig();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return cacheStore.get<T>(key);
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await cacheStore.set(key, value, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await cacheStore.delete(key);
}

export async function cacheRemember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
  return cacheStore.remember(key, ttlSeconds, factory);
}

export async function closeCache(): Promise<void> {
  await cacheStore.close();
}

export function getCacheFallbackState(): CacheFallbackSnapshot {
  return cacheStore.getFallbackSnapshot();
}

export function getCacheLayerSnapshot(): CacheLayerSnapshot {
  return cacheStore.getSnapshot();
}

export function isRedisFallbackActive(): boolean {
  return cacheStore.isRedisFallbackActive();
}

export function onCacheFallbackChange(listener: (state: CacheFallbackSnapshot) => void): () => void {
  return cacheStore.onFallbackStateChange(listener);
}
