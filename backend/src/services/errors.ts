import type {
  AppErrorInit,
  ErrorCategory,
  ErrorClassification,
  ErrorCode,
  ErrorResponseContext,
  FormattedErrorResponse,
  NormalizedErrorOptions,
} from '../types/errors.js';
import { getTraceId } from './trace.js';

const CATEGORY_CLASSIFICATION_MAP: Record<ErrorCategory, ErrorClassification> = {
  validation: 'validation',
  authentication: 'auth',
  authorization: 'auth',
  not_found: 'business',
  conflict: 'business',
  rate_limit: 'business',
  dependencies: 'database',
  database: 'database',
  internal: 'internal',
};

const resolveClassification = (
  category: ErrorCategory,
  explicit?: ErrorClassification,
): ErrorClassification => explicit ?? CATEGORY_CLASSIFICATION_MAP[category] ?? 'internal';

const INTERNAL_ERROR_MESSAGE = 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.';
const DEPENDENCY_ERROR_MESSAGE = 'Сервис временно недоступен. Пожалуйста, попробуйте позже.';
const DATABASE_ERROR_MESSAGE = 'Данные временно недоступны. Пожалуйста, повторите попытку позже.';

const resolveUserFacingMessage = (error: AppError): string => {
  if (error.userMessage) {
    return error.userMessage;
  }

  if (error.category === 'dependencies') {
    return DEPENDENCY_ERROR_MESSAGE;
  }

  if (error.category === 'database') {
    return DATABASE_ERROR_MESSAGE;
  }

  if (error.category === 'internal' || error.statusCode >= 500) {
    return INTERNAL_ERROR_MESSAGE;
  }

  return error.message;
};

export class AppError extends Error {
  public readonly statusCode: number;

  public readonly code: ErrorCode;

  public readonly category: ErrorCategory;

  public readonly classification: ErrorClassification;

  public readonly userMessage?: string;

  public readonly details?: unknown;

  public readonly exposeDetails: boolean;

  public readonly cause?: unknown;

  constructor(init: AppErrorInit) {
    super(init.message);
    this.name = 'AppError';
    this.statusCode = init.statusCode ?? 500;
    this.code = init.code;
    this.category = init.category ?? 'internal';
    this.classification = resolveClassification(this.category, init.classification);
    this.userMessage = init.userMessage;
    this.details = init.details;
    this.exposeDetails = init.exposeDetails ?? false;
    this.cause = init.cause;
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;

export const normalizeToAppError = (
  error: unknown,
  fallback?: NormalizedErrorOptions,
): AppError => {
  if (isAppError(error)) {
    return error;
  }

  const message = fallback?.message ?? 'Внутренняя ошибка сервера';
  const code = fallback?.code ?? 'internal_error';

  return new AppError({
    message,
    code,
    statusCode: fallback?.statusCode ?? 500,
    category: fallback?.category ?? 'internal',
    classification: fallback?.classification,
    userMessage: fallback?.userMessage,
    details: fallback?.details,
    exposeDetails: fallback?.exposeDetails ?? false,
    cause: error instanceof Error ? error : undefined,
  });
};

export const formatErrorResponse = (
  error: AppError,
  context?: ErrorResponseContext,
): FormattedErrorResponse => {
  const payload: FormattedErrorResponse = {
    error: error.code,
    message: resolveUserFacingMessage(error),
    classification: error.classification,
  };

  if (error.category !== 'internal') {
    payload.category = error.category;
  }

  const traceId = context?.traceId ?? getTraceId();
  if (traceId) {
    payload.traceId = traceId;
  }

  if (context?.resource) {
    payload.resource = context.resource;
  }

  if (error.exposeDetails && error.details !== undefined) {
    payload.details = error.details;
  }

  return payload;
};
