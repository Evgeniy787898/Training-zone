import { Prisma } from '@prisma/client';
import { appContainer, diTokens } from './container';
import { SafePrismaClient } from '../types/prisma';

export type LogEntity = 'TrainingSession' | 'ExerciseProgress';
export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE';

export class HistoryService {
    private get prisma(): SafePrismaClient {
        return appContainer.resolve(diTokens.prisma);
    }

    /**
     * Logs a change to the audit log.
     * @param profileId - The ID of the user performing the action.
     * @param entityType - The type of entity being changed.
     * @param entityId - The ID of the entity.
     * @param action - The action performed (CREATE, UPDATE, DELETE).
     * @param previousState - The state of the entity BEFORE the change (nullable for CREATE).
     * @param newState - The state of the entity AFTER the change (nullable for DELETE).
     */
    async logChange(
        profileId: string,
        entityType: LogEntity,
        entityId: string,
        action: LogAction,
        previousState: Record<string, any> | null,
        newState: Record<string, any> | null
    ): Promise<void> {
        try {
            await this.prisma.workoutAuditLog.create({
                data: {
                    profileId,
                    entityType,
                    entityId,
                    action,
                    previousState: previousState ? (previousState as Prisma.InputJsonValue) : Prisma.JsonNull,
                    newState: newState ? (newState as Prisma.InputJsonValue) : Prisma.JsonNull,
                },
            });
        } catch (error) {
            // Audit logging should not block the main transaction, but we should log the error
            console.error('[HistoryService] Failed to log change:', error);
        }
    }

    /**
     * Retrieves the history for a specific entity.
     */
    async getHistory(entityId: string) {
        return this.prisma.workoutAuditLog.findMany({
            where: { entityId },
            orderBy: { changedAt: 'desc' },
        });
    }
}

export const historyService = new HistoryService();
