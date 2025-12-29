import api from './api';

export interface Evolution360Status {
    current: boolean;
    goal: boolean;
}

export interface Evolution360Frames {
    frames: string[];
    count: number;
}

export interface FrameUploadResult {
    frameIndex: number;
    imageUrl: string;
    success: boolean;
}

export interface FinalizeScanResult {
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
     * Start a new upload session (clears old data)
     */
    async startUpload(scanType: 'current' | 'goal'): Promise<void> {
        await api.post(`/evolution/${scanType}/start`);
    }

    /**
     * Upload a single frame
     */
    async uploadFrame(
        scanType: 'current' | 'goal',
        frameIndex: number,
        arrayBuffer: ArrayBuffer,
        mimeType: string
    ): Promise<FrameUploadResult> {
        // Create File object from ArrayBuffer with proper MIME type
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const ext = mimeType.split('/')[1] || 'jpg';
        const file = new File([blob], `frame_${String(frameIndex).padStart(3, '0')}.${ext}`, { type: mimeType });

        const formData = new FormData();
        formData.append('frame', file);
        formData.append('frameIndex', String(frameIndex));

        // CRITICAL: Set Content-Type to undefined to let browser set it with boundary
        // axios instance has default Content-Type: application/json which breaks FormData
        const response = await api.post<{ data: FrameUploadResult }>(
            `/evolution/${scanType}/frame`,
            formData,
            {
                timeout: 30000,
                headers: {
                    'Content-Type': undefined as any, // Clear default Content-Type
                },
            }
        );
        return unwrapData<FrameUploadResult>(response.data);
    }

    /**
     * Finalize upload and create DB records
     */
    async finalizeScan(
        scanType: 'current' | 'goal',
        frames: Array<{ frameIndex: number; imageUrl: string }>
    ): Promise<FinalizeScanResult> {
        const response = await api.post<{ data: FinalizeScanResult }>(
            `/evolution/${scanType}/finalize`,
            { frames }
        );
        return unwrapData<FinalizeScanResult>(response.data);
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

    /**
     * Get preview (first frame) for a scan type (D6)
     */
    async getPreview(scanType: 'current' | 'goal'): Promise<string | null> {
        try {
            const response = await api.get(`/evolution/${scanType}/preview`, {
                responseType: 'blob'
            });
            return URL.createObjectURL(response.data);
        } catch {
            return null;
        }
    }

    /**
     * Upload ZIP file to server for processing
     * Server will extract images and upload to Supabase
     */
    async uploadZip(
        scanType: 'current' | 'goal',
        zipFile: File | Blob,
        onProgress?: (percent: number) => void
    ): Promise<{ scanId: string; frameCount: number; frames: string[] }> {
        const formData = new FormData();
        formData.append('file', zipFile);

        const response = await api.post<{ data: { scanId: string; frameCount: number; frames: string[] } }>(
            `/evolution/${scanType}/upload-zip`,
            formData,
            {
                timeout: 300000, // 5 minutes for large ZIPs
                headers: {
                    'Content-Type': undefined as any, // Let browser set with boundary
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percent);
                    }
                }
            }
        );

        return unwrapData<{ scanId: string; frameCount: number; frames: string[] }>(response.data);
    }
}

export const evolutionService = new EvolutionService();
