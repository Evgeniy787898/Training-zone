import type { RequestHandler } from 'express';
import { AppError } from '../services/errors.js';

export interface RequestTimeoutConfig {
  softTimeoutMs: number;
  hardTimeoutMs: number;
  headerName?: string;
}

const MIN_HARD_TIMEOUT_MS = 500;

const clampTimeout = (value: number, fallback: number, min = MIN_HARD_TIMEOUT_MS) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
};

const normalizeHeaderName = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const createRequestTimeoutMiddleware = (config: RequestTimeoutConfig): RequestHandler => {
  const hardLimitMs = clampTimeout(config.hardTimeoutMs, MIN_HARD_TIMEOUT_MS);
  const softLimitMs = Math.max(0, Math.floor(config.softTimeoutMs || 0));
  const headerName = normalizeHeaderName(config.headerName) ?? 'x-request-timeout-ms';

  return (req, res, next) => {
    const controller = new AbortController();
    req.timeoutSignal = controller.signal;
    req.hasTimedOut = false;
    res.setHeader(headerName, String(hardLimitMs));

    let completed = false;
    const startedAt = Date.now();

    const cleanup = () => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(hardTimer);
      if (softTimer) {
        clearTimeout(softTimer);
      }
      req.off('aborted', cleanup);
      res.off('close', cleanup);
      res.off('finish', cleanup);
    };

    const handleTimeout = () => {
      if (completed) {
        return;
      }
      req.hasTimedOut = true;
      controller.abort();
      const elapsed = Date.now() - startedAt;
      const error = new AppError({
        message: 'Request processing time exceeded the allowed limit',
        code: 'request_timeout',
        statusCode: 504,
        category: 'dependencies',
        details: { limitMs: hardLimitMs, elapsedMs: elapsed },
        userMessage: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
      });

      cleanup();

      if (!res.headersSent) {
        res.setHeader('connection', 'close');
        return next(error);
      }
    };

    const hardTimer = setTimeout(handleTimeout, hardLimitMs);

    const softTimer = softLimitMs
      ? setTimeout(() => {
          if (!completed && !res.headersSent) {
            res.setHeader('x-request-timeout-warning', String(hardLimitMs - softLimitMs));
          }
        }, softLimitMs)
      : null;

    req.once('aborted', cleanup);
    res.once('close', cleanup);
    res.once('finish', cleanup);

    return next();
  };
};
