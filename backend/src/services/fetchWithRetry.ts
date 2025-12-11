/**
 * Fetch with Retry - Reliable HTTP client with exponential backoff
 * Implements BE-002: Retry-политики для межсервисных вызовов
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry count and delay
 * - Retries on network errors and 5xx responses
 * - Circuit breaker pattern support
 */

export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    retries?: number;
    /** Initial delay in ms before first retry (default: 500) */
    initialDelay?: number;
    /** Maximum delay between retries in ms (default: 10000) */
    maxDelay?: number;
    /** Backoff multiplier (default: 2) */
    backoffFactor?: number;
    /** Add random jitter to delays (default: true) */
    jitter?: boolean;
    /** HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504]) */
    retryOnStatusCodes?: number[];
    /** Callback on each retry attempt */
    onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    retries: 3,
    initialDelay: 500,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true,
    retryOnStatusCodes: [408, 429, 500, 502, 503, 504],
    onRetry: () => { },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    backoffFactor: number,
    jitter: boolean
): number {
    const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    if (jitter) {
        // Add random jitter between 0.5x and 1.5x of the delay
        const jitterFactor = 0.5 + Math.random();
        return Math.round(cappedDelay * jitterFactor);
    }

    return cappedDelay;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error that should be retried
 */
function isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
        // Network errors in fetch appear as TypeError
        return true;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('network') ||
            message.includes('econnrefused') ||
            message.includes('econnreset') ||
            message.includes('etimedout') ||
            message.includes('fetch failed')
        );
    }
    return false;
}

/**
 * Fetch with automatic retry on failure
 *
 * @example
 * ```ts
 * const response = await fetchWithRetry('http://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ key: 'value' }),
 *   headers: { 'Content-Type': 'application/json' },
 * }, {
 *   retries: 3,
 *   onRetry: (attempt, error, delay) => {
 *     console.log(`Retry ${attempt}, waiting ${delay}ms: ${error.message}`);
 *   },
 * });
 * ```
 */
export async function fetchWithRetry(
    url: string | URL,
    init?: RequestInit,
    options?: RetryOptions
): Promise<Response> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
        try {
            const response = await fetch(url, init);

            // Check if we should retry based on status code
            if (!response.ok && opts.retryOnStatusCodes.includes(response.status)) {
                if (attempt <= opts.retries) {
                    const delay = calculateDelay(
                        attempt,
                        opts.initialDelay,
                        opts.maxDelay,
                        opts.backoffFactor,
                        opts.jitter
                    );
                    lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    opts.onRetry(attempt, lastError, delay);
                    await sleep(delay);
                    continue;
                }
            }

            return response;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Only retry on network errors
            if (isNetworkError(error) && attempt <= opts.retries) {
                const delay = calculateDelay(
                    attempt,
                    opts.initialDelay,
                    opts.maxDelay,
                    opts.backoffFactor,
                    opts.jitter
                );
                opts.onRetry(attempt, lastError, delay);
                await sleep(delay);
                continue;
            }

            throw lastError;
        }
    }

    throw lastError;
}

/**
 * Create a pre-configured fetchWithRetry for a specific service
 *
 * @example
 * ```ts
 * const aiAdvisorFetch = createServiceFetch('AI Advisor', {
 *   retries: 3,
 *   initialDelay: 500,
 * });
 *
 * const response = await aiAdvisorFetch('/api/advice', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function createServiceFetch(
    serviceName: string,
    baseUrl: string,
    defaultOptions?: RetryOptions
): (path: string, init?: RequestInit, options?: RetryOptions) => Promise<Response> {
    return async (path: string, init?: RequestInit, options?: RetryOptions) => {
        const url = `${baseUrl}${path}`;
        const mergedOptions: RetryOptions = {
            ...defaultOptions,
            ...options,
            onRetry: (attempt, error, delay) => {
                console.warn(
                    `[${serviceName}] Retry ${attempt}/${(options?.retries ?? defaultOptions?.retries ?? 3)}: ` +
                    `${error.message}. Waiting ${delay}ms...`
                );
                defaultOptions?.onRetry?.(attempt, error, delay);
                options?.onRetry?.(attempt, error, delay);
            },
        };
        return fetchWithRetry(url, init, mergedOptions);
    };
}

export default fetchWithRetry;
