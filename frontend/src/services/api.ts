import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { env } from '@/config/env';
import {
    ProfileSummary,
    TrainingSession,
    SessionTodayResponse,
    SessionWeekResponse,
    ExerciseCatalogItem,
    ExerciseHistoryItem,
    ExerciseLevel,
    ExerciseLevelsResponse,
    TrainingDiscipline,
    TrainingProgram,
    ProgramExercise,
    AchievementResponse,
    DailyAdvice,
    AuthResponse,
    PinVerificationResponse,
    ReportData,
    TelegramUser,
    AssistantSessionState,
    AssistantReplyResponse,
    AssistantLatencyAlert,
    AssistantNotesResponse,
    CreateAssistantNoteResponse,
    CreateSessionPayload,
    UpdateSessionPayload,
    UserProgramSnapshot,
    UserProgramRequest,
    UserProgramUpdateRequest,
    ThemePalette,
    ThemePaletteResponse,
    VisualizationType,
    AnalyticsFilters,
    VisualizationResponse,
} from '@/types';
import ErrorHandler from './errorHandler';
import { enqueueOfflineRequest, initOfflineSync, isOfflineError, markOfflineQueuedError } from './offlineSync';
import { buildRequestDedupKey, createRequestDeduplicator } from './requestDeduplicator';
import { beginProgress } from './progressTracker';

function normalizeApiBaseURL(): string {
    const raw = env.VITE_API_BASE_URL;
    if (!raw || raw === '/') return '/api';
    // Ensure trailing /api
    const trimmed = raw.replace(/\/$/, '');
    if (trimmed.endsWith('/api')) return trimmed;
    return `${trimmed}/api`;
}

const api: AxiosInstance = axios.create({
    baseURL: normalizeApiBaseURL(),
    headers: {
        'Content-Type': 'application/json',
    },
});

initOfflineSync(api);

const baseAdapter = api.defaults.adapter;
if (typeof baseAdapter === 'function') {
    const originalAdapter = baseAdapter;
    const deduplicator = createRequestDeduplicator();
    api.defaults.adapter = async (config) => {
        const key = buildRequestDedupKey(config);
        if (!key) {
            return originalAdapter(config);
        }
        return deduplicator.run(key, () => originalAdapter(config));
    };
}

// Configure client with Telegram data
let authToken: string | null = null;
let telegramInitData: string | null = null;
let profileIdOverride: string | null = null;
let telegramUserId: number | null = null;

function extractTelegramUser(initData?: string): TelegramUser | null {
    if (!initData) return null;
    try {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) return null;
        const parsed = JSON.parse(userStr);
        if (parsed && typeof parsed === 'object' && 'id' in parsed) {
            return parsed as TelegramUser;
        }
        return null;
    } catch (error) {
        console.warn('Failed to parse Telegram user from initData:', error);
        return null;
    }
}

