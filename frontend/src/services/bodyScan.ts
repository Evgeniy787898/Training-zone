import api from './api';
import { AxiosResponse } from 'axios';

export interface BodyScanSession {
    id: string;
    profileId: string;
    frontImageUrl: string;
    backImageUrl: string;
    leftImageUrl: string;
    rightImageUrl: string;
    heightCm: number;
    weightKg: number;
    bodyFat?: number;
    analysis?: {
        somatotype: string;
        estimatedBodyFat: number;
        postureAnalysis: string[];
        strengths: string[];
        weaknesses: string[];
        idealPhysique: {
            targetWeightKg: number;
            description: string;
            focusAreas: string[];
        };
    };
    scannedAt: string;
}

export interface UploadScanPayload {
    files: {
        front: File;
        back: File;
        left: File;
        right: File;
    };
    biometrics: {
        heightCm: number;
        weightKg: number;
        bodyFat?: number;
    };
}

export const bodyScanService = {
    async uploadScan(payload: UploadScanPayload): Promise<BodyScanSession> {
        const formData = new FormData();
        formData.append('front', payload.files.front);
        formData.append('back', payload.files.back);
        formData.append('left', payload.files.left);
        formData.append('right', payload.files.right);

        formData.append('heightCm', String(payload.biometrics.heightCm));
        formData.append('weightKg', String(payload.biometrics.weightKg));
        if (payload.biometrics.bodyFat) {
            formData.append('bodyFat', String(payload.biometrics.bodyFat));
        }

        const response: AxiosResponse<{ data: BodyScanSession }> = await api.post('/body-scan', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 60000, // Longer timeout for multiple files
        });
        return response.data.data;
    },

    async getLatest(): Promise<BodyScanSession | null> {
        const response: AxiosResponse<{ data: BodyScanSession | null }> = await api.get('/body-scan/latest');
        return response.data.data;
    },

    async getHistory(): Promise<BodyScanSession[]> {
        const response: AxiosResponse<{ data: BodyScanSession[] }> = await api.get('/body-scan/history');
        return response.data.data;
    },
};
