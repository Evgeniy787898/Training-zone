import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface RequestDeduplicatorOptions {
  /**
   * Максимальное время жизни записей о завершённых запросах.
   * Даже если промис ещё не удалён (например, при зависании),
   * запись будет очищена после указанного периода.
   */
  maxAgeMs?: number;
}

const DEFAULT_MAX_AGE_MS = 30_000;

interface DedupEntry<TResult> {
  promise: Promise<AxiosResponse<TResult>>;
  createdAt: number;
}

function normalizeUrl(baseURL: string | undefined, url: string | undefined): string {
  const relative = url ?? '';
  if (/^https?:/i.test(relative)) {
    return relative;
  }
  const trimmedBase = (baseURL ?? '').replace(/\/$/, '');
  if (!trimmedBase) {
    return relative || '/';
  }
  if (!relative) {
    return trimmedBase || '/';
  }
  if (relative.startsWith('/')) {
    return `${trimmedBase}${relative}`;
  }
  return `${trimmedBase}/${relative}`;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(normalizeValue(value));
  } catch (error) {
    console.warn('[requestDeduplicator] Failed to stringify value', error);
    return String(value);
  }
}

/**
 * Формирует ключ дедупликации для запроса.
 * Возвращает null, если запрос не подлежит объединению (например, не GET).
 */
export function buildRequestDedupKey(config: InternalAxiosRequestConfig): string | null {
  const method = (config.method ?? 'get').toUpperCase();
  if (method !== 'GET') {
    return null;
  }
  if ((config as any).disableDeduplication) {
    return null;
  }

  const normalizedUrl = normalizeUrl(config.baseURL, config.url);
  const paramsKey = stableStringify(config.params ?? {});

  return `${method}:${normalizedUrl}?${paramsKey}`;
}

export function createRequestDeduplicator(options: RequestDeduplicatorOptions = {}) {
  const { maxAgeMs = DEFAULT_MAX_AGE_MS } = options;
  const entries = new Map<string, DedupEntry<any>>();

  const cleanup = () => {
    if (!entries.size) {
      return;
    }
    const now = Date.now();
    for (const [key, entry] of entries.entries()) {
      if (now - entry.createdAt > maxAgeMs) {
        entries.delete(key);
      }
    }
  };

  return {
    run<TResult>(key: string, factory: () => Promise<AxiosResponse<TResult>>) {
      const existing = entries.get(key);
      if (existing) {
        return existing.promise as Promise<AxiosResponse<TResult>>;
      }

      const promise = factory().finally(() => {
        const current = entries.get(key);
        if (current?.promise === promise) {
          entries.delete(key);
        }
      });

      entries.set(key, { promise, createdAt: Date.now() });
      cleanup();
      return promise;
    },
    clear(targetKey?: string) {
      if (typeof targetKey === 'string') {
        entries.delete(targetKey);
      } else {
        entries.clear();
      }
    },
  };
}

export type RequestDeduplicator = ReturnType<typeof createRequestDeduplicator>;
