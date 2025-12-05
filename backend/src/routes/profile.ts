import { Request, Response, Router } from 'express';
import { z } from 'zod';
import {
    getCachedResource,
    setCachedResource,
    invalidateCachedResource,
} from '../modules/infrastructure/cacheStrategy.js';
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

    return router;
}
