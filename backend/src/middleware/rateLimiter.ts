import { Request, Response, NextFunction } from 'express';
import { rateLimitConfig } from '../config/constants.js';
import type { RateLimitOptions } from '../types/middleware.js';
import { createRecurringTask } from '../patterns/recurringTask.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const buckets = new Map<string, RateLimitEntry>();

const cleanupInterval = rateLimitConfig.memoryCleanupIntervalMs;

const cleanupTask = createRecurringTask({
  name: 'rate-limit-bucket-cleanup',
  intervalMs: cleanupInterval,
  immediate: false,
  autoStart: false,
  run: () => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now && (!entry.blockedUntil || entry.blockedUntil <= now)) {
        buckets.delete(key);
      }
    }
  },
});

function ensureCleanupTimer() {
  cleanupTask.start();
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator, name } = options;
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('windowMs must be a positive number');
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error('max must be a positive number');
  }

  ensureCleanupTimer();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = (keyGenerator ? keyGenerator(req) : req.ip) || 'global';
    const bucketKey = `${name || 'default'}:${key}`;
    let entry = buckets.get(bucketKey);

    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      console.warn(
        `[rate-limit] Blocked request for bucket ${bucketKey}, retry in ${retryAfter}s`,
      );
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Превышен лимит запросов. Попробуйте позже.',
        retry_after: retryAfter,
      });
    }

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      console.warn(
        `[rate-limit] Limit exceeded for bucket ${bucketKey}: ${entry.count}/${max}`,
      );
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Превышен лимит запросов. Попробуйте позже.',
        retry_after: retryAfter,
      });
    }

    next();
  };
}

export function blockRateLimitKey(options: RateLimitOptions, req: Request, durationMs: number) {
  const key = (options.keyGenerator ? options.keyGenerator(req) : req.ip) || 'global';
  const bucketKey = `${options.name || 'default'}:${key}`;
  const now = Date.now();
  const entry = buckets.get(bucketKey) ?? { count: 0, resetAt: now + options.windowMs };
  entry.blockedUntil = Math.max(now + durationMs, entry.blockedUntil ?? 0);
  buckets.set(bucketKey, entry);
}

export function resetRateLimitKey(options: RateLimitOptions, req: Request) {
  const key = (options.keyGenerator ? options.keyGenerator(req) : req.ip) || 'global';
  const bucketKey = `${options.name || 'default'}:${key}`;
  buckets.delete(bucketKey);
}
