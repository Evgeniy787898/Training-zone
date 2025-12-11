import { BodyScanSession } from '@prisma/client';
import { supabase } from '../../services/supabase.js';
import { AppError } from '../../services/errors.js';
import { BodyScanRepository } from './bodyScanRepository.js';
import { GeminiService } from '../../services/gemini.js';

export interface UploadScanPayload {
    profileId: string;
    files: {
        front: { buffer: Buffer; mimetype: string };
        back: { buffer: Buffer; mimetype: string };
        left: { buffer: Buffer; mimetype: string };
        right: { buffer: Buffer; mimetype: string };
    };
    biometrics: {
        heightCm: number;
        weightKg: number;
        bodyFat?: number;
    };
}

export class BodyScanService {
    private bucketName = 'body-scans';

    constructor(
        private repository: BodyScanRepository,
        private geminiService: GeminiService
    ) { }

    private async uploadFile(profileId: string, timestamp: number, angle: string, file: { buffer: Buffer; mimetype: string }): Promise<string> {
        const ext = file.mimetype.split('/')[1] || 'jpg';
        const filePath = `${profileId}/${timestamp}/${angle}.${ext}`;

        const { error: uploadError } = await supabase
            .storage
            .from(this.bucketName)
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) {
            throw new AppError({
                statusCode: 500,
                message: `Failed to upload ${angle} image`,
                code: 'storage_upload_failed',
                category: 'internal'
            });
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from(this.bucketName)
            .getPublicUrl(filePath);

        return publicUrl;
    }

    async createSession(payload: UploadScanPayload): Promise<BodyScanSession> {
        const { profileId, files, biometrics } = payload;
        const timestamp = Date.now();

        // Upload all 4 photos in parallel
        const [frontUrl, backUrl, leftUrl, rightUrl] = await Promise.all([
            this.uploadFile(profileId, timestamp, 'front', files.front),
            this.uploadFile(profileId, timestamp, 'back', files.back),
            this.uploadFile(profileId, timestamp, 'left', files.left),
            this.uploadFile(profileId, timestamp, 'right', files.right),
        ]);

        // Async AI Analysis (Fire and forget, or wait? Better wait for MVP to show results immediately)
        let analysis = null;
        try {
            analysis = await this.geminiService.analyzeBodyScan(
                {
                    front: files.front.buffer,
                    back: files.back.buffer,
                    left: files.left.buffer,
                    right: files.right.buffer
                },
                {
                    heightCm: biometrics.heightCm,
                    weightKg: biometrics.weightKg
                }
            );
        } catch (e) {
            console.error('AI Analysis skipped due to error', e);
        }

        // Create DB record
        return this.repository.create({
            profileId,
            frontImageUrl: frontUrl,
            backImageUrl: backUrl,
            leftImageUrl: leftUrl,
            rightImageUrl: rightUrl,
            heightCm: biometrics.heightCm,
            weightKg: biometrics.weightKg,
            bodyFat: biometrics.bodyFat,
            analysis: analysis || undefined,
        });
    }

    async getHistory(profileId: string): Promise<BodyScanSession[]> {
        return this.repository.findManyByProfileId(profileId, 20, 0); // Limit to last 20
    }

    async getLatest(profileId: string): Promise<BodyScanSession | null> {
        return this.repository.findLatestByProfileId(profileId);
    }
}
