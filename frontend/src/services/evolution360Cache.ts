import { get, set, del, keys } from 'idb-keyval';

const CACHE_PREFIX = 'evo360_';
const CACHE_VERSION = 1;

function getCacheKey(profileId: string, scanType: string): string {
    return `${CACHE_PREFIX}v${CACHE_VERSION}_${profileId}_${scanType}`;
}

export interface CachedEvolution360Data {
    urls: string[];
    cachedAt: number;
    version: number;
}

/**
 * Cache service for Evolution 360 images using IndexedDB
 */
export const evolution360Cache = {
    /**
     * Get cached frame URLs for a scan
     */
    async get(profileId: string, scanType: string): Promise<string[] | null> {
        try {
            const key = getCacheKey(profileId, scanType);
            const cached = await get<CachedEvolution360Data>(key);

            if (!cached || cached.version !== CACHE_VERSION) {
                return null;
            }

            // Cache is valid for 7 days
            const maxAge = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - cached.cachedAt > maxAge) {
                await del(key);
                return null;
            }

            return cached.urls;
        } catch (error) {
            console.warn('[Evolution360Cache] Failed to get cache:', error);
            return null;
        }
    },

    /**
     * Set cached frame URLs for a scan
     */
    async set(profileId: string, scanType: string, urls: string[]): Promise<void> {
        try {
            const key = getCacheKey(profileId, scanType);
            const data: CachedEvolution360Data = {
                urls,
                cachedAt: Date.now(),
                version: CACHE_VERSION,
            };
            await set(key, data);
        } catch (error) {
            console.warn('[Evolution360Cache] Failed to set cache:', error);
        }
    },

    /**
     * Clear cache for a specific scan or all scans
     */
    async clear(profileId: string, scanType?: string): Promise<void> {
        try {
            if (scanType) {
                const key = getCacheKey(profileId, scanType);
                await del(key);
            } else {
                // Clear all caches for this profile
                const allKeys = await keys();
                const profileKeys = allKeys.filter(
                    (k) => typeof k === 'string' && k.startsWith(`${CACHE_PREFIX}`) && k.includes(profileId)
                );
                for (const key of profileKeys) {
                    await del(key);
                }
            }
        } catch (error) {
            console.warn('[Evolution360Cache] Failed to clear cache:', error);
        }
    },

    /**
     * Clear all evolution caches
     */
    async clearAll(): Promise<void> {
        try {
            const allKeys = await keys();
            const evolutionKeys = allKeys.filter(
                (k) => typeof k === 'string' && k.startsWith(CACHE_PREFIX)
            );
            for (const key of evolutionKeys) {
                await del(key);
            }
        } catch (error) {
            console.warn('[Evolution360Cache] Failed to clear all cache:', error);
        }
    },
};
