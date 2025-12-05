import type { AppError } from '../services/errors.js';
import type { ZodTypeAny } from 'zod';
import type { ErrorCode } from './errors.js';

export type RequestValidationPart = 'body' | 'query' | 'params' | 'headers';

export type RequestValidationSchemas = Partial<Record<RequestValidationPart, ZodTypeAny>>;

export type ValidationMessageOverrides = Partial<
    Record<RequestValidationPart, { error?: ErrorCode; message?: string }>
>;

export interface RequestValidationOptions {
    messages?: ValidationMessageOverrides;
}

export interface RequestValidationPayloads {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: unknown;
}

export type RequestValidationSuccess = {
    success: true;
    data: RequestValidationPayloads;
};

export type RequestValidationFailure = {
    success: false;
    error: AppError;
    details: {
        part: RequestValidationPart;
        issues: unknown;
    };
};

export type RequestValidationResult = RequestValidationSuccess | RequestValidationFailure;
