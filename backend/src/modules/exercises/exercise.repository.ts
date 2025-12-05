import type { PrismaClient } from '@prisma/client';
import {
    exerciseCatalogSelect,
    exerciseLevelDetailedSelect,
    exerciseProgressWithSessionSelect,
} from '../database/prismaSelect.js';

export class ExerciseRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findManyExercises(params: {
        skip?: number;
        take?: number;
        where?: any;
        select?: any;
        orderBy?: any;
    }) {
        return this.prisma.exercise.findMany({
            select: params.select || exerciseCatalogSelect,
            where: params.where,
            orderBy: params.orderBy || { exerciseKey: 'asc' },
            skip: params.skip,
            take: params.take,
        });
    }

    async countExercises(where?: any) {
        return this.prisma.exercise.count({ where });
    }

    async findManyLevels(params: {
        skip?: number;
        take?: number;
        where?: any;
        select?: any;
        orderBy?: any;
    }) {
        return this.prisma.exerciseLevel.findMany({
            select: params.select || exerciseLevelDetailedSelect,
            where: params.where,
            orderBy: params.orderBy || [
                { orderIndex: 'asc' },
                { level: 'asc' },
            ],
            skip: params.skip,
            take: params.take,
        });
    }

    async countLevels(where?: any) {
        return this.prisma.exerciseLevel.count({ where });
    }

    async findUniqueExerciseKeys(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }) {
        const delegate = this.prisma.exerciseLevel as any;
        return delegate.findMany({
            where: params.where,
            select: { exerciseKey: true },
            distinct: ['exerciseKey'],
            orderBy: params.orderBy || { exerciseKey: 'asc' },
            skip: params.skip,
            take: params.take,
        });
    }

    async countUniqueExerciseKeys(where?: any) {
        const delegate = this.prisma.exerciseLevel as any;
        return delegate.count({
            where,
            distinct: ['exerciseKey'],
        });
    }

    async findManyProgress(params: {
        skip?: number;
        take?: number;
        where?: any;
        select?: any;
        orderBy?: any;
    }) {
        return this.prisma.exerciseProgress.findMany({
            select: params.select || exerciseProgressWithSessionSelect,
            where: params.where,
            orderBy: params.orderBy || { createdAt: 'desc' },
            skip: params.skip,
            take: params.take,
        });
    }

    async countProgress(where?: any) {
        return this.prisma.exerciseProgress.count({ where });
    }

    async transaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(async (tx) => callback(tx as PrismaClient));
    }
}