export async function configureClient({
    telegramUser,
    initData,
    skipAuth = false,
    token,
    profileId,
}: {
    telegramUser?: TelegramUser;
    initData?: string;
    skipAuth?: boolean; // Пропустить запрос к /auth/telegram
    token?: string; // Прямая установка токена (для веб-версии)
    profileId?: string; // Прямая установка profileId (для веб-версии)
} = {}): Promise<{ user?: TelegramUser; token?: string; profileId?: string }> {
    const resolvedUser = telegramUser ?? extractTelegramUser(initData ?? undefined);

    // Если токен передан напрямую (для веб-версии), используем его
    if (token) {
        authToken = token;
        if (profileId) {
            profileIdOverride = profileId;
        }
    }

    if (initData) {
        telegramInitData = initData;
    }

    if (telegramInitData) {
        (api.defaults.headers.common as any)['X-Telegram-Init-Data'] = telegramInitData;
    }

    if (resolvedUser?.id) {
        telegramUserId = resolvedUser.id;
        (api.defaults.headers.common as any)['X-Telegram-Id'] = String(telegramUserId);
    }

    // Аутентификация через initData только если skipAuth = false и токен не передан напрямую
    if (initData && !skipAuth && !token) {
        // Authenticate with Telegram initData
        try {
            const response: AxiosResponse<AuthResponse> = await api.post('/auth/telegram', { initData });
            if (response.data.token) {
                authToken = response.data.token;
                if (response.data.profileId) {
                    profileIdOverride = response.data.profileId;
                }
            }
        } catch (error) {
            // Тихая ошибка - не логируем, т.к. это может быть до верификации PIN
            authToken = null;
            profileIdOverride = null;
        }
    } else if (!initData && !resolvedUser && !token) {
        // No Telegram context provided; clear auth headers to avoid stale state
        authToken = null;
        profileIdOverride = null;
        telegramInitData = null;
        telegramUserId = null;
        delete (api.defaults.headers.common as any)['X-Telegram-Init-Data'];
        delete (api.defaults.headers.common as any)['X-Telegram-Id'];
    }

    return {
        user: resolvedUser ?? undefined,
        token: authToken ?? undefined,
        profileId: profileIdOverride ?? undefined,
    };
}

// Request interceptor - добавление auth headers (дедупликация обрабатывается в cachedApi)
const progressCleanup = new WeakMap<InternalAxiosRequestConfig, () => void>();

// CSRF Token storage
let csrfToken: string | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const stopProgress = beginProgress();
    progressCleanup.set(config, stopProgress);
    // Убеждаемся, что Telegram данные установлены, если доступны
    if (!telegramInitData || !telegramUserId) {
        try {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.initData && !telegramInitData) {
                telegramInitData = tg.initData;
                (api.defaults.headers.common as any)['X-Telegram-Init-Data'] = telegramInitData;
            }
            if (tg?.initDataUnsafe?.user?.id && !telegramUserId) {
                telegramUserId = tg.initDataUnsafe.user.id;
                (api.defaults.headers.common as any)['X-Telegram-Id'] = String(telegramUserId);
            }
        } catch (err) {
            // Silent - Telegram WebApp might not be available
        }
    }

    if (authToken) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (telegramInitData) {
        config.headers = config.headers || {};
        config.headers['X-Telegram-Init-Data'] = telegramInitData;
    }
    if (telegramUserId) {
        config.headers = config.headers || {};
        config.headers['X-Telegram-Id'] = String(telegramUserId);
    }
    if (profileIdOverride) {
        config.headers = config.headers || {};
        config.headers['X-Profile-Id'] = profileIdOverride;
    }

    // Inject CSRF token if available
    if (csrfToken) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
        console.log('[API] Injected CSRF token into request:', config.url);
    } else {
        console.warn('[API] No CSRF token available to inject for:', config.url);
    }

    return config;
});

// Response interceptor - обработка 401 и оффлайн-очереди
api.interceptors.response.use(
    (response: AxiosResponse) => {
        const cleanup = progressCleanup.get(response.config as InternalAxiosRequestConfig);
        cleanup?.();
        if (response.config) {
            progressCleanup.delete(response.config as InternalAxiosRequestConfig);
        }

        // Capture CSRF token from response headers
        const newCsrfToken = response.headers['x-csrf-token'];
        if (newCsrfToken) {
            console.log('[API] Captured new CSRF token from response:', response.config.url);
            csrfToken = newCsrfToken;
        } else if (response.config.url?.includes('/auth/verify-pin')) {
            console.warn('[API] verify-pin response missing x-csrf-token header. Available headers:', Object.keys(response.headers));
        }

        return response;
    },
    (error: AxiosError) => {
        const cleanup = error.config ? progressCleanup.get(error.config) : undefined;
        cleanup?.();
        if (error.config) {
            progressCleanup.delete(error.config as InternalAxiosRequestConfig);
        }

        // Capture CSRF token even from error responses (e.g. 403 might return a new one?)
        if (error.response?.headers['x-csrf-token']) {
            console.log('[API] Captured CSRF token from error response:', error.config?.url);
            csrfToken = error.response.headers['x-csrf-token'];
        }

        const method = (error.config?.method || '').toLowerCase();
        if (method && method !== 'get' && isOfflineError(error)) {
            if (error.config) {
                enqueueOfflineRequest(error.config as InternalAxiosRequestConfig);
            }
            return Promise.reject(markOfflineQueuedError(error));
        }

        if (error.response?.status === 401) {
            authToken = null;
            profileIdOverride = null;
            // Don't clear CSRF token on 401 as it might be needed for re-auth or public endpoints? 
            // Actually, usually 401 means session invalid, so CSRF might be invalid too.
            // But let's keep it simple.
        }
        return Promise.reject(error);
    }
);


