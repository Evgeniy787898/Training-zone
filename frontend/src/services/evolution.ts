import api from './api';
import type { AxiosResponse } from 'axios';

export interface Evolution360Status {
    current: boolean;
    goal: boolean;
}

export interface Evolution360Frames {
    frames: string[];
    count: number;
}

export interface Evolution360UploadResult {
    id: string;
    scanType: string;
    frameCount: number;
}

// Helper to unwrap API response
const unwrapData = <T>(data: any): T => {
    if (data && typeof data === 'object' && 'data' in data) {
        return data.data as T;
    }
    return data as T;
};

class EvolutionService {
    /**
     * Get status of scans for current profile
     */
    async getStatus(): Promise<Evolution360Status> {
        const response = await api.get<{ data: Evolution360Status }>('/evolution/status');
        return unwrapData<Evolution360Status>(response.data);
    }

    /**
     * Get frames for a specific scan type
     */
    async getFrames(scanType: 'current' | 'goal'): Promise<string[]> {
        const response = await api.get<{ data: Evolution360Frames }>(`/evolution/${scanType}`);
        const data = unwrapData<Evolution360Frames>(response.data);
        return data.frames;
    }

    /**
     * Upload ZIP file with frames
     */
    async uploadZip(scanType: 'current' | 'goal', file: File): Promise<Evolution360UploadResult> {
        const formData = new FormData();
        formData.append('zipFile', file);

        const response: AxiosResponse<{ data: Evolution360UploadResult }> = await api.post(
            `/evolution/${scanType}`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 120000, // 2 min timeout for large uploads
            }
        );
        return unwrapData<Evolution360UploadResult>(response.data);
    }

    /**
     * Delete scan and all frames
     */
    async deleteScan(scanType: 'current' | 'goal'): Promise<void> {
        await api.delete(`/evolution/${scanType}`);
    }

    /**
     * Check if scan exists
     */
    async hasScan(scanType: 'current' | 'goal'): Promise<boolean> {
        try {
            const status = await this.getStatus();
            return status[scanType];
        } catch {
            return false;
        }
    }
}

export const evolutionService = new EvolutionService();

