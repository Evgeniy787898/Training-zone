import { Evolution360Scan } from '@prisma/client';
import { supabase } from '../../services/supabase.js';
import { AppError } from '../../services/errors.js';
import { EvolutionRepository } from './evolutionRepository.js';
import { logger } from '../../services/logger.js';

export interface UploadFramesPayload {
    profileId: string;
    scanType: 'current' | 'goal';
    frames: Array<{
        index: number;
        buffer: Buffer;
        mimeType: string;
    }>;
}

export class EvolutionService {
    private bucketName = 'evolution-360';

    constructor(private repository: EvolutionRepository) { }

    async uploadFrames(payload: UploadFramesPayload): Promise<Evolution360Scan> {
        const { profileId, scanType, frames } = payload;

        // Delete existing scan if any
        await this.repository.deleteScan(profileId, scanType);

        // Upload frames to storage
        const uploadedFrames: Array<{ frameIndex: number; imageUrl: string }> = [];

        for (const frame of frames) {
            const ext = frame.mimeType.split('/')[1] || 'jpg';
            const filePath = `${profileId}/${scanType}/${String(frame.index).padStart(3, '0')}.${ext}`;

            const { error: uploadError } = await supabase
                .storage
                .from(this.bucketName)
                .upload(filePath, frame.buffer, {
                    contentType: frame.mimeType,
                    upsert: true,
                });

            if (uploadError) {
                logger.error({ err: uploadError }, `[Evolution] Failed to upload frame ${frame.index}`);
                throw new AppError({
                    statusCode: 500,
                    message: 'Failed to upload frame to storage',
                    code: 'storage_upload_failed',
                    category: 'internal',
                });
            }

            const { data: { publicUrl } } = supabase
                .storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            uploadedFrames.push({
                frameIndex: frame.index,
                imageUrl: publicUrl,
            });
        }

        // Create scan record
        const scan = await this.repository.createScan({
            profileId,
            scanType,
            frameCount: uploadedFrames.length,
        });

        // Create frame records
        await this.repository.createFrames(scan.id, uploadedFrames);

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
        // Get existing frames to delete from storage
        const frames = await this.repository.getFrameUrls(profileId, scanType);

        if (frames.length > 0) {
            // Extract file paths from URLs
            const filePaths = frames.map(url => {
                const parts = url.split(`${this.bucketName}/`);
                return parts.length > 1 ? parts[1] : null;
            }).filter((p): p is string => p !== null);

            if (filePaths.length > 0) {
                const { error: deleteError } = await supabase
                    .storage
                    .from(this.bucketName)
                    .remove(filePaths);

                if (deleteError) {
                    logger.warn({ err: deleteError }, '[Evolution] Failed to delete files from storage');
                }
            }
        }

        await this.repository.deleteScan(profileId, scanType);
    }
}