interface AchievementQueryParams {
    page?: number;
    pageSize?: number;
    fields?: readonly string[];
}

interface AssistantNotesQueryParams {
    page?: number;
    pageSize?: number;
}

const unwrapApiData = <T>(payload: any): T => {
    if (payload && typeof payload === 'object' && 'data' in payload && (payload as any).data !== undefined) {
        return (payload as any).data as T;
    }
    return payload as T;
};

export interface ApiClient {
    // Auth
    verifyPin: (pin: string) => Promise<PinVerificationResponse>;

    // Profile
    getProfileSummary: () => Promise<ProfileSummary>;
    updatePreferences: (payload: Record<string, any>) => Promise<ProfileSummary>;
    getThemePalette: () => Promise<ThemePaletteResponse>;
    updateThemePalette: (palette: ThemePalette) => Promise<ThemePaletteResponse>;

    // Sessions
    getTodaySession: (date?: string) => Promise<SessionTodayResponse>;
    getWeekPlan: (date?: string) => Promise<SessionWeekResponse>;
    getSession: (id: string) => Promise<TrainingSession>;
    createSession: (payload: CreateSessionPayload) => Promise<TrainingSession>;
    updateSession: (id: string, payload: UpdateSessionPayload) => Promise<TrainingSession>;
    deleteSession: (id: string) => Promise<void>;

    // Reports
    getReport: <TReport extends ReportData = ReportData>(slug: string, params?: Record<string, any>) => Promise<TReport>;

    // Achievements
    getAchievements: (params?: AchievementQueryParams) => Promise<AchievementResponse>;

    // Exercises
    getExerciseCatalog: () => Promise<{ items: ExerciseCatalogItem[] } | ExerciseCatalogItem[]>;
    getExerciseHistory: (exerciseKey: string) => Promise<{ items: ExerciseHistoryItem[] } | ExerciseHistoryItem[]>;
    getExerciseLevels: (exerciseKey: string) => Promise<{ items: ExerciseLevel[] }>;
    getProgramExercises: (programId?: string, disciplineId?: string) => Promise<ProgramExercise[]>;

    // Training Programs
    getTrainingDisciplines: () => Promise<TrainingDiscipline[]>;
    getTrainingPrograms: (disciplineId?: string) => Promise<TrainingProgram[]>;

    // User Training Programs
    getUserProgram: () => Promise<UserProgramSnapshot>;
    saveUserProgram: (payload: UserProgramRequest) => Promise<UserProgramSnapshot>;
    createUserProgram: (payload: UserProgramRequest) => Promise<UserProgramSnapshot>;
    updateUserProgram: (payload: UserProgramUpdateRequest) => Promise<UserProgramSnapshot>;

    // Daily Advice
    getDailyAdvice: (date?: string) => Promise<DailyAdvice>;

    // Assistant
    assistantReply: (payload: { message: string; mode?: 'chat' | 'command'; persist?: boolean }) => Promise<AssistantReplyResponse>;
    getAssistantSessionState: () => Promise<{ state: AssistantSessionState; updatedAt: string | null; expiresAt: string | null }>;
    getAssistantNotes: (params?: AssistantNotesQueryParams) => Promise<AssistantNotesResponse>;
    createAssistantNote: (payload: { title?: string; content: string; tags?: string[] }) => Promise<CreateAssistantNoteResponse>;

