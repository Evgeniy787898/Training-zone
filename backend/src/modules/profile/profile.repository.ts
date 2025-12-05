import type { PrismaClient, Profile } from '@prisma/client';

export class ProfileRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findById(id: string): Promise<Profile | null> {
        return this.prisma.profile.findUnique({
            where: { id },
        });
    }

    async findByTelegramId(telegramId: bigint): Promise<Profile | null> {
        return this.prisma.profile.findUnique({
            where: { telegramId },
        });
    }

    async findByPinHash(pinHash: string): Promise<Profile | null> {
        return this.prisma.profile.findFirst({
            where: { pinHash },
        });
    }

    async create(data: {
        telegramId: bigint;
        firstName?: string | null;
        lastName?: string | null;
        pinHash?: string;
        pinUpdatedAt?: Date;
    }): Promise<Profile> {
        return this.prisma.profile.create({
            data,
        });
    }

    async update(
        id: string,
        data: Partial<{
            firstName: string | null;
            lastName: string | null;
            pinHash: string;
            pinUpdatedAt: Date;
            preferences: any;
            notificationTime: Date | string;
            timezone: string;
            notificationsPaused: boolean;
        }>
    ): Promise<Profile> {
        return this.prisma.profile.update({
            where: { id },
            data: data as any, // Type assertion to handle Prisma's complex update types
        });
    }
}
