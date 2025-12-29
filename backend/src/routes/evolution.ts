import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EvolutionService } from '../modules/evolution/evolutionService.js';
import { AppError } from '../services/errors.js';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';
import { logger } from '../services/logger.js';

// Multer for single image uploads (max 5MB per image)
const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per image
    },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            logger.warn(`[Evolution] Rejected file with mimetype: ${file.mimetype}`);
            cb(new Error('Only JPEG, PNG, WEBP images are allowed'));
        }
    },
});

// Multer for ZIP file uploads (max 150MB to match bodySizeDefaults)
const uploadZip = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 150 * 1024 * 1024, // 150MB max ZIP
    },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
        if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
            cb(null, true);
        } else {
            logger.warn(`[Evolution] Rejected ZIP file with mimetype: ${file.mimetype}`);
            cb(new Error('Only ZIP files are allowed'));
        }
    },
});

const scanTypeSchema = z.enum(['current', 'goal']);

export function createEvolutionRouter(evolutionService: EvolutionService): Router {
    const router = Router();

    // GET /api/evolution/status
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
            respondWithSuccess(res, status);
        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in GET /status');
            next(error);
        }
    });

    // GET /api/evolution/:scanType/preview - Get first frame as preview (D6)
    router.get('/:scanType/preview', async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.profileId) {
                return res.status(401).send('Unauthorized');
            }

            const parsed = scanTypeSchema.safeParse(req.params.scanType);
            if (!parsed.success) {
                return res.status(400).send('Invalid scan type');
            }

            // Get first frame
            const filePath = `${req.profileId}/${parsed.data}/001.webp`;

            const { supabase } = await import('../services/supabase.js');
            const { data, error } = await supabase.storage.from('evolution-360').download(filePath);

            if (error || !data) {
                // Try old format .png
                const pngPath = `${req.profileId}/${parsed.data}/001.png`;
                const { data: pngData, error: pngError } = await supabase.storage.from('evolution-360').download(pngPath);

                if (pngError || !pngData) {
                    return res.status(404).send('No preview available');
                }

                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
                const buffer = Buffer.from(await pngData.arrayBuffer());
                return res.send(buffer);
            }

            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
            const buffer = Buffer.from(await data.arrayBuffer());
            res.send(buffer);

        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in GET /:scanType/preview');
            res.status(500).send('Internal Server Error');
        }
    });

    // GET /api/evolution/proxy/:scanType/:filename - Proxy image download
    router.get('/proxy/:scanType/:filename', async (req: Request, res: Response, next: NextFunction) => {
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
                return res.status(400).send('Invalid scan type');
            }

            const filename = req.params.filename;
            if (!filename || !filename.match(/^[a-zA-Z0-9_.-]+$/)) {
                return res.status(400).send('Invalid filename');
            }

            // Stream file from Supabase - path: profileId/scanType/filename
            const filePath = `${req.profileId}/${parsed.data}/${filename}`;
            logger.info(`[Evolution] Proxy downloading: ${filePath}`);

            const { supabase } = await import('../services/supabase.js');
            const { data, error } = await supabase.storage.from('evolution-360').download(filePath);

            if (error || !data) {
                logger.warn({ err: error, filePath }, `[Evolution] Proxy failed for ${filename}`);
                return res.status(404).send('Not found');
            }

            logger.info(`[Evolution] Successfully retrieved file ${filename} for proxy. Content-Type: ${data.type}`);
            res.setHeader('Content-Type', data.type);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for a long time

            // Pipe arrayBuffer to response
            const buffer = Buffer.from(await data.arrayBuffer());
            logger.info(`[Evolution] Sending proxied file ${filename}, size: ${buffer.length} bytes`);
            res.send(buffer);

        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in GET /proxy');
            res.status(500).send('Internal Server Error');
        }
    });

    // GET /api/evolution/:scanType
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
                    message: 'Invalid scan type',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            // Get original public URLs from service
            const urls = await evolutionService.getFrames(req.profileId, parsed.data);

            // Extract filenames only
            // URL format: .../uuid/scanType/filename.ext or similar
            // We assume the service returns valid public URLs or paths.
            // We just want the last segment.
            const filenames = urls.map(url => {
                const parts = url.split('/');
                return parts[parts.length - 1]; // e.g. "001.png"
            });

            respondWithSuccess(res, {
                frames: filenames,
                count: filenames.length
            });
        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in GET /:scanType');
            next(error);
        }
    });

    // POST /api/evolution/:scanType/start
    router.post('/:scanType/start', async (req: Request, res: Response, next: NextFunction) => {
        try {
            logger.info(`[Evolution] POST /:scanType/start called`);

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
                    message: 'Invalid scan type',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            await evolutionService.deleteScan(req.profileId, parsed.data);

            logger.info(`[Evolution] Started upload session for ${parsed.data}`);
            respondWithSuccess(res, { started: true });
        } catch (error) {

            logger.error({ err: error }, '[Evolution] Error in POST /:scanType/start');
            next(error);
        }
    });

    // POST /api/evolution/:scanType/upload-zip - Upload entire ZIP file for server-side processing
    router.post(
        '/:scanType/upload-zip',
        // @ts-ignore
        uploadZip.single('file'),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                logger.info(`[Evolution] POST /:scanType/upload-zip called`);

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
                        message: 'Invalid scan type',
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

                logger.info(`[Evolution] Processing ZIP: ${req.file.originalname}, size: ${req.file.buffer.length} bytes`);

                const result = await evolutionService.uploadZipFile({
                    profileId: req.profileId,
                    scanType: parsed.data,
                    zipBuffer: req.file.buffer,
                });

                logger.info(`[Evolution] ZIP upload complete: ${result.frameCount} frames`);

                respondWithSuccess(res, {
                    scanId: result.scanId,
                    frameCount: result.frameCount,
                    frames: result.frames.map(f => f.imageUrl),
                });
            } catch (error: any) {
                logger.error({
                    err: error,
                    message: error?.message,
                    stack: error?.stack
                }, '[Evolution] Error in POST /:scanType/upload-zip');
                next(error);
            }
        }
    );

    // POST /api/evolution/:scanType/frame - Upload a single frame
    router.post(
        '/:scanType/frame',
        (req: Request, res: Response, next: NextFunction) => {
            console.log(`[Evolution DEBUG] POST /:scanType/frame called`);
            console.log(`[Evolution DEBUG] Content-Type: ${req.headers['content-type']}`);
            console.log(`[Evolution DEBUG] Body keys:`, Object.keys(req.body || {}));
            next();
        },
        // @ts-ignore
        uploadImage.single('frame'),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                console.log(`[Evolution DEBUG] After multer - file exists:`, !!req.file);
                console.log(`[Evolution DEBUG] Body after multer:`, Object.keys(req.body || {}));
                if (req.file) {
                    console.log(`[Evolution DEBUG] File info:`, {
                        fieldname: req.file.fieldname,
                        originalname: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.buffer?.length
                    });
                }
                logger.info(`[Evolution] Processing frame upload`);

                if (!req.profileId) {
                    logger.warn('[Evolution] No profileId');
                    return respondWithAppError(res, new AppError({
                        statusCode: 401,
                        message: 'Unauthorized',
                        code: 'auth_required',
                        category: 'authentication'
                    }));
                }

                const parsed = scanTypeSchema.safeParse(req.params.scanType);
                if (!parsed.success) {
                    logger.warn(`[Evolution] Invalid scanType: ${req.params.scanType}`);
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'Invalid scan type',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                if (!req.file) {
                    logger.warn('[Evolution] No file in request');
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'Image file is required',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                const frameIndex = parseInt(req.body.frameIndex, 10);
                if (isNaN(frameIndex) || frameIndex < 0 || frameIndex > 999) {
                    logger.warn(`[Evolution] Invalid frameIndex: ${req.body.frameIndex}`);
                    return respondWithAppError(res, new AppError({
                        statusCode: 400,
                        message: 'Valid frameIndex (0-999) is required',
                        code: 'validation_error',
                        category: 'validation'
                    }));
                }

                logger.info(`[Evolution] Uploading frame ${frameIndex}, file size: ${req.file.buffer.length}, mimetype: ${req.file.mimetype}`);

                const imageUrl = await evolutionService.uploadSingleFrame({
                    profileId: req.profileId,
                    scanType: parsed.data,
                    frameIndex,
                    buffer: req.file.buffer,
                    mimeType: req.file.mimetype,
                });

                logger.info(`[Evolution] Frame ${frameIndex} uploaded: ${imageUrl}`);

                respondWithSuccess(res, {
                    data: {
                        frameIndex,
                        imageUrl,
                        success: true
                    }
                });
            } catch (error: any) {
                logger.error({
                    err: error,
                    message: error?.message,
                    stack: error?.stack
                }, '[Evolution] Error in POST /:scanType/frame');
                next(error);
            }
        }
    );

    // POST /api/evolution/:scanType/finalize
    router.post('/:scanType/finalize', async (req: Request, res: Response, next: NextFunction) => {
        try {
            logger.info(`[Evolution] POST /:scanType/finalize called`);

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
                    message: 'Invalid scan type',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            const { frames } = req.body as { frames: Array<{ frameIndex: number; imageUrl: string }> };

            if (!Array.isArray(frames) || frames.length === 0) {
                return respondWithAppError(res, new AppError({
                    statusCode: 400,
                    message: 'Frames array is required',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            const scan = await evolutionService.finalizeScan({
                profileId: req.profileId,
                scanType: parsed.data,
                frames,
            });

            logger.info(`[Evolution] Finalized scan ${scan.id} with ${frames.length} frames`);

            respondWithSuccess(res, {
                data: {
                    id: scan.id,
                    scanType: scan.scanType,
                    frameCount: scan.frameCount,
                }
            }, { statusCode: 201 });
        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in POST /:scanType/finalize');
            next(error);
        }
    });

    // DELETE /api/evolution/:scanType
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
                    message: 'Invalid scan type',
                    code: 'validation_error',
                    category: 'validation'
                }));
            }

            await evolutionService.deleteScan(req.profileId, parsed.data);
            res.status(204).send();
        } catch (error) {
            logger.error({ err: error }, '[Evolution] Error in DELETE /:scanType');
            next(error);
        }
    });

    // Error handler for multer
    router.use((err: any, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof multer.MulterError) {
            logger.error({ err }, '[Evolution] Multer error');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'upload_error',
                    message: err.message
                }
            });
        }
        if (err.message?.includes('Only JPEG')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'invalid_file_type',
                    message: err.message
                }
            });
        }
        next(err);
    });

    return router;
}
