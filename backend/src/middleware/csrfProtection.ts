import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAMES,
  issueCsrfToken,
  shouldRefreshCsrfToken,
  verifyCsrfToken,
} from '../modules/security/csrf.js';
import type { CsrfProtectionOptions } from '../types/security.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const parseCookies = (cookieHeader: string | undefined | null) => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (!rawKey || rest.length === 0) {
      continue;
    }
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    const rawValue = rest.join('=').trim();
    if (!rawValue) {
      continue;
    }
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const resolveProfileId = (req: Request): string | null => {
  if (req.profile?.id) {
    return req.profile.id;
  }
  if (req.profileId) {
    return req.profileId;
  }
  if (req.authTokenPayload?.profileId) {
    return `${req.authTokenPayload.profileId}`;
  }
  const headerProfileId = req.header('x-profile-id');
  if (headerProfileId) {
    return headerProfileId.trim() || null;
  }
  return null;
};

const isIgnoredPath = (path: string, ignoredPaths: Array<string | RegExp>) => {
  return ignoredPaths.some((rule) => {
    if (typeof rule === 'string') {
      return path.startsWith(rule);
    }
    return rule.test(path);
  });
};

const pickHeaderToken = (req: Request, headerNames: string[]): string | null => {
  for (const name of headerNames) {
    const value = req.headers[name];
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      return value[0]?.trim() || null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

export const createCsrfProtectionMiddleware = (options: CsrfProtectionOptions = {}) => {
  const ignoredPaths = options.ignoredPaths ?? [];
  const headerNames = (options.headerNames ?? CSRF_HEADER_NAMES).map((name) => name.toLowerCase());

  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    const effectivePath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    if (isIgnoredPath(effectivePath, ignoredPaths)) {
      return next();
    }

    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE_NAME];
    const headerToken = pickHeaderToken(req, headerNames);

    if (!headerToken || !cookieToken) {
      console.warn('[security] CSRF token missing', {
        path: req.originalUrl,
        method: req.method,
        hasHeaderToken: Boolean(headerToken),
        headerTokenValue: headerToken ? '***' : 'null',
        hasCookieToken: Boolean(cookieToken),
        cookieTokenValue: cookieToken ? '***' : 'null',
        cookiesKeys: Object.keys(cookies),
        headers: Object.keys(req.headers),
      });
      return res.status(403).json({
        error: 'csrf_required',
        message: 'CSRF token is required for this request',
      });
    }

    if (!timingSafeEqual(headerToken, cookieToken)) {
      console.warn('[security] CSRF token mismatch', {
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(403).json({
        error: 'csrf_mismatch',
        message: 'CSRF token mismatch',
      });
    }

    const profileId = resolveProfileId(req);
    const verification = verifyCsrfToken(headerToken, { profileId });
    if (!verification.valid) {
      console.warn('[security] Invalid CSRF token', {
        path: req.originalUrl,
        method: req.method,
        reason: verification.reason,
      });
      const status = verification.reason === 'expired' ? 440 : 403;
      return res.status(status).json({
        error: 'csrf_invalid',
        message: 'CSRF token is invalid or expired',
        reason: verification.reason,
      });
    }

    if (shouldRefreshCsrfToken(verification.details)) {
      issueCsrfToken(res, profileId);
    }

    return next();
  };
};
