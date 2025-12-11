/**
 * API Response Utilities - Standardized JSON response format
 * Implements BE-003: Стандартизация JSON-ответов
 *
 * Standard format: { success, data, error, meta }
 */
import { Response } from 'express';

// ============================================
// TYPES
// ============================================

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    meta?: ResponseMeta;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: ResponseMeta;
}

export interface ResponseMeta {
    timestamp?: string;
    requestId?: string;
    pagination?: PaginationMeta;
    processingTimeMs?: number;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// ERROR CODES
// ============================================

export const ErrorCodes = {
    // Client errors (4xx)
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    CONFLICT: 'CONFLICT',

    // Server errors (5xx)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================
// RESPONSE BUILDERS
// ============================================

/**
 * Create a success response
 */
export function successResponse<T>(
    data: T,
    meta?: ResponseMeta
): ApiSuccessResponse<T> {
    return {
        success: true,
        data,
        ...(meta && { meta: { ...meta, timestamp: new Date().toISOString() } }),
    };
}

/**
 * Create an error response
 */
export function errorResponse(
    code: ErrorCode,
    message: string,
    details?: unknown,
    meta?: ResponseMeta
): ApiErrorResponse {
    return {
        success: false,
        error: {
            code,
            message,
            ...(details !== undefined && { details }),
        },
        ...(meta && { meta: { ...meta, timestamp: new Date().toISOString() } }),
    };
}

/**
 * Create pagination meta
 */
export function paginationMeta(
    page: number,
    limit: number,
    total: number
): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

// ============================================
// EXPRESS RESPONSE HELPERS
// ============================================

/**
 * Send success response
 */
export function sendSuccess<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    meta?: ResponseMeta
): Response {
    return res.status(statusCode).json(successResponse(data, meta));
}

/**
 * Send created response (201)
 */
export function sendCreated<T>(
    res: Response,
    data: T,
    meta?: ResponseMeta
): Response {
    return sendSuccess(res, data, 201, meta);
}

/**
 * Send no content response (204)
 */
export function sendNoContent(res: Response): Response {
    return res.status(204).send();
}

/**
 * Send error response
 */
export function sendError(
    res: Response,
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
    meta?: ResponseMeta
): Response {
    return res.status(statusCode).json(errorResponse(code, message, details, meta));
}

/**
 * Send bad request error (400)
 */
export function sendBadRequest(
    res: Response,
    message: string = 'Invalid request',
    details?: unknown
): Response {
    return sendError(res, 400, ErrorCodes.BAD_REQUEST, message, details);
}

/**
 * Send validation error (400)
 */
export function sendValidationError(
    res: Response,
    message: string = 'Validation failed',
    details?: unknown
): Response {
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, message, details);
}

/**
 * Send unauthorized error (401)
 */
export function sendUnauthorized(
    res: Response,
    message: string = 'Authentication required'
): Response {
    return sendError(res, 401, ErrorCodes.UNAUTHORIZED, message);
}

/**
 * Send forbidden error (403)
 */
export function sendForbidden(
    res: Response,
    message: string = 'Access denied'
): Response {
    return sendError(res, 403, ErrorCodes.FORBIDDEN, message);
}

/**
 * Send not found error (404)
 */
export function sendNotFound(
    res: Response,
    message: string = 'Resource not found'
): Response {
    return sendError(res, 404, ErrorCodes.NOT_FOUND, message);
}

/**
 * Send rate limit error (429)
 */
export function sendRateLimited(
    res: Response,
    message: string = 'Too many requests',
    retryAfterSeconds?: number
): Response {
    if (retryAfterSeconds) {
        res.setHeader('Retry-After', retryAfterSeconds.toString());
    }
    return sendError(res, 429, ErrorCodes.RATE_LIMITED, message);
}

/**
 * Send internal error (500)
 */
export function sendInternalError(
    res: Response,
    message: string = 'Internal server error',
    details?: unknown
): Response {
    return sendError(res, 500, ErrorCodes.INTERNAL_ERROR, message, details);
}

/**
 * Send service unavailable error (503)
 */
export function sendServiceUnavailable(
    res: Response,
    message: string = 'Service temporarily unavailable'
): Response {
    return sendError(res, 503, ErrorCodes.SERVICE_UNAVAILABLE, message);
}

export default {
    successResponse,
    errorResponse,
    paginationMeta,
    sendSuccess,
    sendCreated,
    sendNoContent,
    sendError,
    sendBadRequest,
    sendValidationError,
    sendUnauthorized,
    sendForbidden,
    sendNotFound,
    sendRateLimited,
    sendInternalError,
    sendServiceUnavailable,
    ErrorCodes,
};
