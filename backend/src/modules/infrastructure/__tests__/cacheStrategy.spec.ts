import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheRememberMock = vi.fn(async (_key: string, _ttl: number, factory: () => Promise<unknown>) => factory());
const cacheSetMock = vi.fn();
const cacheGetMock = vi.fn();
const cacheDelMock = vi.fn();
const onCacheFallbackChangeMock = vi.fn();
const getAdaptiveTtlSecondsMock = vi.fn(() => 999);
const recordAdaptiveTtlMutationMock = vi.fn();

vi.mock('../cache.js', () => ({
  cacheRemember: cacheRememberMock,
  cacheSet: cacheSetMock,
  cacheGet: cacheGetMock,
  cacheDel: cacheDelMock,
  getCacheNamespace: () => 'testns',
  getCacheRedisConfig: () => null,
  isRedisFallbackActive: () => false,
  onCacheFallbackChange: onCacheFallbackChangeMock,
}));

vi.mock('../cacheAdaptiveTtl.js', () => ({
  getAdaptiveTtlSeconds: getAdaptiveTtlSecondsMock,
  recordAdaptiveTtlMutation: recordAdaptiveTtlMutationMock,
}));

vi.mock('../utils/typeGuards.js', () => ({
  isCacheScopeEventPayload: () => true,
}));

const originalEnv = { ...process.env };

describe('cacheStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('versioned rememberCachedResource keys honor global/resource versions and TTLs', async () => {
    process.env.CACHE_VERSION_GLOBAL = '3';
    process.env.CACHE_VERSION_ACHIEVEMENTS_PAGE = '5';

    const { rememberCachedResource } = await import('../cacheStrategy.js');

    const factory = vi.fn(async () => 'payload');
    const value = await rememberCachedResource(
      'achievementsPage',
      { profileId: 'user-1', page: 1, pageSize: 20 },
      factory,
    );

    expect(value).toBe('payload');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(getAdaptiveTtlSecondsMock).toHaveBeenCalledWith('achievementsPage', 'user-1', 300);
    expect(cacheRememberMock).toHaveBeenCalledWith(
      'achievements:user-1:p:1:s:20:gv3:rv5:v1',
      999,
      expect.any(Function),
    );
  });

  it('invalidateCachedResource removes the built key and records TTL mutations', async () => {
    const { invalidateCachedResource } = await import('../cacheStrategy.js');

    await invalidateCachedResource('profileSummary', { profileId: 'profile-123' });

    expect(cacheDelMock).toHaveBeenCalledWith('profile:summary:profile-123');
    expect(recordAdaptiveTtlMutationMock).toHaveBeenCalledWith('profileSummary', null);
  });

  it('bumpCachedResourceScope advances scope versions used in rememberCachedResource', async () => {
    const { rememberCachedResource, bumpCachedResourceScope } = await import('../cacheStrategy.js');

    await rememberCachedResource('exerciseCatalog', { profileId: 'p-1', page: 1, pageSize: 10 }, async () => 'first');
    const firstKey = cacheRememberMock.mock.calls[0][0] as string;
    expect(firstKey).toContain(':v1');

    await bumpCachedResourceScope('exerciseCatalog', { profileId: 'p-1' });

    await rememberCachedResource('exerciseCatalog', { profileId: 'p-1', page: 1, pageSize: 10 }, async () => 'second');
    const secondKey = cacheRememberMock.mock.calls[1][0] as string;

    expect(secondKey).toContain(':v2');
    expect(recordAdaptiveTtlMutationMock).toHaveBeenCalledWith('exerciseCatalog', 'p-1');
  });
});
