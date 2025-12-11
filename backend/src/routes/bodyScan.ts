import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { BodyScanService } from '../modules/bodyScan/bodyScanService.js';
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

const uploadFields = upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'left', maxCount: 1 },
    { name: 'right', maxCount: 1 },
]);

const uploadBodySchema = z.object({
    heightCm: z.string().transform(val => parseFloat(val)),
    weightKg: z.string().transform(val => parseFloat(val)),
    bodyFat: z.string().transform(val => parseFloat(val)).optional(),
});

export function createBodyScanRouter(bodyScanService: BodyScanService): Router {
    const router = Router();

    router.post(
        '/',
        // @ts-ignore - multer types mismatch with express router
        uploadFields,
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

                const files = req.files as { [fieldname: string]: Express.Multer.File[] };

                if (!files?.front?.[0] || !files?.back?.[0] || !files?.left?.[0] || !files?.right?.[0]) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'All 4 angles (front, back, left, right) are required',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                const { heightCm, weightKg, bodyFat } = req.body;
                const profileId = req.profileId;

                const session = await bodyScanService.createSession({
                    profileId,
                    files: {
                        front: { buffer: files.front[0].buffer, mimetype: files.front[0].mimetype },
                        back: { buffer: files.back[0].buffer, mimetype: files.back[0].mimetype },
                        left: { buffer: files.left[0].buffer, mimetype: files.left[0].mimetype },
                        right: { buffer: files.right[0].buffer, mimetype: files.right[0].mimetype },
                    },
                    biometrics: {
                        heightCm,
                        weightKg,
                        bodyFat,
                    },
                });

                respondWithSuccess(res, { data: session }, { meta: req.traceId ? { traceId: req.traceId } : undefined });
            } catch (error) {
                next(error);
            }
        }
    );

    router.get(
        '/history',
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
                const sessions = await bodyScanService.getHistory(req.profileId);
                respondWithSuccess(res, { data: sessions });
            } catch (error) {
                next(error);
            }
        }
    );

    router.get(
        '/latest',
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
                const latest = await bodyScanService.getLatest(req.profileId);
                respondWithSuccess(res, { data: latest });
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
}
