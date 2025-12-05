/**
 * The cache strategy layer is the single source of truth for how we cache expensive
 * read endpoints.  It knows how to build cache keys, how to derive per-profile or
 * per-resource scopes, how adaptive TTLs should be calculated, and how versioning
 * interacts with Redis-backed invalidation.  All read flows (HTTP routes, warmers,
 * Supabase sync jobs) should go through this module so that every caller benefits
 * from the same locking, scope bumps, and fallback behaviour.
 */
import { cacheConfig, cacheVersioningConfig } from '../../config/constants.js';
import {
    cacheDel,
    cacheGet,
    cacheRemember,
    cacheSet,
    getCacheNamespace,
    getCacheRedisConfig,
    isRedisFallbackActive,
    onCacheFallbackChange,
} from './cache.js';
import { getAdaptiveTtlSeconds, recordAdaptiveTtlMutation } from './cacheAdaptiveTtl.js';
import { isCacheScopeEventPayload } from '../../utils/typeGuards.js';

type CacheStrategyEntry<Params, Scope = Params> = {
    ttlSeconds: number;
    buildKey: (params: Params) => string;
    scopeResolver?: (params: Scope) => string;
    version?: number;
};

// Each cache resource describes the default TTL, cache-key builder, and optional
// scope resolver.  The resolver allows us to bump or invalidate only the cache
// entries that belong to a given profile or logical group instead of flushing
// the entire cache namespace.
const cacheStrategies = {
    profileSummary: {
        ttlSeconds: cacheConfig.profile.summary.ttlSeconds,
        buildKey: ({ profileId }: { profileId: string }) => `profile:summary:${profileId}`,
    },
    achievementsPage: {
        ttlSeconds: cacheConfig.achievements.ttlSeconds,
        buildKey: ({ profileId, page, pageSize }: { profileId: string; page: number; pageSize: number }) =>
            `achievements:${profileId}:p:${page}:s:${pageSize}`,
        scopeResolver: ({ profileId }: { profileId: string }) => profileId,
    },
    exerciseCatalog: {
        ttlSeconds: cacheConfig.exercises.catalog.ttlSeconds,
        buildKey: ({ profileId, page, pageSize }: { profileId: string | null; page: number; pageSize: number }) =>
            `exercises:catalog:${profileId ?? 'public'}:p:${page}:s:${pageSize}`,
        scopeResolver: ({ profileId }: { profileId: string | null }) => profileId ?? 'public',
    },
    exerciseList: {
        ttlSeconds: cacheConfig.exercises.list.ttlSeconds,
        buildKey: ({
            filter,
            filterId,
            page,
            pageSize,
        }: {
            filter: 'program' | 'discipline' | 'empty';
            filterId?: string | null;
            page: number;
            pageSize: number;
        }) => `exercises:list:${filter}:${filterId || 'all'}:p:${page}:s:${pageSize}`,
        scopeResolver: ({
            filter,
            filterId,
        }: {
            filter: 'program' | 'discipline' | 'empty';
            filterId?: string | null;
        }) => `${filter}:${filterId || 'all'}`,
    },
    dailyAdviceList: {
        ttlSeconds: cacheConfig.dailyAdvice.list.ttlSeconds,
        buildKey: ({ adviceType }: { adviceType: 'training' | 'rest' }) => `daily_advice:list:${adviceType}`,
        scopeResolver: ({ adviceType }: { adviceType: 'training' | 'rest' }) => adviceType,
    },
    reports: {
        ttlSeconds: cacheConfig.reports.ttlSeconds,
        buildKey: ({
            profileId,
            slug,
            range,
        }: {
            profileId: string;
            slug: string;
            range: string;
        }) => `reports:${profileId}:${slug}:${range}`,
        scopeResolver: ({ profileId }: { profileId: string }) => profileId,
    },
    trainingDisciplines: {
        ttlSeconds: cacheConfig.training.disciplines.ttlSeconds,
        buildKey: (_params: Record<string, never>) => 'training:disciplines:v1',
    },
    trainingPrograms: {
        ttlSeconds: cacheConfig.training.programs.ttlSeconds,
        buildKey: ({ disciplineId }: { disciplineId?: string | null }) =>
            `training:programs:${disciplineId || 'all'}`,
    },
    assistantNotesPage: {
        ttlSeconds: cacheConfig.assistant.notes.ttlSeconds,
        buildKey: ({ profileId, limit, offset }: { profileId: string; limit: number; offset: number }) =>
            `assistant:notes:${profileId}:l${limit}:o${offset}`,
        scopeResolver: ({ profileId }: { profileId: string }) => profileId,
    },
    aiAdvisorAdvice: {
        ttlSeconds: cacheConfig.assistant.aiAdvice.ttlSeconds,
        buildKey: ({ profileId, fingerprint }: { profileId: string; fingerprint: string }) =>
            `assistant:ai-advice:${profileId}:${fingerprint}`,
        scopeResolver: ({ profileId }: { profileId: string }) => profileId,
    },
} satisfies Record<string, CacheStrategyEntry<any, any>>;


