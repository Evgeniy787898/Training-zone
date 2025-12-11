import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import JSZip from 'jszip';
import { EvolutionService } from '../modules/evolution/evolutionService.js';
import { AppError } from '../services/errors.js';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';
import { logger } from '../services/logger.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB for ZIP files
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    },
});

const scanTypeSchema = z.enum(['current', 'goal']);

// Extract 3-digit number from filename (e.g., "frame_001.jpg" -> 1)
function extractFrameIndex(filename: string): number | null {
    const match = filename.match(/(\d{3})/);
    return match ? parseInt(match[1], 10) : null;
}

export function createEvolutionRouter(evolutionService: EvolutionService): Router {
    const router = Router();

    // GET /api/evolution/status - Get scan status for both types
    router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(res, new AppError({
                    statusCode: 401,
                    message: 'Unauthorized',
                    code: 'auth_required',
                    category: 'authentication'
                }));
            }

            const status = await evolutionService.getScanStatus(req.profileId);
            respondWithSuccess(res, { data: status });
        } catch (error) {
            next(error);
        }
    });

    // GET /api/evolution/:scanType - Get frames for a specific scan type
    router.get('/:scanType', async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(res, new AppError({
                    statusCode: 401,
                    message: 'Unauthorized',
                    code: 'auth_required',
                    category: 'authentication'
                }));
            }

            const parsed = scanTypeSchema.safeParse(req.params.scanType);
            if (!parsed.success) {
                return respondWithAppError(res, new AppError({
                    statusCode: 400,
                    message: 'Invalid scan type. Must be "current" or "goal"',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            const frames = await evolutionService.getFrames(req.profileId, parsed.data);
            respondWithSuccess(res, { data: { frames, count: frames.length } });
        } catch (error) {
            next(error);
        }
    });

    // POST /api/evolution/:scanType - Upload ZIP with frames
    router.post(
        '/:scanType',
        // @ts-ignore - Multer type mismatch
        upload.single('zipFile'),
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

                const parsed = scanTypeSchema.safeParse(req.params.scanType);
                if (!parsed.success) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'Invalid scan type. Must be "current" or "goal"',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                if (!req.file) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'ZIP file is required',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                // Extract ZIP
                const zip = await JSZip.loadAsync(req.file.buffer);
                const frames: Array<{ index: number; buffer: Buffer; mimeType: string }> = [];

                // Process files in ZIP
                const filePromises: Promise<void>[] = [];

                zip.forEach((relativePath, zipEntry) => {
                    // Skip directories and non-image files
                    if (zipEntry.dir) return;

                    const lowerPath = relativePath.toLowerCase();
                    if (!lowerPath.endsWith('.jpg') && !lowerPath.endsWith('.jpeg') && !lowerPath.endsWith('.png') && !lowerPath.endsWith('.webp')) {
                        return;
                    }

                    const frameIndex = extractFrameIndex(relativePath);
                    if (frameIndex === null) {
                        logger.warn(`[Evolution] Skipping file without 3-digit number: ${relativePath}`);
                        return;
                    }

                    const promise = zipEntry.async('nodebuffer').then(buffer => {
                        const ext = lowerPath.split('.').pop() || 'jpg';
                        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                        frames.push({ index: frameIndex, buffer, mimeType });
                    });

                    filePromises.push(promise);
                });

                await Promise.all(filePromises);

                if (frames.length === 0) {
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'No valid image files found in ZIP. Ensure files have 3-digit numbers in names (e.g., frame_001.jpg)',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                // Sort by frame index
                frames.sort((a, b) => a.index - b.index);

                logger.info(`[Evolution] Processing ${frames.length} frames for ${parsed.data} scan`);

                // Upload frames
                const scan = await evolutionService.uploadFrames({
                    profileId: req.profileId,
                    scanType: parsed.data,
                    frames,
                });

                respondWithSuccess(res, {
                    data: {
                        id: scan.id,
                        scanType: scan.scanType,
                        frameCount: scan.frameCount,
                    }
                }, { statusCode: 201 });
            } catch (error) {
                next(error);
            }
        }
    );

    // DELETE /api/evolution/:scanType - Delete scan and all frames
    router.delete('/:scanType', async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(res, new AppError({
                    statusCode: 401,
                    message: 'Unauthorized',
                    code: 'auth_required',
                    category: 'authentication'
                }));
            }

            const parsed = scanTypeSchema.safeParse(req.params.scanType);
            if (!parsed.success) {
                return respondWithAppError(res, new AppError({
                    statusCode: 400,
                    message: 'Invalid scan type. Must be "current" or "goal"',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            await evolutionService.deleteScan(req.profileId, parsed.data);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    return router;
}
