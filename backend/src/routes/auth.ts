import { Request, Response, Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { JwtPayload } from 'jsonwebtoken';
import { createRateLimiter, blockRateLimitKey, resetRateLimitKey } from '../middleware/rateLimiter.js';
import type { RateLimitOptions } from '../types/middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { issueAuthToken, validateAuthToken } from '../modules/profile/tokenService.js';
import { issueCsrfToken } from '../modules/security/csrf.js';
import {
    getBruteForceKey,
    isBlocked,
    getRetryAfterSeconds,
    recordFailedAttempt,
    recordSuccessfulAttempt,
    getBlockDurationMs,
} from '../modules/security/bruteForce.js';
import { rateLimitConfig } from '../config/constants.js';
import { respondWithAppError, respondWithSuccess } from '../utils/apiResponses.js';
import { AppError } from '../services/errors.js';
import { ERROR_CODES } from '../types/errors.js';
import type { TelegramWebAppUser } from '../types/telegram.js';
import { isTelegramWebAppUser } from '../utils/typeGuards.js';

import {
    verifyPinSchema,
    telegramAuthSchema,
    changePinSchema, // SETT-F01
    type VerifyPinPayload,
    type TelegramAuthPayload,
    type ChangePinPayload, // SETT-F01
} from '../contracts/auth.js';

import type { ProfileService } from '../modules/profile/profile.service.js';
import type { RefreshTokenService } from '../modules/profile/refreshToken.service.js';
import type { AuditService } from '../modules/security/audit.service.js';

export function createAuthRouter(
    profileService: ProfileService,
    refreshTokenService: RefreshTokenService,
    auditService: AuditService
) {
    const router = Router();

    const TELEGRAM_WEBAPP_SECRET = process.env.TELEGRAM_WEBAPP_SECRET;
    const BRUTE_FORCE_BLOCK_MS = getBlockDurationMs();

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
            const refreshToken = (await refreshTokenService.createRefreshToken(profile.id)).token;
            const csrfToken = issueCsrfToken(res, profile.id).token;

            await auditService.log('LOGIN_SUCCESS', profile.id, 'SUCCESS', {
                ip: req.ip,
                userAgent: req.get('user-agent'),
                metadata: { method: 'telegram', telegramId: Number(telegramId) },
            });

            return respondWithSuccess(
                res,
                {
                    token,
                    refreshToken,
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
            console.log('[verify-pin] START request');
            console.log('[verify-pin] Headers:', {
                'x-telegram-id': req.header('x-telegram-id'),
                'x-telegram-init-data': req.header('x-telegram-init-data') ? 'present' : 'missing',
                'x-profile-id': req.header('x-profile-id'),
                'authorization': req.header('authorization') ? 'present' : 'missing'
            });

            const body = req.body;
            console.log('[verify-pin] Body keys:', Object.keys(body));

            const { pin, telegram_id, initData } = req.validated?.body as VerifyPinPayload;
            const prisma = req.prisma;

            // Explicit check for Prisma connection
            if (!prisma) {
                console.error('[verify-pin] CRITICAL: req.prisma is undefined!');
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'database_unavailable',
                        message: 'Database connection not available (req.prisma missing)',
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

                        await auditService.log('LOGIN_SUCCESS', profileByPin.id, 'SUCCESS', {
                            ip: req.ip,
                            userAgent: req.get('user-agent'),
                            metadata: { method: 'pin_web' },
                        });

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
                    const refreshToken = (await refreshTokenService.createRefreshToken(webProfile.id)).token;
                    const csrfToken = issueCsrfToken(res, webProfile.id).token;

                    recordSuccessfulAttempt(bruteForceKey);
                    resetRateLimitKey(pinRateLimitOptions, req);

                    return respondWithSuccess(
                        res,
                        {
                            valid: true,
                            message: 'PIN установлен',
                            token,
                            refreshToken,
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

                    await auditService.log('LOGIN_FAILURE', profile.id, 'FAILURE', {
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                        metadata: { method: 'pin', reason: 'invalid_pin' },
                    });
                } else {
                    recordSuccessfulAttempt(bruteForceKey);
                    resetRateLimitKey(pinRateLimitOptions, req);

                    // Generate JWT token and CSRF token for successful PIN verification
                    const { token } = issueAuthToken({
                        profileId: profile.id,
                        telegramId: numericId,
                    });
                    const refreshToken = (await refreshTokenService.createRefreshToken(profile.id)).token;
                    const csrfToken = issueCsrfToken(res, profile.id).token;

                    console.log('[verify-pin] PIN verified successfully', {
                        profileId: profile.id,
                        hasToken: !!token,
                        tokenPrefix: token ? token.substring(0, 20) + '...' : null,
                    });

                    await auditService.log('LOGIN_SUCCESS', profile.id, 'SUCCESS', {
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                        metadata: { method: 'pin' },
                    });

                    return respondWithSuccess(
                        res,
                        {
                            valid: true,
                            message: 'PIN верный',
                            token,
                            refreshToken,
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

    // POST /api/auth/change-pin (SETT-F01)
    // Requires authentication and old PIN verification
    router.post('/change-pin', verifyPinLimiter, validateRequest({ body: changePinSchema }), async (req: Request, res: Response, next) => {
        try {
            const { oldPin, newPin } = req.validated?.body as ChangePinPayload;
            const prisma = req.prisma;
            const profile = (req as any).profile;

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

            // Require authenticated profile
            if (!profile?.id) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: ERROR_CODES.UNAUTHORIZED,
                        message: 'Требуется авторизация для смены PIN',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Get current profile with PIN
            const currentProfile = await profileService.getProfileById(profile.id);
            if (!currentProfile) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'profile_not_found',
                        message: 'Профиль не найден',
                        statusCode: 404,
                        category: 'not_found',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Verify old PIN
            const oldPinHash = hashPin(oldPin);
            if (currentProfile.pinHash !== oldPinHash) {
                const bruteForceKey = getBruteForceKey(req, currentProfile.telegramId ? Number(currentProfile.telegramId) : null);
                const blocked = recordFailedAttempt(bruteForceKey);

                if (blocked) {
                    blockRateLimitKey(pinRateLimitOptions, req, BRUTE_FORCE_BLOCK_MS);
                }

                await auditService.log('PIN_CHANGE_FAILURE', profile.id, 'FAILURE', {
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    metadata: { reason: 'invalid_old_pin' },
                });

                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'invalid_pin',
                        message: 'Неверный текущий PIN',
                        statusCode: 400,
                        category: 'validation',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Update to new PIN
            const newPinHash = hashPin(newPin);
            await profileService.updatePin(profile.id, newPinHash);

            // Reset rate limit on success
            const bruteForceKey = getBruteForceKey(req, currentProfile.telegramId ? Number(currentProfile.telegramId) : null);
            recordSuccessfulAttempt(bruteForceKey);
            resetRateLimitKey(pinRateLimitOptions, req);

            await auditService.log('PIN_CHANGE_SUCCESS', profile.id, 'SUCCESS', {
                ip: req.ip,
                userAgent: req.get('user-agent'),
            });

            console.log('[change-pin] PIN changed successfully', { profileId: profile.id });

            return respondWithSuccess(
                res,
                {
                    success: true,
                    message: 'PIN успешно изменён',
                },
                { meta: req.traceId ? { traceId: req.traceId } : undefined },
            );
        } catch (error) {
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
            console.error('[change-pin] Error:', error);
            next(error);
        }
    });

    // POST /api/auth/refresh
    router.post('/refresh', async (req: Request, res: Response, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: ERROR_CODES.INVALID_REQUEST,
                        message: 'Refresh token is required',
                        statusCode: 400,
                        category: 'validation',
                    }),
                );
            }

            const { newRefreshToken, profileId } = await refreshTokenService.rotateRefreshToken(refreshToken);

            const profile = await profileService.getProfileById(profileId);
            if (!profile) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: ERROR_CODES.PROFILE_NOT_FOUND,
                        message: 'Profile not found',
                        statusCode: 404,
                        category: 'not_found',
                    }),
                );
            }

            const { token } = issueAuthToken({
                profileId: profile.id,
                telegramId: profile.telegramId ? profile.telegramId.toString() : null,
            });

            return respondWithSuccess(res, {
                token,
                refreshToken: newRefreshToken.token,
            });
        } catch (error) {
            next(error);
        }
    });

    // POST /api/auth/logout
    router.post('/logout', async (req: Request, res: Response, next) => {
        try {
            const { refreshToken } = req.body;
            if (refreshToken) {
                await refreshTokenService.revoke(refreshToken);
                // Extract profileId from refresh token if possible, but here we might not have it decoded easily without looking it up.
                // However, logout is usually authenticated or we just revoke.
                // For simplicity, we log LOGOUT if we can.
                // Since this route might not be protected by auth middleware (it receives token in body), we can't easily guess profileId unless we decode/lookup.
                // But refreshTokenService.revoke(token) returns void.
                // Let's assume we want to log it if successful.
                // If we want profileId, we'd need to fetch it.
                // Given the constraints, maybe skip profileId for logout or enhance revoke to return it.
                // For now, let's just log "LOGOUT" without profileId if we don't have it, or rely on token lookup if implemented.
                // Actually, let's skip profileId lookup to keep it fast, or if req.profile exists?
                // This route is NOT protected by profileContextMiddleware in standard way commonly used for these kinds of endpoints?
                // routesSetup.ts says: app.use('/api', profileContextMiddleware(prisma)); so yes, it is.
                // So req.profile should be available IF the request has specific headers (x-profile-id) or Authorization,
                // BUT /logout usually just sends refreshToken.
                // Let's check profileContextMiddleware usage.
                // If req.profile is available, use it.
            }

            const profileId = (req as any).profile?.id;
            await auditService.log('LOGOUT', profileId || null, 'SUCCESS', {
                ip: req.ip,
                userAgent: req.get('user-agent'),
            });

            return respondWithSuccess(res, { message: 'Logged out' });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
