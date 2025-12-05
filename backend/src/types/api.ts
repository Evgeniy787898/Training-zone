import type { ErrorResponseContext, FormattedErrorResponse } from './errors.js';

export interface ApiResponseMeta extends ErrorResponseContext {
    timestamp?: string;
    [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: ApiResponseMeta;
}

export interface ApiErrorResponse {
    success: false;
    error: FormattedErrorResponse;
    meta?: ApiResponseMeta;
}

export interface SuccessResponseOptions {
    statusCode?: number;
    meta?: ApiResponseMeta;
}

export type ServiceErrorContext = ErrorResponseContext & {
    details?: unknown;
};
