import { ProgressPhoto } from '@prisma/client';
import { supabase } from '../../services/supabase.js';
import { AppError } from '../../services/errors.js';
import { ProgressPhotoRepository } from './progressPhotoRepository.js';

export interface UploadPhotoPayload {
    profileId: string;
    imageBuffer: Buffer;
    mimeType: string;
    note?: string;
    weightKg?: number;
    bodyFat?: number;
    capturedAt?: string | Date;
}

export class ProgressPhotoService {
    private bucketName = 'progress-photos';

    constructor(private repository: ProgressPhotoRepository) { }

    async uploadPhoto(payload: UploadPhotoPayload): Promise<ProgressPhoto> {
        const { profileId, imageBuffer, mimeType, note, weightKg, bodyFat, capturedAt } = payload;

        // Generate filename: profileId/timestamp.ext
        const timestamp = Date.now();
        const ext = mimeType.split('/')[1] || 'jpg';
        const filePath = `${profileId}/${timestamp}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase
            .storage
            .from(this.bucketName)
            .upload(filePath, imageBuffer, {
                contentType: mimeType,
            });

        if (uploadError) {
            console.error('[ProgressPhotos] Upload error:', uploadError);
            throw new AppError({
                statusCode: 500,
                message: 'Failed to upload image to storage',
                code: 'storage_upload_failed',
                category: 'internal'
            });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
            .storage
            .from(this.bucketName) // Fixed property name
            .getPublicUrl(filePath);

        // Create DB record
        return this.repository.create({
            profileId,
            imageUrl: publicUrl,
            weightKg,
            bodyFat,
            note,
            capturedAt: capturedAt ? new Date(capturedAt) : new Date(), // Ensure Date is passed
        });
    }

    async getPhotos(profileId: string, limit: number, offset: number) {
        // Return object with data and params for pagination consistency if needed, or just data?
        // The repository returns array. The router expects { data: [..], pagination: {..} }
        // Previous implementation had this logic. Let's restore it.
        const photos = await this.repository.findManyByProfileId(profileId, limit, offset);
        const total = await this.repository.countByProfileId(profileId);
        return { data: photos, params: { limit, offset, total } };
    }

    async deletePhoto(profileId: string, photoId: string): Promise<void> {
        const photo = await this.repository.findOne(photoId, profileId); // Fixed method name

        if (!photo) { // Removed extra profileId check since findOne includes it
            throw new AppError({
                statusCode: 404,
                message: 'Photo not found',
                code: 'not_found',
                category: 'not_found'
            });
        }

        // Delete from Storage
        const urlParts = photo.imageUrl.split(`${this.bucketName}/`);
        if (urlParts.length > 1) {
            const filePath = urlParts[1];
            const { error: deleteError } = await supabase
                .storage
                .from(this.bucketName)
                .remove([filePath]);

            if (deleteError) {
                console.warn('[ProgressPhotos] Failed to delete file:', deleteError);
                // Proceed to delete DB record anyway 
            }
        }

        await this.repository.delete(photoId);
    }
}
