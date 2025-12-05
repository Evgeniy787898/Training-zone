import crypto from 'crypto';
import type { Response } from 'express';
import type { CookieOptions } from 'express';
import { csrfDefaults } from '../../config/constants.js';
import { getConfig } from '../../config/configService.js';
import type {
  CsrfTokenDetails,
  VerifyCsrfOptions,
  VerifyCsrfResult,
} from '../../types/security.js';
import { parseBoolean } from '../../utils/envParsers.js';

const TOKEN_VERSION = 'v1';
const DEFAULT_TTL_MS = csrfDefaults.tokenTtlMs;
const DEFAULT_REFRESH_THRESHOLD_MS = csrfDefaults.refreshThresholdMs;
const DEFAULT_COOKIE_NAME = csrfDefaults.cookieName;
const DEFAULT_HEADER_NAMES = csrfDefaults.headerNames;

const parseDuration = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) {
    console.warn(`Invalid CSRF duration value "${value}", falling back to ${fallback}ms`);
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 'ms';

  if (!Number.isFinite(amount) || amount <= 0) {
    console.warn(`Invalid CSRF duration amount "${value}", falling back to ${fallback}ms`);
    return fallback;
  }

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      console.warn(`Unsupported CSRF duration unit "${unit}", falling back to ${fallback}ms`);
      return fallback;
  }
};

const getCsrfSecrets = () => {
  const { csrfSecret, csrfFallbackSecret } = getConfig().security;
  if (!csrfSecret?.trim()) {
    throw new Error('CSRF_SECRET must be configured and contain a strong random value');
  }
  if (csrfSecret.trim().length < 32) {
    throw new Error('CSRF_SECRET must contain at least 32 characters');
  }
  const fallback = csrfFallbackSecret?.trim()?.length ? csrfFallbackSecret.trim() : null;
  if (fallback && fallback.length < 32) {
    throw new Error('CSRF_SECRET_PREVIOUS must contain at least 32 characters when provided');
  }
  return { primary: csrfSecret.trim(), fallback } as const;
};

const TOKEN_TTL_MS = parseDuration(process.env.CSRF_TOKEN_TTL, DEFAULT_TTL_MS);
const REFRESH_THRESHOLD_MS = parseDuration(
  process.env.CSRF_TOKEN_REFRESH_THRESHOLD ?? '',
  Math.min(DEFAULT_REFRESH_THRESHOLD_MS, Math.floor(TOKEN_TTL_MS / 3)),
);

export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;

const headerNamesFromEnv = process.env.CSRF_HEADER_NAMES
  ? process.env.CSRF_HEADER_NAMES.split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
  : [];

export const CSRF_HEADER_NAMES = headerNamesFromEnv.length ? headerNamesFromEnv : DEFAULT_HEADER_NAMES;

const cookieSecureDefault = process.env.NODE_ENV === 'production';
const cookieSecure = parseBoolean(process.env.CSRF_COOKIE_SECURE, cookieSecureDefault);
const cookieSameSite = ((): CookieOptions['sameSite'] => {
  const raw = process.env.CSRF_COOKIE_SAMESITE?.trim().toLowerCase();
  if (!raw) {
    return 'strict';
  }
  if (raw === 'lax' || raw === 'strict') {
    return raw;
  }
  if (raw === 'none') {
    return 'none';
  }
  console.warn(`Unsupported CSRF cookie SameSite value "${raw}", falling back to Strict`);
  return 'strict';
})();

const COOKIE_BASE_OPTIONS: CookieOptions = {
  httpOnly: false,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: '/',
};

const computeContextHash = (profileId: string | null | undefined) => {
  if (!profileId) {
    return '';
  }
  return crypto.createHash('sha256').update(profileId).digest('base64url').slice(0, 32);
};

const createSignature = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64url');

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const encodeIssuedAt = (timestamp: number) => timestamp.toString(36);
const decodeIssuedAt = (raw: string) => {
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export const createCsrfToken = (profileId?: string | null): CsrfTokenDetails => {
  const { primary } = getCsrfSecrets();
  const issuedAt = Date.now();
  const contextHash = computeContextHash(profileId ?? null);
  const random = crypto.randomBytes(32).toString('base64url');
  const issuedAtSegment = encodeIssuedAt(issuedAt);
  const payload = [TOKEN_VERSION, issuedAtSegment, random, contextHash].join('.');
  const signature = createSignature(payload, primary);
  const token = `${payload}.${signature}`;
  return {
    token,
    issuedAt,
    expiresAt: issuedAt + TOKEN_TTL_MS,
    contextHash,
    version: TOKEN_VERSION,
  };
};

export const verifyCsrfToken = (token: string | undefined | null, options: VerifyCsrfOptions = {}): VerifyCsrfResult => {
  const { primary, fallback } = getCsrfSecrets();
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  const segments = token.split('.');
  if (segments.length !== 5) {
    return { valid: false, reason: 'tampered' };
  }

  const [version, issuedAtRaw, randomSegment, contextHash, signature] = segments;
  if (version !== TOKEN_VERSION) {
    return { valid: false, reason: 'invalid' };
  }

  if (!randomSegment || !signature) {
    return { valid: false, reason: 'invalid' };
  }

  const payload = [version, issuedAtRaw, randomSegment, contextHash].join('.');
  const expectedSignature = createSignature(payload, primary);

  if (!timingSafeEqual(signature, expectedSignature)) {
    if (!fallback || !timingSafeEqual(signature, createSignature(payload, fallback))) {
      return { valid: false, reason: 'invalid' };
    }
  }

  const issuedAt = decodeIssuedAt(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, reason: 'invalid' };
  }

  const expiresAt = issuedAt + TOKEN_TTL_MS;
  if (expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  const expectedContext = computeContextHash(options.profileId ?? null);
  if (expectedContext && expectedContext !== contextHash) {
    return { valid: false, reason: 'mismatch' };
  }

  return {
    valid: true,
    details: {
      token,
      issuedAt,
      expiresAt,
      contextHash,
      version,
    },
  };
};

export const shouldRefreshCsrfToken = (details: CsrfTokenDetails) => {
  const timeToExpiry = details.expiresAt - Date.now();
  return timeToExpiry <= REFRESH_THRESHOLD_MS;
};

export const issueCsrfToken = (res: Response, profileId?: string | null) => {
  const details = createCsrfToken(profileId);
  const cookieOptions: CookieOptions = {
    ...COOKIE_BASE_OPTIONS,
    maxAge: TOKEN_TTL_MS,
    expires: new Date(details.expiresAt),
  };
  res.cookie(CSRF_COOKIE_NAME, details.token, cookieOptions);
  res.setHeader('X-CSRF-Token', details.token);
  return details;
};

export const resolveCookieOptions = () => ({
  ...COOKIE_BASE_OPTIONS,
  maxAge: TOKEN_TTL_MS,
});

export const getCsrfTtlMs = () => TOKEN_TTL_MS;
export const getCsrfRefreshThresholdMs = () => REFRESH_THRESHOLD_MS;
