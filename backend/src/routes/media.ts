import { Router, Request, Response } from 'express';
import { z } from 'zod';
import expressRateLimit from 'express-rate-limit';

import { validateRequest } from '../middleware/validateRequest.js';
import { respondWithAppError, respondWithDatabaseUnavailable } from '../utils/apiResponses.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { imageProcessorConfig, mediaCacheConfig } from '../config/constants.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';
import { AppError } from '../services/errors.js';
import { ensureTraceId } from '../services/trace.js';
import { optimizeImageBuffer, resolveTargetImageFormat } from '../modules/integrations/imageProcessor.js';

const router = Router();

// Rate limiter for media endpoint to prevent abuse
const mediaLimiter = expressRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: 'Too many media requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
});

const exerciseLevelImageParams = z
    .object({
        exerciseKey: z.string().trim().min(1).max(64),
        level: z.string().trim().min(1).max(32),
        slot: z.enum(['1', '2', '3']),
    })
    .strict();

const positiveIntegerString = (min: number, max: number) =>
    z
        .string()
        .trim()
        .regex(/^\d+$/u, 'Must be a positive integer')
        .transform((value) => Number(value))
        .refine((value) => value >= min, { message: `Value must be >= ${min}` })
        .refine((value) => value <= max, { message: `Value must be <= ${max}` });

const dimensionQuerySchema = positiveIntegerString(
    imageProcessorConfig.limits.minDimension,
    imageProcessorConfig.limits.maxDimension,
);

const qualityQuerySchema = positiveIntegerString(
    imageProcessorConfig.limits.minQuality,
    imageProcessorConfig.limits.maxQuality,
);

const formatQuerySchema = z
    .string()
    .trim()
    .min(3)
    .max(32)
    .transform((value) => (value.startsWith('image/') ? value.toLowerCase() : `image/${value.toLowerCase()}`))
    .refine((value) => imageProcessorConfig.allowedFormats.includes(value), {
        message: 'Unsupported image format',
    });

const exerciseLevelImageQuery = z
    .object({
        maxWidth: dimensionQuerySchema.optional(),
        maxHeight: dimensionQuerySchema.optional(),
        quality: qualityQuerySchema.optional(),
        format: formatQuerySchema.optional(),
        v: z.string().optional(), // Cache busting parameter
    })
    .partial()
    .strict();

const toBuffer = (value: unknown): Buffer | null => {
    if (!value) {
        return null;
    }
    if (Buffer.isBuffer(value)) {
        return value.length ? value : null;
    }
    if (value instanceof Uint8Array) {
        return value.length ? Buffer.from(value) : null;
    }
    if (Array.isArray(value)) {
        return value.length ? Buffer.from(value) : null;
    }
    if (typeof value === 'string') {
        if (value.startsWith('data:')) {
            const base64Index = value.indexOf(',');
            if (base64Index >= 0) {
                return Buffer.from(value.slice(base64Index + 1), 'base64');
            }
        }
        if (value.startsWith('\\x')) {
            return Buffer.from(value.slice(2), 'hex');
        }
        return Buffer.from(value, 'base64');
    }
    return null;
};

const sniffMimeType = (buffer: Buffer): string => {
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return 'image/gif';
    }
    return 'application/octet-stream';
};

type ExerciseImageQuery = z.infer<typeof exerciseLevelImageQuery>;
type ExerciseLevelMediaRecord = Record<string, unknown> & { updatedAt: Date | string | null };

router.get(
    '/exercise-levels/:exerciseKey/:level/:slot',
    mediaLimiter,
    validateRequest({ params: exerciseLevelImageParams, query: exerciseLevelImageQuery }),
    async (req: Request, res: Response) => {
        if (!req.prisma) {
            return respondWithDatabaseUnavailable(res, 'media_exercise_level', {
                traceId: req.traceId,
                details: { stage: 'client_missing' },
            });
        }

        const traceId = ensureTraceId(req.traceId);
        const { exerciseKey, level, slot } = (req.validated?.params as z.infer<typeof exerciseLevelImageParams>) || {
            exerciseKey: '',
            level: '',
            slot: '1',
        };

        // Map slot to URL field name (imageUrl, imageUrl2, imageUrl3)
        const urlField = slot === '1' ? 'imageUrl' : slot === '2' ? 'imageUrl2' : 'imageUrl3';

        try {
            const levelRecord = await req.prisma.exerciseLevel.findUnique({
                where: { exerciseKey_level: { exerciseKey, level } },
                select: {
                    [urlField]: true,
                },
            });

            if (!levelRecord || !levelRecord[urlField]) {
                console.warn(`[media/exercise-levels] 404 Not Found: key=${exerciseKey}, level=${level}, slot=${slot}, field=${urlField}`);
                if (levelRecord) {
                    console.warn(`[media/exercise-levels] Record found but field empty:`, levelRecord);
                } else {
                    console.warn(`[media/exercise-levels] Record NOT found`);
                }
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'media_not_found',
                        message: 'Image not found',
                        statusCode: 404,
                        category: 'validation',
                    }),
                    { traceId },
                );
            }

            const imageUrl = (levelRecord as any)[urlField] as string;

            // Redirect to Supabase Storage URL
            res.redirect(302, imageUrl);
        } catch (error: unknown) {
            console.error('[media/exercise-levels] Error:', error);
            return respondWithDatabaseUnavailable(res, 'exercise_level_media', {
                traceId,
                details: { exerciseKey, level, slot, stage: 'database_lookup_failed' },
            });
        }
    },
);

export default router;
