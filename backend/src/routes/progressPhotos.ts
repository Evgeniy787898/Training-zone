import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ProgressPhotoService } from '../modules/progress/progressPhotoService.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { AppError } from '../services/errors.js';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

const uploadBodySchema = z.object({
    note: z.string().max(500).optional(),
    weightKg: z.string().transform(val => parseFloat(val)).optional(), // Multipart sends strings
    bodyFat: z.string().transform(val => parseFloat(val)).optional(),
    capturedAt: z.string().datetime().optional(),
});

const listQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(50).default(50),
    offset: z.coerce.number().min(0).default(0),
});

export function createProgressPhotosRouter(progressPhotoService: ProgressPhotoService): Router {
    const router = Router();

    router.post(
        '/',
        // @ts-ignore - Multer type mismatch
        upload.single('image'),
        validateRequest({ body: uploadBodySchema }),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                if (!req.profileId) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 401,
                        message: 'Unauthorized',
                        code: 'auth_required',
                        category: 'authentication'
                    }));
                }

                if (!req.file) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'Image file is required',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                const { note, weightKg, bodyFat, capturedAt } = req.body;
                const profileId = req.profileId;

                const photo = await progressPhotoService.uploadPhoto({
                    profileId,
                    imageBuffer: req.file.buffer,
                    mimeType: req.file.mimetype,
                    note,
                    weightKg,
                    bodyFat,
                    capturedAt,
                });

                respondWithSuccess(res, { data: photo }, {
                    meta: req.traceId ? { traceId: req.traceId } : undefined,
                    statusCode: 201
                });
            } catch (error) {
                next(error);
            }
        }
    );

    router.get(
        '/',
        validateRequest({ query: listQuerySchema }),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                if (!req.profileId) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 401,
                        message: 'Unauthorized',
                        code: 'auth_required',
                        category: 'authentication'
                    }));
                }
                const { limit, offset } = req.query;
                const result = await progressPhotoService.getPhotos(req.profileId, Number(limit), Number(offset));

                respondWithSuccess(res, {
                    data: result.data,
                    pagination: result.params
                });
            } catch (error) {
                next(error);
            }
        }
    );

    router.delete(
        '/:id',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                if (!req.profileId) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 401,
                        message: 'Unauthorized',
                        code: 'auth_required',
                        category: 'authentication'
                    }));
                }
                const { id } = req.params;
                await progressPhotoService.deletePhoto(req.profileId, id);
                res.status(204).send();
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
}
