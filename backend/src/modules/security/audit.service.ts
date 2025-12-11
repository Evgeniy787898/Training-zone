import type { PrismaClient, SensitiveAuditLog } from '@prisma/client';
import { logger } from '../../services/logger.js';

export interface AuditContext {
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

export type SecurityEvent =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGOUT'
    | 'PIN_CHANGE'
    | 'PIN_VERIFY_FAILURE'
    | 'PROFILE_UPDATE'
    | 'REFRESH_TOKEN_ROTATION'
    | 'REFRESH_TOKEN_REVOKE';

export class AuditService {
    constructor(private readonly prisma: PrismaClient) { }

    /**
     * Logs a sensitive security event to the database.
     * Failures to log are caught and logged to the file logger to prevent crashing the main request flow.
     */
    async log(
        event: SecurityEvent,
        profileId: string | null,
        status: 'SUCCESS' | 'FAILURE',
        context?: AuditContext
    ): Promise<void> {
        try {
            await this.prisma.sensitiveAuditLog.create({
                data: {
                    profileId,
                    event,
                    status,
                    ip: context?.ip,
                    userAgent: context?.userAgent,
                    metadata: context?.metadata ?? {},
                },
            });
        } catch (error) {
            // Fallback to file logger if DB write fails
            logger.error({
                msg: 'Failed to write to SensitiveAuditLog',
                error,
                details: { event, profileId, status, context },
            });
        }
    }
}