const resourceVersionOverrides = cacheVersioningConfig.resources as Record<string, number | undefined>;
const globalVersion = Math.max(1, Math.floor(cacheVersioningConfig.globalVersion ?? 1));

type CacheStrategies = typeof cacheStrategies;
export type CacheResourceName = keyof CacheStrategies;
const cacheResourceNames = new Set<CacheResourceName>(Object.keys(cacheStrategies) as Array<CacheResourceName>);
const isKnownCacheResourceName = (name: string): name is CacheResourceName =>
    cacheResourceNames.has(name as CacheResourceName);
export type CacheResourceParams<Name extends CacheResourceName> = Parameters<CacheStrategies[Name]['buildKey']>[0];
export type CacheScopeParams<Name extends CacheResourceName> = CacheStrategies[Name] extends {
    scopeResolver: (params: infer Scope) => string;
}
    ? Scope
    : never;

// Cache namespace and Redis channel metadata are derived once so that every
// helper below works with consistent identifiers regardless of the calling
// environment (worker, HTTP request, tests, etc.).
const cacheNamespace = getCacheNamespace();
const redisConfig = getCacheRedisConfig();
const MAX_VERSION = Number.MAX_SAFE_INTEGER - 1;
const scopeVersionChannel = redisConfig ? `${cacheNamespace}:cache:scope-version` : null;

type RedisCommandClient = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: 'NX'): Promise<unknown>;
    incr(key: string): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type RedisSubscriber = {
    subscribe(channel: string): Promise<unknown>;
    on(event: 'message', listener: (channel: string, payload: string) => void): void;
    on(event: 'error', listener: (error: unknown) => void): void;
};

const scopeVersions = new Map<CacheResourceName, Map<string, number>>();
let versionRedisPromise: Promise<RedisCommandClient | null> | null = null;
let versionSubscriberPromise: Promise<RedisSubscriber | null> | null = null;
let versionSubscriptionActive = false;

const resetScopeVersionClients = () => {
    versionRedisPromise = null;
    versionSubscriberPromise = null;
    versionSubscriptionActive = false;
};

if (redisConfig) {
    onCacheFallbackChange((state) => {
        if (!state.enabled) {
            return;
        }
        if (state.mode === 'fallback' || state.mode === 'ready' || state.mode === 'unknown') {
            resetScopeVersionClients();
        }
    });
}

type ScopeVersionEvent = {
    name: CacheResourceName;
    scopeKey: string;
    version: number;
};

function hasScopeResolver<Name extends CacheResourceName>(
    strategy: CacheStrategies[Name],
): strategy is CacheStrategies[Name] & { scopeResolver: (params: CacheScopeParams<Name>) => string } {
    return typeof (strategy as { scopeResolver?: unknown }).scopeResolver === 'function';
}

function setLocalScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string, version: number): void {
    let versions = scopeVersions.get(name);
    if (!versions) {
        versions = new Map();
        scopeVersions.set(name, versions);
    }
    versions.set(scopeKey, version);
}

function getLocalScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): number | null {
    const versions = scopeVersions.get(name);
    if (!versions) {
        return null;
    }
    const version = versions.get(scopeKey);
    return typeof version === 'number' ? version : null;
}

function getNextLocalScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): number {
    const current = getLocalScopeVersion(name, scopeKey) ?? 1;
    const next = current >= MAX_VERSION ? 1 : current + 1;
    setLocalScopeVersion(name, scopeKey, next);
    return next;
}

function buildScopeVersionKey<Name extends CacheResourceName>(name: Name, scopeKey: string): string {
    return `${cacheNamespace}:scope-version:${name}:${scopeKey}`;
}

async function getRedisCommandClient(): Promise<RedisCommandClient | null> {
    if (!redisConfig) {
        return null;
    }
    if (isRedisFallbackActive()) {
        return null;
    }
    if (!versionRedisPromise) {
        versionRedisPromise = (async () => {
            const redisModule = await import('ioredis');
            const Redis = redisModule.default as unknown as new (url: string, options?: Record<string, unknown>) => RedisCommandClient;
            const client = new Redis(redisConfig.url, {
                ...redisConfig.options,
                lazyConnect: false,
            });
            client.on?.('error', (error: unknown) => {
                console.error('[cache] scope version redis error', error);
            });
            return client;
        })().catch((error) => {
            console.error('[cache] failed to initialize redis for scope versions', error);
            return null;
        });
    }
    return versionRedisPromise;
}

