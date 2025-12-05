import type { Request } from 'express';

export type RateLimitKeyFn = (req: Request) => string;

export interface RateLimitOptions {
    /** Window duration in milliseconds */
    windowMs: number;
    /** Maximum number of requests allowed per window */
    max: number;
    /** Optional function to derive a key for the bucket. Defaults to IP. */
    keyGenerator?: RateLimitKeyFn;
    /** Optional name for logging context */
    name?: string;
}
