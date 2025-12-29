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

    // Upsert scan - create or update
    async upsertScan(data: {
        profileId: string;
        scanType: string;
        frameCount: number;
    }): Promise<Evolution360Scan> {
        return this.prisma.evolution360Scan.upsert({
            where: {
                profileId_scanType: {
                    profileId: data.profileId,
                    scanType: data.scanType
                },
            },
            create: data,
            update: { frameCount: data.frameCount },
        });
    }

    async createFrames(scanId: string, frames: Array<{ frameIndex: number; imageUrl: string }>): Promise<number> {
        // First delete any existing frames for this scan
        await this.prisma.evolution360Frame.deleteMany({
            where: { scanId }
        });

        // Then create new frames
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
