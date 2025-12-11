import { PrismaClient, BodyScanSession } from '@prisma/client';

export class BodyScanRepository {
    constructor(private prisma: PrismaClient) { }

    async create(data: {
        profileId: string;
        frontImageUrl: string;
        backImageUrl: string;
        leftImageUrl: string;
        rightImageUrl: string;
        heightCm: number;
        weightKg: number;
        bodyFat?: number;
        analysis?: any;
    }): Promise<BodyScanSession> {
        return this.prisma.bodyScanSession.create({
            data,
        });
    }

    async findLatestByProfileId(profileId: string): Promise<BodyScanSession | null> {
        return this.prisma.bodyScanSession.findFirst({
            where: { profileId },
            orderBy: { scannedAt: 'desc' },
        });
    }

    async findManyByProfileId(profileId: string, limit: number, offset: number): Promise<BodyScanSession[]> {
        return this.prisma.bodyScanSession.findMany({
            where: { profileId },
            orderBy: { scannedAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }
}
