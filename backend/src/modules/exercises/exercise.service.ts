import type { ExerciseRepository } from './exercise.repository.js';

export class ExerciseService {
    constructor(private readonly exerciseRepository: ExerciseRepository) { }

    async getExercises(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }) {
        const [exercises, total] = await Promise.all([
            this.exerciseRepository.findManyExercises(params),
            this.exerciseRepository.countExercises(params.where),
        ]);
        return { exercises, total };
    }

    async getExerciseLevels(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }) {
        const [levels, total] = await Promise.all([
            this.exerciseRepository.findManyLevels(params),
            this.exerciseRepository.countLevels(params.where),
        ]);
        return { levels, total };
    }

    async getExerciseProgress(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }) {
        const [progress, total] = await Promise.all([
            this.exerciseRepository.findManyProgress(params),
            this.exerciseRepository.countProgress(params.where),
        ]);
        return { progress, total };
    }

    async getExercisesByProgram(programId: string, pagination: { skip: number; take: number }) {
        return this.exerciseRepository.transaction(async (prisma) => {
            const [exercises, total] = await Promise.all([
                this.exerciseRepository.findManyExercises({
                    where: { programId },
                    skip: pagination.skip,
                    take: pagination.take,
                    orderBy: { title: 'asc' },
                }),
                this.exerciseRepository.countExercises({ programId }),
            ]);
            return { exercises, total };
        });
    }

    async getExercisesByDiscipline(disciplineId: string, pagination: { skip: number; take: number }) {
        const levelWhere = {
            disciplineId,
            OR: [{ isActive: true }, { isActive: null }],
        };

        const [exerciseKeys, total] = await Promise.all([
            this.exerciseRepository.findUniqueExerciseKeys({
                where: levelWhere,
                skip: pagination.skip,
                take: pagination.take,
            }),
            this.exerciseRepository.countUniqueExerciseKeys(levelWhere),
        ]);

        if (exerciseKeys.length === 0) {
            return { exercises: [], total: 0 };
        }

        const keys = exerciseKeys.map((r: { exerciseKey: string }) => r.exerciseKey);
        const exercises = await this.exerciseRepository.findManyExercises({
            where: { exerciseKey: { in: keys } },
            orderBy: { title: 'asc' },
        });

        return { exercises, total };
    }
}
