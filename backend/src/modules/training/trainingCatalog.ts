import type { SafePrismaClient } from '../../types/prisma.js';

export type TrainingDisciplineSummary = {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean | null;
};

export type TrainingProgramSummary = {
    id: string;
    name: string;
    description: string | null;
    frequency: number | null;
    restDay: string | null;
    programData: unknown;
    isActive: boolean | null;
    disciplineId: string | null;
};

export async function loadActiveTrainingDisciplines(prisma: SafePrismaClient): Promise<TrainingDisciplineSummary[]> {
    return prisma.trainingDiscipline.findMany({
        where: {
            OR: [
                { isActive: true },
                { isActive: null },
            ],
        },
        select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            isActive: true,
        },
        orderBy: { name: 'asc' },
    });
}

export async function loadTrainingPrograms(
    prisma: SafePrismaClient,
    { disciplineId }: { disciplineId?: string | null },
): Promise<TrainingProgramSummary[]> {
    const where: Record<string, unknown> = {
        OR: [
            { isActive: true },
            { isActive: null },
        ],
    };

    if (disciplineId) {
        where.disciplineId = disciplineId;
    }

    return prisma.trainingProgram.findMany({
        where,
        select: {
            id: true,
            name: true,
            description: true,
            frequency: true,
            restDay: true,
            programData: true,
            isActive: true,
            disciplineId: true,
        },
        orderBy: { name: 'asc' },
        take: 100,
    });
}
