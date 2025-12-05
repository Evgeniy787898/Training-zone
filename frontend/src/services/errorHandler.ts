import { useAppStore } from '@/stores/app';

export type AppErrorOptions = {
    code?: string;
    details?: Record<string, any>;
    traceId?: string;
    classification?: string;
};

export class AppError extends Error {
    public code?: string;

    public details?: Record<string, any>;

    public traceId?: string;

    public classification?: string;

    constructor(message: string, options: AppErrorOptions = {}) {
        super(message);
        this.name = 'AppError';
        this.code = options.code;
        this.details = options.details;
        this.traceId = options.traceId;
        this.classification = options.classification;
    }
}

export class NetworkError extends AppError {
    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { ...options, code: 'NETWORK_ERROR' });
        this.name = 'NetworkError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { ...options, code: 'VALIDATION_ERROR' });
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { ...options, code: 'AUTHENTICATION_ERROR' });
        this.name = 'AuthenticationError';
    }
}

export class NotFoundError extends AppError {
    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { ...options, code: 'NOT_FOUND_ERROR' });
        this.name = 'NotFoundError';
    }
}

export class ServerError extends AppError {
    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { ...options, code: 'SERVER_ERROR' });
        this.name = 'ServerError';
    }
}

type ApiErrorPayload = {
    message?: string;
    error?: string;
    classification?: string;
    category?: string;
    traceId?: string;
    resource?: string;
};

type ApiErrorResponse = {
    success: false;
    error: ApiErrorPayload;
    meta?: { traceId?: string; resource?: string };
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
    if (!value || typeof value !== 'object') return false;
    const data = value as Record<string, unknown>;
    return data.success === false && typeof data.error === 'object' && data.error !== null;
};

const CLASSIFICATION_HINTS: Record<string, string> = {
    validation: 'Проверьте введённые данные и попробуйте ещё раз.',
    auth: 'Сессия истекла или требуется авторизация. Войдите и повторите действие.',
    database: 'Данные временно недоступны. Повторите попытку позже.',
    business: 'Запрос не может быть выполнен в текущем состоянии. Обновите экран или попробуйте другое действие.',
    internal: 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.',
};

const resolveUserMessage = (messageFromServer: string | undefined, classification?: string, status?: number): string => {
    const normalized = messageFromServer?.trim();
    if (normalized) {
        return normalized;
    }

    if (classification && CLASSIFICATION_HINTS[classification]) {
        return CLASSIFICATION_HINTS[classification];
    }

    if (status === 401 || status === 403) {
        return CLASSIFICATION_HINTS.auth;
    }

    if (status === 400) {
        return CLASSIFICATION_HINTS.validation;
    }

    if (status && status >= 500) {
        return CLASSIFICATION_HINTS.database;
    }

    return CLASSIFICATION_HINTS.internal;
};

export class ErrorHandler {
    static handle(error: unknown, context?: string): AppError {
        // Не логируем ошибки 500 для некоторых контекстов (они обрабатываются тихо)
        const silentContexts = ['getExerciseLevels', 'getDailyAdvice'];
        const shouldLog = !silentContexts.includes(context || '');

        if ((error as any)?.__offlineQueued) {
            return new NetworkError('Запрос сохранён и будет отправлен при восстановлении соединения.', {
                details: { context },
            });
        }

        if (shouldLog) {
            console.error(`Error in ${context || 'application'}:`, error);
        }

        // If it's already an AppError, return it
        if (error instanceof AppError) {
            return error;
        }

        // Handle different types of errors
        if (error instanceof Error) {
            // Network errors
            if (
                error.message.includes('Network Error') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('ECONNREFUSED')
            ) {
                return new NetworkError('Ошибка сети. Проверьте подключение к интернету.', {
                    details: { originalError: error.message, context },
                });
            }

            // Handle axios errors
            if ((error as any).isAxiosError) {
                const axiosError = error as any;
                const status = axiosError.response?.status;

                const responseData = axiosError.response?.data;
                const apiError = isApiErrorResponse(responseData) ? responseData.error : undefined;
                const traceId = apiError?.traceId ?? (responseData?.meta?.traceId ?? undefined);
                const classification = apiError?.classification;
                const messageFromServer = apiError?.message ?? (typeof responseData?.message === 'string' ? responseData.message : undefined);
                const userMessage = resolveUserMessage(messageFromServer, classification, status);
                const sharedOptions: AppErrorOptions = {
                    details: {
                        originalError: error.message,
                        context,
                        response: axiosError.response?.data,
                    },
                    traceId,
                    classification,
                };

                switch (status) {
                    case 400:
                        return new ValidationError(userMessage, sharedOptions);
                    case 401:
                    case 403:
                        return new AuthenticationError(
                            resolveUserMessage(messageFromServer, classification ?? 'auth', status),
                            { ...sharedOptions, classification: classification ?? 'auth' },
                        );
                    case 404:
                        return new NotFoundError(
                            resolveUserMessage(messageFromServer, classification ?? 'business', status),
                            { ...sharedOptions, classification: classification ?? 'business' },
                        );
                    case 500:
                    case 502:
                    case 503:
                    case 504:
                        // Для ошибок 500 не логируем в консоль, если это тихий контекст
                        const silentContexts = ['getExerciseLevels', 'getDailyAdvice'];
                        if (!silentContexts.includes(context || '')) {
                            console.error(`Server error in ${context || 'application'}:`, error);
                        }
                        return new ServerError(
                            resolveUserMessage(messageFromServer, classification ?? 'database', status),
                            { ...sharedOptions, classification: classification ?? 'database' },
                        );
                    default:
                        return new ServerError(resolveUserMessage(messageFromServer, classification, status), sharedOptions);
                }
            }

            // Generic error
            return new AppError(error.message, {
                code: 'UNKNOWN_ERROR',
                details: { originalError: error.message, context },
            });
        }

        // Handle non-Error objects
        return new AppError(typeof error === 'string' ? error : 'Произошла неизвестная ошибка.', {
            code: 'UNKNOWN_ERROR',
            details: { originalError: error, context },
        });
    }

    static showToast(error: AppError): void {
        const appStore = useAppStore();

        let title = 'Ошибка';
        let type: 'error' | 'warning' | 'info' = 'error';

        switch (error.constructor) {
            case NetworkError:
                title = 'Ошибка сети';
                break;
            case ValidationError:
                title = 'Ошибка валидации';
                type = 'warning';
                break;
            case AuthenticationError:
                title = 'Ошибка авторизации';
                break;
            case NotFoundError:
                title = 'Не найдено';
                type = 'info';
                break;
            case ServerError:
                title = 'Ошибка сервера';
                break;
            default:
                title = 'Ошибка';
        }

        appStore.showToast({
            title,
            message: error.message,
            type,
            traceId: error.traceId ?? (typeof error.details?.traceId === 'string' ? error.details.traceId : undefined),
        });
    }

    static async handleWithToast(error: unknown, context?: string): Promise<AppError> {
        const appError = this.handle(error, context);
        this.showToast(appError);
        return appError;
    }
}

export default ErrorHandler;