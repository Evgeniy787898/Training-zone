import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryService } from '../historyService';
import { diTokens } from '../container';

// Mock dependencies
const { mockPrisma, mockResolve } = vi.hoisted(() => ({
    mockPrisma: {
        workoutAuditLog: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
    },
    mockResolve: vi.fn(),
}));

vi.mock('../container', () => ({
    appContainer: {
        resolve: mockResolve,
    },
    diTokens: {
        prisma: Symbol('prisma'),
    },
}));

describe('HistoryService', () => {
    let service: HistoryService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new HistoryService();
        mockResolve.mockReturnValue(mockPrisma);
    });

    it('should log a change successfully', async () => {
        const profileId = 'test-profile';
        const entityId = 'test-entity';
        const previousState = { status: 'planned' };
        const newState = { status: 'done' };

        await service.logChange(
            profileId,
            'TrainingSession',
            entityId,
            'UPDATE',
            previousState,
            newState
        );

        expect(mockResolve).toHaveBeenCalledWith(diTokens.prisma);
        expect(mockPrisma.workoutAuditLog.create).toHaveBeenCalledWith({
            data: {
                profileId,
                entityType: 'TrainingSession',
                entityId,
                action: 'UPDATE',
                previousState,
                newState,
            },
        });
    });

    it('should log creation change (no previous state)', async () => {
        const profileId = 'test-profile';
        const entityId = 'test-entity';
        const newState = { status: 'planned' };

        await service.logChange(
            profileId,
            'TrainingSession',
            entityId,
            'CREATE',
            null,
            newState
        );

        expect(mockPrisma.workoutAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: 'CREATE',
                // JsonNull is imported from @prisma/client, but here we can check strict equality or matching
                // Since we didn't mock JsonNull values, standard behavior of simple objects might differ, 
                // but checking the call arguments is enough.
            })
        }));
    });

    it('should retrieve history', async () => {
        const entityId = 'test-entity';
        const mockLogs = [
            { id: '1', action: 'CREATE', changedAt: new Date() },
            { id: '2', action: 'UPDATE', changedAt: new Date() },
        ];
        mockPrisma.workoutAuditLog.findMany.mockResolvedValue(mockLogs);

        const result = await service.getHistory(entityId);

        expect(result).toEqual(mockLogs);
        expect(mockPrisma.workoutAuditLog.findMany).toHaveBeenCalledWith({
            where: { entityId },
            orderBy: { changedAt: 'desc' },
        });
    });

    it('should handle errors gracefully during logging', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        mockPrisma.workoutAuditLog.create.mockRejectedValue(new Error('DB Error'));

        await service.logChange('pid', 'TrainingSession', 'eid', 'DELETE', null, null);

        // Should not throw
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
