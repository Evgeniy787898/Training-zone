import api from './api';
import { AxiosResponse } from 'axios';

export interface ProgressPhoto {
    id: string;
    profileId: string;
    imageUrl: string;
    thumbnail?: string;
    capturedAt: string;
    note?: string;
    weightKg?: number;
    bodyFat?: number;
    createdAt: string;
}

export interface ProgressPhotoListResponse {
    data: ProgressPhoto[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

export interface UploadPhotoPayload {
    image: File;
    note?: string;
    weightKg?: number;
    bodyFat?: number;
    capturedAt?: string;
}

export const progressPhotoService = {
    async uploadPhoto(payload: UploadPhotoPayload): Promise<ProgressPhoto> {
        const formData = new FormData();
        formData.append('image', payload.image);
        if (payload.note) formData.append('note', payload.note);
        if (payload.weightKg) formData.append('weightKg', String(payload.weightKg));
        if (payload.bodyFat) formData.append('bodyFat', String(payload.bodyFat));
        if (payload.capturedAt) formData.append('capturedAt', payload.capturedAt);

        const response: AxiosResponse<{ data: ProgressPhoto }> = await api.post('/progress-photos', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.data;
    },

    async getPhotos(limit = 50, offset = 0): Promise<ProgressPhotoListResponse> {
        const response: AxiosResponse<ProgressPhotoListResponse> = await api.get('/progress-photos', {
            params: { limit, offset },
        });
        return response.data;
    },

    async deletePhoto(id: string): Promise<void> {
        await api.delete(`/progress-photos/${id}`);
    },
};
