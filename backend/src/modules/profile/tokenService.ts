import crypto from 'crypto';
import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import type { JsonWebTokenError, NotBeforeError, TokenExpiredError } from 'jsonwebtoken';
import { jwtDefaults } from '../../config/constants.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';
import type {
  IssueAuthTokenClaims,
  TokenValidationFailureReason,
  TokenValidationResult,
  VerifiedAuthTokenPayload,
} from '../../types/security.js';

type SecretEntry = {
  id: string;
  secret: string;
  isLegacy?: boolean;
};

const LEGACY_SECRET_ID = process.env.JWT_SECRET_LEGACY_ID?.trim() || 'legacy';
const TokenExpiredErrorCtor = jwt.TokenExpiredError as typeof jwt.TokenExpiredError;
const JsonWebTokenErrorCtor = jwt.JsonWebTokenError as typeof jwt.JsonWebTokenError;
const NotBeforeErrorCtor = jwt.NotBeforeError as typeof jwt.NotBeforeError;

const parseConfiguredSecrets = (): SecretEntry[] => {
  const entries: SecretEntry[] = [];
  const seenIds = new Set<string>();

  const rawKeys = process.env.JWT_SECRET_KEYS;
  if (rawKeys) {
    for (const rawEntry of rawKeys.split(',')) {
      const trimmed = rawEntry.trim();
      if (!trimmed) {
        continue;
      }

      const delimiterIndex = trimmed.indexOf(':');
      if (delimiterIndex <= 0) {
        continue;
      }

      const id = trimmed.slice(0, delimiterIndex).trim();
      const secret = trimmed.slice(delimiterIndex + 1);

      if (!id || !secret) {
        continue;
      }

      if (seenIds.has(id)) {
        continue;
      }

      entries.push({ id, secret });
      seenIds.add(id);
    }
  }

  const legacySecret = process.env.JWT_SECRET?.trim();
  if (legacySecret && !seenIds.has(LEGACY_SECRET_ID)) {
    entries.push({ id: LEGACY_SECRET_ID, secret: legacySecret, isLegacy: true });
    seenIds.add(LEGACY_SECRET_ID);
  }

  if (entries.length === 0) {
    entries.push({ id: 'default', secret: 'default-secret-change-in-production', isLegacy: true });
  }

  return entries;
};

const configuredSecrets = parseConfiguredSecrets();

const ACTIVE_SECRET_ID = process.env.JWT_SECRET_ACTIVE_ID?.trim();

const orderedSecrets = (() => {
  if (!ACTIVE_SECRET_ID) {
    return configuredSecrets;
  }

  const activeSecret = configuredSecrets.find((entry) => entry.id === ACTIVE_SECRET_ID);
  if (!activeSecret) {
    return configuredSecrets;
  }

  return [activeSecret, ...configuredSecrets.filter((entry) => entry.id !== ACTIVE_SECRET_ID)];
})();

const ACTIVE_SECRET = orderedSecrets[0];

const secretMap = new Map(orderedSecrets.map((entry) => [entry.id, entry]));

const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || jwtDefaults.expiresIn;
const TOKEN_ISSUER = process.env.JWT_ISSUER?.trim() || undefined;
const TOKEN_AUDIENCE = process.env.JWT_AUDIENCE?.trim() || undefined;

const DEFAULT_REVOKED_TTL_MS = Number.isFinite(Number(process.env.JWT_REVOKED_FALLBACK_TTL_MS))
  ? Math.max(1, Math.floor(Number(process.env.JWT_REVOKED_FALLBACK_TTL_MS)))
  : jwtDefaults.revokedFallbackTtlMs;

const CLEANUP_INTERVAL_MS = Number.isFinite(Number(process.env.JWT_REVOKED_CLEANUP_INTERVAL_MS))
  ? Math.max(1, Math.floor(Number(process.env.JWT_REVOKED_CLEANUP_INTERVAL_MS)))
  : jwtDefaults.revokedCleanupIntervalMs;

type RevokedEntry = {
  expiresAt: number;
};

const revokedTokens = new Map<string, RevokedEntry>();

const revokedCleanupTask = createRecurringTask({
  name: 'jwt-revoked-cleanup',
  intervalMs: CLEANUP_INTERVAL_MS,
  immediate: false,
  autoStart: false,
  run: () => {
    const now = Date.now();
    for (const [jti, entry] of revokedTokens.entries()) {
      if (entry.expiresAt <= now) {
        revokedTokens.delete(jti);
      }
    }
  },
});

const startCleanupTimer = () => {
  revokedCleanupTask.start();
};

const createSignOptions = (options?: SignOptions): SignOptions => {
  const signOptions: SignOptions = {};

  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
  if (expiresIn) {
    signOptions.expiresIn = expiresIn as SignOptions['expiresIn'];
  }

  const audience = options?.audience ?? TOKEN_AUDIENCE;
  if (audience) {
    signOptions.audience = audience;
  }

  const issuer = options?.issuer ?? TOKEN_ISSUER;
  if (issuer) {
    signOptions.issuer = issuer;
  }

  if (options?.notBefore) {
    signOptions.notBefore = options.notBefore;
  }

  if (options?.subject) {
    signOptions.subject = options.subject;
  }

  if (options?.jwtid) {
    signOptions.jwtid = options.jwtid;
  }

  if (options?.keyid) {
    signOptions.keyid = options.keyid;
  }

  return signOptions;
};

