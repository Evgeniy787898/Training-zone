import type { Request, RequestHandler } from 'express';
import {
  getDatabaseAvailabilitySnapshot,
  isDatabaseTemporarilyUnavailable,
} from '../modules/database/databaseAvailability.js';
import { respondWithDatabaseUnavailable } from '../utils/apiResponses.js';
import { ensureTraceId } from '../services/trace.js';

interface DatabaseAvailabilityMiddlewareOptions {
  bypassPaths?: string[];
}

const normalizeResource = (req: Request) => {
  if (req.baseUrl) {
    return req.baseUrl.replace(/^\/+/, '').replace(/^api\//, '') || 'http_request';
  }
  if (req.path.startsWith('/api/')) {
    return req.path.replace(/^\/api\//, '') || 'http_request';
  }
  return req.path.replace(/^\/+/, '') || 'http_request';
};

export const createDatabaseAvailabilityMiddleware = (
  options?: DatabaseAvailabilityMiddlewareOptions,
): RequestHandler => {
  const bypass = new Set(options?.bypassPaths ?? []);
  return (req, res, next) => {
    if (bypass.has(req.path)) {
      return next();
    }
    if (!isDatabaseTemporarilyUnavailable()) {
      return next();
    }

    const snapshot = getDatabaseAvailabilitySnapshot();
    const retryAfterSeconds = snapshot.retryAfterMs
      ? Math.max(1, Math.ceil(snapshot.retryAfterMs / 1000))
      : undefined;

    if (retryAfterSeconds) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }

    const traceId = ensureTraceId(req.traceId);
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    const resource = normalizeResource(req);
    const details = snapshot.lastError
      ? {
        code: snapshot.lastError.code,
        message: snapshot.lastError.message,
      }
      : undefined;

    return respondWithDatabaseUnavailable(res, resource, { traceId, details });
  };
};
