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

  const traceId = ensureTraceId(options.traceId);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers({
    'content-type': 'application/json',
    'x-trace-id': traceId,
    'x-service-name': 'tzona-api',
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
      throw new AppError({
        code: 'microservice_error',
        message: `${String(name)} microservice responded with ${response.status}`,
        statusCode: response.status,
        category: 'dependencies',
        details: errorBody,
      });
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
    if (error instanceof AppError) {
      throw error;
    }
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new AppError({
      code: isAbort ? 'microservice_timeout' : 'microservice_network_error',
      message: isAbort
        ? `${String(name)} microservice timed out`
        : `${String(name)} microservice request failed`,
      statusCode: isAbort ? 504 : 502,
      category: 'dependencies',
      details: error instanceof Error ? { message: error.message } : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}