const sanitizeClaims = (claims: IssueAuthTokenClaims): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(claims)) {
    if (['jti', 'exp', 'iat'].includes(key)) {
      continue;
    }

    if (key === 'telegramId') {
      if (value !== null && value !== undefined) {
        sanitized.telegramId = `${value}`;
      }
      continue;
    }

    if (value !== undefined) {
      sanitized[key] = value;
    }
  }

  if (!claims.profileId) {
    throw new Error('profileId claim is required');
  }

  sanitized.profileId = typeof claims.profileId === 'string' ? claims.profileId.trim() : `${claims.profileId}`;

  return sanitized;
};

export const issueAuthToken = (claims: IssueAuthTokenClaims, options?: SignOptions) => {
  const jti = crypto.randomUUID();
  const payload = { ...sanitizeClaims(claims), jti };
  const signOptions = createSignOptions(options);

  const signingSecretEntry =
    signOptions.keyid && secretMap.has(signOptions.keyid)
      ? secretMap.get(signOptions.keyid)!
      : ACTIVE_SECRET;

  if (!signOptions.keyid) {
    signOptions.keyid = signingSecretEntry.id;
  }

  const token = jwt.sign(payload, signingSecretEntry.secret, signOptions);
  const decoded = jwt.decode(token) as JwtPayload | null;

  const exp = typeof decoded?.exp === 'number' ? decoded.exp : undefined;

  return {
    token,
    jti,
    expiresAt: exp ? exp * 1000 : undefined,
  };
};

const isTokenRevoked = (jti: string) => {
  const entry = revokedTokens.get(jti);
  if (!entry) {
    return false;
  }

  if (entry.expiresAt <= Date.now()) {
    revokedTokens.delete(jti);
    return false;
  }

  return true;
};

export const revokeTokenId = (jti: string, expiresAtSeconds?: number) => {
  const now = Date.now();
  const expiresAt = expiresAtSeconds && Number.isFinite(expiresAtSeconds)
    ? Math.max(now, Math.floor(expiresAtSeconds) * 1000)
    : now + DEFAULT_REVOKED_TTL_MS;

  revokedTokens.set(jti, { expiresAt });
  startCleanupTimer();
};

export const revokeAuthToken = (token: string): boolean => {
  const result = validateAuthToken(token);
  if (!result.valid) {
    return false;
  }

  const payload = result.payload;
  revokeTokenId(payload.jti, payload.exp);
  return true;
};

const verifyOptions = (): VerifyOptions => {
  const options: VerifyOptions = {
    algorithms: ['HS256'],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  };

  if (!options.audience) {
    delete options.audience;
  }
  if (!options.issuer) {
    delete options.issuer;
  }

  return options;
};

export const validateAuthToken = (token?: string | null): TokenValidationResult => {
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  const decoded = jwt.decode(token, { complete: true });
  const tokenKeyId =
    decoded && typeof decoded === 'object' && decoded.header && typeof decoded.header === 'object'
      ? typeof decoded.header.kid === 'string'
        ? decoded.header.kid
        : undefined
      : undefined;

  const attemptedSecrets: SecretEntry[] = [];

  if (tokenKeyId) {
    const matched = secretMap.get(tokenKeyId);
    if (matched) {
      attemptedSecrets.push(matched);
    }
  }

  for (const entry of orderedSecrets) {
    if (!attemptedSecrets.some((existing) => existing.id === entry.id)) {
      attemptedSecrets.push(entry);
    }
  }

  let lastSignatureError: JsonWebTokenError | null = null;

  for (const entry of attemptedSecrets) {
    try {
      const payload = jwt.verify(token, entry.secret, verifyOptions()) as JwtPayload;

      if (!payload || typeof payload !== 'object') {
        return { valid: false, reason: 'invalid', token };
      }

      if (!payload.jti || typeof payload.jti !== 'string') {
        return { valid: false, reason: 'invalid', token };
      }

      if (!payload.profileId || typeof payload.profileId !== 'string') {
        return { valid: false, reason: 'invalid', token };
      }

      if (typeof payload.exp === 'number') {
        const expMs = payload.exp * 1000;
        if (expMs <= Date.now()) {
          revokeTokenId(payload.jti, payload.exp);
          return { valid: false, reason: 'expired', token };
        }
      }

      if (isTokenRevoked(payload.jti)) {
        return { valid: false, reason: 'revoked', token };
      }

      return { valid: true, payload: payload as VerifiedAuthTokenPayload, token };
    } catch (error) {
      if (error instanceof TokenExpiredErrorCtor) {
        return { valid: false, reason: 'expired', error, token };
      }

      if (error instanceof NotBeforeErrorCtor) {
        return { valid: false, reason: 'invalid', error, token };
      }

      if (error instanceof JsonWebTokenErrorCtor) {
        if (error.message === 'invalid signature') {
          lastSignatureError = error;
          continue;
        }

        return { valid: false, reason: 'invalid', error, token };
      }

      return { valid: false, reason: 'invalid', error: error as Error, token };
    }
  }

  if (lastSignatureError) {
    return { valid: false, reason: 'invalid', error: lastSignatureError, token };
  }

  return { valid: false, reason: 'invalid', token };
};

export const getRevokedTokenCount = () => revokedTokens.size;

