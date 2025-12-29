import { Evolution360Scan } from '@prisma/client';
import { supabase } from '../../services/supabase.js';
import { AppError } from '../../services/errors.js';
import { EvolutionRepository } from './evolutionRepository.js';
import { logger } from '../../services/logger.js';
import JSZip from 'jszip';
import sharp from 'sharp';

export interface UploadZipPayload {
    profileId: string;
    scanType: 'current' | 'goal';
    zipBuffer: Buffer;
}

export interface UploadZipResult {
    scanId: string;
    frameCount: number;
    frames: Array<{ frameIndex: number; imageUrl: string }>;
}

export interface UploadSingleFramePayload {
    profileId: string;
    scanType: 'current' | 'goal';
    frameIndex: number;
    buffer: Buffer;
    mimeType: string;
}

export interface FinalizeScanPayload {
    profileId: string;
    scanType: 'current' | 'goal';
    frames: Array<{ frameIndex: number; imageUrl: string }>;
}

export class EvolutionService {
    private bucketName = 'evolution-360';
    private bucketReady = false;

    constructor(private repository: EvolutionRepository) { }

    /**
     * Ensure bucket exists before uploading
     */
    private async ensureBucket(): Promise<void> {
        if (this.bucketReady) return;

        try {
            const { data: buckets, error: listError } = await supabase.storage.listBuckets();

            if (listError) {
                logger.error({ err: listError }, '[Evolution] Failed to list buckets');
                // Don't throw, try to proceed anyway
                this.bucketReady = true;
                return;
            }

            const exists = buckets?.some(b => b.name === this.bucketName);

            if (!exists) {
                logger.info(`[Evolution] Creating bucket ${this.bucketName}`);
                const { error: createError } = await supabase.storage.createBucket(this.bucketName, {
                    public: true,
                    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    fileSizeLimit: 10 * 1024 * 1024,
                });

                if (createError && !createError.message.includes('already exists')) {
                    logger.error({ err: createError }, '[Evolution] Failed to create bucket');
                }
            }

            this.bucketReady = true;
            logger.info('[Evolution] Bucket ready');
        } catch (err) {
            logger.error({ err }, '[Evolution] Error ensuring bucket');
            this.bucketReady = true; // Proceed anyway
        }
    }

    /**
     * Upload a single frame to Supabase Storage
     */
    async uploadSingleFrame(payload: UploadSingleFramePayload): Promise<string> {
        const { profileId, scanType, frameIndex, buffer, mimeType } = payload;

        await this.ensureBucket();

        const ext = mimeType.split('/')[1] || 'jpg';
        const filePath = `${profileId}/${scanType}/${String(frameIndex).padStart(3, '0')}.${ext}`;

        logger.info(`[Evolution] Uploading frame ${frameIndex} to ${filePath} (${buffer.length} bytes)`);

        const { data, error: uploadError } = await supabase
            .storage
            .from(this.bucketName)
            .upload(filePath, buffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) {
            logger.error({
                err: uploadError,
                frameIndex,
                filePath,
                bufferSize: buffer.length,
                mimeType
            }, '[Evolution] Supabase upload error');

            throw new AppError({
                statusCode: 500,
                message: `Upload failed: ${uploadError.message}`,
                code: 'storage_upload_failed',
                category: 'internal',
            });
        }

        logger.info(`[Evolution] Frame ${frameIndex} uploaded successfully`);

        const { data: { publicUrl } } = supabase
            .storage
            .from(this.bucketName)
            .getPublicUrl(filePath);

        return publicUrl;
    }

    /**
     * Finalize the scan by creating DB records
     */
    async finalizeScan(payload: FinalizeScanPayload): Promise<Evolution360Scan> {
        const { profileId, scanType, frames } = payload;

        logger.info(`[Evolution] Finalizing scan for ${scanType} with ${frames.length} frames`);

        if (frames.length === 0) {
            throw new AppError({
                statusCode: 400,
                message: 'No frames to save',
                code: 'validation_error',
                category: 'validation',
            });
        }

        const sortedFrames = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);

        // Use upsert to avoid conflicts if scan already exists
        const scan = await this.repository.upsertScan({
            profileId,
            scanType,
            frameCount: sortedFrames.length,
        });

        // Create frame records (will delete old ones first)
        await this.repository.createFrames(scan.id, sortedFrames);

        logger.info(`[Evolution] Scan ${scan.id} finalized with ${sortedFrames.length} frames`);

