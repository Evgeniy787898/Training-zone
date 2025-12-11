import { PrismaClient, Evolution360Scan, Evolution360Frame } from '@prisma/client';

export class EvolutionRepository {
    constructor(private prisma: PrismaClient) { }

    async findScan(profileId: string, scanType: string): Promise<Evolution360Scan | null> {
        return this.prisma.evolution360Scan.findUnique({
            where: {
                profileId_scanType: { profileId, scanType },
            },
        });
    }

    async findScanWithFrames(profileId: string, scanType: string): Promise<(Evolution360Scan & { frames: Evolution360Frame[] }) | null> {
        return this.prisma.evolution360Scan.findUnique({
            where: {
                profileId_scanType: { profileId, scanType },
            },
            include: {
                frames: {
                    orderBy: { frameIndex: 'asc' },
                },
            },
        });
    }

    async createScan(data: {
        profileId: string;
        scanType: string;
        frameCount: number;
    }): Promise<Evolution360Scan> {
        return this.prisma.evolution360Scan.create({
            data,
        });
    }

    async createFrames(scanId: string, frames: Array<{ frameIndex: number; imageUrl: string }>): Promise<number> {
        const result = await this.prisma.evolution360Frame.createMany({
            data: frames.map(f => ({
                scanId,
                frameIndex: f.frameIndex,
                imageUrl: f.imageUrl,
            })),
        });
        return result.count;
    }

    async deleteScan(profileId: string, scanType: string): Promise<void> {
        // Cascade delete will handle frames
        await this.prisma.evolution360Scan.deleteMany({
            where: { profileId, scanType },
        });
    }

    async getFrameUrls(profileId: string, scanType: string): Promise<string[]> {
        const scan = await this.findScanWithFrames(profileId, scanType);
        if (!scan) return [];
        return scan.frames.map((f: { imageUrl: string }) => f.imageUrl);
    }

    async hasScan(profileId: string, scanType: string): Promise<boolean> {
        const scan = await this.findScan(profileId, scanType);
        return scan !== null;
    }
}