async function getRedisSubscriber(): Promise<RedisSubscriber | null> {
    if (!redisConfig) {
        return null;
    }
    if (isRedisFallbackActive()) {
        return null;
    }
    if (!versionSubscriberPromise) {
        versionSubscriberPromise = (async () => {
            const redisModule = await import('ioredis');
            const Redis = redisModule.default as unknown as new (url: string, options?: Record<string, unknown>) => RedisSubscriber;
            const subscriber = new Redis(redisConfig.url, {
                ...redisConfig.options,
                lazyConnect: false,
            });
            subscriber.on('error', (error) => {
                console.error('[cache] scope version subscriber error', error);
            });
            return subscriber;
        })().catch((error) => {
            console.error('[cache] failed to initialize scope version subscriber', error);
            return null;
        });
    }
    return versionSubscriberPromise;
}

async function ensureScopeVersionSubscription(): Promise<void> {
    if (!scopeVersionChannel || versionSubscriptionActive) {
        return;
    }
    const subscriber = await getRedisSubscriber();
    if (!subscriber) {
        return;
    }
    try {
        await subscriber.subscribe(scopeVersionChannel);
        subscriber.on('message', (channel, payload) => {
            if (channel !== scopeVersionChannel) {
                return;
            }
            try {
                const event = JSON.parse(payload);
                if (!isCacheScopeEventPayload(event, isKnownCacheResourceName)) {
                    return;
                }
                setLocalScopeVersion(event.name, event.scopeKey, event.version);
            } catch (error) {
                console.error('[cache] failed to parse scope version event', error);
            }
        });
        versionSubscriptionActive = true;
    } catch (error) {
        console.error('[cache] failed to subscribe to scope version updates', error);
    }
}

async function fetchScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): Promise<number | null> {
    const client = await getRedisCommandClient();
    if (!client) {
        return null;
    }
    const key = buildScopeVersionKey(name, scopeKey);
    try {
        const raw = await client.get(key);
        if (!raw) {
            await client.set(key, '1', 'NX');
            return 1;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            await client.set(key, '1');
            return 1;
        }
        await ensureScopeVersionSubscription();
        return parsed;
    } catch (error) {
        console.error('[cache] failed to fetch scope version', { key, error });
        return null;
    }
}

async function incrementScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): Promise<number | null> {
    const client = await getRedisCommandClient();
    if (!client) {
        return null;
    }
    const key = buildScopeVersionKey(name, scopeKey);
    try {
        const next = await client.incr(key);
        if (next > MAX_VERSION) {
            await client.set(key, '1');
            return 1;
        }
        await ensureScopeVersionSubscription();
        return next;
    } catch (error) {
        console.error('[cache] failed to increment scope version', { key, error });
        return null;
    }
}

async function publishScopeVersionUpdate<Name extends CacheResourceName>(name: Name, scopeKey: string, version: number): Promise<void> {
    if (!scopeVersionChannel) {
        return;
    }
    const client = await getRedisCommandClient();
    if (!client) {
        return;
    }
    try {
        await client.publish(
            scopeVersionChannel,
            JSON.stringify({
                name,
                scopeKey,
                version,
            } satisfies ScopeVersionEvent),
        );
    } catch (error) {
        console.error('[cache] failed to publish scope version update', error);
    }
}

async function getScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): Promise<number> {
    const local = getLocalScopeVersion(name, scopeKey);
    if (typeof local === 'number') {
        return local;
    }
    const distributed = await fetchScopeVersion(name, scopeKey);
    const version = distributed ?? 1;
    setLocalScopeVersion(name, scopeKey, version);
    return version;
}

async function bumpScopeVersion<Name extends CacheResourceName>(name: Name, scopeKey: string): Promise<number> {
    const distributed = await incrementScopeVersion(name, scopeKey);
    const version = typeof distributed === 'number' ? distributed : getNextLocalScopeVersion(name, scopeKey);
    if (typeof distributed === 'number') {
        await publishScopeVersionUpdate(name, scopeKey, version);
    }
    return version;
}

async function buildCacheKey<Name extends CacheResourceName>(name: Name, params: CacheResourceParams<Name>): Promise<string> {
    const strategy = cacheStrategies[name] as CacheStrategies[Name];
    const baseKey = strategy.buildKey(params as CacheResourceParams<Name> as any);
    const scopeKey = resolveScopeKey(name, params as CacheResourceParams<Name>);
    const versionedBaseKey = appendVersionSegments(name, baseKey);
    if (!scopeKey) {
        return versionedBaseKey;
    }
    const version = await getScopeVersion(name, scopeKey);
    return `${versionedBaseKey}:v${version}`;
}

