import type { Response } from 'express';
import {
    AppError,
    formatErrorResponse,
} from '../services/errors.js';
import type {
    ApiErrorResponse,
    ApiResponseMeta,
    ApiSuccessResponse,
    ServiceErrorContext,
    SuccessResponseOptions,
} from '../types/api.js';
import { getTraceId } from '../services/trace.js';
import { removeNullFields } from './responsePayload.js';

export const respondWithSuccess = <T>(
    res: Response,
    data: T,
    options?: SuccessResponseOptions,
): Response<ApiSuccessResponse<T>> => {
    const payload: ApiSuccessResponse<T> = {
        success: true,
        data,
    };

    if (options?.meta) {
        payload.meta = options.meta;
    }

    return res
        .status(options?.statusCode ?? 200)
        .json(removeNullFields(payload));
};

export const respondWithAppError = (
    res: Response,
    error: AppError,
    context?: ServiceErrorContext,
): Response<ApiErrorResponse> => {
    const traceId = context?.traceId ?? getTraceId() ?? undefined;
    const payload = formatErrorResponse(error, { ...context, traceId });

    if (context?.details !== undefined && payload.details === undefined) {
        payload.details = context.details;
    }

    const meta: ApiResponseMeta | undefined =
        traceId || context?.resource
            ? {
                  traceId: traceId ?? undefined,
                  resource: context?.resource,
              }
            : undefined;

    return res.status(error.statusCode).json(
        removeNullFields({
            success: false,
            error: payload,
            ...(meta ? { meta } : {}),
        }),
    );
};

export const respondWithServiceUnavailable = (
    res: Response,
    message: string,
    context?: ServiceErrorContext,
): Response<ApiErrorResponse> => {
    const error = new AppError({
        message,
        code: 'service_unavailable',
        statusCode: 503,
        category: 'dependencies',
        details: context?.details,
        exposeDetails: context?.details !== undefined,
    });

    return respondWithAppError(res, error, context);
};

export const respondWithDatabaseUnavailable = (
    res: Response,
    resource: string,
    context?: ServiceErrorContext,
): Response<ApiErrorResponse> => {
    const message = 'Данные временно недоступны. Пожалуйста, попробуйте позже.';

    return respondWithServiceUnavailable(res, message, {
        ...context,
        resource,
    });
};