    // Analytics
    getAnalyticsVisualization: (type: VisualizationType, filters?: AnalyticsFilters) => Promise<VisualizationResponse>;
}

export const apiClient: ApiClient = {
    // Auth
    verifyPin: async (pin: string) => {
        try {
            console.log('[verifyPin] Starting PIN verification...');
            console.log('[verifyPin] Current state:', {
                telegramUserId,
                telegramInitData: telegramInitData ? 'present' : 'missing',
                authToken: authToken ? 'present' : 'missing'
            });

            // Убеждаемся, что Telegram данные доступны перед отправкой запроса
            let finalTelegramId = telegramUserId;
            let finalInitData = telegramInitData;

            if (!finalTelegramId || !finalInitData) {
                try {
                    const tg = (window as any).Telegram?.WebApp;
                    console.log('[verifyPin] Checking window.Telegram.WebApp:', {
                        exists: !!tg,
                        initData: tg?.initData ? 'present' : 'missing',
                        userId: tg?.initDataUnsafe?.user?.id
                    });

                    if (tg?.initData && !finalInitData) {
                        finalInitData = tg.initData;
                        telegramInitData = tg.initData;
                        console.log('[verifyPin] Set initData from Telegram.WebApp');
                    }
                    if (tg?.initDataUnsafe?.user?.id && !finalTelegramId) {
                        finalTelegramId = tg.initDataUnsafe.user.id;
                        telegramUserId = tg.initDataUnsafe.user.id;
                        // Обновляем заголовки
                        (api.defaults.headers.common as any)['X-Telegram-Id'] = String(finalTelegramId);
                        if (finalInitData) {
                            (api.defaults.headers.common as any)['X-Telegram-Init-Data'] = finalInitData;
                        }
                        console.log('[verifyPin] Set Telegram ID from Telegram.WebApp:', finalTelegramId);
                    }
                } catch (err) {
                    console.warn('Failed to get Telegram data for PIN verification:', err);
                }
            }

            const requestBody: { pin: string; telegram_id?: number; initData?: string } = { pin };
            if (finalTelegramId) {
                requestBody.telegram_id = finalTelegramId;
            }
            if (finalInitData) {
                requestBody.initData = finalInitData;
            }

            console.log('[verifyPin] Sending request:', {
                url: '/auth/verify-pin',
                bodyKeys: Object.keys(requestBody),
                hasTelegramId: !!requestBody.telegram_id,
                hasInitData: !!requestBody.initData
            });

            const response: AxiosResponse<any> = await api.post('/auth/verify-pin', requestBody);
            console.log('[verifyPin] Response received:', response.status, 'Response structure:', {
                hasSuccess: 'success' in (response.data || {}),
                hasData: 'data' in (response.data || {}),
                dataKeys: response.data?.data ? Object.keys(response.data.data) : Object.keys(response.data || {}),
            });
            // Backend wraps response in { success: true, data: {...} }
            const unwrapped = unwrapApiData<PinVerificationResponse>(response.data);
            console.log('[verifyPin] Unwrapped response:', {
                valid: unwrapped.valid,
                hasToken: !!unwrapped.token,
                hasProfileId: !!unwrapped.profileId,
            });
            return unwrapped;
        } catch (error) {
            throw ErrorHandler.handle(error, 'verifyPin');
        }
    },

    // Profile
    getProfileSummary: async () => {
        try {
            const response = await api.get<ProfileSummary>('/profile/summary');
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getProfileSummary');
        }
    },
    updatePreferences: async (payload: Record<string, any>) => {
        try {
            const response = await api.patch<ProfileSummary>('/profile/preferences', payload);
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'updatePreferences');
        }
    },
    getThemePalette: async () => {
        try {
            const response = await api.get<{ data: ThemePaletteResponse }>('/profile/theme');
            return unwrapApiData<ThemePaletteResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getThemePalette');
        }
    },
    updateThemePalette: async (palette: ThemePalette) => {
        try {
            const response = await api.put<{ data: ThemePaletteResponse }>('/profile/theme', { palette });
            return unwrapApiData<ThemePaletteResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'updateThemePalette');
        }
    },

    // Sessions
    getTodaySession: async (date?: string) => {
        try {
            const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
            const response = await api.get<{ data: SessionTodayResponse }>(`/sessions/today${suffix}`);
            return unwrapApiData<SessionTodayResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getTodaySession');
        }
    },
    getWeekPlan: async (date?: string) => {
        try {
            const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
            const response = await api.get<{ data: SessionWeekResponse }>(`/sessions/week${suffix}`);
            return unwrapApiData<SessionWeekResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getWeekPlan');
        }
    },
    getSession: async (id: string) => {
        try {
            const response = await api.get<{ data: TrainingSession }>(`/sessions/${id}`);
            return unwrapApiData<TrainingSession>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getSession');
        }
    },
    createSession: async (payload: CreateSessionPayload) => {
        try {
            console.log('[apiClient.createSession] Requesting:', payload);
            const response = await api.post<{ data: TrainingSession }>('/sessions', payload);
            const unwrapped = unwrapApiData<TrainingSession>(response.data);
            console.log('[apiClient.createSession] Response:', response.status, unwrapped);
            return unwrapped;
        } catch (error) {
            console.error('[apiClient.createSession] Error:', error);
            throw ErrorHandler.handle(error, 'createSession');
        }
    },
    updateSession: async (id: string, payload: UpdateSessionPayload) => {
        try {
            const response = await api.put<{ data: TrainingSession }>(`/sessions/${id}`, payload);
            return unwrapApiData<TrainingSession>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'updateSession');
        }
    },
    deleteSession: async (id: string) => {
        try {
            await api.delete<void>(`/sessions/${id}`);
        } catch (error) {
            throw ErrorHandler.handle(error, 'deleteSession');
        }
    },

    // Reports
    getReport: async <TReport extends ReportData = ReportData>(slug: string, params = {}) => {
        try {
            const search = new URLSearchParams(params as any);
            const suffix = search.toString() ? `?${search.toString()}` : '';
            const response = await api.get<TReport>(`/reports/${slug}${suffix}`);
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getReport');
        }
    },

    // Achievements
    getAchievements: async (params: AchievementQueryParams = {}) => {
        try {
            const search = new URLSearchParams();
            if (typeof params.page === 'number' && params.page > 0) {
                search.append('page', String(params.page));
            }
            if (typeof params.pageSize === 'number' && params.pageSize > 0) {
                search.append('page_size', String(params.pageSize));
            }
            if (Array.isArray(params.fields) && params.fields.length > 0) {
                search.append('fields', params.fields.join(','));
            }
            const suffix = search.toString() ? `?${search.toString()}` : '';
            const response = await api.get<AchievementResponse>(`/achievements${suffix}`);
            return unwrapApiData<AchievementResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getAchievements');
        }
    },

    // Exercises
    getExerciseCatalog: async () => {
        try {
            const response = await api.get<{ items: ExerciseCatalogItem[] } | ExerciseCatalogItem[]>('/exercises/catalog');
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getExerciseCatalog');
        }
    },
    getExerciseHistory: async (exerciseKey: string) => {
        try {
            const response = await api.get<{ items: ExerciseHistoryItem[] } | ExerciseHistoryItem[]>(`/exercises/${exerciseKey}/history`);
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getExerciseHistory');
        }
    },
    getExerciseLevels: async (exerciseKey: string) => {
        try {
            console.log(`[apiClient.getExerciseLevels] Requesting ${exerciseKey}...`);

            const response = await api.get<{ data?: ExerciseLevelsResponse; items?: ExerciseLevel[] }>(
                `/exercises/${exerciseKey}/levels`,
                {
                    params: {
                        page_size: 100,
                    },
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                },
            );

            const unwrapped = unwrapApiData<ExerciseLevelsResponse | { items?: ExerciseLevel[] }>(response.data);
            const items = Array.isArray((unwrapped as ExerciseLevelsResponse).items)
                ? (unwrapped as ExerciseLevelsResponse).items
                : Array.isArray((unwrapped as any)?.data?.items)
                    ? (unwrapped as any).data.items
                    : Array.isArray((unwrapped as any)?.items)
                        ? (unwrapped as any).items
                        : [];

            const payload: ExerciseLevelsResponse = {
                exercise_key: (unwrapped as ExerciseLevelsResponse).exercise_key ?? exerciseKey,
                items,
            };

            console.log(
                `[apiClient.getExerciseLevels] Received ${exerciseKey}: ${payload.items.length} levels, first level has image1: ${!!payload.items?.[0]?.image1}`,
            );

            return payload;
        } catch (error: any) {
            console.error(`[apiClient.getExerciseLevels] Error for ${exerciseKey}:`, error);
            throw ErrorHandler.handle(error, 'getExerciseLevels');
        }
    },
    getProgramExercises: async (programId?: string, disciplineId?: string) => {
        try {
            const params = new URLSearchParams();
            if (programId) {
                params.append('program_id', programId);
            } else if (disciplineId) {
                params.append('discipline_id', disciplineId);
            }
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await api.get<ProgramExercise[] | { data?: ProgramExercise[]; items?: ProgramExercise[] }>(
                `/exercises/list${suffix}`,
            );
            const payload = response.data;
            let result: ProgramExercise[] = [];
            if (Array.isArray(payload)) {
                result = payload;
            } else if (payload && Array.isArray(payload.data)) {
                result = payload.data;
            } else if (payload && Array.isArray(payload.items)) {
                result = payload.items;
            }

            // Debug: log icon presence
            if (result.length > 0) {
                console.log('[getProgramExercises] First exercise icon data:', {
                    id: result[0].id,
                    title: result[0].title,
                    iconUrl: result[0].iconUrl,
                    iconUrlHover: result[0].iconUrlHover,
                    hasIconUrl: !!result[0].iconUrl,
                    allKeys: Object.keys(result[0]),
                });
            }

            return result;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getProgramExercises');
        }
    },

    // Training Programs
    getTrainingDisciplines: async () => {
        try {
            const response = await api.get<TrainingDiscipline[]>('/training-disciplines');
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getTrainingDisciplines');
        }
    },
    getTrainingPrograms: async (disciplineId?: string) => {
        try {
            const suffix = disciplineId ? `?discipline_id=${encodeURIComponent(disciplineId)}` : '';
            console.log('[apiClient.getTrainingPrograms] Requesting:', `/training-programs${suffix}`);
            const response = await api.get<TrainingProgram[]>(`/training-programs${suffix}`);
            console.log('[apiClient.getTrainingPrograms] Response:', response.status, response.data?.length || 0, 'items');
            return response.data;
        } catch (error) {
            console.error('[apiClient.getTrainingPrograms] Error:', error);
            throw ErrorHandler.handle(error, 'getTrainingPrograms');
        }
    },

    // User Training Programs
    getUserProgram: async () => {
        try {
            const response = await api.get<{ data: UserProgramSnapshot }>('/user-programs');
            return unwrapApiData<UserProgramSnapshot>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getUserProgram');
        }
    },
    saveUserProgram: async (payload: UserProgramRequest) => {
        try {
            const response = await api.post<{ data: UserProgramSnapshot }>('/user-programs', payload);
            return unwrapApiData<UserProgramSnapshot>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'saveUserProgram');
        }
    },
    createUserProgram: async (payload: UserProgramRequest) => {
        try {
            const response = await api.post<{ data: UserProgramSnapshot }>('/user-programs/create', payload);
            return unwrapApiData<UserProgramSnapshot>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'createUserProgram');
        }
    },
    updateUserProgram: async (payload: UserProgramUpdateRequest) => {
        try {
            const response = await api.put<{ data: UserProgramSnapshot }>('/user-programs', payload);
            return unwrapApiData<UserProgramSnapshot>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'updateUserProgram');
        }
    },

    // Daily Advice
    getDailyAdvice: async (date?: string) => {
        try {
            const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
            const response = await api.get<DailyAdvice>(`/daily-advice${suffix}`);
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'getDailyAdvice');
        }
    },

    // Assistant
    assistantReply: async (payload: { message: string; mode?: 'chat' | 'command'; persist?: boolean }) => {
        try {
            const response = await api.post('/assistant/reply', payload);
            return response.data;
        } catch (error) {
            throw ErrorHandler.handle(error, 'assistantReply');
        }
    },
    getAssistantSessionState: async () => {
        try {
            const response = await api.get('/assistant/state');
            const raw = (response.data?.state ?? {}) as any;
            const rawLatency = raw.latency_stats && typeof raw.latency_stats === 'object' ? raw.latency_stats : null;
            const latencyStats = rawLatency ? {
                lastMs: typeof rawLatency.last_ms === 'number' ? rawLatency.last_ms : null,
                averageMs: typeof rawLatency.average_ms === 'number' ? rawLatency.average_ms : null,
                samples: typeof rawLatency.samples === 'number' ? rawLatency.samples : 0,
                slowThresholdMs: typeof rawLatency.slow_threshold_ms === 'number' ? rawLatency.slow_threshold_ms : 3500,
                slowTurns: typeof rawLatency.slow_turns === 'number' ? rawLatency.slow_turns : 0,
                slowRatio: typeof rawLatency.slow_ratio === 'number' ? rawLatency.slow_ratio : 0,
                worstMs: typeof rawLatency.worst_ms === 'number' ? rawLatency.worst_ms : null,
                lastUpdatedAt: typeof rawLatency.last_updated_at === 'string' ? rawLatency.last_updated_at : (response.data?.updated_at || null),
            } : null;

            const parseLatencyValue = (value: any): number | null => {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return null;
                }
                return Math.round(value);
            };

            const parseLatencyAlert = (value: any): AssistantLatencyAlert | null => {
                if (!value || typeof value !== 'object') {
                    return null;
                }
                const severity = value.severity === 'error' ? 'error' : value.severity === 'warn' ? 'warn' : null;
                if (!severity) {
                    return null;
                }
                const allowedReasons = new Set<AssistantLatencyAlert['reason']>(['slow_turn', 'slow_ratio', 'average_latency']);
                const reason = allowedReasons.has(value.reason) ? value.reason : 'slow_turn';
                const thresholdMs = typeof value.threshold_ms === 'number' && Number.isFinite(value.threshold_ms)
                    ? Math.max(0, Math.round(value.threshold_ms))
                    : 3500;
                const rawRatio = typeof value.slow_ratio === 'number' && Number.isFinite(value.slow_ratio)
                    ? value.slow_ratio
                    : 0;
                const slowRatio = Math.min(1, Math.max(0, Number(rawRatio.toFixed(2))));
                const samples = typeof value.samples === 'number' && Number.isFinite(value.samples)
                    ? Math.max(0, Math.round(value.samples))
                    : 0;
                const triggeredAt = typeof value.triggered_at === 'string'
                    ? value.triggered_at
                    : (response.data?.updated_at || new Date().toISOString());
                const averageMs = parseLatencyValue(value.average_ms ?? null);
                const latencyMs = parseLatencyValue(value.latency_ms ?? null);
                const fallbackMessage = severity === 'error'
                    ? 'Ассистент отвечает слишком медленно.'
                    : 'Ответ ассистента превысил рабочий порог.';
                const message = typeof value.message === 'string' && value.message.trim().length
                    ? value.message.trim()
                    : fallbackMessage;

                return {
                    severity,
                    reason,
                    message,
                    latencyMs,
                    thresholdMs,
                    slowRatio,
                    averageMs,
                    samples,
                    triggeredAt,
                };
            };

            const buildLatencyAlertHistory = (historyRaw: any, latest: AssistantLatencyAlert | null): AssistantLatencyAlert[] => {
                const entries: AssistantLatencyAlert[] = [];
                if (Array.isArray(historyRaw)) {
                    for (const item of historyRaw) {
                        const parsed = parseLatencyAlert(item);
                        if (parsed) {
                            entries.push(parsed);
                        }
                    }
                }
                if (latest) {
                    entries.unshift(latest);
                }
                const uniqueByTimestamp = new Map<string, AssistantLatencyAlert>();
                for (const entry of entries) {
                    if (!uniqueByTimestamp.has(entry.triggeredAt)) {
                        uniqueByTimestamp.set(entry.triggeredAt, entry);
                    }
                }
                return Array.from(uniqueByTimestamp.values())
                    .sort((a, b) => (a.triggeredAt > b.triggeredAt ? -1 : 1))
                    .slice(0, 10);
            };

            const latencyAlert = parseLatencyAlert(raw.latency_alert);
            const latencyAlertHistory = buildLatencyAlertHistory(raw.latency_alert_history, latencyAlert);

            const normalized: AssistantSessionState = {
                status: (raw.status as AssistantSessionState['status']) || 'idle',
                lastUserMessageAt: raw.last_user_message_at || null,
                lastAssistantMessageAt: raw.last_assistant_message_at || null,
                lastIntent: raw.last_intent || null,
                lastMode: raw.last_mode || null,
                totalUserMessages: Number(raw.total_user_messages) || 0,
                totalAssistantMessages: Number(raw.total_assistant_messages) || 0,
                totalTurns: Number(raw.total_turns) || 0,
                closedAt: raw.closed_at || null,
                closedReason: raw.closed_reason || null,
                closedSummary: (raw.closed_summary as Record<string, any> | null) || null,
                lastUpdatedAt: raw.last_updated_at || response.data?.updated_at || null,
                lastLatencyMs: typeof raw.last_latency_ms === 'number' ? raw.last_latency_ms : null,
                slowResponse: Boolean(raw.slow_response),
                latencyStats,
                latencyAlert,
                latencyAlertHistory,
            };

            return {
                state: normalized,
                updatedAt: response.data?.updated_at || null,
                expiresAt: response.data?.expires_at || null,
            };
        } catch (error) {
            throw ErrorHandler.handle(error, 'getAssistantSessionState');
        }
    },
    getAssistantNotes: async (params: AssistantNotesQueryParams = {}) => {
        try {
            const search = new URLSearchParams();
            if (typeof params.page === 'number' && params.page > 0) {
                search.append('page', String(params.page));
            }
            if (typeof params.pageSize === 'number' && params.pageSize > 0) {
                search.append('page_size', String(params.pageSize));
            }
            const suffix = search.toString() ? `?${search.toString()}` : '';
            const response = await api.get<AssistantNotesResponse>(`/assistant/notes${suffix}`);
            return unwrapApiData<AssistantNotesResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getAssistantNotes');
        }
    },
    createAssistantNote: async (payload: { title?: string; content: string; tags?: string[] }) => {
        try {
            const response = await api.post<{ data: CreateAssistantNoteResponse }>('/assistant/notes', payload);
            return unwrapApiData<CreateAssistantNoteResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'createAssistantNote');
        }
    },

    // Analytics
    getAnalyticsVisualization: async (type: VisualizationType, filters: AnalyticsFilters = {}) => {
        try {
            const response = await api.post<VisualizationResponse>(`/analytics/visualizations/${type}`, filters);
            return unwrapApiData<VisualizationResponse>(response.data);
        } catch (error) {
            throw ErrorHandler.handle(error, 'getAnalyticsVisualization');
        }
    },
};

export default api;
