import type { Response } from 'express';

type CacheScope = 'public' | 'private' | 'no-store';

export type HttpCacheOptions = {
    scope?: CacheScope;
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    staleIfError?: number;
    mustRevalidate?: boolean;
    immutable?: boolean;
    vary?: string[];
};

const clampSeconds = (value?: number, fallback = 0) => {
    if (!Number.isFinite(value as number)) {
        return Math.max(0, Math.floor(fallback));
    }
    return Math.max(0, Math.floor(value as number));
};

const formatVary = (headers?: string[]): string | null => {
    if (!headers || headers.length === 0) {
        return null;
    }
    const normalized = Array.from(
        new Set(
            headers
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
        ),
    );
    return normalized.length > 0 ? normalized.join(', ') : null;
};

export function applyEdgeCacheHeaders(res: Response, options: HttpCacheOptions = {}): void {
    const scope: CacheScope = options.scope ?? 'public';

    const varyHeader = formatVary(options.vary);
    if (varyHeader) {
        res.setHeader('Vary', varyHeader);
    }

    if (scope === 'no-store') {
        res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('CDN-Cache-Control', 'no-store');
        return;
    }

    const maxAge = clampSeconds(options.maxAge, 0);
    const cacheControl = [scope, `max-age=${maxAge}`];

    if (options.mustRevalidate) {
        cacheControl.push('must-revalidate');
    }

    if (options.immutable) {
        cacheControl.push('immutable');
    }

    if (options.staleWhileRevalidate) {
        cacheControl.push(`stale-while-revalidate=${clampSeconds(options.staleWhileRevalidate)}`);
    }

    if (options.staleIfError) {
        cacheControl.push(`stale-if-error=${clampSeconds(options.staleIfError)}`);
    }

    res.setHeader('Cache-Control', cacheControl.join(', '));

    if (scope === 'public') {
        const surrogateControl = [`max-age=${clampSeconds(options.sMaxAge, maxAge)}`];

        if (options.staleWhileRevalidate) {
            surrogateControl.push(`stale-while-revalidate=${clampSeconds(options.staleWhileRevalidate)}`);
        }
        if (options.staleIfError) {
            surrogateControl.push(`stale-if-error=${clampSeconds(options.staleIfError)}`);
        }

        res.setHeader('Surrogate-Control', surrogateControl.join(', '));
        res.setHeader('CDN-Cache-Control', surrogateControl.join(', '));
        return;
    }

    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
}

export function preventHttpCaching(res: Response): void {
    applyEdgeCacheHeaders(res, { scope: 'no-store' });
}
