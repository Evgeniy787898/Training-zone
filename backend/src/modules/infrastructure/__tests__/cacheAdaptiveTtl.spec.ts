import { describe, expect, it, vi, beforeEach } from 'vitest';

const adaptiveEnvKeys = [
  'CACHE_ADAPTIVE_TTL_ENABLED',
  'CACHE_ADAPTIVE_TTL_FAST_WINDOW_SECONDS',
  'CACHE_ADAPTIVE_TTL_SLOW_WINDOW_SECONDS',
  'CACHE_ADAPTIVE_TTL_MIN_MULTIPLIER',
  'CACHE_ADAPTIVE_TTL_MAX_MULTIPLIER',
] as const;

type AdaptiveEnvKey = (typeof adaptiveEnvKeys)[number];

type EnvOverrides = Partial<Record<AdaptiveEnvKey, string>>;

const applyEnv = (overrides: EnvOverrides) => {
  const previous: Record<AdaptiveEnvKey, string | undefined> = Object.create(null);
  adaptiveEnvKeys.forEach((key) => {
    previous[key] = process.env[key];
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key as AdaptiveEnvKey];
    } else {
      process.env[key as AdaptiveEnvKey] = value;
    }
  });

  return () => {
    adaptiveEnvKeys.forEach((key) => {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
};

describe('cacheAdaptiveTtl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns base TTL when adaptive mode is disabled', async () => {
    const restoreEnv = applyEnv({ CACHE_ADAPTIVE_TTL_ENABLED: 'false' });
    const { getAdaptiveTtlSeconds } = await import('../cacheAdaptiveTtl.js');

    expect(getAdaptiveTtlSeconds('profileSummary', 'scope', 120)).toBe(120);
    restoreEnv();
  });

  it('never drops TTL below one second even with aggressive multipliers', async () => {
    const restoreEnv = applyEnv({
      CACHE_ADAPTIVE_TTL_ENABLED: 'true',
      CACHE_ADAPTIVE_TTL_MIN_MULTIPLIER: '0.1',
      CACHE_ADAPTIVE_TTL_MAX_MULTIPLIER: '2',
    });
    const { recordAdaptiveTtlMutation, getAdaptiveTtlSeconds } = await import('../cacheAdaptiveTtl.js');

    recordAdaptiveTtlMutation('profileSummary', null);
    expect(getAdaptiveTtlSeconds('profileSummary', null, 0)).toBe(1);

    restoreEnv();
  });
});
