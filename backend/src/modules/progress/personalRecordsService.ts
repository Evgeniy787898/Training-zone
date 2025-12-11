/**
 * Personal Records Service (GAP-008)
 * 
 * Computes personal records (PRs) dynamically from TrainingSessionExercise data.
 * No schema changes required - uses existing completedSets/completedReps fields.
 */

import type { SafePrismaClient } from '../../types/prisma.js';

export interface PersonalRecord {
    exerciseKey: string;
    exerciseName?: string;
    maxVolume: number; // sets * reps
    maxSets: number;
    maxReps: number;
    achievedAt: Date;
    sessionId: string;
}

export interface PersonalRecordsSummary {
    records: PersonalRecord[];
    totalExercises: number;
}

export class PersonalRecordsService {
    constructor(private readonly prisma: SafePrismaClient) { }

    /**
     * Get personal records for a profile, optionally filtered by exercise key.
     * Returns the best (max volume = sets * reps) performance for each exercise.
     */
    async getPersonalRecords(
        profileId: string,
        exerciseKey?: string
    ): Promise<PersonalRecordsSummary> {
        // Query all completed exercises for the profile
        const whereClause: any = {
            profileId,
            completedSets: { not: null },
            completedReps: { not: null },
        };

        if (exerciseKey) {
            whereClause.exerciseKey = exerciseKey;
        }

        const exercises = await this.prisma.trainingSessionExercise.findMany({
            where: whereClause,
            select: {
                id: true,
                sessionId: true,
                exerciseKey: true,
                completedSets: true,
                completedReps: true,
                createdAt: true,
                session: {
                    select: {
                        plannedAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Group by exerciseKey and find max volume for each
        const recordsByExercise = new Map<string, PersonalRecord>();

        for (const ex of exercises) {
            const sets = ex.completedSets ?? 0;
            const reps = ex.completedReps ?? 0;
            const volume = sets * reps;

            if (volume === 0) continue;

            const existing = recordsByExercise.get(ex.exerciseKey);

            if (!existing || volume > existing.maxVolume) {
                recordsByExercise.set(ex.exerciseKey, {
                    exerciseKey: ex.exerciseKey,
                    maxVolume: volume,
                    maxSets: sets,
                    maxReps: reps,
                    achievedAt: ex.session?.plannedAt ?? ex.createdAt,
                    sessionId: ex.sessionId,
                });
            }
        }

        return {
            records: Array.from(recordsByExercise.values()),
            totalExercises: recordsByExercise.size,
        };
    }

    /**
     * Check if a new performance is a personal record.
     * Returns the PR if it's a new record, null otherwise.
     */
    async checkNewRecord(
        profileId: string,
        exerciseKey: string,
        completedSets: number,
        completedReps: number
    ): Promise<{ isNewRecord: boolean; previousBest?: number; newVolume: number }> {
        const newVolume = completedSets * completedReps;

        if (newVolume === 0) {
            return { isNewRecord: false, newVolume: 0 };
        }

        const { records } = await this.getPersonalRecords(profileId, exerciseKey);
        const currentBest = records[0]?.maxVolume ?? 0;

        return {
            isNewRecord: newVolume > currentBest,
            previousBest: currentBest > 0 ? currentBest : undefined,
            newVolume,
        };
    }
}
