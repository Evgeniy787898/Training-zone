export type ErrorCategory =
    | 'validation'
    | 'authentication'
    | 'authorization'
    | 'not_found'
    | 'conflict'
    | 'rate_limit'
    | 'dependencies'
    | 'database'
    | 'internal';

export type ErrorClassification = 'validation' | 'database' | 'auth' | 'business' | 'internal';

export const ERROR_CODES = {
    AUTH_REQUIRED: 'auth_required',
    DATABASE_ERROR: 'database_error',
    DATABASE_UNAVAILABLE: 'database_unavailable',
    DEPENDENCY_TIMEOUT: 'dependency_timeout',
    CIRCUIT_OPEN: 'circuit_open',
    CIRCUIT_HALF_OPEN: 'circuit_half_open',
    FORBIDDEN: 'forbidden',
    INCOMPLETE_DATA: 'incomplete_data',
    INTERNAL_ERROR: 'internal_error',
    INVALID_DATE: 'invalid_date',
    INVALID_PAYLOAD: 'invalid_payload',
    INVALID_REQUEST: 'invalid_request',
    INVALID_SIGNATURE: 'invalid_signature',
    MEDIA_NOT_FOUND: 'media_not_found',
    NOT_FOUND: 'not_found',
    PAYLOAD_TOO_LARGE: 'payload_too_large',
    PIN_LOCKED: 'pin_locked',
    INVALID_PIN: 'invalid_pin',
    PROFILE_NOT_FOUND: 'profile_not_found',
    REPORT_NOT_AVAILABLE: 'report_not_available',
    REQUEST_TIMEOUT: 'request_timeout',
    SERVICE_UNAVAILABLE: 'service_unavailable',
    SESSION_NOT_FOUND: 'session_not_found',
    USER_PROGRAMS_UNAVAILABLE: 'user_programs_unavailable',
    VALIDATION_ERROR: 'validation_error',
    VALIDATION_FAILED: 'validation_failed',
    XSS_DETECTED: 'xss_detected',
    MICROSERVICE_UNAVAILABLE: 'microservice_unavailable',
    MICROSERVICE_ERROR: 'microservice_error',
    MICROSERVICE_EMPTY_RESPONSE: 'microservice_empty_response',
    MICROSERVICE_TIMEOUT: 'microservice_timeout',
    MICROSERVICE_NETWORK_ERROR: 'microservice_network_error',
    STORAGE_UPLOAD_FAILED: 'storage_upload_failed',
    INVALID_TOKEN: 'invalid_token',
    TOKEN_REVOKED: 'token_revoked',
    TOKEN_EXPIRED: 'token_expired',
    FAVORITES_ERROR: 'favorites_error',
    UNAUTHORIZED: 'unauthorized',
    INVALID_PAGINATION: 'invalid_pagination',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface AppErrorInit {
    message: string;
    code: ErrorCode;
    statusCode?: number;
    category?: ErrorCategory;
    classification?: ErrorClassification;
    userMessage?: string;
    details?: unknown;
    exposeDetails?: boolean;
    cause?: unknown;
}

export interface NormalizedErrorOptions extends Partial<AppErrorInit> {
    message?: string;
}

export interface ErrorResponseContext {
    traceId?: string;
    resource?: string;
}

export interface FormattedErrorResponse {
    error: ErrorCode;
    message: string;
    category?: ErrorCategory;
    classification: ErrorClassification;
    traceId?: string;
    resource?: string;
    details?: unknown;
}