        return scan;
    }

    async getFrames(profileId: string, scanType: string): Promise<string[]> {
        return this.repository.getFrameUrls(profileId, scanType);
    }

    async hasScan(profileId: string, scanType: string): Promise<boolean> {
        return this.repository.hasScan(profileId, scanType);
    }

    async getScanStatus(profileId: string): Promise<{ current: boolean; goal: boolean }> {
        const [current, goal] = await Promise.all([
            this.repository.hasScan(profileId, 'current'),
            this.repository.hasScan(profileId, 'goal'),
        ]);
        return { current, goal };
    }

    async deleteScan(profileId: string, scanType: string): Promise<void> {
        logger.info(`[Evolution] Deleting scan for ${scanType}`);

        // Delete ALL files in the folder (not just those in DB)
        // This ensures orphaned files are also removed
        const folderPath = `${profileId}/${scanType}/`;

        try {
            // List all files in the folder
            const { data: files, error: listError } = await supabase
                .storage
                .from(this.bucketName)
                .list(folderPath);

            if (listError) {
                logger.warn({ err: listError }, '[Evolution] Failed to list files for deletion');
            } else if (files && files.length > 0) {
                const filePaths = files.map(f => `${folderPath}${f.name}`);
                logger.info(`[Evolution] Deleting ${filePaths.length} files from storage`);

                const { error: deleteError } = await supabase
                    .storage
                    .from(this.bucketName)
                    .remove(filePaths);

                if (deleteError) {
                    logger.warn({ err: deleteError }, '[Evolution] Failed to delete files');
                }
            }
        } catch (err) {
            logger.warn({ err }, '[Evolution] Error during file cleanup');
        }

        await this.repository.deleteScan(profileId, scanType);
        logger.info(`[Evolution] Scan deleted`);
    }

    /**
     * Upload ZIP file: extract images and upload to Supabase in batches
     */
    async uploadZipFile(payload: UploadZipPayload): Promise<UploadZipResult> {
        const { profileId, scanType, zipBuffer } = payload;

        logger.info(`[Evolution] Processing ZIP upload for ${scanType}, size: ${zipBuffer.length} bytes`);

        // 1. Delete old scan if exists
        try {
            await this.deleteScan(profileId, scanType);
        } catch (err) {
            // Ignore if no scan exists
            logger.debug('[Evolution] No existing scan to delete');
        }

        // 2. Extract images from ZIP
        await this.ensureBucket();

        const zip = await JSZip.loadAsync(zipBuffer);
        const imageFiles: Array<{ name: string; index: number; file: JSZip.JSZipObject }> = [];

        // Collect image files
        zip.forEach((relativePath, file) => {
            if (file.dir) return;
            const lower = relativePath.toLowerCase();
            if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
                // Extract index from filename (001.jpg, 002.png, etc.)
                const match = relativePath.match(/(\d+)\.(jpg|jpeg|png|webp)$/i);
                const index = match ? parseInt(match[1], 10) : imageFiles.length + 1;
                imageFiles.push({ name: relativePath, index, file });
            }
        });

        if (imageFiles.length === 0) {
            throw new AppError({
                statusCode: 400,
                message: 'No images found in ZIP archive',
                code: 'validation_error',
                category: 'validation',
            });
        }

        // Sort by index
        imageFiles.sort((a, b) => a.index - b.index);

        logger.info(`[Evolution] Found ${imageFiles.length} images in ZIP`);

        // 3. Upload images in batches of 5
        const BATCH_SIZE = 5;
        const uploadedFrames: Array<{ frameIndex: number; imageUrl: string }> = [];

        for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
            const batch = imageFiles.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (img, batchIndex) => {
                    const originalBuffer = await img.file.async('nodebuffer');
                    const frameIndex = i + batchIndex + 1; // 1-based index

                    // Convert to WebP for better compression (P1)
                    let webpBuffer: Buffer;
                    try {
                        webpBuffer = await sharp(originalBuffer)
                            .webp({ quality: 80 }) // Good balance of quality and size
                            .toBuffer();

                        const savings = Math.round((1 - webpBuffer.length / originalBuffer.length) * 100);
                        logger.debug(`[Evolution] Frame ${frameIndex}: ${originalBuffer.length} -> ${webpBuffer.length} bytes (${savings}% smaller)`);
                    } catch (err) {
                        logger.warn({ err, frameIndex }, '[Evolution] WebP conversion failed, using original');
                        webpBuffer = originalBuffer;
                    }

                    const filePath = `${profileId}/${scanType}/${String(frameIndex).padStart(3, '0')}.webp`;

                    const { error: uploadError } = await supabase
                        .storage
                        .from(this.bucketName)
                        .upload(filePath, webpBuffer, {
                            contentType: 'image/webp',
                            upsert: true,
                        });

                    if (uploadError) {
                        logger.error({ err: uploadError, filePath }, '[Evolution] Upload error');
                        throw uploadError;
                    }

                    const { data: { publicUrl } } = supabase
                        .storage
                        .from(this.bucketName)
                        .getPublicUrl(filePath);

                    return { frameIndex, imageUrl: publicUrl };
                })
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    uploadedFrames.push(result.value);
                } else {
                    logger.warn({ err: result.reason }, '[Evolution] Frame upload failed');
                }
            }

            logger.info(`[Evolution] Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${uploadedFrames.length}/${imageFiles.length}`);
        }

        if (uploadedFrames.length === 0) {
            throw new AppError({
                statusCode: 500,
                message: 'Failed to upload any frames',
                code: 'storage_upload_failed',
                category: 'internal',
            });
        }

        // 4. Save to database
        const sortedFrames = [...uploadedFrames].sort((a, b) => a.frameIndex - b.frameIndex);

        const scan = await this.repository.upsertScan({
            profileId,
            scanType,
            frameCount: sortedFrames.length,
        });

        await this.repository.createFrames(scan.id, sortedFrames);

        logger.info(`[Evolution] ZIP upload complete: ${sortedFrames.length} frames saved`);

        return {
            scanId: scan.id,
            frameCount: sortedFrames.length,
            frames: sortedFrames,
        };
    }
}
