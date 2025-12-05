import { Request, Response, NextFunction } from 'express';
import type { PrismaProfile, SafePrismaClient } from '../types/prisma.js';
import { validateAuthToken } from '../modules/profile/tokenService.js';
import type {
    TokenValidationFailureReason,
    VerifiedAuthTokenPayload,
} from '../types/security.js';
import { profileContextCacheConfig } from '../config/constants.js';
import { ensureTraceId } from '../services/trace.js';

function unauthorized(res: Response, message = 'Authentication required') {
    console.warn('[security] Unauthorized access attempt', {
        path: res.req?.originalUrl,
        ip: res.req?.ip,
    });
    return res.status(401).json({ error: 'auth_required', message });
}

function forbidden(res: Response, message = 'Access denied') {
    console.warn('[security] Forbidden access attempt', {
        path: res.req?.originalUrl,
        ip: res.req?.ip,
    });
    return res.status(403).json({ error: 'forbidden', message });
}

type ProfileCacheEntry = {
    profile: PrismaProfile;
    expiresAt: number;
};

const PROFILE_CACHE_TTL_MS = profileContextCacheConfig.ttlMs;
const profileCacheById = new Map<string, ProfileCacheEntry>();
const profileCacheByTelegram = new Map<string, ProfileCacheEntry>();

const now = () => Date.now();

function getCachedProfileById(id: string | null | undefined): PrismaProfile | null {
    if (!id) return null;
    const entry = profileCacheById.get(id.trim());
    if (!entry) return null;
    if (entry.expiresAt < now()) {
        profileCacheById.delete(id.trim());
        if (entry.profile.telegramId) {
            profileCacheByTelegram.delete(entry.profile.telegramId.toString());
        }
        return null;
    }
    return entry.profile;
}

function getCachedProfileByTelegram(telegramId: string | number | null | undefined): PrismaProfile | null {
    if (telegramId === null || telegramId === undefined) return null;
    const key = typeof telegramId === 'string' ? telegramId : telegramId.toString();
    const entry = profileCacheByTelegram.get(key);
    if (!entry) return null;
    if (entry.expiresAt < now()) {
        profileCacheByTelegram.delete(key);
        profileCacheById.delete(entry.profile.id);
        return null;
    }
    return entry.profile;
}

function cacheProfile(profile: PrismaProfile | null | undefined) {
    if (!profile) return;
    const entry: ProfileCacheEntry = {
        profile,
        expiresAt: now() + PROFILE_CACHE_TTL_MS,
    };
    profileCacheById.set(profile.id, entry);
    if (profile.telegramId !== null && profile.telegramId !== undefined) {
        profileCacheByTelegram.set(profile.telegramId.toString(), entry);
    }
}

async function resolveProfile(req: Request, prisma: SafePrismaClient) {
    const profileIdHeader = req.header('x-profile-id');
    const cachedById = getCachedProfileById(profileIdHeader);
    if (cachedById) {
        return cachedById;
    }

    const overrideTelegramId = req.telegramId;
    const cachedOverride = getCachedProfileByTelegram(overrideTelegramId);
    if (cachedOverride) {
        return cachedOverride;
    }

    const telegramIdHeader = req.header('x-telegram-id');
    const cachedHeader = getCachedProfileByTelegram(telegramIdHeader);
    if (cachedHeader) {
        return cachedHeader;
    }

    if (profileIdHeader) {
        const profile = await prisma.profile.findUnique({
            where: { id: profileIdHeader.trim() },
        });
        cacheProfile(profile);
        return profile;
    }

    if (overrideTelegramId) {
        const numericId = Number(overrideTelegramId);
        if (!Number.isNaN(numericId)) {
            const profile = await prisma.profile.findUnique({
                where: { telegramId: BigInt(numericId) },
            });
            cacheProfile(profile);
            return profile;
        }
    }

    if (telegramIdHeader) {
        const numericId = Number(telegramIdHeader);
        if (!Number.isNaN(numericId)) {
            const profile = await prisma.profile.findUnique({
                where: { telegramId: BigInt(numericId) },
            });
            cacheProfile(profile);
            return profile;
        }
    }

    return null;
}

