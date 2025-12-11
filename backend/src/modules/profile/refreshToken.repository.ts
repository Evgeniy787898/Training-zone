import type { PrismaClient, RefreshToken } from '@prisma/client';

export class RefreshTokenRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async create(data: {
        token: string;
        profileId: string;
        expiresAt: Date;
    }): Promise<RefreshToken> {
        return this.prisma.refreshToken.create({
            data,
        });
    }

    async findByToken(token: string): Promise<RefreshToken | null> {
        return this.prisma.refreshToken.findUnique({
            where: { token },
        });
    }

    async findByProfileId(profileId: string): Promise<RefreshToken[]> {
        return this.prisma.refreshToken.findMany({
            where: { profileId },
        });
    }

    async revoke(token: string): Promise<RefreshToken> {
        return this.prisma.refreshToken.update({
            where: { token },
            data: { revoked: true },
        });
    }

    async revokeAllForProfile(profileId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { profileId, revoked: false },
            data: { revoked: true },
        });
    }

    async deleteExpired(): Promise<void> {
        await this.prisma.refreshToken.deleteMany({
            where: {
                expiresAt: { lte: new Date() }
            }
        });
    }
}
