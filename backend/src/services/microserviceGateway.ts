import { microserviceClients } from '../config/constants.js';
import { AppError } from './errors.js';
import { ensureTraceId } from './trace.js';

export type MicroserviceName = keyof typeof microserviceClients;

export type MicroserviceCallOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  traceId?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number; // Number of retries (default: 3)
  retryDelayMs?: number; // Initial retry delay (default: 1000ms)
};

const normalizeUrl = (baseUrl: string, path: string): string => {
  if (!baseUrl) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
};

const parseErrorBody = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const text = await response.text();
    if (!text) {
      return {};
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
};

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Check if error is retryable (transient errors)
const isRetryableError = (error: unknown, statusCode?: number): boolean => {
  // Retry on rate limit, server errors, timeout, network errors
  const retryableStatuses = [429, 500, 502, 503, 504];
  if (statusCode && retryableStatuses.includes(statusCode)) {
    return true;
  }
  if (error instanceof AppError) {
    return ['microservice_timeout', 'microservice_network_error'].includes(error.code);
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  return false;
};

export async function callMicroservice<T>(
  name: MicroserviceName,
  options: MicroserviceCallOptions,
): Promise<T> {
  const config = microserviceClients[name];
  if (!config?.enabled || !config.baseUrl) {
    throw new AppError({
      code: 'microservice_unavailable',
      message: `${String(name)} microservice is unavailable`,
      statusCode: 503,
      category: 'dependencies',
    });
  }

  const maxRetries = options.retries ?? 3;
  const baseDelayMs = options.retryDelayMs ?? 1000;
  const traceId = ensureTraceId(options.traceId);

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? config.timeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers = new Headers({
      'content-type': 'application/json',
      'x-trace-id': traceId,
      'x-service-name': 'tzona-api',
      'x-retry-attempt': String(attempt),
    });
    if (config.token) {
      headers.set('authorization', `Bearer ${config.token}`);
    }

    try {
      const response = await fetch(normalizeUrl(config.baseUrl, options.path), {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        const errorBody = await parseErrorBody(response);
        const error = new AppError({
          code: 'microservice_error',
          message: `${String(name)} microservice responded with ${response.status}`,
          statusCode: response.status,
          category: 'dependencies',
          details: errorBody,
        });

        // Check if this error is retryable
        if (isRetryableError(error, response.status) && attempt < maxRetries) {
          lastError = error;
          const delayMs = baseDelayMs * Math.pow(2, attempt); // Exponential backoff
          console.warn(`[Microservice] ${name} retry ${attempt + 1}/${maxRetries} after ${response.status}, waiting ${delayMs}ms`);
          clearTimeout(timeout);
          await sleep(delayMs);
          continue;
        }

        throw error;
      }

      const text = await response.text();
      if (!text) {
        throw new AppError({
          code: 'microservice_empty_response',
          message: `${String(name)} microservice returned an empty response`,
          statusCode: 502,
          category: 'dependencies',
        });
      }
      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof AppError && !isRetryableError(error, error.statusCode)) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      const networkError = new AppError({
        code: isAbort ? 'microservice_timeout' : 'microservice_network_error',
        message: isAbort
          ? `${String(name)} microservice timed out`
          : `${String(name)} microservice request failed`,
        statusCode: isAbort ? 504 : 502,
        category: 'dependencies',
        details: error instanceof Error ? { message: error.message } : undefined,
      });

      // Retry on transient errors
      if (isRetryableError(networkError) && attempt < maxRetries) {
        lastError = networkError;
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Microservice] ${name} retry ${attempt + 1}/${maxRetries} after error, waiting ${delayMs}ms`);
        await sleep(delayMs);
        continue;
      }

      throw networkError;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Should not reach here, but just in case
  throw lastError || new AppError({
    code: 'microservice_error',
    message: `${String(name)} microservice failed after ${maxRetries} retries`,
    statusCode: 502,
    category: 'dependencies',
  });
}
