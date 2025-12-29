/**
 * AI Response Cache Service (BE-004)
 * Caches AI responses for repeated/similar questions to reduce API costs and latency
 */

import { createHash } from 'crypto';

export interface CachedResponse {
    reply: string;
    cards?: unknown[];
    reaction?: string;
    cachedAt: number;
    hitCount: number;
    profileId: string;
}

export interface CacheConfig {
    maxEntries: number;
    ttlMs: number;
    similarityThreshold: number; // 0-1, how similar questions need to be to hit cache
}

const DEFAULT_CONFIG: CacheConfig = {
    maxEntries: 500,
    ttlMs: 30 * 60 * 1000, // 30 minutes
    similarityThreshold: 0.9,
};

// In-memory cache (can be replaced with Redis for distributed caching)
const responseCache = new Map<string, CachedResponse>();

// Common question patterns that can be cached
const CACHEABLE_PATTERNS = [
    /^(привет|здравствуй|хай|хелло)/i,
    /^(что ты умеешь|помощь|help)/i,
    /^(как (мне |)делать .+)/i,
    /^(техника .+)/i,
    /^(что такое .+)/i,
];

// Patterns that should NEVER be cached (require fresh data)
const NON_CACHEABLE_PATTERNS = [
    /статистик/i,
    /прогресс/i,
    /сегодня/i,
    /вчера/i,
    /неделя/i,
    /план/i,
    /результат/i,
    /сколько/i,
    /мой/i,
    /моя/i,
    /моё/i,
];

/**
 * Generate cache key from question and context
 */
function generateCacheKey(
    question: string,
    profileId: string,
    intent?: string,
): string {
    // Normalize question
    const normalized = question
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ''); // Remove punctuation

    const keyData = `${normalized}|${intent || 'unknown'}`;
    return createHash('sha256').update(keyData).digest('hex').slice(0, 16);
}

/**
 * Check if question is cacheable
 */
export function isCacheable(question: string): boolean {
    // Check if matches non-cacheable patterns (user-specific data)
    for (const pattern of NON_CACHEABLE_PATTERNS) {
        if (pattern.test(question)) {
            return false;
        }
    }

    // Check if matches cacheable patterns
    for (const pattern of CACHEABLE_PATTERNS) {
        if (pattern.test(question)) {
            return true;
        }
    }

    // Default: don't cache unless explicitly cacheable
    return false;
}

/**
 * Get cached response if available
 */
export function getCachedResponse(
    question: string,
    profileId: string,
    intent?: string,
    config: Partial<CacheConfig> = {},
): CachedResponse | null {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (!isCacheable(question)) {
        return null;
    }

    const key = generateCacheKey(question, profileId, intent);
    const cached = responseCache.get(key);

    if (!cached) {
        return null;
    }

    // Check TTL
    const age = Date.now() - cached.cachedAt;
    if (age > cfg.ttlMs) {
        responseCache.delete(key);
        return null;
    }

    // Update hit count
    cached.hitCount++;

    console.log(`[AI Cache] HIT for key ${key}, hits: ${cached.hitCount}`);
    return cached;
}

/**
 * Store response in cache
 */
export function setCachedResponse(
    question: string,
    profileId: string,
    response: { reply: string; cards?: unknown[]; reaction?: string },
    intent?: string,
    config: Partial<CacheConfig> = {},
): void {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (!isCacheable(question)) {
        return;
    }

    // Enforce max entries (LRU eviction)
    if (responseCache.size >= cfg.maxEntries) {
        // Remove oldest entry
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) {
            responseCache.delete(oldestKey);
        }
    }

    const key = generateCacheKey(question, profileId, intent);

    responseCache.set(key, {
        reply: response.reply,
        cards: response.cards,
        reaction: response.reaction,
        cachedAt: Date.now(),
        hitCount: 0,
        profileId,
    });

    console.log(`[AI Cache] SET for key ${key}`);
}

/**
 * Clear cache for a specific profile
 */
export function clearProfileCache(profileId: string): number {
    let cleared = 0;
    for (const [key, value] of responseCache.entries()) {
        if (value.profileId === profileId) {
            responseCache.delete(key);
            cleared++;
        }
    }
    return cleared;
}

/**
 * Clear entire cache
 */
export function clearAllCache(): void {
    responseCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
    size: number;
    totalHits: number;
    oldestEntryAge: number;
} {
    let totalHits = 0;
    let oldestAge = 0;
    const now = Date.now();

    for (const entry of responseCache.values()) {
        totalHits += entry.hitCount;
        const age = now - entry.cachedAt;
        if (age > oldestAge) {
            oldestAge = age;
        }
    }

    return {
        size: responseCache.size,
        totalHits,
        oldestEntryAge: oldestAge,
    };
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupExpiredEntries(ttlMs: number = DEFAULT_CONFIG.ttlMs): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of responseCache.entries()) {
        if (now - entry.cachedAt > ttlMs) {
            responseCache.delete(key);
            removed++;
        }
    }

    if (removed > 0) {
        console.log(`[AI Cache] Cleaned up ${removed} expired entries`);
    }

    return removed;
}
