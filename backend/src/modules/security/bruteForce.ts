/**
 * Brute-force protection module for PIN verification and other sensitive operations.
 * 
 * Tracks failed attempts per key (telegram ID, profile ID, IP) and blocks
 * further attempts after threshold is exceeded.
 */
import crypto from 'crypto';
import type { Request } from 'express';
import { rateLimitConfig } from '../../config/constants.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';

// Configuration from environment or defaults
const MAX_ATTEMPTS = Number.isFinite(Number(process.env.PIN_MAX_ATTEMPTS)) && Number(process.env.PIN_MAX_ATTEMPTS) > 0
    ? Math.floor(Number(process.env.PIN_MAX_ATTEMPTS))
    : rateLimitConfig.bruteForce.maxAttempts;

const BLOCK_DURATION_MS = Number.isFinite(Number(process.env.PIN_BLOCK_DURATION_MS)) && Number(process.env.PIN_BLOCK_DURATION_MS) > 0
    ? Math.floor(Number(process.env.PIN_BLOCK_DURATION_MS))
    : rateLimitConfig.bruteForce.blockDurationMs;

export interface BruteForceEntry {
    attempts: number;
    blockedUntil?: number;
    lastAttempt: number;
}

// In-memory store for brute-force tracking
const bruteForceMap = new Map<string, BruteForceEntry>();

/**
 * Prune expired entries from the brute-force map.
 * Called periodically by the recurring task.
 */
export const pruneBruteForceMap = (): void => {
    const now = Date.now();
    for (const [key, entry] of bruteForceMap.entries()) {
        if (entry.blockedUntil && entry.blockedUntil < now - BLOCK_DURATION_MS) {
            bruteForceMap.delete(key);
        } else if (!entry.blockedUntil && entry.lastAttempt < now - BLOCK_DURATION_MS) {
            bruteForceMap.delete(key);
        }
    }
};

// Start automatic cleanup task
createRecurringTask({
    name: 'brute-force-prune',
    intervalMs: rateLimitConfig.bruteForce.pruneIntervalMs,
    immediate: false,
    run: pruneBruteForceMap,
});

/**
 * Generate a unique key for brute-force tracking.
 * Priority: telegram ID > profile ID > initData hash > IP
 */
export function getBruteForceKey(
    req: Request,
    telegramNumericId: number | null
): string {
    if (telegramNumericId !== null && Number.isFinite(telegramNumericId)) {
        return `telegram:${telegramNumericId}`;
    }
    const profileId = req.header('x-profile-id');
    if (profileId) {
        return `profile:${profileId}`;
    }
    const initData = req.header('x-telegram-init-data') || req.body?.initData;
    if (initData) {
        return `initData:${crypto.createHash('sha256').update(initData).digest('hex')}`;
    }
    return `ip:${req.ip}`;
}

/**
 * Check if a key is currently blocked.
 */
export function isBlocked(key: string): boolean {
    const entry = bruteForceMap.get(key);
    if (!entry?.blockedUntil) {
        return false;
    }
    if (entry.blockedUntil > Date.now()) {
        return true;
    }
    // Block expired, clean up
    bruteForceMap.delete(key);
    return false;
}

/**
 * Get retry-after seconds for a blocked key.
 */
export function getRetryAfterSeconds(key: string): number | null {
    const entry = bruteForceMap.get(key);
    if (!entry?.blockedUntil) {
        return null;
    }
    const diff = entry.blockedUntil - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

/**
 * Record a failed attempt. Returns true if the key is now blocked.
 */
export function recordFailedAttempt(key: string): boolean {
    const now = Date.now();
    const entry = bruteForceMap.get(key) ?? { attempts: 0, lastAttempt: now };
    entry.attempts += 1;
    entry.lastAttempt = now;

    if (entry.attempts >= MAX_ATTEMPTS) {
        entry.blockedUntil = now + BLOCK_DURATION_MS;
        console.warn(`[security] Blocking key ${key} for ${BLOCK_DURATION_MS / 1000}s due to brute-force attempts`);
    }

    bruteForceMap.set(key, entry);
    return Boolean(entry.blockedUntil && entry.blockedUntil > now);
}

/**
 * Record a successful attempt (clears tracking for the key).
 */
export function recordSuccessfulAttempt(key: string): void {
    bruteForceMap.delete(key);
}

/**
 * Get the block duration in milliseconds (for external use).
 */
export function getBlockDurationMs(): number {
    return BLOCK_DURATION_MS;
}

/**
 * Get current map size (for monitoring/debugging).
 */
export function getBruteForceMapSize(): number {
    return bruteForceMap.size;
}