async function resolveProfileWithTimeout(req: Request, prisma: SafePrismaClient) {
    const lookup = resolveProfile(req, prisma);
    const timeoutToken = Symbol('profile-timeout');
    const timeout = new Promise<typeof timeoutToken>((resolve) => {
        setTimeout(() => resolve(timeoutToken), 4500);
    });

    const result = await Promise.race([lookup, timeout]);
    if (result === timeoutToken) {
        console.warn('Profile lookup exceeded 4500ms, waiting for completion without failing request');
        try {
            const profile = await lookup;
            cacheProfile(profile);
            return profile;
        } catch (error) {
            console.error('Profile lookup failed after timeout:', error);
            throw error;
        }
    }

    const profile = result as PrismaProfile | null;
    cacheProfile(profile);
    return profile;
}

export function profileContextMiddleware(prisma: SafePrismaClient) {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (req.path === '/public/status') {
            return next();
        }

        const traceId = ensureTraceId(req.traceId);
        req.traceId = traceId;
        req.prisma = prisma;

        const authToken = req.header('authorization')?.replace('Bearer ', '') || req.header('x-auth-token');

        let tokenPayload: VerifiedAuthTokenPayload | null = null;
        const tokenValidation = validateAuthToken(authToken);

        if (tokenValidation.valid) {
            tokenPayload = tokenValidation.payload;
        } else if (authToken) {
            const reason: TokenValidationFailureReason = tokenValidation.reason;
            if (reason === 'expired') {
                return unauthorized(res, 'Срок действия маркера истёк. Пожалуйста, авторизуйтесь снова.');
            }
            if (reason === 'revoked') {
                return unauthorized(res, 'Маркер доступа был отозван. Пожалуйста, авторизуйтесь снова.');
            }

            console.warn('[security] Invalid auth token received', {
                path: req.originalUrl,
                ip: req.ip,
                traceId,
                reason,
            });
        }

        // Telegram WebApp validation would go here
        const initDataRaw = req.header('x-telegram-init-data');
        if (initDataRaw && tokenPayload && tokenPayload.user?.id) {
            req.telegramId = tokenPayload.user.id;
            req.telegramUser = tokenPayload.user;
        }

        let profile: PrismaProfile | null = null;
        const tokenProfileId = tokenPayload
            ? (tokenPayload as any).profile_id || (tokenPayload as any).profileId || null
            : null;
        const tokenTelegramId = tokenPayload
            ? (tokenPayload as any).telegramId || (tokenPayload as any).telegram_id || null
            : null;

        profile =
            getCachedProfileById(tokenProfileId) ||
            getCachedProfileByTelegram(tokenTelegramId);

        if (!profile) {
            try {
                profile = await resolveProfileWithTimeout(req, prisma);
            } catch (error: any) {
                if (error?.code !== 'P2024') {
                    console.error('Failed to resolve profile:', error?.message || error);
                }

                if (error?.code === 'P2024') {
                    if (req.path?.includes('/exercises/') && req.path?.includes('/levels')) {
                        return res.json({
                            exercise_key: req.params?.exerciseKey || 'unknown',
                            items: [],
                        });
                    }
                    return res.status(503).json({
                        error: 'database_unavailable',
                        message: 'База данных временно перегружена. Попробуйте позже.',
                        trace_id: traceId,
                    });
                }

                if (req.path?.includes('/exercises/') && req.path?.includes('/levels')) {
                    return res.json({
                        exercise_key: req.params?.exerciseKey || 'unknown',
                        items: [],
                    });
                }

                return res.status(500).json({
                    error: 'profile_lookup_failed',
                    message: 'Не удалось найти профиль пользователя',
                    trace_id: traceId,
                });
            }
        }

        if (!profile) {
            // Для уровней упражнений не требуем профиль, просто продолжаем
            if (req.path?.includes('/exercises/') && req.path?.includes('/levels')) {
                return next();
            }
            return unauthorized(res, 'Профиль не найден. Откройте WebApp из чата бота.');
        }

        if (tokenPayload) {
            const tokenProfileId = (tokenPayload as any).profile_id || (tokenPayload as any).profileId;
            if (tokenProfileId && tokenProfileId !== profile.id) {
                return forbidden(res, 'Маркер доступа не соответствует профилю.');
            }
        }

        req.profile = profile;
        req.profileId = profile.id;
        if (tokenPayload) {
            req.authTokenPayload = tokenPayload;
        } else {
            req.authTokenPayload = undefined;
        }

        return next();
    };
}

export default profileContextMiddleware;
