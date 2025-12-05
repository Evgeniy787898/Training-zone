import { cacheAdaptiveTtlConfig } from '../../config/constants.js';
import type { CacheResourceName } from './cacheStrategy.js';

const DEFAULT_MULTIPLIER = 1;
const GLOBAL_SCOPE_KEY = '__global';
const scopeMutations = new Map<CacheResourceName, Map<string, number>>();

const clamp = (value: number, min: number, max: number): number => {
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

const getScopeKey = (scopeKey: string | null): string => {
  if (!scopeKey) {
    return GLOBAL_SCOPE_KEY;
  }
  return scopeKey;
};

const touchScope = (name: CacheResourceName, scopeKey: string): void => {
  let entries = scopeMutations.get(name);
  if (!entries) {
    entries = new Map();
    scopeMutations.set(name, entries);
  }
  entries.set(scopeKey, Date.now());
};

const getScopeAgeSeconds = (name: CacheResourceName, scopeKey: string): number | null => {
  const lastMutation = scopeMutations.get(name)?.get(scopeKey);
  if (!lastMutation) {
    return null;
  }
  return Math.max(0, (Date.now() - lastMutation) / 1000);
};

const computeMultiplier = (ageSeconds: number | null): number => {
  if (!cacheAdaptiveTtlConfig.enabled) {
    return DEFAULT_MULTIPLIER;
  }
  if (ageSeconds === null) {
    return DEFAULT_MULTIPLIER;
  }

  const { fastWindowSeconds, slowWindowSeconds, minMultiplier, maxMultiplier } = cacheAdaptiveTtlConfig;
  if (ageSeconds <= fastWindowSeconds) {
    return minMultiplier;
  }
  if (ageSeconds >= slowWindowSeconds) {
    return maxMultiplier;
  }

  const windowSpan = Math.max(slowWindowSeconds - fastWindowSeconds, 1);
  const ratio = clamp((ageSeconds - fastWindowSeconds) / windowSpan, 0, 1);
  return minMultiplier + ratio * (maxMultiplier - minMultiplier);
};

export function recordAdaptiveTtlMutation<Name extends CacheResourceName>(
  name: Name,
  scopeKey: string | null,
): void {
  if (!cacheAdaptiveTtlConfig.enabled) {
    return;
  }

  touchScope(name, getScopeKey(scopeKey));
}

export function getAdaptiveTtlSeconds<Name extends CacheResourceName>(
  name: Name,
  scopeKey: string | null,
  baseTtlSeconds: number,
): number {
  if (!cacheAdaptiveTtlConfig.enabled) {
    return baseTtlSeconds;
  }

  const ageSeconds = getScopeAgeSeconds(name, getScopeKey(scopeKey));
  const multiplier = computeMultiplier(ageSeconds);
  const ttl = Math.round(baseTtlSeconds * multiplier);
  return Math.max(1, ttl);
}
