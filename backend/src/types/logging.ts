export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BaseLogContext {
    traceId?: string;
    resource?: string;
    profileId?: string;
    userId?: string | number;
    telegramId?: string;
    metadata?: Record<string, unknown>;
}

export interface RequestLogContext extends BaseLogContext {
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
}

export interface ErrorLogContext extends RequestLogContext {
    statusCode?: number;
    code?: string;
    category?: string;
    classification?: string;
    message?: string;
    details?: unknown;
}

export interface StructuredLogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    traceId?: string;
    resource?: string;
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
    profileId?: string;
    userId?: string | number;
    telegramId?: string;
    metadata?: Record<string, unknown>;
    details?: unknown;
}
