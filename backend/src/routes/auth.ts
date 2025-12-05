import { Request, Response, Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { JwtPayload } from 'jsonwebtoken';
import { createRateLimiter, blockRateLimitKey, resetRateLimitKey } from '../middleware/rateLimiter.js';
import type { RateLimitOptions } from '../types/middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { issueAuthToken, validateAuthToken } from '../modules/profile/tokenService.js';
import { issueCsrfToken } from '../modules/security/csrf.js';
import { rateLimitConfig } from '../config/constants.js';
import { respondWithAppError, respondWithSuccess } from '../utils/apiResponses.js';
import { AppError } from '../services/errors.js';
import { createRecurringTask } from '../patterns/recurringTask.js';
import type { TelegramWebAppUser } from '../types/telegram.js';
import { isTelegramWebAppUser } from '../utils/typeGuards.js';

import {
    verifyPinSchema,
    telegramAuthSchema,
    type VerifyPinPayload,
    type TelegramAuthPayload
} from '../contracts/auth.js';

import type { ProfileService } from '../modules/profile/profile.service.js';

export function createAuthRouter(profileService: ProfileService) {
    const router = Router();

    const TELEGRAM_WEBAPP_SECRET = process.env.TELEGRAM_WEBAPP_SECRET;

    interface AuthTokenPayload extends JwtPayload {
        profileId?: string;
        telegramId?: string | number;
    }

    const pinRateLimitOptions: RateLimitOptions = {
        windowMs: rateLimitConfig.pin.windowMs,
        max: Number.isFinite(Number(process.env.PIN_RATE_LIMIT_MAX)) && Number(process.env.PIN_RATE_LIMIT_MAX) > 0
            ? Math.floor(Number(process.env.PIN_RATE_LIMIT_MAX))
            : rateLimitConfig.pin.defaultMax,
        keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'unknown',
        name: 'verify-pin',
    };

    const verifyPinLimiter = createRateLimiter(pinRateLimitOptions);

    type BruteForceEntry = {
        attempts: number;
        blockedUntil?: number;
        lastAttempt: number;
    };

    const bruteForceMap = new Map<string, BruteForceEntry>();
    const BRUTE_FORCE_MAX_ATTEMPTS = Number.isFinite(Number(process.env.PIN_MAX_ATTEMPTS)) && Number(process.env.PIN_MAX_ATTEMPTS) > 0
        ? Math.floor(Number(process.env.PIN_MAX_ATTEMPTS))
        : rateLimitConfig.bruteForce.maxAttempts;
    const BRUTE_FORCE_BLOCK_MS = Number.isFinite(Number(process.env.PIN_BLOCK_DURATION_MS)) && Number(process.env.PIN_BLOCK_DURATION_MS) > 0
        ? Math.floor(Number(process.env.PIN_BLOCK_DURATION_MS))
        : rateLimitConfig.bruteForce.blockDurationMs;

    const pruneBruteForceMap = () => {
        const now = Date.now();
        for (const [key, entry] of bruteForceMap.entries()) {
            if (entry.blockedUntil && entry.blockedUntil < now - BRUTE_FORCE_BLOCK_MS) {
                bruteForceMap.delete(key);
            } else if (!entry.blockedUntil && entry.lastAttempt < now - BRUTE_FORCE_BLOCK_MS) {
                bruteForceMap.delete(key);
            }
        }
    };

    createRecurringTask({
        name: 'pin-bruteforce-prune',
        intervalMs: rateLimitConfig.bruteForce.pruneIntervalMs,
        immediate: false,
        run: pruneBruteForceMap,
    });

    function getBruteForceKey(req: Request, telegramNumericId: number | null): string {
        if (telegramNumericId !== null && Number.isFinite(telegramNumericId)) {
            return `telegram:${telegramNumericId}`;
        }
        const profileId = req.header('x-profile-id');
        if (profileId) {
            return `profile:${profileId}`;
        }
        const initData = req.header('x-telegram-init-data') || req.body?.initData;
        if (initData) {
            return `initData:${crypto.createHash('sha256').update(initData).digest('hex')}`;
        }
        return `ip:${req.ip}`;
    }

    function isBlocked(key: string) {
        const entry = bruteForceMap.get(key);
        if (!entry?.blockedUntil) {
            return false;
        }
        if (entry.blockedUntil > Date.now()) {
            return true;
        }
        bruteForceMap.delete(key);
        return false;
    }

    function getRetryAfterSeconds(key: string) {
        const entry = bruteForceMap.get(key);
        if (!entry?.blockedUntil) {
            return null;
        }
        const diff = entry.blockedUntil - Date.now();
        return diff > 0 ? Math.ceil(diff / 1000) : 0;
    }

    function recordFailedAttempt(key: string) {
        const now = Date.now();
        const entry = bruteForceMap.get(key) ?? { attempts: 0, lastAttempt: now };
        entry.attempts += 1;
        entry.lastAttempt = now;
        if (entry.attempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
            entry.blockedUntil = now + BRUTE_FORCE_BLOCK_MS;
            console.warn(`[security] Blocking key ${key} for ${BRUTE_FORCE_BLOCK_MS / 1000}s due to brute-force attempts`);
        }
        bruteForceMap.set(key, entry);
        return Boolean(entry.blockedUntil && entry.blockedUntil > now);
    }

    function recordSuccessfulAttempt(key: string) {
        bruteForceMap.delete(key);
    }

    // Verify Telegram WebApp initData
    async function verifyTelegramInitData(initData: string): Promise<{ user?: TelegramWebAppUser; hash?: string } | null> {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            if (!hash) return null;

            urlParams.delete('hash');

            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            if (!TELEGRAM_WEBAPP_SECRET) {
                console.error('TELEGRAM_WEBAPP_SECRET not set, cannot validate initData');
                return null;
            }

            let secretKey: Buffer;
            try {
                const decoded = Buffer.from(TELEGRAM_WEBAPP_SECRET, 'base64');
                if (decoded.length >= 16) {
                    secretKey = decoded;
                } else {
                    secretKey = Buffer.from(TELEGRAM_WEBAPP_SECRET, 'utf8');
                }
            } catch {
                secretKey = Buffer.from(TELEGRAM_WEBAPP_SECRET, 'utf8');
            }

            const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

            if (calculatedHash !== hash) {
                return null;
            }

            const userStr = urlParams.get('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user && !isTelegramWebAppUser(user)) {
                return null;
            }

            return { user: user ?? undefined, hash };
        } catch (error) {
            console.error('Failed to verify Telegram initData:', error);
            return null;
        }
    }

    // POST /api/auth/telegram
    router.post('/telegram', validateRequest({ body: telegramAuthSchema }), async (req: Request, res: Response, next) => {
        try {
            const { initData } = req.validated?.body as TelegramAuthPayload;
            const prisma = req.prisma;

            if (!prisma) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'database_unavailable',
                        message: 'Database connection not available',
                        statusCode: 500,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            const verified = await verifyTelegramInitData(initData);

            if (!verified || !verified.user) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'invalid_signature',
                        message: 'Не удалось проверить подпись Telegram WebApp',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            const telegramId = BigInt(verified.user.id);

            const user = verified.user;

            // Find or create profile using service
            const profile = await profileService.getOrCreateProfileByTelegram(telegramId, {
                firstName: user?.first_name,
                lastName: user?.last_name,
            });

            // Generate JWT token
            const { token } = issueAuthToken({
                profileId: profile.id,
                telegramId: verified.user.id,
            });
            const csrfToken = issueCsrfToken(res, profile.id).token;

            return respondWithSuccess(
                res,
                {
                    token,
                    profileId: profile.id,
                    user: verified.user,
                    csrfToken,
                },
                { meta: req.traceId ? { traceId: req.traceId } : undefined },
            );
        } catch (error) {
            if (error instanceof z.ZodError) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'validation_failed',
                        message: 'Некорректные данные Telegram initData',
                        statusCode: 422,
                        category: 'validation',
                        details: error.issues,
                        exposeDetails: true,
                    }),
                    { traceId: req.traceId },
                );
            }
            next(error);
        }
    });

    function hashPin(pin: string) {
        return crypto.createHash('sha256').update(pin).digest('hex');
    }

    // POST /api/auth/verify-pin
    router.post('/verify-pin', verifyPinLimiter, validateRequest({ body: verifyPinSchema }), async (req: Request, res: Response, next) => {
        try {
            console.log('[verify-pin] Request body:', JSON.stringify(req.body));
            console.log('[verify-pin] Headers:', {
                'x-telegram-id': req.header('x-telegram-id'),
                'x-telegram-init-data': req.header('x-telegram-init-data') ? 'present' : 'missing',
                'x-profile-id': req.header('x-profile-id'),
                'authorization': req.header('authorization') ? 'present' : 'missing'
            });

            const { pin, telegram_id, initData } = req.validated?.body as VerifyPinPayload;
            const prisma = req.prisma;

            if (!prisma) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'database_unavailable',
                        message: 'Database connection not available',
                        statusCode: 500,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            let numericId: number | null = null;
            let bruteForceKey = getBruteForceKey(req, numericId);

            const respondIfBlocked = () => {
                bruteForceKey = getBruteForceKey(req, numericId);
                if (!isBlocked(bruteForceKey)) {
                    return false;
                }
                const retryAfter = Math.max(1, getRetryAfterSeconds(bruteForceKey) ?? Math.ceil(BRUTE_FORCE_BLOCK_MS / 1000));
                blockRateLimitKey(pinRateLimitOptions, req, retryAfter * 1000);
                res.setHeader('Retry-After', retryAfter.toString());
                console.warn(`[security] PIN attempts locked for key ${bruteForceKey}`);
                respondWithAppError(
                    res,
                    new AppError({
                        code: 'pin_locked',
                        message: 'PIN временно заблокирован из-за подозрительной активности. Попробуйте позже.',
                        statusCode: 423,
                        category: 'authentication',
                        details: { retry_after: retryAfter },
                        exposeDetails: true,
                    }),
                    { traceId: req.traceId },
                );
                return true;
            };

            if (respondIfBlocked()) {
                return;
            }

            // Resolve Telegram ID: prefer body/header/profileId, else parse from initData
            // Body fallback
            if (telegram_id !== undefined && telegram_id !== null && !Number.isNaN(Number(telegram_id))) {
                numericId = Number(telegram_id);
                if (respondIfBlocked()) {
                    return;
                }
            }
            const telegramIdHeader = req.header('x-telegram-id');
            if (telegramIdHeader) {
                const n = Number(telegramIdHeader);
                if (!Number.isNaN(n)) {
                    numericId = n;
                    if (respondIfBlocked()) {
                        return;
                    }
                }
            }
            if (numericId === null) {
                const profileIdHeader = req.header('x-profile-id');
                if (profileIdHeader) {
                    try {
                        const p = await profileService.getProfileById(profileIdHeader);
                        if (p?.telegramId) {
                            const n = Number(p.telegramId.toString());
                            if (!Number.isNaN(n)) {
                                numericId = n;
                                if (respondIfBlocked()) {
                                    return;
                                }
                            }
                        }
                    } catch (dbError: any) {
                        // Если ошибка подключения к БД, не используем этот способ получения ID
                        if (dbError?.code && typeof dbError.code === 'string' && dbError.code.startsWith('P')) {
                            console.warn('[verify-pin] Failed to fetch profile by ID header:', dbError.message);
                        } else {
                            throw dbError;
                        }
                    }
                }
            }
            if (numericId === null) {
                const authHeader = req.header('authorization');
                const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

                if (token) {
                    const validation = validateAuthToken(token);
                    if (validation.valid) {
                        const payload = validation.payload as AuthTokenPayload;
                        if (payload.telegramId !== undefined && payload.telegramId !== null && !Number.isNaN(Number(payload.telegramId))) {
                            numericId = Number(payload.telegramId);
                            if (respondIfBlocked()) {
                                return;
                            }
                        } else if (payload.profileId) {
                            try {
                                const profileFromToken = await profileService.getProfileById(payload.profileId);
                                if (profileFromToken?.telegramId) {
                                    const n = Number(profileFromToken.telegramId.toString());
                                    if (!Number.isNaN(n)) {
                                        numericId = n;
                                        if (respondIfBlocked()) {
                                            return;
                                        }
                                    }
                                }
                            } catch (dbError: any) {
                                // Если ошибка подключения к БД, не используем этот способ получения ID
                                if (dbError?.code && typeof dbError.code === 'string' && dbError.code.startsWith('P')) {
                                    console.warn('[verify-pin] Failed to fetch profile by token profileId:', dbError.message);
                                } else {
                                    throw dbError;
                                }
                            }
                        }
                    }
                }
            }

            if (numericId === null) {
                const initDataRaw = req.header('x-telegram-init-data') || initData;
                if (initDataRaw) {
                    try {
                        const urlParams = new URLSearchParams(initDataRaw);
                        const userStr = urlParams.get('user');
                        const user = userStr ? JSON.parse(userStr) : null;
                        if (isTelegramWebAppUser(user) && !Number.isNaN(Number(user.id))) {
                            numericId = Number(user.id);
                            if (respondIfBlocked()) {
                                return;
                            }
                        }
                    } catch (e) {
                        // ignore parse errors, will handle below
                    }
                }
            }
            // Для веб-версии (без Telegram ID) используем специальный идентификатор
            // или ищем профиль по PIN hash напрямую
            if (numericId === null) {
                console.log('[verify-pin] No Telegram ID found - using web version mode');

                bruteForceKey = getBruteForceKey(req, null);
                if (respondIfBlocked()) {
                    return;
                }

                // Для веб-версии: ищем профиль по PIN hash
                // Это позволяет веб-версии работать с БД без Telegram ID
                const hashedAttempt = hashPin(pin);

                try {
                    // Ищем профиль с таким PIN hash
                    const profileByPin = await profileService.findProfileByPinHash(hashedAttempt);

                    if (profileByPin) {
                        // Найден профиль с таким PIN - возвращаем успех
                        // Генерируем JWT токен для веб-версии
                        const { token } = issueAuthToken({
                            profileId: profileByPin.id,
                            telegramId: profileByPin.telegramId ? profileByPin.telegramId.toString() : null,
                        });
                        const csrfToken = issueCsrfToken(res, profileByPin.id).token;

                        recordSuccessfulAttempt(bruteForceKey);
                        resetRateLimitKey(pinRateLimitOptions, req);

                        return respondWithSuccess(
                            res,
                            {
                                valid: true,
                                message: 'PIN верный',
                                token,
                                profileId: profileByPin.id,
                                csrfToken,
                            },
                            { meta: req.traceId ? { traceId: req.traceId } : undefined },
                        );
                    }

                    // Если профиль не найден, создаем новый для веб-версии
                    const webProfile = await profileService.createWebProfile(hashedAttempt);

                    // Генерируем JWT токен для веб-версии
                    const { token } = issueAuthToken({
                        profileId: webProfile.id,
                        telegramId: webProfile.telegramId ? webProfile.telegramId.toString() : null,
                    });
                    const csrfToken = issueCsrfToken(res, webProfile.id).token;

                    recordSuccessfulAttempt(bruteForceKey);
                    resetRateLimitKey(pinRateLimitOptions, req);

                    return respondWithSuccess(
                        res,
                        {
                            valid: true,
                            message: 'PIN установлен',
                            token,
                            profileId: webProfile.id,
                            csrfToken,
                        },
                        { meta: req.traceId ? { traceId: req.traceId } : undefined },
                    );
                } catch (dbError: any) {
                    // Ошибки БД будут обработаны в основном блоке catch
                    throw dbError;
                }
            }

            console.log('[verify-pin] Resolved Telegram ID:', numericId);

            bruteForceKey = getBruteForceKey(req, numericId);
            if (respondIfBlocked()) {
                return;
            }

            // PIN is stored as hashed value
            const hashedAttempt = hashPin(pin);

            try {
                // Get or create profile to check/update PIN
                let profile = await profileService.getProfileByTelegramId(BigInt(numericId));
                const storedHash = profile?.pinHash || null;

                if (!storedHash) {
                    if (!profile) {
                        profile = await profileService.getOrCreateProfileByTelegram(BigInt(numericId), {});
                        profile = await profileService.updatePin(profile.id, hashedAttempt);
                    } else {
                        profile = await profileService.updatePin(profile.id, hashedAttempt);
                    }

                    recordSuccessfulAttempt(bruteForceKey);
                    resetRateLimitKey(pinRateLimitOptions, req);

                    return respondWithSuccess(
                        res,
                        {
                            valid: true,
                            message: 'PIN установлен',
                        },
                        { meta: req.traceId ? { traceId: req.traceId } : undefined },
                    );
                }

                const isValid = storedHash === hashedAttempt;

                if (!profile) {
                    throw new AppError({
                        statusCode: 500,
                        message: 'Profile not found during PIN verification',
                        code: 'internal_error'
                    });
                }

                console.log('[verify-pin] PIN verification result:', {
                    profileId: profile.id,
                    hasStoredHash: !!storedHash,
                    storedHashPrefix: storedHash ? storedHash.substring(0, 8) + '...' : null,
                    attemptHashPrefix: hashedAttempt.substring(0, 8) + '...',
                    isValid,
                });

                if (!isValid) {
                    const blocked = recordFailedAttempt(bruteForceKey);
                    if (blocked) {
                        blockRateLimitKey(pinRateLimitOptions, req, BRUTE_FORCE_BLOCK_MS);
                    }
                    const retryAfter = blocked
                        ? Math.max(1, getRetryAfterSeconds(bruteForceKey) ?? Math.ceil(BRUTE_FORCE_BLOCK_MS / 1000))
                        : undefined;
                    if (retryAfter) {
                        res.setHeader('Retry-After', retryAfter.toString());
                    }
                    console.warn('[verify-pin] Invalid PIN attempt detected', {
                        key: bruteForceKey,
                        ip: req.ip,
                        profileId: profile.id,
                    });
                } else {
                    recordSuccessfulAttempt(bruteForceKey);
                    resetRateLimitKey(pinRateLimitOptions, req);

                    // Generate JWT token and CSRF token for successful PIN verification
                    const { token } = issueAuthToken({
                        profileId: profile.id,
                        telegramId: numericId,
                    });
                    const csrfToken = issueCsrfToken(res, profile.id).token;

                    console.log('[verify-pin] PIN verified successfully', {
                        profileId: profile.id,
                        hasToken: !!token,
                        tokenPrefix: token ? token.substring(0, 20) + '...' : null,
                    });

                    return respondWithSuccess(
                        res,
                        {
                            valid: true,
                            message: 'PIN верный',
                            token,
                            profileId: profile.id,
                            csrfToken,
                        },
                        { meta: req.traceId ? { traceId: req.traceId } : undefined },
                    );
                }

                // Invalid PIN
                return respondWithSuccess(
                    res,
                    {
                        valid: false,
                        message: 'Неверный PIN',
                    },
                    { meta: req.traceId ? { traceId: req.traceId } : undefined },
                );
            } catch (dbError: any) {
                // Ошибки БД будут обработаны в основном блоке catch
                throw dbError;
            }
        } catch (error: any) {
            // Обработка ошибок валидации
            if (error instanceof z.ZodError) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'validation_failed',
                        message: 'Некорректные данные',
                        statusCode: 422,
                        category: 'validation',
                        details: error.issues,
                        exposeDetails: true,
                    }),
                    { traceId: req.traceId },
                );
            }

            // Проверка на ошибки Prisma (включая недоступность БД)
            const isPrismaError =
                // Проверка по коду ошибки (начинается с P)
                (error?.code && typeof error.code === 'string' && error.code.startsWith('P')) ||
                // Проверка по имени класса
                error?.name === 'PrismaClientInitializationError' ||
                error?.name === 'PrismaClientKnownRequestError' ||
                error?.name === 'PrismaClientUnknownRequestError' ||
                // Проверка по сообщению об ошибке
                (typeof error?.message === 'string' && (
                    error.message.includes('Can\'t reach database server') ||
                    error.message.includes('database server') ||
                    error.message.includes('P1001') ||
                    error.message.includes('connection') ||
                    error.message.includes('Prisma')
                ));

            if (isPrismaError) {
                console.error('[verify-pin] Prisma error:', {
                    name: error?.name,
                    code: error?.code,
                    message: error?.message,
                });

                // Ошибка подключения к БД
                const isConnectionError =
                    error?.code === 'P1001' ||
                    error?.name === 'PrismaClientInitializationError' ||
                    (typeof error?.message === 'string' && (
                        error.message.includes('Can\'t reach database server') ||
                        error.message.includes('connection') ||
                        error.message.includes('ECONNREFUSED') ||
                        error.message.includes('ETIMEDOUT')
                    ));

                if (isConnectionError) {
                    return respondWithAppError(
                        res,
                        new AppError({
                            code: 'database_unavailable',
                            message: 'База данных временно недоступна. Попробуйте позже.',
                            statusCode: 503,
                            category: 'dependencies',
                        }),
                        { traceId: req.traceId },
                    );
                }

                // Общие ошибки БД
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'database_error',
                        message: 'Ошибка базы данных при проверке PIN. Попробуйте позже.',
                        statusCode: 500,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Обработка других ошибок
            console.error('[verify-pin] Unexpected error:', error);
            next(error);
        }
    });

    return router;
}
