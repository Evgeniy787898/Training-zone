import { Request, Response, Router } from 'express';
import { z } from 'zod';
import {
    getCachedResource,
    setCachedResource,
    invalidateCachedResource,
} from '../modules/infrastructure/cacheStrategy.js';
import { invalidateAllUserCaches } from '../modules/infrastructure/cacheInvalidation.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { cacheConfig } from '../config/constants.js';
import { AppError } from '../services/errors.js';
import { loadProfileSummary } from '../modules/profile/profileSummary.js';
import type {
    ProfilePreferencesResponse,
    ProfileSummaryResponse,
    ThemePaletteResponse,
} from '../types/apiResponses.js';
import { isPlainObject } from '../utils/object.js';

import {
    themePaletteSchema,
    preferencesSchema,
    themePayloadSchema,
    type PreferencesPayload,
    type ThemePalette
} from '../contracts/profile.js';

const PROFILE_SUMMARY_CACHE = cacheConfig.profile.summary;

import type { ProfileService } from '../modules/profile/profile.service.js';

export function createProfileRouter(profileService: ProfileService) {
    const router = Router();

    const formatNotificationTime = (value: Date | string | null | undefined): string | null => {
        if (!value) {
            return null;
        }
        if (typeof value === 'string') {
            return value;
        }
        const iso = value.toISOString();
        const timePart = iso.split('T')[1];
        return timePart ? timePart.slice(0, 8) : iso;
    };

    const defaultThemePalette: ThemePalette = {
        accent: { r: 96, g: 165, b: 250 },
        background: { r: 5, g: 5, b: 5 },
        textPrimary: { r: 244, g: 244, b: 245 },
        textSecondary: { r: 203, g: 213, b: 245 },
    };

    const resolveStoredThemePalette = (preferences: unknown): ThemePalette => {
        if (!isPlainObject(preferences)) {
            return defaultThemePalette;
        }

        const candidate = (preferences as Record<string, unknown>).themePalette;
        const parsed = candidate ? themePaletteSchema.safeParse(candidate) : null;
        if (parsed?.success) {
            return parsed.data;
        }
        return defaultThemePalette;
    };

    // GET /api/profile/summary
    router.get('/summary', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_summary', {
                    traceId: req.traceId,
                });
            }

            const cacheParams = { profileId: req.profileId };

            const cached = await getCachedResource<ProfileSummaryResponse, 'profileSummary'>('profileSummary', cacheParams);
            if (cached) {
                const payload: ProfileSummaryResponse = { ...cached, cached: true };
                applyEdgeCacheHeaders(res, { ...PROFILE_SUMMARY_CACHE.edge, scope: 'private' });
                if (maybeRespondWithNotModified(req, res, payload)) {
                    return;
                }
                return respondWithSuccess<ProfileSummaryResponse>(res, payload, {
                    meta: req.traceId ? { traceId: req.traceId } : undefined,
                });
            }

            const summary = await loadProfileSummary(req.prisma, req.profileId);

            if (!summary) {
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
            await setCachedResource('profileSummary', cacheParams, { ...summary, cached: undefined });
            applyEdgeCacheHeaders(res, { ...PROFILE_SUMMARY_CACHE.edge, scope: 'private' });

            if (maybeRespondWithNotModified(req, res, summary)) {
                return;
            }

            return respondWithSuccess<ProfileSummaryResponse>(res, summary, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error) {
            next(error);
        }
    });

    // PATCH /api/profile - Update full profile (goals, equipment, preferences)
    const updateProfileSchema = z.object({
        goals: z.array(z.string()).optional(),
        equipment: z.array(z.string()).optional(),
        preferences: z.record(z.unknown()).optional(),
    });

    router.patch('/', validateRequest({ body: updateProfileSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(res, new AppError({
                    code: 'auth_required',
                    message: 'Profile required',
                    statusCode: 401,
                    category: 'authentication'
                }));
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_update', { traceId: req.traceId });
            }

            const payload = req.validated?.body as z.infer<typeof updateProfileSchema>;
            const updates: any = {};

            if (payload.goals) updates.goals = payload.goals;
            if (payload.equipment) updates.equipment = payload.equipment;

            // Handle preferences merge if provided
            let preferencesPatch: Record<string, unknown> | null = null;
            if (payload.preferences) {
                const existingPrefs = await profileService.getProfilePreferences(req.profileId);
                if (existingPrefs) {
                    const basePreferences = isPlainObject(existingPrefs.preferences) ? existingPrefs.preferences : {};
                    preferencesPatch = {
                        ...basePreferences,
                        ...payload.preferences,
                    };
                    updates.preferences = preferencesPatch;
                }
            }

            if (Object.keys(updates).length === 0) {
                return respondWithAppError(res, new AppError({
                    code: 'invalid_payload',
                    message: 'No data to update',
                    statusCode: 400,
                    category: 'validation'
                }));
            }

            // We need to use prisma update directly or add a method to service.
            // Since we don't have updateProfile in service yet, let's allow service access or just do it here carefully.
            // Ideally, we add `updateProfile` to `ProfileService`.
            // For now, let's use `updatePreferences` but it only takes specific args in the interface.
            // Looking at `profile.service.ts` would be better, but assuming `updatePreferences` only updates `preferences` field is risky.
            // Wait, lines 220-223 in profile.ts show usage of `profileService.updatePreferences`.
            // It passes `{ ...updates }`. So if `updatePreferences` method accepts any profile update, we are good.
            // But the name suggests otherwise.

            // Let's rely on Prisma client being available in `req.prisma` and do a quick update here?
            // No, that bypasses service logic.
            // Let's assume `profileService.updatePreferences` (or maybe `updateProfile` if it exists) can handle it.
            // Or better: Use `req.prisma.profile.update`. 
            // BUT: "Do not introduce new epics...". This is a small fix.
            // I will use `req.prisma.profile.update` directly here as a pragmatic solution to avoid refactoring service now.

            const updatedProfile = await req.prisma.profile.update({
                where: { id: req.profileId },
                data: updates,
            });

            await invalidateCachedResource('profileSummary', { profileId: req.profileId });

            const summary = await loadProfileSummary(req.prisma, req.profileId);

            return respondWithSuccess(res, summary, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error) {
            next(error);
        }
    });

    // PATCH /api/profile/preferences
    router.patch('/preferences', validateRequest({ body: preferencesSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_preferences', {
                    traceId: req.traceId,
                });
            }

            const payload = (req.validated?.body as PreferencesPayload) ?? {};

            const updates: any = {};
            let preferencesPatch: Record<string, unknown> | null = null;
            let hasChanges = false;

            if (payload.notification_time) {
                updates.notificationTime = `${payload.notification_time}:00`;
                hasChanges = true;
            }

            if (payload.timezone) {
                updates.timezone = payload.timezone;
                hasChanges = true;
            }

            if (payload.notifications_paused !== undefined) {
                updates.notificationsPaused = payload.notifications_paused;
                hasChanges = true;
            }

            if (payload.theme_palette) {
                const parsed = themePaletteSchema.parse(payload.theme_palette);
                const existingPrefs = await profileService.getProfilePreferences(req.profileId);

                if (!existingPrefs) {
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

                const basePreferences = isPlainObject(existingPrefs.preferences) ? existingPrefs.preferences : {};
                preferencesPatch = {
                    ...basePreferences,
                    themePalette: parsed,
                };
                hasChanges = true;
            }

            if (!hasChanges) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'invalid_payload',
                        message: 'Нет данных для обновления',
                        statusCode: 400,
                        category: 'validation',
                    }),
                    { traceId: req.traceId },
                );
            }

            const updatedProfile = await profileService.updatePreferences(req.profileId, {
                ...updates,
                ...(preferencesPatch ? { preferences: preferencesPatch } : {}),
            });

            await invalidateCachedResource('profileSummary', { profileId: req.profileId });

            const profilePayload: ProfilePreferencesResponse['profile'] = {
                id: updatedProfile.id,
                notificationTime: formatNotificationTime(updatedProfile.notificationTime),
                timezone: updatedProfile.timezone,
                preferences: updatedProfile.preferences,
                notificationsPaused: updatedProfile.notificationsPaused,
            };

            const responsePayload: ProfilePreferencesResponse = {
                profile: profilePayload,
                effective_at: new Date().toISOString(),
            };

            return respondWithSuccess<ProfilePreferencesResponse>(res, responsePayload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
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
            next(error);
        }
    });

    // Theme palette (GET/PUT)
    router.get('/theme', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_theme', {
                    traceId: req.traceId,
                });
            }

            const profilePrefs = await profileService.getProfilePreferences(req.profileId);

            if (!profilePrefs) {
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

            const hasStoredPalette =
                isPlainObject(profilePrefs.preferences) && 'themePalette' in (profilePrefs.preferences as Record<string, unknown>);
            const palette = resolveStoredThemePalette(profilePrefs.preferences);
            const responsePayload: ThemePaletteResponse = {
                palette,
                source: hasStoredPalette ? 'stored' : 'default',
                updated_at: null, // We don't have updatedAt from preferences-only query
            };

            return respondWithSuccess<ThemePaletteResponse>(res, responsePayload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error) {
            next(error);
        }
    });

    router.put('/theme', validateRequest({ body: themePayloadSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_theme', {
                    traceId: req.traceId,
                });
            }

            const payload = themePayloadSchema.parse(req.validated?.body ?? req.body);

            const existingPrefs = await profileService.getProfilePreferences(req.profileId);

            if (!existingPrefs) {
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

            const basePreferences = isPlainObject(existingPrefs.preferences) ? existingPrefs.preferences : {};
            const nextPreferences = {
                ...basePreferences,
                themePalette: payload.palette,
            };

            const updated = await profileService.updatePreferences(req.profileId, {
                preferences: nextPreferences,
            });

            await invalidateCachedResource('profileSummary', { profileId: req.profileId });

            const responsePayload: ThemePaletteResponse = {
                palette: payload.palette,
                source: 'stored',
                updated_at: updated.updatedAt.toISOString(),
            };

            return respondWithSuccess<ThemePaletteResponse>(res, responsePayload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
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
            next(error);
        }
    });

    // PUT /api/profile/pin - Change PIN
    const changePinSchema = z.object({
        current_pin: z.string().regex(/^\d{4,6}$/, 'PIN должен быть от 4 до 6 цифр'),
        new_pin: z.string().regex(/^\d{4,6}$/, 'PIN должен быть от 4 до 6 цифр'),
    }).refine(data => data.current_pin !== data.new_pin, {
        message: 'Новый PIN не должен совпадать с текущим',
        path: ['new_pin'],
    });

    const hashPin = (pin: string): string => {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(pin).digest('hex');
    };

    router.put('/pin', validateRequest({ body: changePinSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Требуется авторизация',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'profile_pin', {
                    traceId: req.traceId,
                });
            }

            const { current_pin, new_pin } = req.validated?.body as z.infer<typeof changePinSchema>;

            // Get current profile to verify current PIN
            const profile = await profileService.getProfileById(req.profileId);
            if (!profile) {
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

            // Verify current PIN
            const currentPinHash = hashPin(current_pin);
            if (profile.pinHash !== currentPinHash) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'invalid_pin',
                        message: 'Неверный текущий PIN',
                        statusCode: 403,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Update to new PIN
            const newPinHash = hashPin(new_pin);
            await profileService.updatePin(req.profileId, newPinHash);

            await invalidateCachedResource('profileSummary', { profileId: req.profileId });

            return respondWithSuccess(res, {
                message: 'PIN успешно изменён',
                changed_at: new Date().toISOString(),
            }, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
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
            next(error);
        }
    });

    // DELETE /api/profile/cache - Clear server-side cache (SETTINGS-003)
    router.delete('/cache', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Требуется авторизация',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            const result = await invalidateAllUserCaches(req.profileId);

            return respondWithSuccess(res, {
                message: 'Кэш успешно очищен',
                ...result,
            }, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