function resolveScopeKey<Name extends CacheResourceName>(
    name: Name,
    params: CacheResourceParams<Name>,
): string | null {
    const strategy = cacheStrategies[name] as CacheStrategies[Name];
    if (!hasScopeResolver(strategy)) {
        return null;
    }
    const scopeKey = strategy.scopeResolver(params as CacheScopeParams<Name>);
    if (!scopeKey) {
        return null;
    }
    return scopeKey;
}

/**
 * Reads a cached value using the canonical cache key builder.  Callers should
 * use this when they already know a resource was cached (e.g. after warming)
 * and simply want to retrieve the hydrated payload without recomputing it.
 */
export async function getCachedResource<T, Name extends CacheResourceName>(
    name: Name,
    params: CacheResourceParams<Name>,
): Promise<T | null> {
    const key = await buildCacheKey(name, params);
    return cacheGet<T>(key);
}

/**
 * Persists a value under the strategy-driven key while applying adaptive TTLs.
 * The adaptive multiplier ensures hot resources stay cached longer when they
 * are mutated infrequently, and shorter when they change constantly.
 */
export async function setCachedResource<T, Name extends CacheResourceName>(
    name: Name,
    params: CacheResourceParams<Name>,
    value: T,
): Promise<void> {
    const key = await buildCacheKey(name, params);
    const scopeKey = resolveScopeKey(name, params);
    const ttl = getAdaptiveTtlSeconds(name, scopeKey, cacheStrategies[name].ttlSeconds);
    await cacheSet(key, value, ttl);
}

/**
 * Wraps expensive factories with cache lookup + stampede-safe remember
 * semantics.  The factory is only executed on a miss while concurrent callers
 * share the same in-flight promise through the cache store.
 */
export async function rememberCachedResource<T, Name extends CacheResourceName>(
    name: Name,
    params: CacheResourceParams<Name>,
    factory: () => Promise<T>,
): Promise<T> {
    const key = await buildCacheKey(name, params);
    const scopeKey = resolveScopeKey(name, params);
    const ttl = getAdaptiveTtlSeconds(name, scopeKey, cacheStrategies[name].ttlSeconds);
    return cacheRemember(key, ttl, factory);
}

/**
 * Deletes a specific cache entry and records the mutation so adaptive TTLs can
 * react to the increased churn for that scope/resource.
 */
export async function invalidateCachedResource<Name extends CacheResourceName>(
    name: Name,
    params: CacheResourceParams<Name>,
): Promise<void> {
    const key = await buildCacheKey(name, params);
    const scopeKey = resolveScopeKey(name, params);
    recordAdaptiveTtlMutation(name, scopeKey);
    await cacheDel(key);
}

/**
 * Increments the distributed scope version so all cache entries tied to the
 * same logical owner (e.g. profile) become stale in one atomic operation.
 * Scope bumps are preferred over deleting every derived key manually.
 */
export async function bumpCachedResourceScope<Name extends CacheResourceName>(
    name: Name,
    params: CacheScopeParams<Name>,
): Promise<void> {
    const strategy = cacheStrategies[name] as CacheStrategies[Name];
    if (!hasScopeResolver(strategy)) {
        return;
    }
    const scopeKey = strategy.scopeResolver(params);
    if (!scopeKey) {
        return;
    }
    await bumpScopeVersion(name, scopeKey);
    recordAdaptiveTtlMutation(name, scopeKey);
}

export function getCacheStrategy<Name extends CacheResourceName>(name: Name) {
    return cacheStrategies[name];
}

function appendVersionSegments<Name extends CacheResourceName>(name: Name, baseKey: string): string {
    const segments: string[] = [];
    if (globalVersion > 1) {
        segments.push(`gv${globalVersion}`);
    }
    const resourceVersion = getResourceVersion(name);
    if (resourceVersion > 1) {
        segments.push(`rv${resourceVersion}`);
    }
    if (!segments.length) {
        return baseKey;
    }
    return `${baseKey}:${segments.join(':')}`;
}

function getResourceVersion<Name extends CacheResourceName>(name: Name): number {
    const strategyVersion = (cacheStrategies[name] as { version?: number }).version;
    if (typeof strategyVersion === 'number' && Number.isFinite(strategyVersion) && strategyVersion > 0) {
        return Math.floor(strategyVersion);
    }
    const override = resourceVersionOverrides[name];
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
        return Math.floor(override);
    }
    return 1;
}

