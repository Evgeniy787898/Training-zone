import { PrismaClient, ProgressPhoto } from '@prisma/client';

export class ProgressPhotoRepository {
    constructor(private prisma: PrismaClient) { }

    async create(data: {
        profileId: string;
        imageUrl: string;
        note?: string;
        weightKg?: number;
        bodyFat?: number;
        capturedAt: Date;
    }): Promise<ProgressPhoto> {
        return this.prisma.progressPhoto.create({
            data,
        });
    }

    async findManyByProfileId(profileId: string, limit: number, offset: number): Promise<ProgressPhoto[]> {
        return this.prisma.progressPhoto.findMany({
            where: { profileId },
            orderBy: { capturedAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }

    async countByProfileId(profileId: string): Promise<number> {
        return this.prisma.progressPhoto.count({
            where: { profileId },
        });
    }

    async findOne(photoId: string, profileId: string): Promise<ProgressPhoto | null> {
        return this.prisma.progressPhoto.findFirst({
            where: { id: photoId, profileId },
        });
    }

    async delete(photoId: string): Promise<void> {
        await this.prisma.progressPhoto.delete({
            where: { id: photoId },
        });
    }
}
