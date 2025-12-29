/**
 * Music Tracks API Routes
 * 
 * Handles upload, list, and delete operations for training music
 */

import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';
import { respondAuthRequired } from '../utils/auth.js';
import { AppError } from '../services/errors.js';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

// Multer setup for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP3, WAV, OGG allowed.'));
        }
    },
});

// Supabase client for storage
const getSupabaseStorage = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
    }

    return createClient(supabaseUrl, supabaseKey);
};

const BUCKET_NAME = 'training-music';

export function createMusicRouter(prisma: PrismaClient) {
    const router = Router();

    const buildRequestMeta = (req: Request) => (req.traceId ? { traceId: req.traceId } : undefined);

    // GET /api/music/tracks - List all tracks for user
    router.get('/tracks', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const tracks = await prisma.musicTrack.findMany({
                where: { profileId: req.profileId },
                orderBy: { uploadedAt: 'desc' },
            });

            return respondWithSuccess(res, { tracks }, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // POST /api/music/tracks - Upload a new track
    router.post('/tracks', upload.single('file'), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const file = req.file;
            if (!file) {
                return respondWithAppError(res, new AppError(400, 'Файл не предоставлен'), { traceId: req.traceId });
            }

            const supabase = getSupabaseStorage();
            const fileName = `${req.profileId}/${Date.now()}-${file.originalname}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploadError) {
                console.error('[Music] Upload error:', uploadError);
                return respondWithAppError(res, new AppError(500, 'Ошибка загрузки файла'), { traceId: req.traceId });
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(uploadData.path);

            // Extract track name from filename
            const trackName = req.body.name || file.originalname.replace(/\.[^/.]+$/, '');

            // Save to database
            const track = await prisma.musicTrack.create({
                data: {
                    profileId: req.profileId,
                    name: trackName,
                    fileName: file.originalname,
                    storagePath: uploadData.path,
                    storageUrl: urlData.publicUrl,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    duration: req.body.duration ? parseInt(req.body.duration, 10) : null,
                },
            });

            return respondWithSuccess(res, { track }, { meta: buildRequestMeta(req) });
        } catch (error) {
            console.error('[Music] Upload error:', error);
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // DELETE /api/music/tracks/:id - Delete a track
    router.delete('/tracks/:id', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const trackId = req.params.id;

            // Find track
            const track = await prisma.musicTrack.findFirst({
                where: { id: trackId, profileId: req.profileId },
            });

            if (!track) {
                return respondWithAppError(res, new AppError(404, 'Трек не найден'), { traceId: req.traceId });
            }

            // Delete from storage
            try {
                const supabase = getSupabaseStorage();
                await supabase.storage.from(BUCKET_NAME).remove([track.storagePath]);
            } catch (storageError) {
                console.error('[Music] Storage delete error:', storageError);
                // Continue with DB delete even if storage fails
            }

            // Delete from database
            await prisma.musicTrack.delete({
                where: { id: trackId },
            });

            return respondWithSuccess(res, { message: 'Трек удалён' }, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    return router;
}
