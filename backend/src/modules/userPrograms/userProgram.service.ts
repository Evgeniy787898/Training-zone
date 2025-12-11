import type { UserProgramRepository } from './userProgram.repository.js';

export class UserProgramService {
    constructor(private readonly userProgramRepository: UserProgramRepository) { }

    async getActiveProgram(profileId: string) {
        return this.userProgramRepository.findActiveByProfileId(profileId);
    }

    async getLatestProgram(profileId: string) {
        return this.userProgramRepository.findLatestByProfileId(profileId);
    }

    async createOrUpdate(
        profileId: string,
        data: {
            disciplineId: string;
            programId: string;
            initialLevels?: any;
            currentLevels?: any;
        },
    ) {
        const existing = await this.userProgramRepository.findLatestByProfileId(profileId);

        if (existing) {
            const target = Array.isArray(existing) ? existing[0] : existing;
            const targetId = (target as any)?.id;
            if (!target || typeof targetId !== 'string') return null;

            return this.userProgramRepository.update(targetId, {
                disciplineId: data.disciplineId,
                programId: data.programId,
                initialLevels: data.initialLevels ?? target.initialLevels,
                currentLevels: data.currentLevels ?? target.currentLevels ?? data.initialLevels,
                isActive: true,
                updatedAt: new Date(),
            });
        }

        return this.userProgramRepository.create({
            profileId,
            disciplineId: data.disciplineId,
            programId: data.programId,
            initialLevels: data.initialLevels ?? null,
            currentLevels: data.currentLevels ?? data.initialLevels,
            isActive: true,
        });
    }

    async createNewProgram(
        profileId: string,
        data: {
            disciplineId: string;
            programId: string;
            initialLevels?: any;
            currentLevels?: any;
        },
    ) {
        // Деактивируем существующую программу
        const existing = await this.userProgramRepository.findLatestByProfileId(profileId);
        if (existing) {
            const target = Array.isArray(existing) ? existing[0] : existing;
            const targetId = (target as any)?.id;
            if (target && typeof targetId === 'string') {
                await this.userProgramRepository.update(targetId, { isActive: false });
            }
        }

        // Создаём новую
        return this.userProgramRepository.create({
            profileId,
            disciplineId: data.disciplineId,
            programId: data.programId,
            initialLevels: data.initialLevels ?? {},
            currentLevels: data.currentLevels ?? data.initialLevels ?? {},
            isActive: true,
        });
    }

    async updateProgram(
        profileId: string,
        data: {
            disciplineId?: string;
            programId?: string;
            initialLevels?: any;
            currentLevels?: any;
        },
    ) {
        const existing = await this.userProgramRepository.findLatestByProfileId(profileId);
        if (!existing) {
            return null;
        }

        const target = Array.isArray(existing) ? existing[0] : existing;
        const targetId = (target as any)?.id;
        if (!target || typeof targetId !== 'string') return null;

        const updateData: any = { updatedAt: new Date() };
        if (data.disciplineId !== undefined) updateData.disciplineId = data.disciplineId;
        if (data.programId !== undefined) updateData.programId = data.programId;
        if (data.initialLevels !== undefined) updateData.initialLevels = data.initialLevels;
        if (data.currentLevels !== undefined) updateData.currentLevels = data.currentLevels;

        return this.userProgramRepository.update(targetId, updateData);
    }
}
