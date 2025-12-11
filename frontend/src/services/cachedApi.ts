import { apiClient, type ApiClient } from './api';
import {
    ProfileSummary,
    SessionTodayResponse,
    SessionWeekResponse,
    ExerciseCatalogItem,
    ExerciseHistoryItem,
    ExerciseLevelsResponse,
    TrainingDirection,
    TrainingProgram,
    ProgramExercise,
    AchievementResponse,
    DailyAdvice,
    PinVerificationResponse,
    ReportData,
    AssistantSessionState,
    AssistantNotesResponse,
    UserProgramSnapshot,
    UserProgramRequest,
    UserProgramUpdateRequest,
    CreateSessionPayload,
    UpdateSessionPayload,
} from '@/types';

// Версия кэша - увеличивай ТОЛЬКО при критических изменениях структуры данных!
const CACHE_VERSION = 9; // v9: Force clear ALL cache for icon data refresh

// Кэш для данных с временем жизни
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // время жизни в миллисекундах
    staleTime?: number; // время до устаревания (для stale-while-revalidate)
}

class ApiCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private persistentCache: Map<string, CacheEntry<any>> = new Map(); // Для долгого кеша
    private backgroundRefreshPromises: Map<string, Promise<any>> = new Map(); // Для фонового обновления
    private failureTimestamps: Map<string, number> = new Map();
    private readonly failureSuppressionMs = 30 * 1000; // 30 секунд подавления устаревших данных после ошибки

    private savePersistentCacheTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Проверяем версию кэша и очищаем если устарел
        this.checkCacheVersion();
        // Загружаем персистентный кеш из localStorage при инициализации
        this.loadPersistentCache();

        // Сохраняем персистентный кеш в localStorage периодически
        setInterval(() => {
            this.savePersistentCache();
        }, 5 * 60 * 1000); // Каждые 5 минут (вместо 1 минуты для производительности)
    }

    private markFailure(key: string): void {
        this.failureTimestamps.set(key, Date.now());
    }

    private clearFailure(key: string): void {
        this.failureTimestamps.delete(key);
    }

    private checkCacheVersion(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const storedVersion = localStorage.getItem('tzona_cache_version');
            const currentVersion = CACHE_VERSION.toString();

            if (storedVersion !== currentVersion) {
                console.log(`[ApiCache] Cache version changed from ${storedVersion} to ${currentVersion}, clearing ALL cache`);
                // Очищаем весь кэш при смене версии
                localStorage.removeItem('tzona_persistent_cache');
                // Также удаляем все старые force clear флаги
                for (let i = 1; i <= 20; i++) {
                    localStorage.removeItem(`tzona_cache_force_clear_v${i}`);
                }
                localStorage.setItem('tzona_cache_version', currentVersion);
            }
        } catch (e) {
            console.warn('[ApiCache] Failed to check cache version:', e);
        }
    }

    private isRecentlyFailed(key: string): boolean {
        const timestamp = this.failureTimestamps.get(key);
        if (!timestamp) {
            return false;
        }
        if (Date.now() - timestamp < this.failureSuppressionMs) {
            return true;
        }
        this.failureTimestamps.delete(key);
        return false;
    }

    // Загрузить персистентный кеш из localStorage (оптимизировано)
    private loadPersistentCache(): void {
        try {
            const stored = localStorage.getItem('tzona_persistent_cache');
            if (!stored) return;

            const parsed = JSON.parse(stored);
            const now = Date.now();

            // Оптимизация: обрабатываем только нужные ключи
            for (const [key, entry] of Object.entries(parsed)) {
                const typedEntry = entry as any;
                if (!typedEntry || !typedEntry.data) continue;

                const age = now - typedEntry.timestamp;
                // Загружаем валидные записи (свежие или stale, но в пределах staleTime)
                const staleTime = typedEntry.staleTime || typedEntry.ttl * 2;
                if (age < staleTime) {
                    this.persistentCache.set(key, typedEntry);
                    // Если данные свежие, переносим в обычный кеш для быстрого доступа
                    if (age < typedEntry.ttl) {
                        this.cache.set(key, typedEntry);
                    }
                }
            }
        } catch (e) {
            // Игнорируем ошибки парсинга
            console.debug('Failed to load persistent cache:', e);
        }
    }

    // Сохранить персистентный кеш в localStorage с debounce
    private savePersistentCache(): void {
        // Очищаем предыдущий таймаут для debounce
        if (this.savePersistentCacheTimeout !== null) {
            clearTimeout(this.savePersistentCacheTimeout);
        }

        // Debounce сохранения на 1 секунду
        this.savePersistentCacheTimeout = setTimeout(() => {
            try {
                const toStore: Record<string, any> = {};
                const now = Date.now();
                for (const [key, entry] of this.persistentCache.entries()) {
                    // Сохраняем только валидные записи
                    if (entry && (now - entry.timestamp < entry.ttl)) {
                        toStore[key] = entry;
                    }
                }
                localStorage.setItem('tzona_persistent_cache', JSON.stringify(toStore));
            } catch (e) {
                // Игнорируем ошибки (например, если localStorage переполнен)
            }
            this.savePersistentCacheTimeout = null;
        }, 1000);
    }

    /**
     * Совместимость со старым API: scheduleSavePersistentCache использовался до рефакторинга,
     * поэтому оставляем отдельный метод-обертку, который вызывает текущее debounce сохранение.
     */
    private scheduleSavePersistentCache(): void {
        this.savePersistentCache();
    }

    // Получить данные из кэша, если они еще действительны
    // Возвращает данные даже если они stale (stale-while-revalidate паттерн)
    get<T>(key: string, allowStale = true): T | null {
        // Сначала проверяем обычный кеш
        const entry = this.cache.get(key);
        if (entry) {
            if (this.isRecentlyFailed(key)) {
                this.cache.delete(key);
                this.persistentCache.delete(key);
                return null;
            }
            const age = Date.now() - entry.timestamp;
            if (age < entry.ttl) {
                // Данные свежие, возвращаем их
                return entry.data;
            }
            // Данные устарели, но если allowStale - возвращаем их и обновляем в фоне
            if (allowStale && (!entry.staleTime || age < entry.staleTime)) {
                return entry.data;
            }
        }

        // Проверяем персистентный кеш
        const persistentEntry = this.persistentCache.get(key);
        if (persistentEntry) {
            if (this.isRecentlyFailed(key)) {
                this.persistentCache.delete(key);
                return null;
            }
            const age = Date.now() - persistentEntry.timestamp;
            if (age < persistentEntry.ttl) {
                // Переносим в обычный кеш для быстрого доступа
                this.cache.set(key, persistentEntry);
                return persistentEntry.data;
            }
            // Если данные устарели, но если allowStale - возвращаем их и обновляем в фоне
            if (allowStale && (!persistentEntry.staleTime || age < persistentEntry.staleTime)) {
                // Переносим в обычный кеш для быстрого доступа
                this.cache.set(key, persistentEntry);
                return persistentEntry.data;
            }
        }

        return null;
    }

    // Сохранить данные в кэш (с оптимизацией для больших данных)
    set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000, persistent = false, staleTime?: number): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl,
            staleTime: staleTime || ttl * 2, // По умолчанию stale время = 2x TTL
        };

        this.cache.set(key, entry);
        this.clearFailure(key);

        if (persistent) {
            try {
                this.persistentCache.set(key, entry);
                // КРИТИЧНО: Запланировать сохранение в localStorage!
                this.scheduleSavePersistentCache();
            } catch (e: any) {
                // Если localStorage переполнен, игнорируем ошибку
                // В будущем можно использовать IndexedDB для больших данных
                console.debug('Failed to save to persistent cache (localStorage full):', e);
            }
        }
    }

    // Получить данные с фоновым обновлением (stale-while-revalidate)
    async getWithBackgroundRefresh<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number,
        persistent = false,
        staleTime?: number
    ): Promise<T> {
        const isTrainingPrograms = key.startsWith('trainingPrograms_');
        const isTrainingDisciplines = key === 'trainingDisciplines';
        const isProgramExercises = key.startsWith('programExercises_');
        let fallbackData: T | null = null;

        // Получаем данные из кеша (даже если stale)
        const cached = this.get<T>(key, true);

        if (cached) {
            const entry = this.cache.get(key) || this.persistentCache.get(key);
            const age = Date.now() - (entry?.timestamp || 0);
            const isEmptyArray = Array.isArray(cached) && cached.length === 0;
            const forceRefreshEmpty =
                isEmptyArray && (isTrainingPrograms || isTrainingDisciplines || isProgramExercises);

            console.log(`[ApiCache] Found cached data for ${key}: `, {
                age: age,
                ttl: entry?.ttl || ttl,
                staleTime: entry?.staleTime || staleTime || ttl * 2,
                dataLength: Array.isArray(cached) ? cached.length : 'not array',
                isFresh: age < (entry?.ttl || ttl)
            });

            if (forceRefreshEmpty) {
                console.warn(`[ApiCache] Cached data for ${key} is empty, forcing refresh`);
                fallbackData = cached;
            } else {
                // Если данные свежие, возвращаем их сразу
                if (age < (entry?.ttl || ttl)) {
                    console.log(`[ApiCache] Returning fresh cached data for ${key}`);
                    return cached;
                }

                // Если данные stale, возвращаем их, но обновляем в фоне
                if (age < (entry?.staleTime || staleTime || ttl * 2)) {
                    console.log(`[ApiCache] Returning stale cached data for ${key}, refreshing in background`);
                    // Запускаем фоновое обновление, если еще не запущено
                    if (!this.backgroundRefreshPromises.has(key)) {
                        const refreshPromise = fetchFn()
                            .then((freshData) => {
                                console.log(`[ApiCache] Background refresh success for ${key}: `, Array.isArray(freshData) ? freshData.length : 'not array');
                                const emptyTrainingPrograms = isTrainingPrograms && Array.isArray(freshData) && freshData.length === 0;
                                if (emptyTrainingPrograms) {
                                    const emptyTtl = Math.min(ttl, 10 * 60 * 1000); // максимум 10 минут для пустых данных
                                    const emptyStale = staleTime ?? emptyTtl * 2;
                                    this.set(key, freshData, emptyTtl, persistent, emptyStale);
                                } else {
                                    this.set(key, freshData, ttl, persistent, staleTime);
                                }
                                this.backgroundRefreshPromises.delete(key);
                                return freshData;
                            })
                            .catch((err: any) => {
                                this.backgroundRefreshPromises.delete(key);
                                // При ошибке фонового обновления - ОСТАВЛЯЕМ старые данные в кеше!
                                // НЕ удаляем кеш, чтобы при следующем заходе данные загрузились мгновенно
                                console.warn(`[ApiCache] Background refresh failed for ${key}, keeping cached data: `, err.message);
                                this.markFailure(key);
                            });
                        this.backgroundRefreshPromises.set(key, refreshPromise);
                    }

                    return cached; // Возвращаем stale данные сразу
                }
            }
        }

        console.log(`[ApiCache] No cached data for ${key}, fetching fresh data`);

        // Данных нет или они слишком старые - загружаем свежие и ЖДЕМ загрузки
        try {
            const data = await fetchFn();
            console.log(`[ApiCache] Fetched fresh data for ${key}: `, Array.isArray(data) ? data.length : 'not array', data);

            if (data !== null && data !== undefined) {
                const isEmptyCriticalArray =
                    Array.isArray(data) &&
                    data.length === 0 &&
                    (isTrainingPrograms || isTrainingDisciplines || isProgramExercises);

                if (isEmptyCriticalArray) {
                    const emptyTtl = Math.min(ttl, 10 * 60 * 1000);
                    const emptyStale = staleTime ?? emptyTtl * 2;
                    this.set(key, data, emptyTtl, persistent, emptyStale);
                } else {
                    this.set(key, data, ttl, persistent, staleTime);
                }
                console.log(`[ApiCache] Saved data to cache for ${key}`);
            }
            return data;
        } catch (err: any) {
            console.error(`[ApiCache] Error fetching data for ${key}: `, err);

            const isDatabaseUnavailable =
                err.code === 'SERVER_ERROR' ||
                err.message?.includes('503') ||
                err.message?.includes('database_unavailable') ||
                err.message?.includes('недоступен');

            if (isDatabaseUnavailable) {
                this.delete(key, { preserveFailure: true });
            }

            this.markFailure(key);

            if (fallbackData) {
                console.warn(`[ApiCache] Returning cached fallback for ${key} after fetch failure`);
                return fallbackData;
            }

            if (isDatabaseUnavailable && key.startsWith('exerciseLevels_')) {
                return { items: [] } as unknown as T;
            }

            throw err;
        }
    }

    // Очистить кэш
    clear(): void {
        this.cache.clear();
        this.persistentCache.clear();
        try {
            localStorage.removeItem('tzona_persistent_cache');
        } catch (e) {
            // Игнорируем ошибки
        }
    }

    // Удалить конкретный ключ
    delete(key: string, options: { preserveFailure?: boolean } = {}): void {
        this.cache.delete(key);
        this.persistentCache.delete(key);
        if (!options.preserveFailure) {
            this.failureTimestamps.delete(key);
        }
        try {
            const stored = localStorage.getItem('tzona_persistent_cache');
            if (!stored) {
                return;
            }
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                delete parsed[key];
                localStorage.setItem('tzona_persistent_cache', JSON.stringify(parsed));
            }
        } catch (e) {
            // Игнорируем ошибки чтения/записи localStorage
        }
    }

    // Очистить устаревшие записи (оптимизированная версия)
    cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        // Собираем ключи для удаления (более эффективно чем удаление во время итерации)
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > (entry.staleTime || entry.ttl * 2)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));

        keysToDelete.length = 0; // Очищаем массив для повторного использования

        for (const [key, entry] of this.persistentCache.entries()) {
            if (now - entry.timestamp > (entry.staleTime || entry.ttl * 2)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.persistentCache.delete(key));
    }
}

