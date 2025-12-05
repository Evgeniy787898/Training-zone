import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'tzona_offline_queue_v1';
const MAX_QUEUE_LENGTH = 50;
let initialized = false;

export interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    data?: any;
    headers?: Record<string, string>;
    createdAt: number;
}

const loadQueue = (): QueuedRequest[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    } catch (error) {
        console.warn('[offlineSync] Failed to load queue', error);
    }
    return [];
};

const saveQueue = (queue: QueuedRequest[]): void => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_LENGTH)));
    } catch (error) {
        console.warn('[offlineSync] Failed to persist queue', error);
    }
};

const normalizeUrl = (config: InternalAxiosRequestConfig): string | null => {
    if (!config.url) return null;
    const base = config.baseURL ? config.baseURL.replace(/\/$/, '') : '';
    if (config.url.startsWith('http')) return config.url;
    return `${base}${config.url}`;
};

export const isOfflineError = (error: any): boolean => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    return !error?.response;
};

export const markOfflineQueuedError = (error: any): any => {
    if (error && typeof error === 'object') {
        (error as any).__offlineQueued = true;
    }
    return error;
};

export const enqueueOfflineRequest = (config: InternalAxiosRequestConfig): void => {
    const url = normalizeUrl(config);
    if (!url || !config.method || config.method.toLowerCase() === 'get') return;

    const queue = loadQueue();
    queue.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        url,
        method: config.method,
        data: config.data,
        headers: config.headers as Record<string, string> | undefined,
        createdAt: Date.now(),
    });

    if (queue.length > MAX_QUEUE_LENGTH) {
        queue.shift();
    }

    saveQueue(queue);
};

const flushQueue = async (api: AxiosInstance): Promise<void> => {
    const queue = loadQueue();
    if (!queue.length) return;

    const remaining: QueuedRequest[] = [];
    for (const item of queue) {
        try {
            await api.request({
                url: item.url,
                method: item.method as any,
                data: item.data,
                headers: item.headers,
            });
        } catch (error) {
            // Если сеть снова упала, прекращаем текущую попытку и сохраняем оставшиеся запросы
            if (isOfflineError(error)) {
                remaining.push(item, ...queue.slice(queue.indexOf(item) + 1));
                break;
            }
            // Для других ошибок логируем и не повторяем бесконечно
            console.warn('[offlineSync] Failed to replay queued request', { error, url: item.url });
        }
    }
    saveQueue(remaining);
};

export const initOfflineSync = (api: AxiosInstance): void => {
    if (initialized) return;
    initialized = true;

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            void flushQueue(api);
        });
    }

    void flushQueue(api);
};
