import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../audit.service.js';
import type { PrismaClient } from '@prisma/client';

describe('AuditService', () => {
    let auditService: AuditService;
    let prismaMock: {
        sensitiveAuditLog: {
            create: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        prismaMock = {
            sensitiveAuditLog: {
                create: vi.fn(),
            },
        };
        auditService = new AuditService(prismaMock as unknown as PrismaClient);
    });

    it('should log a security event successfully', async () => {
        const eventData = {
            event: 'LOGIN_SUCCESS',
            profileId: '123',
            status: 'SUCCESS',
            context: {
                ip: '127.0.0.1',
                userAgent: 'Mozilla',
                metadata: { method: 'telegram' }
            }
        } as const;

        await auditService.log(
            eventData.event,
            eventData.profileId,
            eventData.status,
            eventData.context
        );

        expect(prismaMock.sensitiveAuditLog.create).toHaveBeenCalledWith({
            data: {
                event: 'LOGIN_SUCCESS',
                profileId: '123',
                status: 'SUCCESS',
                ip: '127.0.0.1',
                userAgent: 'Mozilla',
                metadata: { method: 'telegram' },
            },
        });
    });

    it('should handle logging failures gracefully without throwing', async () => {
        const error = new Error('DB Error');
        prismaMock.sensitiveAuditLog.create.mockRejectedValue(error);

        // Mock logger to suppress console output during test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Should not throw
        await auditService.log('LOGIN_FAILURE', null, 'FAILURE');

        expect(prismaMock.sensitiveAuditLog.create).toHaveBeenCalled();
        // We expect it to be caught and maybe logged to logger, but at least not throw.

        consoleSpy.mockRestore();
    });
});