// Создаем экземпляр кэша
const apiCache = new ApiCache();

const ASSISTANT_SESSION_CACHE_KEY = 'assistantSessionState';

const fetchAssistantSessionState = async () => apiClient.getAssistantSessionState();

// Интервал для очистки устаревших записей (каждые 10 минут для лучшей производительности)
setInterval(() => {
    apiCache.cleanup();
}, 10 * 60 * 1000);

// Кэширующий API клиент
type CachedApiClient = ApiClient & {
    verifyPin: (pin: string) => Promise<PinVerificationResponse>;
    clearCache: () => void;
    invalidateCache: (keys: string | string[]) => void;
    refreshAssistantSessionState: () => Promise<{ state: AssistantSessionState; updatedAt: string | null; expiresAt: string | null }>;
};

export const cachedApiClient = {
    // Auth
    verifyPin: apiClient.verifyPin,

    // Profile
    getProfileSummary: async () => {
        const cacheKey = 'profileSummary';
        const cached = apiCache.get<ProfileSummary>(cacheKey);
        if (cached) return cached;

        const data = await apiClient.getProfileSummary();
        apiCache.set<ProfileSummary>(cacheKey, data, 30 * 1000); // 30 секунд
        return data;
    },

    updatePreferences: async (payload: Record<string, any>) => {
        const data = await apiClient.updatePreferences(payload);
        // Очищаем кэш профиля после обновления
        apiCache.clear();
        return data;
    },
    getThemePalette: () => apiClient.getThemePalette(),
    updateThemePalette: async (palette) => {
        const data = await apiClient.updateThemePalette(palette);
        apiCache.clear();
        return data;
    },
    changePin: apiClient.changePin,
    clearServerCache: async () => {
        const data = await apiClient.clearServerCache();
        // Also clear local cache to ensure sync
        apiCache.clear();
        return data;
    },

    // Sessions
    getTodaySession: async (date?: string) => {
        const cacheKey = `todaySession_${date || 'today'} `;
        const cached = apiCache.get<SessionTodayResponse>(cacheKey);
        if (cached) return cached;

        const data = await apiClient.getTodaySession(date);
        apiCache.set<SessionTodayResponse>(cacheKey, data, 60 * 1000); // 1 минута
        return data;
    },

    getWeekPlan: async (date?: string) => {
        const cacheKey = `weekPlan_${date || 'thisWeek'} `;
        const cached = apiCache.get<SessionWeekResponse>(cacheKey);
        if (cached) return cached;

        const data = await apiClient.getWeekPlan(date);
        apiCache.set<SessionWeekResponse>(cacheKey, data, 5 * 60 * 1000); // 5 минут
        return data;
    },

    getSession: apiClient.getSession,
    createSession: async (payload: CreateSessionPayload) => {
        const data = await apiClient.createSession(payload);
        // Очищаем кэш сессий после создания новой
        apiCache.clear();
        return data;
    },

    updateSession: async (id: string, payload: UpdateSessionPayload) => {
        const data = await apiClient.updateSession(id, payload);
        // Очищаем кэш сессий после обновления
        apiCache.clear();
        return data;
    },

    deleteSession: async (id: string) => {
        const data = await apiClient.deleteSession(id);
        // Очищаем кэш сессий после удаления
        apiCache.clear();
        return data;
    },

    // Reports
    getReport: async <TReport extends ReportData = ReportData>(slug: string, params: Record<string, any> = {}) => {
        const cacheKey = `report_${slug}_${JSON.stringify(params)} `;
        const cached = apiCache.get<TReport>(cacheKey);
        if (cached) return cached;

        const data = await apiClient.getReport<TReport>(slug, params);
        apiCache.set<TReport>(cacheKey, data, 10 * 60 * 1000); // 10 минут
        return data;
    },

    // Achievements
    getAchievements: async (params: { page?: number; pageSize?: number; fields?: readonly string[] } = {}) => {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;
        const fieldsKey = Array.isArray(params.fields) && params.fields.length > 0
            ? params.fields.slice().sort().join(',')
            : 'all';
        const cacheKey = `achievements_${page}_${pageSize}_${fieldsKey} `;

        return apiCache.getWithBackgroundRefresh<AchievementResponse>(
            cacheKey,
            () => apiClient.getAchievements({ ...params, page, pageSize }),
            5 * 60 * 1000,
            true, // persistent
            24 * 60 * 60 * 1000 // 24h stale
        );
    },

    // Exercises
    getExerciseCatalog: async () => {
        const cacheKey = 'exerciseCatalog';
        return apiCache.getWithBackgroundRefresh<{ items: ExerciseCatalogItem[] } | ExerciseCatalogItem[]>(
            cacheKey,
            () => apiClient.getExerciseCatalog(),
            10 * 60 * 1000,
            true, // persistent
            24 * 60 * 60 * 1000 // 24h stale
        );
    },

    getExerciseHistory: async (exerciseKey: string) => {
        const cacheKey = `exerciseHistory_${exerciseKey} `;
        return apiCache.getWithBackgroundRefresh<{ items: ExerciseHistoryItem[] } | ExerciseHistoryItem[]>(
            cacheKey,
            () => apiClient.getExerciseHistory(exerciseKey),
            5 * 60 * 1000,
            true, // persistent
            24 * 60 * 60 * 1000 // 24h stale
        );
    },

    getExerciseLevels: async (exerciseKey: string) => {
        const cacheKey = `exerciseLevels_${exerciseKey} `;
        const TTL = 24 * 60 * 60 * 1000; // 24 часа - считается "свежим"
        const STALE_TIME = 30 * 24 * 60 * 60 * 1000; // 30 дней - можно использовать старые данные

        try {
            const payload = await apiCache.getWithBackgroundRefresh<ExerciseLevelsResponse>(
                cacheKey,
                () => apiClient.getExerciseLevels(exerciseKey),
                TTL,
                true, // persistent - сохранять в localStorage
                STALE_TIME
            );

            if (payload && Array.isArray(payload.items)) {
                return payload;
            }

            const fallback = await apiClient.getExerciseLevels(exerciseKey);
            if (fallback && Array.isArray(fallback.items)) {
                apiCache.set(cacheKey, fallback, TTL, true, STALE_TIME);
                return fallback;
            }

            return { exercise_key: exerciseKey, items: [] };
        } catch (err: any) {
            apiCache.delete(cacheKey);
            throw err;
        }
    },

    getProgramExercises: async (programId?: string, disciplineId?: string) => {
        const cacheKey = `programExercises_${programId || 'none'}_${disciplineId || 'none'} `;
        const TTL = 24 * 60 * 60 * 1000; // 24 часа
        const STALE_TIME = 48 * 60 * 60 * 1000; // 48 часов (можно показывать старые данные)

        // Используем фоновое обновление: возвращаем данные из кеша сразу, обновляем в фоне если нужно
        return apiCache.getWithBackgroundRefresh<ProgramExercise[]>(
            cacheKey,
            () => apiClient.getProgramExercises(programId, disciplineId),
            TTL,
            true, // persistent - сохраняем в localStorage
            STALE_TIME
        );
    },

    // Training Programs - приоритетная быстрая загрузка для направлений
    getTrainingDisciplines: async () => {
        const cacheKey = 'trainingDisciplines';
        const TTL = 24 * 60 * 60 * 1000; // 24 часа
        const STALE_TIME = 48 * 60 * 60 * 1000; // 48 часов

        // Используем тот же подход что и для программ: всегда используем getWithBackgroundRefresh
        // Это гарантирует что если есть кеш - данные появятся мгновенно, если нет - загрузятся
        return apiCache.getWithBackgroundRefresh<TrainingDirection[]>(
            cacheKey,
            () => apiClient.getTrainingDisciplines(),
            TTL,
            true, // persistent - сохраняем в localStorage
            STALE_TIME
        );
    },

    getTrainingPrograms: async (disciplineId?: string) => {
        const cacheKey = `trainingPrograms_${disciplineId || 'all'} `;
        const TTL = 24 * 60 * 60 * 1000; // 24 часа
        const STALE_TIME = 48 * 60 * 60 * 1000; // 48 часов

        // Используем фоновое обновление: возвращаем данные из кеша сразу, обновляем в фоне если нужно
        return apiCache.getWithBackgroundRefresh<TrainingProgram[]>(
            cacheKey,
            () => apiClient.getTrainingPrograms(disciplineId),
            TTL,
            true, // persistent - сохраняем в localStorage
            STALE_TIME
        );
    },

    // User Training Programs
    getUserProgram: async () => {
        const cacheKey = 'userProgram';
        const TTL = 5 * 60 * 1000; // 5 минут - считается "свежим"
        const STALE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 дней - можно использовать старые данные

        // Используем фоновое обновление: возвращаем данные из кеша МГНОВЕННО, обновляем в фоне
        return apiCache.getWithBackgroundRefresh<UserProgramSnapshot>(
            cacheKey,
            () => apiClient.getUserProgram(),
            TTL,
            true, // persistent - сохраняем в localStorage
            STALE_TIME
        );
    },
    saveUserProgram: async (payload: UserProgramRequest) => {
        const data = await apiClient.saveUserProgram(payload);
        // Очищаем кэш программы пользователя после сохранения
        apiCache.delete('userProgram');
        return data;
    },
    createUserProgram: async (payload: UserProgramRequest) => {
        const data = await apiClient.createUserProgram(payload);
        // Очищаем кэш программы пользователя после создания
        apiCache.delete('userProgram');
        return data;
    },
    updateUserProgram: async (payload: UserProgramUpdateRequest) => {
        const data = await apiClient.updateUserProgram(payload);
        // Очищаем кэш программы пользователя после обновления
        apiCache.delete('userProgram');
        return data;
    },

    // Daily Advice
    getDailyAdvice: async (date?: string) => {
        const cacheKey = `dailyAdvice_${date || 'today'} `;
        const cached = apiCache.get<DailyAdvice>(cacheKey);
        if (cached) return cached;

        try {
            const data = await apiClient.getDailyAdvice(date);
            apiCache.set<DailyAdvice>(cacheKey, data, 30 * 60 * 1000); // 30 минут
            return data;
        } catch (err: any) {
            console.error('[cachedApi] Failed to load daily advice', err);
            apiCache.delete(cacheKey);
            throw err;
        }
    },

    // Assistant
    assistantReply: async (payload: { message: string; mode?: 'chat' | 'command'; persist?: boolean }) => {
        // Ответ ассистента не кэшируем (stateful)
        return apiClient.assistantReply(payload);
    },
    getAssistantSessionState: async () => {
        const data = await apiCache.getWithBackgroundRefresh<{ state: AssistantSessionState; updatedAt: string | null; expiresAt: string | null }>(
            ASSISTANT_SESSION_CACHE_KEY,
            fetchAssistantSessionState,
            60 * 1000,
        );

        return data;
    },
    refreshAssistantSessionState: async () => {
        apiCache.delete(ASSISTANT_SESSION_CACHE_KEY);
        return apiCache.getWithBackgroundRefresh<{ state: AssistantSessionState; updatedAt: string | null; expiresAt: string | null }>(
            ASSISTANT_SESSION_CACHE_KEY,
            fetchAssistantSessionState,
            60 * 1000,
        );
    },
    getAssistantNotes: async (params: { page?: number; pageSize?: number } = {}) => {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const cacheKey = `assistantNotes_${page}_${pageSize} `;
        const cached = apiCache.get<AssistantNotesResponse>(cacheKey);
        if (cached) return cached;
        const data = await apiClient.getAssistantNotes({ page, pageSize });
        apiCache.set(cacheKey, data, 2 * 60 * 1000);
        return data;
    },
    createAssistantNote: async (payload: { title?: string; content: string; tags?: string[] }) => {
        const data = await apiClient.createAssistantNote(payload);
        apiCache.clear();
        return data as any;
    },

    // Очистить весь кэш
    clearCache: () => {
        apiCache.clear();
    },
    getAnalyticsVisualization: (type, filters) => apiClient.getAnalyticsVisualization(type, filters),

    invalidateCache: (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => {
            apiCache.delete(key);
        });
    },
} as CachedApiClient;
