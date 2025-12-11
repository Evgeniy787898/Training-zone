import type { PrismaClient, FavoriteExercise } from '@prisma/client';

export class FavoritesRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findByProfileId(profileId: string): Promise<FavoriteExercise[]> {
        return this.prisma.favoriteExercise.findMany({
            where: { profileId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findByProfileIdAndKey(profileId: string, exerciseKey: string): Promise<FavoriteExercise | null> {
        return this.prisma.favoriteExercise.findUnique({
            where: {
                profileId_exerciseKey: {
                    profileId,
                    exerciseKey,
                },
            },
        });
    }

    async add(profileId: string, exerciseKey: string): Promise<FavoriteExercise> {
        return this.prisma.favoriteExercise.upsert({
            where: {
                profileId_exerciseKey: {
                    profileId,
                    exerciseKey,
                },
            },
            create: {
                profileId,
                exerciseKey,
            },
            update: {},
        });
    }

    async remove(profileId: string, exerciseKey: string): Promise<void> {
        await this.prisma.favoriteExercise.deleteMany({
            where: {
                profileId,
                exerciseKey,
            },
        });
    }

    async getKeys(profileId: string): Promise<string[]> {
        const favorites = await this.prisma.favoriteExercise.findMany({
            where: { profileId },
            select: { exerciseKey: true },
        });
        return favorites.map(f => f.exerciseKey);
    }
}
