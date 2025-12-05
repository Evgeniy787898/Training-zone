import type { PrismaClient } from '@prisma/client';
import { userTrainingProgramSummarySelect } from '../database/prismaSelect.js';

export class UserProgramRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findFirst(params: {
        where?: any;
        orderBy?: any;
        select?: any;
    }) {
        return this.prisma.userTrainingProgram.findFirst({
            where: params.where,
            orderBy: params.orderBy || [
                { isActive: 'desc' },
                { updatedAt: 'desc' },
            ],
            select: params.select || userTrainingProgramSummarySelect,
        });
    }

    async create(data: any) {
        return this.prisma.userTrainingProgram.create({
            data,
            select: userTrainingProgramSummarySelect,
        });
    }

    async update(id: string, data: any) {
        return this.prisma.userTrainingProgram.update({
            where: { id },
            data,
            select: userTrainingProgramSummarySelect,
        });
    }

    async findActiveByProfileId(profileId: string) {
        return this.findFirst({
            where: {
                profileId,
                NOT: { isActive: false },
            },
        });
    }

    async findLatestByProfileId(profileId: string) {
        return this.findFirst({
            where: { profileId },
        });
    }
}
