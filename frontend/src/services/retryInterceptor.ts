/**
 * Axios Retry Interceptor
 * SVC-R01: Exponential backoff for 5xx errors
 */
import { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

interface RetryConfig {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryCondition?: (error: AxiosError) => boolean;
}

interface ExtendedAxiosConfig extends InternalAxiosRequestConfig {
    __retryCount?: number;
    __skipRetry?: boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryCondition: (error: AxiosError) => {
        // Retry on 5xx errors and network errors
        const status = error.response?.status;
        if (!status) return true; // Network error
        return status >= 500 && status < 600;
    },
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(retryCount: number, baseDelay: number, maxDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Setup retry interceptor on axios instance
 */
export function setupRetryInterceptor(instance: AxiosInstance, config: RetryConfig = {}): void {
    const { maxRetries, baseDelay, maxDelay, retryCondition } = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    instance.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
            const axiosConfig = error.config as ExtendedAxiosConfig | undefined;

            if (!axiosConfig) {
                return Promise.reject(error);
            }

            // Skip retry if explicitly disabled
            if (axiosConfig.__skipRetry) {
                return Promise.reject(error);
            }

            // Initialize retry count
            axiosConfig.__retryCount = axiosConfig.__retryCount ?? 0;

            // Check if we should retry
            const shouldRetry = retryCondition(error) && axiosConfig.__retryCount < maxRetries;

            if (!shouldRetry) {
                return Promise.reject(error);
            }

            // Increment retry count
            axiosConfig.__retryCount += 1;

            // Calculate delay
            const delay = calculateDelay(axiosConfig.__retryCount - 1, baseDelay, maxDelay);

            // Log retry attempt
            console.info(
                `[retry] Attempt ${axiosConfig.__retryCount}/${maxRetries} for ${axiosConfig.method?.toUpperCase()} ${axiosConfig.url} after ${Math.round(delay)}ms`
            );

            // Wait before retry
            await sleep(delay);

            // Retry request
            return instance.request(axiosConfig);
        }
    );
}

/**
 * Mark request to skip retry
 */
export function skipRetry<T extends InternalAxiosRequestConfig>(config: T): T {
    (config as ExtendedAxiosConfig).__skipRetry = true;
    return config;
}

export default setupRetryInterceptor;
